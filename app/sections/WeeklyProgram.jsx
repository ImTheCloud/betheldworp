"use client";

import "./WeeklyProgram.css";
import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/Firebase";
import { useLang } from "../components/LanguageProvider";
import { makeT } from "../lib/i18n";
import tr from "../translations/WeeklyProgram.json";

const safeArr = (v) => (Array.isArray(v) ? v : []);
const safeStr = (v) => String(v ?? "");

function capFirst(s) {
    const x = safeStr(s);
    if (!x) return "";
    return x.charAt(0).toUpperCase() + x.slice(1);
}

function getBrusselsISO(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Brussels",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    })
        .formatToParts(date)
        .filter(Boolean);

    let y = "0000",
        m = "00",
        d = "00";
    parts.forEach((p) => {
        if (p.type === "year") y = p.value;
        if (p.type === "month") m = p.value;
        if (p.type === "day") d = p.value;
    });

    return `${y}-${m}-${d}`;
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

    let yy = 0,
        mm = 0,
        dd = 0;

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

function clampWeekOffset(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return 0;
    return Math.max(-104, Math.min(104, Math.trunc(x)));
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

    const weekdayLong = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "Europe/Brussels" });
    const dayMonthLong = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", timeZone: "Europe/Brussels" });
    const yearLong = new Intl.DateTimeFormat(locale, { year: "numeric", timeZone: "Europe/Brussels" });

    const startWeekday = capFirst(weekdayLong.format(startUTC));
    const endWeekday = capFirst(weekdayLong.format(endUTC));
    const startDayMonth = safeStr(dayMonthLong.format(startUTC));
    const endDayMonth = safeStr(dayMonthLong.format(endUTC));
    const endYear = safeStr(yearLong.format(endUTC));

    const to = (t("week_to") || "to").trim();

    return `${startWeekday} ${startDayMonth} ${to} ${endWeekday} ${endDayMonth} ${endYear}`;
}

function formatWeekRangeShort(startUTC, endUTC, lang) {
    const locale = getLocaleFromLang(lang);
    const fmt = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Brussels" });
    return `${safeStr(fmt.format(startUTC))} – ${safeStr(fmt.format(endUTC))}`;
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
    return { weekKey, affectedProgramIds };
}

function formatBrusselsDDMM(dateObj) {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Brussels",
        day: "2-digit",
        month: "2-digit",
    }).formatToParts(dateObj);

    let dd = "00",
        mm = "00";
    parts.forEach((p) => {
        if (p.type === "day") dd = p.value;
        if (p.type === "month") mm = p.value;
    });
    return `${dd}/${mm}`;
}

function formatBrusselsDDMMYYYY(dateObj) {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Brussels",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).formatToParts(dateObj);

    let dd = "00",
        mm = "00",
        yy = "0000";
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

    const LOCAL_PROGRAM_ITEMS = useMemo(
        () => [
            { day: t("day_mon"), id: "mon", times: ["20:00-21:30"], title: t("act_mon") },
            { day: t("day_tue"), id: "tue", times: ["20:00-21:30"], title: t("act_tue") },
            { day: t("day_wed"), id: "wed", times: ["20:00-21:30"], title: t("act_wed") },
            { day: t("day_thu"), id: "thu", times: ["20:00-21:30"], title: t("act_thu") },
            { day: t("day_fri"), id: "fri", times: ["20:00-21:30"], title: t("act_fri") },
            { day: t("day_sat"), id: "sat", times: ["11:00-13:30"], title: t("act_sat") },
            { day: t("day_sun"), id: "sun_am", times: ["10:00-12:00"], title: t("act_sun_am") },
            { day: t("day_sun"), id: "sun_pm", times: ["18:00-20:00"], title: t("act_sun_pm") },
        ],
        [t]
    );

    const [weekOffset, setWeekOffset] = useState(0);

    const weekInfo = useMemo(() => {
        const base = new Date();
        const { start: baseStart } = getBrusselsWeekRange(base);

        const start = addDaysUTC(baseStart, clampWeekOffset(weekOffset) * 7);
        const end = addDaysUTC(start, 6);

        const { isoYear, week } = getISOWeekYearAndNumberUTC(start);
        const weekKey = `${String(isoYear).padStart(4, "0")}-W${String(week).padStart(2, "0")}`;

        const weekLabelTemplate = t("week_label") || "Week {n}";
        const weekTitle = safeStr(weekLabelTemplate).replaceAll("{n}", String(week));

        const rangeLong = formatWeekRangeLong(start, end, lang, t);
        const rangeShort = formatWeekRangeShort(start, end, lang);

        return { start, end, weekKey, weekTitle, rangeLong, rangeShort };
    }, [lang, weekOffset, t]);

    const dateMetaById = useMemo(() => {
        const byId = {};
        const dayIndexById = {
            mon: 0,
            tue: 1,
            wed: 2,
            thu: 3,
            fri: 4,
            sat: 5,
            sun_am: 6,
            sun_pm: 6,
        };

        Object.entries(dayIndexById).forEach(([id, dayIndex]) => {
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
        const unsub = onSnapshot(
            ref,
            (snap) => {
                if (!snap.exists()) {
                    setOvDoc(null);
                    return;
                }
                setOvDoc({ id: snap.id, data: snap.data() || {} });
            },
            () => {
                setOvDoc(null);
            }
        );

        return () => unsub();
    }, [weekInfo.weekKey]);

    const cancelledSet = useMemo(() => {
        const set = new Set();
        if (!ovDoc) return set;
        const o = normalizeWeekOverride(ovDoc.id, ovDoc.data);
        safeArr(o.affectedProgramIds).forEach((id) => set.add(id));
        return set;
    }, [ovDoc]);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "ArrowLeft") setWeekOffset((v) => clampWeekOffset(v - 1));
            if (e.key === "ArrowRight") setWeekOffset((v) => clampWeekOffset(v + 1));
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    return (
        <section id="program" className="program-section">
            <div className="program-content">
                <div className="program-header">
                    <h2 className="program-title">{t("title")}</h2>

                    <div className="program-weekPicker" role="group" aria-label={weekInfo.weekTitle}>
                        <button type="button" className="program-weekBtn" aria-label="Previous week" onClick={() => setWeekOffset((v) => clampWeekOffset(v - 1))}>
                            ‹
                        </button>

                        <div className="program-weekMeta">
                            <div className="program-weekTitle">{weekInfo.weekTitle}</div>
                            <div className="program-weekRange program-weekRange--long" aria-hidden="true">
                                {weekInfo.rangeLong}
                            </div>
                            <div className="program-weekRange program-weekRange--short" aria-hidden="true">
                                {weekInfo.rangeShort}
                            </div>
                        </div>

                        <button type="button" className="program-weekBtn" aria-label="Next week" onClick={() => setWeekOffset((v) => clampWeekOffset(v + 1))}>
                            ›
                        </button>
                    </div>
                </div>

                <div className="program-grid">
                    {LOCAL_PROGRAM_ITEMS.map((item, idx) => {
                        const id = safeStr(item?.id || `day-${idx}`).trim();
                        const times = safeArr(item?.times);
                        const isCancelled = cancelledSet.has(id);

                        const dm = safeStr(dateMetaById?.[id]?.dm || "");
                        const full = safeStr(dateMetaById?.[id]?.full || "");

                        return (
                            <article key={id} className={`program-card ${isCancelled ? "program-card--cancelled" : "program-card--normal"}`}>
                                {dm ? (
                                    <div className="program-cardDateAbs" title={full} aria-label={full}>
                                        {dm}
                                    </div>
                                ) : null}

                                {isCancelled ? <div className="program-statusPill program-statusPill--abs">{t("status_cancelled")}</div> : null}

                                <div className="program-cardInnerFlat">
                                    <div className="program-cardTop">
                                        <div className="program-day">{item?.day}</div>
                                    </div>

                                    <div className="program-activity">{item?.title}</div>

                                    <div className="program-times">
                                        {times.map((tt) => (
                                            <span key={`${id}-${tt}`} className={`program-time ${isCancelled ? "program-time--cancelled" : ""}`}>
                                                {formatRange(tt)}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </article>
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