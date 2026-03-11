"use client";

import { useEffect } from "react";
import * as Tracker from "../lib/Tracker";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../lib/Firebase";

// ── Known bot User-Agent signatures ──────────────────────────────────────────
const BOT_PATTERNS = [
    /bot/i, /crawl/i, /spider/i, /slurp/i, /search/i,
    /googlebot/i, /bingbot/i, /yandex/i, /baidu/i, /duckduck/i,
    /ahrefs/i, /semrush/i, /moz\.com/i, /rogerbot/i, /dotbot/i,
    /facebookexternalhit/i, /twitterbot/i, /linkedinbot/i,
    /whatsapp/i, /telegrambot/i, /applebot/i, /petalbot/i,
    /bytespider/i, /gptbot/i, /claude-web/i, /anthropic/i,
    /ccbot/i, /dataforseo/i, /serpstat/i, /majestic/i,
    /screaming.?frog/i, /sitebulb/i, /archive\.org/i,
    /wget/i, /curl/i, /python-requests/i, /axios/i, /node-fetch/i,
    /go-http-client/i, /java\//i, /okhttp/i, /libwww/i,
    /headlesschrome/i, /phantomjs/i, /selenium/i, /puppeteer/i,
];

function isBotUserAgent() {
    try {
        const ua = navigator?.userAgent || "";
        if (!ua) return false;
        return BOT_PATTERNS.some((p) => p.test(ua));
    } catch {
        return false;
    }
}

// ── Bot tracking ──────────────────────────────────────────────────────────────
async function trackBot() {
    try {
        const visitorId = Tracker.getOrCreateVisitorIdSafe();
        const botDoneKey = `bethel_bot_done_${visitorId}`;
        if (Tracker.safeStorageGet(botDoneKey) === "1") return;

        const day = Tracker.getBrusselsDayKeySafe();
        const timeHM = Tracker.getBrusselsTimeHMSafe();
        const language = Tracker.getBrowserLanguageSafe();
        const dt = Tracker.deviceTypeSafe();

        let userAgent = "unknown";
        try { userAgent = String(navigator.userAgent || "").slice(0, 200); } catch { }

        const geo = await Tracker.getGeoClientSideRobust(900);

        const botRef = doc(db, "bot_visits", visitorId);
        await setDoc(botRef, {
            visitorId,
            day,
            timeHM,
            deviceType: dt,
            language,
            country: geo.country,
            city: geo.city,
            userAgent,
        });

        Tracker.safeStorageSet(botDoneKey, "1");
    } catch { }
}

// ── Human tracking ─────────────────────────────────────────────────────────
async function trackHuman(cancelled) {
    const day = Tracker.getBrusselsDayKeySafe();
    const timeHM = Tracker.getBrusselsTimeHMSafe();
    const visitorId = Tracker.getOrCreateVisitorIdSafe();
    const language = Tracker.getBrowserLanguageSafe();
    const dt = Tracker.deviceTypeSafe();

    const globalDoneKey = `bethel_global_done_${visitorId}`;

    if (!cancelled() && Tracker.safeStorageGet(globalDoneKey) !== "1") {
        const geo = await Tracker.getGeoClientSideRobust(900);

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
            Tracker.safeStorageSet(globalDoneKey, "1");
        } catch { }
    }

    const doneKey = `bethel_visit_done_${day}`;
    if (!cancelled() && Tracker.safeStorageGet(doneKey) === "1") return;

    const payloadKey = `bethel_visit_payload_${day}`;
    const savedKeyVal = Tracker.safeStorageGet(payloadKey);
    let saved = null;
    try { if (savedKeyVal) saved = JSON.parse(savedKeyVal); } catch { }

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
        const geo = await Tracker.getGeoClientSideRobust(900);

        payload = {
            visitorId,
            day,
            timeHM,
            deviceType: dt,
            language,
            country: geo.country,
            city: geo.city,
        };

        Tracker.safeStorageSet(payloadKey, JSON.stringify(payload));
    }

    if (cancelled()) return;

    const visitorRef = doc(db, "visits", `day_${day}`, "visitors", visitorId);

    try {
        await setDoc(visitorRef, payload);
        Tracker.safeStorageSet(doneKey, "1");
    } catch { }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function VisitTracker() {
    useEffect(() => {
        let isCancelled = false;
        const cancelled = () => isCancelled;

        (async () => {
            try {
                if (isCancelled) return;

                if (isBotUserAgent()) {
                    await trackBot();
                } else {
                    await trackHuman(cancelled);
                }
            } catch { }
        })();

        return () => {
            isCancelled = true;
        };
    }, []);

    return null;
}