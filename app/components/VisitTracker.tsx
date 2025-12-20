"use client";

import { useEffect } from "react";
import { doc, increment, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../lib/Firebase";

function safeKey(v: string) {
    return (v || "unknown")
        .trim()
        .toLowerCase()
        .replace(/\./g, "_")
        .replace(/\//g, "_")
        .replace(/__+/g, "_");
}

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

async function getGeoClientSide() {
    try {
        const res = await fetch("https://ipapi.co/json/", { cache: "no-store" });
        if (!res.ok) throw new Error("geo failed");
        const data = await res.json();

        return {
            country: data?.country_name || data?.country || "Unknown",
            city: data?.city || "Unknown",
        };
    } catch {
        return { country: "Unknown", city: "Unknown" };
    }
}

export default function VisitTracker() {
    useEffect(() => {
        const key = "bethel_visit_tracked";
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, "1");

        (async () => {
            const day = getBrusselsDayKey();
            const { country, city } = await getGeoClientSide();

            const c = safeKey(country);
            const ci = safeKey(city);

            const cityKey = `${c}__${ci}`;

            const globalRef = doc(db, "visits", "global");
            const dayRef = doc(db, "visits", `day_${day}`);

            const inc = increment(1);

            await Promise.all([
                setDoc(
                    globalRef,
                    {
                        total: inc,
                        updatedAt: serverTimestamp(),
                        [`byCountry.${c}`]: inc,
                        [`byCity.${cityKey}`]: inc,
                    },
                    { merge: true }
                ),
                setDoc(
                    dayRef,
                    {
                        date: day,
                        total: inc,
                        updatedAt: serverTimestamp(),
                        [`byCountry.${c}`]: inc,
                        [`byCity.${cityKey}`]: inc,
                    },
                    { merge: true }
                ),
            ]);
        })().catch(() => {});
    }, []);

    return null;
}