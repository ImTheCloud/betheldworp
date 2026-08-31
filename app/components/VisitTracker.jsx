"use client";

import { useEffect } from "react";
import * as Tracker from "../lib/Tracker";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../lib/Firebase";

// ── Tracking ───────────────────────────────────────────────────────────────
async function trackVisit(cancelled) {
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
            if (isCancelled) return;
            try {
                await trackVisit(cancelled);
            } catch { }
        })();

        return () => {
            isCancelled = true;
        };
    }, []);

    return null;
}