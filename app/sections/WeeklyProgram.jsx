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

function ChevronIcon({ open }) {
    return (
        <svg
            className={`faq-chevron${open ? " faq-chevron--open" : ""}`}
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
        >
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function renderInline(text) {
    if (!text.includes("**")) return text;
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) =>
        i % 2 === 1 ? <strong key={i}>{part}</strong> : part
    );
}

function FAQItem({ question, answer, index, isOpen, onToggle }) {
    const num = String(index + 1).padStart(2, "0");
    return (
        <div className={`faq-item${isOpen ? " faq-item--open" : ""}`}>
            <button
                className="faq-question"
                onClick={() => onToggle(index)}
                aria-expanded={isOpen}
            >
                <div className="faq-q-number">{num}</div>
                <div className="faq-q-text">
                    {question.includes(" – ") && question.split(" – ")[0] && (
                        <div className="faq-q-header">{question.split(" – ")[0]}</div>
                    )}
                    <div className="faq-q-main">{question.split(" – ")[1] || question}</div>
                </div>
                <ChevronIcon open={isOpen} />
            </button>

            <div className="faq-answer-wrap">
                <div className="faq-answer">
                    {answer.split("\n\n").map((block, i) => {
                        const trimmed = block.trim();
                        if (!trimmed) return null;

                        if (trimmed.includes("\n- ")) {
                            const [intro, ...rest] = trimmed.split("\n- ");
                            return (
                                <div key={i} className="faq-block">
                                    {intro && <p>{renderInline(intro)}</p>}
                                    <ul className="faq-list">
                                        {rest.map((item, j) => (
                                            <li key={j}><span>{renderInline(item.replace(/^- /, ""))}</span></li>
                                        ))}
                                    </ul>
                                </div>
                            );
                        }

                        return (
                            <p key={i} className="faq-block">
                                {renderInline(trimmed)}
                            </p>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

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
    const customTitles = safeObj(data?.customTitles);
    const customTimes = safeObj(data?.customTimes);
    return { weekKey, affectedProgramIds, replacements, additions, customTitles, customTimes };
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

    const [openIndex, setOpenIndex] = useState(null);

    const faqQuestions = [
        { key: "q1", q: `${t("faq_q1_day")} – ${t("faq_q1_title")}`, a: t("faq_q1_body") },
        { key: "q2", q: `${t("faq_q2_day")} – ${t("faq_q2_title")}`, a: t("faq_q2_body") },
        { key: "q3", q: `${t("faq_q3_day")} – ${t("faq_q3_title")}`, a: t("faq_q3_body") },
        { key: "q4", q: `${t("faq_q4_day")} – ${t("faq_q4_title")}`, a: t("faq_q4_body") },
        { key: "q5", q: `${t("faq_q5_day")} – ${t("faq_q5_title")}`, a: t("faq_q5_body") },
        { key: "q6", q: `${t("faq_q6_day")} – ${t("faq_q6_title")}`, a: t("faq_q6_body") },
        { key: "q7", q: `${t("faq_q7_day")} – ${t("faq_q7_title")}`, a: t("faq_q7_body") },
    ];

    const handleToggle = (index) => {
        setOpenIndex(openIndex === index ? null : index);
    };

    const openContact = () => {
        if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("bethel:open-contact"));
        }
    };

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
        if (!ovDoc) return { cancelledSet: new Set(), replacements: {}, additions: {}, customTitles: {}, customTimes: {} };
        const o = normalizeWeekOverride(ovDoc.id, ovDoc.data);
        return { 
            cancelledSet: new Set(o.affectedProgramIds), 
            replacements: o.replacements, 
            additions: o.additions,
            customTitles: o.customTitles,
            customTimes: o.customTimes
        };
    }, [ovDoc]);

    const { cancelledSet, replacements, additions, customTitles, customTimes } = overrideData;

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
        <section className="program-section">
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



                <div className="program-grid">
                    {LOCAL_PROGRAM_ITEMS.map((item, idx) => {
                        const id = safeStr(item?.id || `day-${idx}`).trim();
                        const times = safeArr(item?.times);
                        const isCancelled = cancelledSet.has(id);
                        const replacementEventId = safeStr(replacements[id]).trim();
                        const replacementEvent = replacementEventId ? eventsMap.get(replacementEventId) : null;
                        const isReplaced = isCancelled && !!replacementEvent;

                        const customTitle = pickByLang(customTitles?.[id], lang);
                        const customTime = safeStr(customTimes?.[id]).trim();
                        const isManual = customTitle !== "" || customTime !== "";
                        const finalIsReplaced = isReplaced || isManual;

                        let statusClass = "program-card--normal";
                        if (finalIsReplaced) statusClass = "program-card--replaced";
                        else if (isCancelled) statusClass = "program-card--cancelled";

                        const dm = safeStr(dateMetaById?.[id]?.dm || "");
                        const full = safeStr(dateMetaById?.[id]?.full || "");

                        const displayTitle = customTitle || (isReplaced ? replacementEvent.title : item?.title);
                        const displayTime = isReplaced && replacementEvent.time ? replacementEvent.time : null;

                        const cleanedTimes = times.map((x) => safeStr(x).trim()).filter(Boolean);
                        const defaultTimeLabel = cleanedTimes.length ? formatRange(cleanedTimes[0]) + (cleanedTimes.length > 1 ? " +" : "") : "";
                        const timeLabel = customTime || (isReplaced && displayTime ? displayTime : defaultTimeLabel);

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
                                            {finalIsReplaced && <div className="program-statusPill program-statusPill--replaced">{t("status_replaced")}</div>}
                                            {isCancelled && !finalIsReplaced && <div className="program-statusPill program-statusPill--cancelled">{t("status_cancelled")}</div>}
                                        </div>
                                        <div className="program-activity">{displayTitle}</div>
                                        <div className="program-bottomRow">
                                            {timeLabel && <div className={`program-timeLine ${isCancelled && !finalIsReplaced ? "program-timeLine--cancelled" : ""} ${finalIsReplaced ? "program-timeLine--replaced" : ""}`}>{timeLabel}</div>}
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

                {/* FAQ Accordion Section */}
                <div className="faq-header">
                    <h2 className="faq-title">{t("faq_section_title")}</h2>
                </div>

                <div className="faq-list-wrap">
                    {faqQuestions.map((item, i) => (
                        <FAQItem
                            key={item.key}
                            index={i}
                            question={item.q}
                            answer={item.a}
                            isOpen={openIndex === i}
                            onToggle={handleToggle}
                        />
                    ))}
                </div>



            </div>
        </section>
    );
}