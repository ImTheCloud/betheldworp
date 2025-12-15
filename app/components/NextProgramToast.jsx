"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

    const mountedAtMs = useRef(Date.now());
    const menuOpenRef = useRef(false);
    const pendingShowRef = useRef(false);
    const showTimerRef = useRef(null);
    const hideTimerRef = useRef(null);

    const SHOW_AFTER_MS = 5000;
    const VISIBLE_MS = 10000;

    const clearTimers = () => {
        if (showTimerRef.current) clearTimeout(showTimerRef.current);
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        showTimerRef.current = null;
        hideTimerRef.current = null;
    };

    const hideNow = () => {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
        setIsVisible(false);
    };

    const showNow = () => {
        if (menuOpenRef.current) {
            pendingShowRef.current = true;
            return;
        }

        pendingShowRef.current = false;
        setIsVisible(true);

        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => setIsVisible(false), VISIBLE_MS);
    };

    useEffect(() => {
        const remaining = Math.max(0, mountedAtMs.current + SHOW_AFTER_MS - Date.now());
        showTimerRef.current = setTimeout(() => {
            if (menuOpenRef.current) {
                pendingShowRef.current = true;
                return;
            }
            showNow();
        }, remaining);

        return () => clearTimers();
    }, []);

    useEffect(() => {
        const onMenu = (e) => {
            const open = !!e?.detail?.open;
            menuOpenRef.current = open;

            if (open) {
                pendingShowRef.current = pendingShowRef.current || false;
                if (isVisible) hideNow();
                return;
            }

            if (!open && pendingShowRef.current) {
                showNow();
            }
        };

        window.addEventListener("bethel:menu", onMenu);
        return () => window.removeEventListener("bethel:menu", onMenu);
    }, [isVisible]);

    return (
        <div className={`iosToast ${isVisible ? "iosToast--show" : ""}`} role="status" aria-live="polite">
            <div className="iosToast-head">
                <div className="iosToast-title">Următorul program</div>

                <button
                    className="iosToast-close"
                    onClick={hideNow}
                    aria-label="Închide"
                    type="button"
                >
                    ×
                </button>
            </div>

            <div className="iosToast-line1">{next.title}</div>
            <div className="iosToast-line2">{next.meta}</div>
        </div>
    );
}