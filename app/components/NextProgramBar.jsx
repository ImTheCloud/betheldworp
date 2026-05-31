"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../lib/Firebase";
import { useLang } from "./LanguageProvider";
import { makeT } from "../lib/i18n";
import trBar from "../translations/NextProgramBar.json";
import trProgram from "../translations/WeeklyProgram.json";
import "./NextProgramBar.css";

const PROGRAM_SLOTS = [
    { id: "mon", dayOffset: 0, defaultTime: "20:00-21:30", titleKey: "act_mon" },
    { id: "tue", dayOffset: 1, defaultTime: "20:00-21:30", titleKey: "act_tue" },
    { id: "wed", dayOffset: 2, defaultTime: "20:00-21:30", titleKey: "act_wed" },
    { id: "thu", dayOffset: 3, defaultTime: "20:00-21:30", titleKey: "act_thu" },
    { id: "fri", dayOffset: 4, defaultTime: "20:00-21:30", titleKey: "act_fri" },
    { id: "sat", dayOffset: 5, defaultTime: "11:00-13:30", titleKey: "act_sat" },
    { id: "sun_am", dayOffset: 6, defaultTime: "10:00-12:00", titleKey: "act_sun_am" },
    { id: "sun_pm", dayOffset: 6, defaultTime: "18:00-20:00", titleKey: "act_sun_pm" },
];

const safeStr = (v) => String(v ?? "");
const safeArr = (v) => (Array.isArray(v) ? v : []);
const safeObj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});

function addDaysUTC(date, days) {
    return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function getBrusselsYMD(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Brussels",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date);

    let yy = 0;
    let mm = 0;
    let dd = 0;
    parts.forEach((p) => {
        if (p.type === "year") yy = Number(p.value);
        if (p.type === "month") mm = Number(p.value);
        if (p.type === "day") dd = Number(p.value);
    });
    return { yy, mm, dd };
}

function getBrusselsDateTimeMeta(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Brussels",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).formatToParts(date);

    let yy = 0;
    let mm = 0;
    let dd = 0;
    let hh = 0;
    let min = 0;
    parts.forEach((p) => {
        if (p.type === "year") yy = Number(p.value);
        if (p.type === "month") mm = Number(p.value);
        if (p.type === "day") dd = Number(p.value);
        if (p.type === "hour") hh = Number(p.value);
        if (p.type === "minute") min = Number(p.value);
    });

    const dateNumber = yy * 10000 + mm * 100 + dd;
    return { yy, mm, dd, hh, min, dateNumber, minuteOfDay: hh * 60 + min };
}

function getBrusselsWeekRange(date = new Date()) {
    const { yy, mm, dd } = getBrusselsYMD(date);
    const noonUTC = new Date(Date.UTC(yy, mm - 1, dd, 12, 0, 0));
    const dow = noonUTC.getUTCDay();
    const mondayIndex = (dow + 6) % 7;
    const start = addDaysUTC(noonUTC, -mondayIndex);
    const end = addDaysUTC(start, 6);
    return { start, end };
}

function getISOWeekYearAndNumberUTC(dateUTC) {
    const d = new Date(Date.UTC(dateUTC.getUTCFullYear(), dateUTC.getUTCMonth(), dateUTC.getUTCDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const isoYear = d.getUTCFullYear();
    const yearStart = new Date(Date.UTC(isoYear, 0, 1));
    const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return { isoYear, week };
}

function getWeekKeyFromStart(startUTC) {
    const { isoYear, week } = getISOWeekYearAndNumberUTC(startUTC);
    return `${String(isoYear).padStart(4, "0")}-W${String(week).padStart(2, "0")}`;
}

function getLocaleFromLang(lang) {
    const l = safeStr(lang).toLowerCase();
    if (l.startsWith("fr")) return "fr-BE";
    if (l.startsWith("nl")) return "nl-BE";
    if (l.startsWith("ro")) return "ro-RO";
    return "en-GB";
}

function pickByLang(value, lang) {
    if (!value) return "";
    if (typeof value === "string") return String(value || "").trim();
    if (typeof value === "object") {
        const v = value?.[lang] ?? value?.ro ?? value?.en ?? "";
        return String(v || "").trim();
    }
    return "";
}

function normalizeDateToIso(input) {
    const v = safeStr(input).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;

    const m = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (m) {
        const dd = String(Number(m[1])).padStart(2, "0");
        const mm = String(Number(m[2])).padStart(2, "0");
        const yyyy = m[3];
        return `${yyyy}-${mm}-${dd}`;
    }
    return "";
}

function normalizeWeekOverride(docId, data) {
    const weekKey = safeStr(data?.weekKey || docId).trim().toUpperCase();
    const affectedProgramIds = safeArr(data?.affectedProgramIds).map((v) => safeStr(v).trim()).filter(Boolean);
    const replacements = safeObj(data?.replacements);
    const additions = safeObj(data?.additions);
    return { weekKey, affectedProgramIds, replacements, additions };
}

function parseTimeRange(timeValue, fallbackStart = null, fallbackEnd = null) {
    const raw = safeStr(timeValue).trim();
    if (!raw) return { start: fallbackStart, end: fallbackEnd };
    const normalized = raw.replace(/\s+/g, "");
    
    // Check for HH:MM-HH:MM
    const m = normalized.match(/(\d{1,2})[:hH](\d{2})-(\d{1,2})[:hH](\d{2})/);
    if (m) {
        const sh = Number(m[1]), sm = Number(m[2]);
        const eh = Number(m[3]), em = Number(m[4]);
        if (sh >= 0 && sh <= 23 && sm >= 0 && sm <= 59 && eh >= 0 && eh <= 23 && em >= 0 && em <= 59) {
            let endMins = eh * 60 + em;
            if (endMins < sh * 60 + sm) endMins += 24 * 60; // handles crossing midnight
            return { start: sh * 60 + sm, end: endMins };
        }
    }
    
    // Check for just HH:MM
    const startM = normalized.match(/(\d{1,2})[:hH](\d{2})/);
    if (startM) {
        const sh = Number(startM[1]), sm = Number(startM[2]);
        if (sh >= 0 && sh <= 23 && sm >= 0 && sm <= 59) {
            return { start: sh * 60 + sm, end: sh * 60 + sm + 120 }; // Default 2 hours if no end
        }
    }
    
    return { start: fallbackStart, end: fallbackEnd };
}

function brusselsDateNumber(dateObj) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Brussels",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(dateObj);

    let yy = 0;
    let mm = 0;
    let dd = 0;
    parts.forEach((p) => {
        if (p.type === "year") yy = Number(p.value);
        if (p.type === "month") mm = Number(p.value);
        if (p.type === "day") dd = Number(p.value);
    });
    return yy * 10000 + mm * 100 + dd;
}

function formatDateForBar(dateObj, lang) {
    const locale = getLocaleFromLang(lang);
    const dtf = new Intl.DateTimeFormat(locale, {
        day: "2-digit",
        month: "2-digit",
        timeZone: "Europe/Brussels",
    });
    return dtf.format(dateObj);
}

function dateLabelForBar(dateObj, nowMeta, lang, tBar) {
    const candidateDateNumber = brusselsDateNumber(dateObj);
    if (candidateDateNumber === nowMeta.dateNumber) return tBar("today");

    const brusselsTodayNoonUTC = new Date(Date.UTC(nowMeta.yy, nowMeta.mm - 1, nowMeta.dd, 12, 0, 0));
    const brusselsTomorrowNoonUTC = addDaysUTC(brusselsTodayNoonUTC, 1);
    const tomorrowDateNumber = brusselsDateNumber(brusselsTomorrowNoonUTC);
    if (candidateDateNumber === tomorrowDateNumber) return tBar("tomorrow");

    return formatDateForBar(dateObj, lang);
}

function isFutureOrNow(candidate, nowMeta) {
    if (candidate.dateNumber > nowMeta.dateNumber) return true;
    if (candidate.dateNumber < nowMeta.dateNumber) return false;
    return candidate.endMinutes > nowMeta.minuteOfDay;
}

export default function NextProgramBar() {
    const { lang } = useLang();
    const tBar = useMemo(() => makeT(trBar, lang), [lang]);
    const tProgram = useMemo(() => makeT(trProgram, lang), [lang]);

    const [tick, setTick] = useState(() => Date.now());
    const [overridesMap, setOverridesMap] = useState(new Map());
    const [eventsMap, setEventsMap] = useState(new Map());

    const titleRef = useRef(null);
    const titleWrapRef = useRef(null);
    const [isMarquee, setIsMarquee] = useState(false);

    useEffect(() => {
        const checkMarquee = () => {
            if (titleWrapRef.current && titleRef.current) {
                // If the text natural width is greater than the wrapper's clientWidth
                setIsMarquee(titleRef.current.scrollWidth - (isMarquee ? 30 : 0) > titleWrapRef.current.clientWidth);
            }
        };
        checkMarquee();
        window.addEventListener("resize", checkMarquee);
        return () => window.removeEventListener("resize", checkMarquee);
    }, [isMarquee]);

    useEffect(() => {
        const id = setInterval(() => setTick(Date.now()), 30000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        const unsub = onSnapshot(
            collection(db, "program_overrides"),
            (snap) => {
                const next = new Map();
                snap.docs.forEach((d) => {
                    const normalized = normalizeWeekOverride(d.id, d.data() || {});
                    if (normalized.weekKey) {
                        next.set(normalized.weekKey, {
                            cancelledSet: new Set(normalized.affectedProgramIds),
                            replacements: normalized.replacements,
                            additions: normalized.additions,
                        });
                    }
                });
                setOverridesMap(next);
            },
            () => setOverridesMap(new Map())
        );
        return () => unsub();
    }, []);

    useEffect(() => {
        const unsub = onSnapshot(
            collection(db, "events"),
            (snap) => {
                const next = new Map();
                snap.docs.forEach((d) => {
                    const data = d.data() || {};
                    next.set(d.id, {
                        title: pickByLang(data.title, lang),
                        time: safeStr(data.time).trim(),
                        dateEvent: normalizeDateToIso(data.dateEvent),
                    });
                });
                setEventsMap(next);
            },
            () => setEventsMap(new Map())
        );
        return () => unsub();
    }, [lang]);

    const programSlots = useMemo(() => {
        return PROGRAM_SLOTS.map((slot) => ({
            ...slot,
            title: tProgram(slot.titleKey),
        }));
    }, [tProgram]);

    const nextProgram = useMemo(() => {
        const now = new Date(tick);
        const nowMeta = getBrusselsDateTimeMeta(now);
        const candidateWeeks = [];

        for (let weekOffset = 0; weekOffset < 8; weekOffset += 1) {
            const weekAnchor = new Date(now);
            weekAnchor.setDate(weekAnchor.getDate() + weekOffset * 7);
            const { start } = getBrusselsWeekRange(weekAnchor);
            candidateWeeks.push(start);
        }

        const candidates = [];

        candidateWeeks.forEach((weekStart) => {
            const weekKey = getWeekKeyFromStart(weekStart);
            const overrideForWeek = overridesMap.get(weekKey) || {
                cancelledSet: new Set(),
                replacements: {},
                additions: {},
            };

            programSlots.forEach((slot) => {
                const slotDate = addDaysUTC(weekStart, slot.dayOffset);
                const slotDateNumber = brusselsDateNumber(slotDate);
                const defaultRange = parseTimeRange(slot.defaultTime, null, null);

                const cancelled = overrideForWeek.cancelledSet.has(slot.id);
                const replacementEventId = safeStr(overrideForWeek.replacements?.[slot.id]).trim();
                const replacementEvent = replacementEventId ? eventsMap.get(replacementEventId) : null;

                if (!cancelled) {
                    if (defaultRange.start != null) {
                        candidates.push({
                            title: slot.title,
                            timeLabel: slot.defaultTime,
                            startMinutes: defaultRange.start,
                            endMinutes: defaultRange.end,
                            dateObj: slotDate,
                            dateNumber: slotDateNumber,
                        });
                    }
                } else if (replacementEvent) {
                    const replacementRange = parseTimeRange(replacementEvent.time, defaultRange.start, defaultRange.end);
                    if (replacementRange.start != null) {
                        candidates.push({
                            title: replacementEvent.title || slot.title,
                            timeLabel: replacementEvent.time || slot.defaultTime,
                            startMinutes: replacementRange.start,
                            endMinutes: replacementRange.end,
                            dateObj: slotDate,
                            dateNumber: slotDateNumber,
                        });
                    }
                }

                const additionEventId = safeStr(overrideForWeek.additions?.[slot.id]).trim();
                const additionEvent = additionEventId ? eventsMap.get(additionEventId) : null;
                if (additionEvent) {
                    const additionRange = parseTimeRange(additionEvent.time, null, null);
                    if (additionRange.start != null) {
                        candidates.push({
                            title: additionEvent.title || slot.title,
                            timeLabel: additionEvent.time,
                            startMinutes: additionRange.start,
                            endMinutes: additionRange.end,
                            dateObj: slotDate,
                            dateNumber: slotDateNumber,
                        });
                    }
                }
            });
        });

        candidates.sort((a, b) => {
            if (a.dateNumber !== b.dateNumber) return a.dateNumber - b.dateNumber;
            return a.startMinutes - b.startMinutes;
        });

        const found = candidates.find((candidate) => isFutureOrNow(candidate, nowMeta));
        if (!found) return null;

        const isNow = found.dateNumber === nowMeta.dateNumber && nowMeta.minuteOfDay >= found.startMinutes && nowMeta.minuteOfDay < found.endMinutes;

        return {
            ...found,
            isNow,
            dateLabel: isNow ? tBar("happening_now") : dateLabelForBar(found.dateObj, nowMeta, lang, tBar),
        };
    }, [eventsMap, lang, overridesMap, programSlots, tBar, tick]);

    useEffect(() => {
        const wrap = titleWrapRef.current;
        const text = titleRef.current;
        if (!wrap || !text) return;

        let frameId;
        const check = () => {
            if (!wrap || !text) return;
            const hasMarquee = text.classList.contains("marquee");
            const naturalWidth = text.scrollWidth - (hasMarquee ? 30 : 0);
            setIsMarquee(naturalWidth > wrap.clientWidth);
        };

        const ro = new ResizeObserver(() => {
            cancelAnimationFrame(frameId);
            frameId = requestAnimationFrame(check);
        });

        ro.observe(wrap);
        ro.observe(text);
        check();

        return () => {
            ro.disconnect();
            cancelAnimationFrame(frameId);
        };
    }, [nextProgram?.title]);

    const renderContent = () => (
        <>
            {nextProgram.isNow && <span className="nextProgramBar-liveIndicator" aria-hidden="true"></span>}
            {!nextProgram.isNow && (
                <span className="nextProgramBar-prefix">
                    <span className="nextProgramBar-kicker">{tBar("next_program")}</span>
                    <span className="nextProgramBar-sep" aria-hidden="true">•</span>
                </span>
            )}
            <span className="nextProgramBar-date">{nextProgram.dateLabel}</span>
            <span className="nextProgramBar-sep" aria-hidden="true">•</span>
            <span className="nextProgramBar-time">{nextProgram.timeLabel}</span>
            {safeStr(nextProgram.title).trim() ? (
                <>
                    <span className="nextProgramBar-sep" aria-hidden="true">•</span>
                    <span className="nextProgramBar-title">{nextProgram.title}</span>
                </>
            ) : null}
        </>
    );

    return (
        <div className="nextProgramBar" role="status" aria-live="polite">
            <div ref={titleWrapRef} className={`nextProgramBar-inner ${isMarquee ? "is-marquee" : ""}`}>
                {nextProgram ? (
                    <>
                        <div ref={titleRef} className={`nextProgramBar-content ${isMarquee ? "marquee" : ""}`}>
                            {renderContent()}
                        </div>
                        {isMarquee && (
                            <div className="nextProgramBar-content marquee" aria-hidden="true">
                                {renderContent()}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="nextProgramBar-content">
                        <span className="nextProgramBar-empty">{tBar("no_program")}</span>
                    </div>
                )}
            </div>
        </div>
    );
}
