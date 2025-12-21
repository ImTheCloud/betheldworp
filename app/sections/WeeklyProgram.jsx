"use client";

import "./WeeklyProgram.css";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../lib/Firebase";
import { useLang } from "../components/LanguageProvider";
import { makeT } from "../lib/i18n";
import tr from "../translations/WeeklyProgram.json";

const safeArr = (v) => (Array.isArray(v) ? v : []);
const safeStr = (v) => String(v ?? "");

function getBrusselsDayISO(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Brussels",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date);

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

function parseISO(iso) {
    const m = safeStr(iso).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const yy = Number(m[1]);
    const mm = Number(m[2]);
    const dd = Number(m[3]);
    const dt = new Date(yy, mm - 1, dd);
    const time = dt.getTime();
    if (!Number.isFinite(time)) return null;
    return { yy, mm, dd, time };
}

function parseDMY(dmy) {
    const m = safeStr(dmy).trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (!m) return null;
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yy = Number(m[3]);
    const dt = new Date(yy, mm - 1, dd);
    const time = dt.getTime();
    if (!Number.isFinite(time)) return null;
    return { yy, mm, dd, time };
}

function parseDayFlexible(value) {
    const s = safeStr(value).trim();
    return parseDMY(s) || parseISO(s);
}

function formatDMYFromISO(iso) {
    const p = parseISO(iso);
    if (!p) return "";
    return `${String(p.dd).padStart(2, "0")}-${String(p.mm).padStart(2, "0")}-${String(p.yy).padStart(4, "0")}`;
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

function pickByLang(value, lang) {
    if (!value) return "";
    if (typeof value === "string") return value.trim();
    if (typeof value === "object") {
        const v = value?.[lang] ?? value?.ro ?? value?.en ?? "";
        return String(v || "").trim();
    }
    return "";
}

function normalizeAnnouncement(docId, data, lang, todayTime) {
    const untilRaw = safeStr(data?.until || data?.date || "").trim();
    const untilParsed = parseDayFlexible(untilRaw);
    if (!untilParsed) return null;
    if (todayTime > untilParsed.time) return null;

    const message = pickByLang(data?.message, lang);
    if (!message) return null;

    const affectedProgramIds = safeArr(data?.affectedProgramIds)
        .map((v) => safeStr(v).trim())
        .filter(Boolean);

    if (!affectedProgramIds.length) return null;

    const untilDMY = untilRaw.match(/^\d{2}-\d{2}-\d{4}$/) ? untilRaw : formatDMYFromISO(untilRaw);

    return {
        id: safeStr(docId).trim() || untilRaw,
        untilTime: untilParsed.time,
        untilDMY: untilDMY || "",
        affectedProgramIds,
        message,
    };
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

    const [annRaw, setAnnRaw] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [openId, setOpenId] = useState(null);

    const todayISO = useMemo(() => getBrusselsDayISO(), []);
    const todayTime = useMemo(() => parseISO(todayISO)?.time ?? Date.now(), [todayISO]);

    useEffect(() => {
        setLoading(true);
        setError("");

        const ref = collection(db, "program_announcements");
        const unsub = onSnapshot(
            ref,
            (snap) => {
                const list = [];
                snap.forEach((d) => list.push({ id: d.id, data: d.data() || {} }));
                setAnnRaw(list);
                setLoading(false);
                setError("");
            },
            (err) => {
                console.error(err);
                setError(t("error_load_announcements"));
                setLoading(false);
            }
        );

        return () => unsub();
    }, [t]);

    const activeAnnouncements = useMemo(() => {
        const out = annRaw.map((x) => normalizeAnnouncement(x.id, x.data, lang, todayTime)).filter(Boolean);
        out.sort((a, b) => a.untilTime - b.untilTime || a.id.localeCompare(b.id));
        return out;
    }, [annRaw, lang, todayTime]);

    const showAnnouncement = activeAnnouncements.length > 0;

    const affectedIds = useMemo(() => {
        const set = new Set();
        activeAnnouncements.forEach((a) => a.affectedProgramIds.forEach((id) => set.add(id)));
        return set;
    }, [activeAnnouncements]);

    const messageForOpen = useMemo(() => {
        if (!openId) return "";
        const specific = activeAnnouncements.find((a) => a.affectedProgramIds.includes(openId));
        return (specific?.message || "").trim();
    }, [openId, activeAnnouncements]);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "Escape") setOpenId(null);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    return (
        <section id="program" className="program-section">
            <div className="program-content">
                <div className="program-header">
                    <h2 className="program-title">{t("title")}</h2>
                </div>

                {loading ? <div className="program-inlineInfo">{t("loading")}</div> : null}
                {!loading && error ? <div className="program-inlineError">{error}</div> : null}

                {showAnnouncement ? (
                    <div className="program-announcement" role="status" aria-live="polite">
                        <div className="program-announcement-head">
                            <div className="program-announcement-badge" aria-hidden="true">!</div>
                            <div className="program-announcement-title">{t("special_title")}</div>
                        </div>

                        <div className="program-announcement-list">
                            {activeAnnouncements.map((a) => (
                                <div key={a.id} className="program-announcement-item">
                                    {a.message}
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null}

                <div className="program-grid">
                    {LOCAL_PROGRAM_ITEMS.map((item, idx) => {
                        const id = safeStr(item?.id || `day-${idx}`).trim();
                        const isAlert = showAnnouncement && affectedIds.has(id);
                        const isFlipped = openId === id;
                        const times = safeArr(item?.times);

                        return (
                            <article
                                key={id}
                                className={`program-card ${isAlert ? "program-card--alert program-card--clickable" : "program-card--normal"} ${
                                    isFlipped ? "program-card--flipped" : ""
                                }`}
                                role={isAlert ? "button" : undefined}
                                tabIndex={isAlert ? 0 : undefined}
                                aria-label={isAlert ? t("card_click_aria") : undefined}
                                onClick={() => {
                                    if (!isAlert) return;
                                    setOpenId((cur) => (cur === id ? null : id));
                                }}
                                onKeyDown={(e) => {
                                    if (!isAlert) return;
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        setOpenId((cur) => (cur === id ? null : id));
                                    }
                                }}
                            >
                                <div className="program-cardInner">
                                    <div className="program-cardFace program-cardFront">
                                        {isAlert ? (
                                            <div className="program-flag" aria-hidden="true">
                                                <span aria-hidden="true">!</span>
                                            </div>
                                        ) : null}

                                        <div className="program-day">{item?.day}</div>
                                        <div className="program-activity">{item?.title}</div>

                                        <div className="program-times">
                                            {times.map((tt) => (
                                                <span key={`${id}-${tt}`} className="program-time">
                                                    {formatRange(tt)}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="program-cardFace program-cardBack" aria-hidden={!isFlipped}>
                                        {isAlert ? (
                                            <div className="program-flag" aria-hidden="true">
                                                <span aria-hidden="true">!</span>
                                            </div>
                                        ) : null}

                                        <div className="program-cardBackBody">
                                            <div className="program-cardBackText">{isFlipped ? messageForOpen : ""}</div>
                                        </div>
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