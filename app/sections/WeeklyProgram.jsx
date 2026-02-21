"use client";

import "./WeeklyProgram.css";
import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/Firebase";
import { useLang } from "../components/LanguageProvider";
import { makeT } from "../lib/i18n";
import tr from "../translations/WeeklyProgram.json";

const safeArr = (v) => (Array.isArray(v) ? v : []);
const safeStr = (v) => String(v ?? "");
const safeObj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});

function capFirst(s) {
    const x = safeStr(s);
    if (!x) return "";
    return x.charAt(0).toUpperCase() + x.slice(1);
}

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

    let yy = 0, mm = 0, dd = 0;
    parts.forEach((p) => {
        if (p.type === "year") yy = Number(p.value);
        if (p.type === "month") mm = Number(p.value);
        if (p.type === "day") dd = Number(p.value);
    });
    return { yy, mm, dd };
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

function getLocaleFromLang(lang) {
    const l = safeStr(lang).toLowerCase();
    if (l.startsWith("fr")) return "fr-BE";
    if (l.startsWith("nl")) return "nl-BE";
    if (l.startsWith("ro")) return "ro-RO";
    return "en-GB";
}

function formatWeekRangeLong(startUTC, endUTC, lang, t) {
    const locale = getLocaleFromLang(lang);
    const dayMonthLong = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", timeZone: "Europe/Brussels" });
    const yearLong = new Intl.DateTimeFormat(locale, { year: "numeric", timeZone: "Europe/Brussels" });

    const startPart = safeStr(dayMonthLong.format(startUTC));
    const endPart = safeStr(dayMonthLong.format(endUTC));
    const yearPart = safeStr(yearLong.format(endUTC));

    return `${startPart} — ${endPart} ${yearPart}`;
}

function formatTimeToken(token) {
    const t = safeStr(token).trim();
    const m = t.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return t;
    return `${String(Number(m[1]))}h${m[2]}`;
}

function formatRange(range) {
    const raw = safeStr(range).trim().replace(/\s+/g, "");
    const [start, end] = raw.split("-");
    if (!start || !end) return safeStr(range);
    return `${formatTimeToken(start)}-${formatTimeToken(end)}`;
}

function normalizeWeekOverride(docId, data) {
    const weekKey = safeStr(data?.weekKey || docId).trim().toUpperCase();
    const affectedProgramIds = safeArr(data?.affectedProgramIds).map((v) => safeStr(v).trim()).filter(Boolean);
    const replacements = safeObj(data?.replacements);
    const additions = safeObj(data?.additions);
    return { weekKey, affectedProgramIds, replacements, additions };
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

function formatBrusselsDDMM(dateObj) {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Brussels", day: "2-digit", month: "2-digit" }).formatToParts(dateObj);
    let dd = "00", mm = "00";
    parts.forEach((p) => {
        if (p.type === "day") dd = p.value;
        if (p.type === "month") mm = p.value;
    });
    return `${dd}/${mm}`;
}

function formatBrusselsDDMMYYYY(dateObj) {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Brussels", day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(dateObj);
    let dd = "00", mm = "00", yy = "0000";
    parts.forEach((p) => {
        if (p.type === "day") dd = p.value;
        if (p.type === "month") mm = p.value;
        if (p.type === "year") yy = p.value;
    });
    return `${dd}/${mm}/${yy}`;
}

export default function Program() {
    const { lang } = useLang();
    const t = useMemo(() => makeT(tr, lang), [lang]);

    const LOCAL_PROGRAM_ITEMS = useMemo(() => [
        { day: t("day_mon"), id: "mon", times: ["20:00-21:30"], title: t("act_mon") },
        { day: t("day_tue"), id: "tue", times: ["20:00-21:30"], title: t("act_tue") },
        { day: t("day_wed"), id: "wed", times: ["20:00-21:30"], title: t("act_wed") },
        { day: t("day_thu"), id: "thu", times: ["20:00-21:30"], title: t("act_thu") },
        { day: t("day_fri"), id: "fri", times: ["20:00-21:30"], title: t("act_fri") },
        { day: t("day_sat"), id: "sat", times: ["11:00-13:30"], title: t("act_sat") },
        { day: t("day_sun"), id: "sun_am", times: ["10:00-12:00"], title: t("act_sun_am") },
        { day: t("day_sun"), id: "sun_pm", times: ["18:00-20:00"], title: t("act_sun_pm") },
    ], [t]);

    const [weekOffset, setWeekOffset] = useState(0);

    const weekInfo = useMemo(() => {
        const base = new Date();
        base.setDate(base.getDate() + weekOffset * 7);
        const { start, end } = getBrusselsWeekRange(base);
        const { isoYear, week } = getISOWeekYearAndNumberUTC(start);
        const weekKey = `${String(isoYear).padStart(4, "0")}-W${String(week).padStart(2, "0")}`;
        const rangeLong = formatWeekRangeLong(start, end, lang, t);
        const weekLabel = t("week_label").replace("{n}", week);
        return { start, weekKey, rangeLong, weekLabel };
    }, [lang, t, weekOffset]);

    const goPrev = () => setWeekOffset((o) => o - 1);
    const goNext = () => setWeekOffset((o) => o + 1);
    const goToday = () => setWeekOffset(0);


    const dayIdToIndex = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun_am: 6, sun_pm: 6 };

    const dateMetaById = useMemo(() => {
        const byId = {};
        Object.entries(dayIdToIndex).forEach(([id, dayIndex]) => {
            const d = addDaysUTC(weekInfo.start, dayIndex);
            byId[id] = {
                dm: formatBrusselsDDMM(d),
                full: formatBrusselsDDMMYYYY(d),
            };
        });
        return byId;
    }, [weekInfo.start]);

    const [ovDoc, setOvDoc] = useState(null);

    useEffect(() => {
        const ref = doc(db, "program_overrides", weekInfo.weekKey);
        const unsub = onSnapshot(ref,
            (snap) => setOvDoc(snap.exists() ? { id: snap.id, data: snap.data() } : null),
            () => setOvDoc(null)
        );
        return () => unsub();
    }, [weekInfo.weekKey]);

    const overrideData = useMemo(() => {
        if (!ovDoc) return { cancelledSet: new Set(), replacements: {}, additions: {} };
        const o = normalizeWeekOverride(ovDoc.id, ovDoc.data);
        return { cancelledSet: new Set(o.affectedProgramIds), replacements: o.replacements, additions: o.additions };
    }, [ovDoc]);

    const { cancelledSet, replacements, additions } = overrideData;

    // ── Events data for replacement & addition display ──
    const [eventsMap, setEventsMap] = useState(new Map());

    // Fetch events if we have replacements OR additions
    const hasLinkedEvents = useMemo(() => {
        const replKeys = Object.keys(replacements).filter((k) => !!replacements[k]);
        const addKeys = Object.keys(additions).filter((k) => !!additions[k]);
        return replKeys.length > 0 || addKeys.length > 0;
    }, [replacements, additions]);

    useEffect(() => {
        if (!hasLinkedEvents) {
            setEventsMap(new Map());
            return;
        }
        const unsub = onSnapshot(
            collection(db, "events"),
            (snap) => {
                const m = new Map();
                snap.docs.forEach((d) => {
                    const data = d.data() || {};
                    m.set(d.id, {
                        title: pickByLang(data.title, lang),
                        time: safeStr(data.time).trim(),
                    });
                });
                setEventsMap(m);
            },
            () => setEventsMap(new Map())
        );
        return () => unsub();
    }, [hasLinkedEvents, lang]);

    return (
        <section id="program" className="program-section">
            <div className="program-content">
                <div className="program-header">
                    <h2 className="program-title">{t("title")}</h2>
                    <div className="program-weekNav">
                        <button type="button" className="program-weekNavBtn" onClick={goPrev} aria-label="Previous week">‹</button>
                        <div className="program-navText">
                            <div className="program-subtitle">{weekInfo.rangeLong}</div>
                        </div>
                        <button type="button" className="program-weekNavBtn" onClick={goNext} aria-label="Next week">›</button>
                    </div>
                </div>

                {(() => {
                    const linkedCount = Object.keys(replacements).length + Object.keys(additions).length;
                    if (!linkedCount) return null;
                    const hintKey = linkedCount === 1 ? "clickable_hint_one" : "clickable_hint_many";
                    const hintText = t(hintKey).replace("{n}", linkedCount);
                    return (
                        <div className="program-clickableBanner">
                            <span className="program-clickableBannerIcon">↗</span>
                            {hintText}
                        </div>
                    );
                })()}

                <div className="program-grid">
                    {LOCAL_PROGRAM_ITEMS.map((item, idx) => {
                        const id = safeStr(item?.id || `day-${idx}`).trim();
                        const times = safeArr(item?.times);
                        const isCancelled = cancelledSet.has(id);
                        const replacementEventId = safeStr(replacements[id]).trim();
                        const replacementEvent = replacementEventId ? eventsMap.get(replacementEventId) : null;
                        const isReplaced = isCancelled && !!replacementEvent;


                        let statusClass = "program-card--normal";
                        if (isReplaced) statusClass = "program-card--replaced";
                        else if (isCancelled) statusClass = "program-card--cancelled";

                        const dm = safeStr(dateMetaById?.[id]?.dm || "");
                        const full = safeStr(dateMetaById?.[id]?.full || "");

                        const displayTitle = isReplaced ? replacementEvent.title : item?.title;
                        const displayTime = isReplaced && replacementEvent.time ? replacementEvent.time : null;

                        const cleanedTimes = times.map((x) => safeStr(x).trim()).filter(Boolean);
                        const defaultTimeLabel = cleanedTimes.length ? formatRange(cleanedTimes[0]) + (cleanedTimes.length > 1 ? " +" : "") : "";
                        const timeLabel = isReplaced && displayTime ? displayTime : defaultTimeLabel;

                        const additionEventId = safeStr(additions[id]).trim();
                        const additionEvent = additionEventId ? eventsMap.get(additionEventId) : null;

                        return (
                            <React.Fragment key={id}>
                                <article
                                    className={`program-card ${statusClass}${isReplaced ? " program-card--clickable" : ""}`}
                                    onClick={isReplaced ? () => window.dispatchEvent(new CustomEvent("open-event", { detail: { eventId: replacementEventId } })) : undefined}
                                >
                                    <div className="program-cardInnerFlat">
                                        <div className="program-cardTop">
                                            <div className="program-day">{item?.day}</div>
                                            {isReplaced && <div className="program-statusPill program-statusPill--replaced">{t("status_replaced")}</div>}
                                            {isCancelled && !isReplaced && <div className="program-statusPill program-statusPill--cancelled">{t("status_cancelled")}</div>}
                                        </div>
                                        <div className="program-activity">{displayTitle}</div>
                                        <div className="program-bottomRow">
                                            {timeLabel && <div className={`program-timeLine ${isCancelled && !isReplaced ? "program-timeLine--cancelled" : ""} ${isReplaced ? "program-timeLine--replaced" : ""}`}>{timeLabel}</div>}
                                            {dm && <div className="program-dateFixed" title={full}>{dm}</div>}
                                        </div>
                                    </div>
                                </article>

                                {/* Extra addition card */}
                                {additionEvent && (
                                    <article
                                        className="program-card program-card--replaced program-card--clickable"
                                        onClick={() => window.dispatchEvent(new CustomEvent("open-event", { detail: { eventId: additionEventId } }))}
                                    >
                                        <div className="program-cardInnerFlat">
                                            <div className="program-cardTop">
                                                <div className="program-day">{item?.day}</div>
                                                <div className="program-statusPill program-statusPill--replaced">{t("status_addition")}</div>
                                            </div>
                                            <div className="program-activity">{additionEvent.title}</div>
                                            <div className="program-bottomRow">
                                                {additionEvent.time && <div className="program-timeLine program-timeLine--replaced">{additionEvent.time}</div>}
                                                {dm && <div className="program-dateFixed" title={full}>{dm}</div>}
                                            </div>
                                        </div>
                                    </article>
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>

                <div className="program-verse-highlight">
                    <div className="program-verse-content">
                        <p className="program-verse-text">{t("verse_text")}</p>
                        <p className="program-verse-ref">{t("verse_ref")}</p>
                    </div>
                </div>
            </div>
        </section>
    );
}