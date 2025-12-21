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

function normalizeActiveAnnouncements(docData) {
    return safeArr(docData?.items)
        .filter((x) => Boolean(x?.active))
        .map((x) => ({
            id: safeStr(x?.id).trim(),
            affectedProgramIds: safeArr(x?.affectedProgramIds).map((v) => safeStr(v).trim()).filter(Boolean),
            message: safeStr(x?.message).trim()
        }))
        .filter((x) => x.message.length > 0);
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
            { day: t("day_sun"), id: "sun_pm", times: ["18:00-20:00"], title: t("act_sun_pm") }
        ],
        [t]
    );

    const [docData, setDocData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [openId, setOpenId] = useState(null);

    useEffect(() => {
        setLoading(true);
        setError("");

        const ref = doc(db, "program_announcements", "announcement");
        const unsub = onSnapshot(
            ref,
            (snap) => {
                setDocData(snap.exists() ? snap.data() : null);
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

    const activeAnnouncements = useMemo(() => normalizeActiveAnnouncements(docData), [docData]);
    const showAnnouncement = activeAnnouncements.length > 0;

    const affectedIds = useMemo(() => {
        const set = new Set();
        activeAnnouncements.forEach((a) => a.affectedProgramIds.forEach((id) => set.add(id)));
        return set;
    }, [activeAnnouncements]);

    const messageForOpen = useMemo(() => {
        if (!openId) return "";
        const specific = activeAnnouncements.find((a) => a.affectedProgramIds.includes(openId));
        return (specific?.message || activeAnnouncements[0]?.message || "").trim();
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
                            <div className="program-announcement-badge" aria-hidden="true">
                                !
                            </div>
                            <div className="program-announcement-title">{t("special_title")}</div>
                        </div>

                        <div className="program-announcement-list">
                            {activeAnnouncements.map((a, i) => (
                                <div key={a.id || `msg-${i}`} className="program-announcement-item">
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