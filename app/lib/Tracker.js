import { doc, setDoc } from "firebase/firestore";
import { db } from "./Firebase";
import { isOptedOut, expiresAt } from "./tracking";

const VID_KEY = "bethel_vid";

export function pad2(n) {
    return String(n).padStart(2, "0");
}

export function getBrusselsPartsSafe() {
    try {
        const fmt = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Europe/Brussels",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        });

        const parts = fmt.formatToParts(new Date());
        const get = (t, fallback) => parts.find((p) => p.type === t)?.value ?? fallback;

        return {
            y: get("year", "0000"),
            m: get("month", "00"),
            d: get("day", "00"),
            hh: get("hour", "00"),
            mm: get("minute", "00"),
        };
    } catch {
        const d = new Date();
        return {
            y: String(d.getFullYear()),
            m: pad2(d.getMonth() + 1),
            d: pad2(d.getDate()),
            hh: pad2(d.getHours()),
            mm: pad2(d.getMinutes()),
        };
    }
}

export function getBrusselsDayKeySafe() {
    const { d, m, y } = getBrusselsPartsSafe();
    return `${d}-${m}-${y}`;
}

export function getBrusselsTimeHMSafe() {
    const { hh, mm } = getBrusselsPartsSafe();
    return `${hh}:${mm}`;
}

export function deviceTypeSafe() {
    try {
        const w = window.innerWidth || 0;
        return w <= 768 ? "mobile" : "desktop";
    } catch {
        return "unknown";
    }
}

export function normalizeTrackerLang(code) {
    const raw = String(code || "").trim();
    const lower = (raw || "ro").toLowerCase();
    const base = lower.split("-")[0] || "ro";
    return base.slice(0, 16) || "ro";
}

export function getBrowserLanguageSafe() {
    try {
        const first =
            (Array.isArray(navigator.languages) && navigator.languages[0]) ||
            navigator.language ||
            "ro";
        return normalizeTrackerLang(first);
    } catch {
        return "ro";
    }
}

export function safeStorageGet(key) {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

export function safeStorageSet(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch { }
}

let memoryVisitorId = null;

export function getOrCreateVisitorIdSafe() {
    const existing = safeStorageGet(VID_KEY);
    if (existing) return existing;

    if (memoryVisitorId) return memoryVisitorId;

    let id = null;

    try {
        if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
            id = crypto.randomUUID();
        }
    } catch { }

    if (!id) id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;

    memoryVisitorId = id;
    safeStorageSet(VID_KEY, id);
    return id;
}

export async function fetchGeo(url, mapFn, ms) {
    const timeout = new Promise((resolve) => setTimeout(() => resolve(null), ms));
    const req = (async () => {
        try {
            const res = await fetch(url, { cache: "no-store" });
            if (!res.ok) return null;
            const data = await res.json();
            const out = mapFn(data);
            if (!out) return null;

            const country = String(out.country || "").slice(0, 60);
            const city = String(out.city || "").slice(0, 60);
            return { country: country || "Unknown", city: city || "Unknown" };
        } catch {
            return null;
        }
    })();

    return await Promise.race([req, timeout]);
}

export async function getGeoClientSideRobust(ms = 900) {
    const cached = safeStorageGet("bethel_geo_last_ok");
    let initialGeo = null;
    try { if (cached) initialGeo = JSON.parse(cached); } catch { }

    // Résolution côté serveur : l'IP du visiteur ne part plus chez ipapi.co ni
    // ipwho.is. Vercel fournit le pays et la ville dans les en-têtes de la
    // requête, aucune donnée ne quitte l'infrastructure.
    const geo = await fetchGeo(
        "/api/geoip",
        (d) => ({ country: d?.country, city: d?.city }),
        ms
    );
    if (geo) {
        safeStorageSet("bethel_geo_last_ok", JSON.stringify(geo));
        return geo;
    }

    if (initialGeo) return initialGeo;
    return { country: "Unknown", city: "Unknown" };
}

export async function trackWorldMapVisit(geoStatus = "initial", coords = null) {
    // Verrou placé ici plutôt qu'aux quatre appels de la carte : aucun appel,
    // présent ou futur, ne peut contourner l'opposition du visiteur.
    if (isOptedOut()) return;

    try {
        const visitorId = getOrCreateVisitorIdSafe();
        const day = getBrusselsDayKeySafe();
        
        // Use a unique subcollection name for map visits
        const visitRef = doc(db, "world_map_visits", `day_${day}`, "map_visitors", visitorId);
        
        const geo = await getGeoClientSideRobust(900);
        
        const payload = {
            visitorId,
            day,
            timeHM: getBrusselsTimeHMSafe(),
            deviceType: deviceTypeSafe(),
            language: getBrowserLanguageSafe(),
            country: geo.country,
            city: geo.city,
            geoStatus, // "initial", "granted", "denied"
            timestamp: Date.now(),
            expiresAt: expiresAt()
        };

        if (coords?.lat && coords?.lng) {
            payload.preciseLat = coords.lat;
            payload.preciseLng = coords.lng;
        }
        
        await setDoc(visitRef, payload, { merge: true });
        
    } catch (e) {
        console.error("Error tracking map visit", e);
    }
}
