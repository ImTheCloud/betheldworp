"use client";

import { useEffect } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../lib/Firebase";

const VID_KEY = "bethel_vid";

function pad2(n) {
    return String(n).padStart(2, "0");
}

function getLocalParts() {
    const d = new Date();
    return {
        y: String(d.getFullYear()),
        m: pad2(d.getMonth() + 1),
        d: pad2(d.getDate()),
        hh: pad2(d.getHours()),
        mm: pad2(d.getMinutes()),
    };
}

function getBrusselsPartsSafe() {
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
        return getLocalParts();
    }
}

function getBrusselsDayKeySafe() {
    const { d, m, y } = getBrusselsPartsSafe();
    return `${d}-${m}-${y}`;
}

function getBrusselsTimeHMSafe() {
    const { hh, mm } = getBrusselsPartsSafe();
    return `${hh}:${mm}`;
}

function deviceTypeSafe() {
    try {
        const w = window.innerWidth || 0;
        return w <= 768 ? "mobile" : "desktop";
    } catch {
        return "unknown";
    }
}

function normalizeTrackerLang(code) {
    const raw = String(code || "").trim();
    const lower = (raw || "ro").toLowerCase();
    const base = lower.split("-")[0] || "ro";
    return base.slice(0, 16) || "ro";
}

function getBrowserLanguageSafe() {
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

function safeStorageGet(key) {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function safeStorageSet(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch {}
}

function readJsonSafe(key) {
    try {
        return JSON.parse(safeStorageGet(key) || "null");
    } catch {
        return null;
    }
}

let memoryVisitorId = null;

function getOrCreateVisitorIdSafe() {
    const existing = safeStorageGet(VID_KEY);
    if (existing) return existing;

    if (memoryVisitorId) return memoryVisitorId;

    let id = null;

    try {
        if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
            id = crypto.randomUUID();
        }
    } catch {}

    if (!id) {
        id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    }

    memoryVisitorId = id;
    safeStorageSet(VID_KEY, id);
    return id;
}

function isRealPlace(s) {
    const x = String(s || "").trim();
    return x && x.toLowerCase() !== "unknown";
}

async function fetchGeo(url, mapFn, ms) {
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

            if (!isRealPlace(country) || !isRealPlace(city)) return null;
            return { country, city };
        } catch {
            return null;
        }
    })();

    return await Promise.race([req, timeout]);
}

async function getGeoClientSideRobust(ms = 900) {
    const cached = readJsonSafe("bethel_geo_last_ok");

    const geo1 = await fetchGeo(
        "https://ipapi.co/json/",
        (d) => ({ country: d?.country_name || d?.country, city: d?.city }),
        ms
    );
    if (geo1) {
        safeStorageSet("bethel_geo_last_ok", JSON.stringify(geo1));
        return geo1;
    }

    const geo2 = await fetchGeo(
        "https://ipwho.is/",
        (d) => ({ country: d?.country, city: d?.city }),
        ms
    );
    if (geo2) {
        safeStorageSet("bethel_geo_last_ok", JSON.stringify(geo2));
        return geo2;
    }

    if (cached && isRealPlace(cached.country) && isRealPlace(cached.city)) return cached;

    return { country: "Unknown", city: "Unknown" };
}

export default function VisitTracker() {
    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const day = getBrusselsDayKeySafe();
                const timeHM = getBrusselsTimeHMSafe();

                const visitorId = getOrCreateVisitorIdSafe();
                const language = getBrowserLanguageSafe();
                const dt = deviceTypeSafe();

                const globalDoneKey = `bethel_global_done_${visitorId}`;

                if (!cancelled && safeStorageGet(globalDoneKey) !== "1") {
                    const geo = await getGeoClientSideRobust(900);

                    const globalRef = doc(db, "visits_global", visitorId);
                    const globalPayload = {
                        visitorId,
                        firstDay: day,
                        firstTimeHM: timeHM,
                        deviceType: dt,
                        language,
                        country: geo.country,
                        city: geo.city,
                    };

                    try {
                        await setDoc(globalRef, globalPayload);
                        safeStorageSet(globalDoneKey, "1");
                    } catch (e) {
                        console.error("VisitTracker global write failed:", e);
                    }
                }

                const doneKey = `bethel_visit_done_${day}`;
                if (!cancelled && safeStorageGet(doneKey) === "1") return;

                const payloadKey = `bethel_visit_payload_${day}`;
                const saved = readJsonSafe(payloadKey);

                let payload = null;

                if (saved && saved.visitorId === visitorId && saved.day === day) {
                    payload = {
                        visitorId,
                        day,
                        timeHM: saved.timeHM || timeHM,
                        deviceType: saved.deviceType || dt,
                        language: saved.language || language,
                        country: saved.country || "Unknown",
                        city: saved.city || "Unknown",
                    };
                } else {
                    const geo = await getGeoClientSideRobust(900);

                    payload = {
                        visitorId,
                        day,
                        timeHM,
                        deviceType: dt,
                        language,
                        country: geo.country,
                        city: geo.city,
                    };

                    safeStorageSet(payloadKey, JSON.stringify(payload));
                }

                if (cancelled) return;

                const visitorRef = doc(db, "visits", `day_${day}`, "visitors", visitorId);

                try {
                    await setDoc(visitorRef, payload);
                } catch (e) {
                    console.error("VisitTracker day write failed:", e);
                }

                safeStorageSet(doneKey, "1");
            } catch (e) {
                console.error("VisitTracker fatal:", e);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    return null;
}