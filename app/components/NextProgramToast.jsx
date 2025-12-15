"use client";

import { useEffect, useMemo, useState } from "react";
import "./NextProgramToast.css";

const RO_DAYS = ["Duminică", "Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă"];

const HERO_EVENTS = [
    { id: "tue-prayer", weekday: 2, title: "Seară de rugăciune", timeText: "20:00 - 21:30", start: { h: 20, m: 0 } },
    { id: "fri-prayer", weekday: 5, title: "Seară de rugăciune", timeText: "20:00 - 21:30", start: { h: 20, m: 0 } },
    { id: "sun-morning", weekday: 0, title: "Serviciu Divin", timeText: "10:00 - 12:00", start: { h: 10, m: 0 } },
    { id: "sun-evening", weekday: 0, title: "Serviciu Divin", timeText: "18:00 - 20:00", start: { h: 18, m: 0 } },
];

function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

function nextDateForWeekdayTime(now, weekday, hour, minute) {
    const d = new Date(now);
    const nowWeekday = d.getDay();
    const delta = (weekday - nowWeekday + 7) % 7;

    d.setDate(d.getDate() + delta);
    d.setHours(hour, minute, 0, 0);

    if (delta === 0 && d.getTime() <= now.getTime()) d.setDate(d.getDate() + 7);
    return d;
}

function computeNextProgram(fromDate = new Date()) {
    const candidates = HERO_EVENTS.map((e) => {
        const start = nextDateForWeekdayTime(fromDate, e.weekday, e.start.h, e.start.m);
        return { ...e, start };
    }).sort((a, b) => a.start.getTime() - b.start.getTime());

    const next = candidates[0];
    const dayName = RO_DAYS[next.start.getDay()];

    const diffDays = Math.round(
        (startOfDay(next.start).getTime() - startOfDay(fromDate).getTime()) / 86400000
    );

    const rel = diffDays === 0 ? "Astăzi" : diffDays === 1 ? "Mâine" : dayName;

    return {
        title: next.title,
        meta: `${rel} · ${dayName} · ${next.timeText}`,
    };
}

export default function NextProgramToast() {
    const openedAt = useMemo(() => new Date(), []);
    const next = useMemo(() => computeNextProgram(openedAt), [openedAt]);

    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const showTimer = setTimeout(() => setIsVisible(true), 5000);
        const hideTimer = setTimeout(() => setIsVisible(false), 15000);

        return () => {
            clearTimeout(showTimer);
            clearTimeout(hideTimer);
        };
    }, []);

    return (
        <div className={`iosToast ${isVisible ? "iosToast--show" : ""}`} role="status" aria-live="polite">
            <div className="iosToast-head">
                <div className="iosToast-title">Următorul program</div>

                <button className="iosToast-close" onClick={() => setIsVisible(false)} aria-label="Închide">
                    ×
                </button>
            </div>

            <div className="iosToast-line1">{next.title}</div>
            <div className="iosToast-line2">{next.meta}</div>
        </div>
    );
}