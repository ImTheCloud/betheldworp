"use client";

import { useEffect } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../lib/Firebase";
import { useLang } from "./LanguageProvider";

const VID_KEY = "bethel_vid";

function getBrusselsDayKey() {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Brussels",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date());

    const y = parts.find((p) => p.type === "year")?.value ?? "0000";
    const m = parts.find((p) => p.type === "month")?.value ?? "00";
    const d = parts.find((p) => p.type === "day")?.value ?? "00";
    return `${y}-${m}-${d}`;
}

function deviceType() {
    const w = window.innerWidth || 0;
    return w <= 768 ? "mobile" : "desktop";
}

function normalizeLang(code) {
    const raw = String(code || "").trim();
    const base = (raw || "ro").toLowerCase().split("-")[0] || "ro";
    return base.slice(0, 16) || "ro";
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

function getOrCreateVisitorId() {
    const existing = safeStorageGet(VID_KEY);
    if (existing) return existing;

    if (memoryVisitorId) return memoryVisitorId;

    const id =
        (typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID()) ||
        `${Date.now()}_${Math.random().toString(16).slice(2)}`;

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
    const { lang } = useLang();

    useEffect(() => {
        const day = getBrusselsDayKey();
        const doneKey = `bethel_visit_done_${day}`;
        if (safeStorageGet(doneKey) === "1") return;

        (async () => {
            const visitorId = getOrCreateVisitorId();
            const payloadKey = `bethel_visit_payload_${day}`;
            const saved = readJsonSafe(payloadKey);

            const language = normalizeLang(lang || (typeof navigator !== "undefined" ? navigator.language : "ro") || "ro");

            let payload = null;

            if (saved && saved.visitorId === visitorId && saved.day === day) {
                payload = {
                    visitorId,
                    day,
                    deviceType: saved.deviceType || deviceType(),
                    language: saved.language || language,
                    country: saved.country || "Unknown",
                    city: saved.city || "Unknown",
                };
            } else {
                const geo = await getGeoClientSideRobust(900);

                payload = {
                    visitorId,
                    day,
                    deviceType: deviceType(),
                    language,
                    country: geo.country,
                    city: geo.city,
                };

                safeStorageSet(payloadKey, JSON.stringify(payload));
            }

            const visitorRef = doc(db, "visits", `day_${day}`, "visitors", visitorId);

            try {
                await setDoc(visitorRef, payload);
            } catch (e) {
                if (process.env.NODE_ENV !== "production") console.error("VisitTracker write failed:", e);
            }

            safeStorageSet(doneKey, "1");
        })().catch((e) => {
            if (process.env.NODE_ENV !== "production") console.error("VisitTracker fatal:", e);
        });
    }, [lang]);

    return null;
}