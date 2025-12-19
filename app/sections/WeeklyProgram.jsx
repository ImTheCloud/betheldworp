"use client";

import "./WeeklyProgram.css";
import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/Firebase";

const LOCAL_PROGRAM_ITEMS = [
    { day: "Luni", id: "mon", times: ["20:00-21:30"], title: "Seară de Tineret și Adolescenți" },
    { day: "Marți", id: "tue", times: ["20:00-21:30"], title: "Seară de rugăciune" },
    { day: "Miercuri", id: "wed", times: ["20:00-21:30"], title: "Repetiție cor Mixt" },
    { day: "Joi", id: "thu", times: ["20:00-21:30"], title: "Repetiție cor Bărbătesc" },
    { day: "Vineri", id: "fri", times: ["20:00-21:30"], title: "Seară de rugăciune" },
    { day: "Sâmbătă", id: "sat", times: ["11:00-13:30"], title: "Program cu copii" },
    { day: "Duminică", id: "sun_am", times: ["10:00-12:00"], title: "Serviciu Divin (Dimineață)" },
    { day: "Duminică", id: "sun_pm", times: ["18:00-20:00"], title: "Serviciu Divin (Seara)" },
];

function safeArr(v) {
    return Array.isArray(v) ? v : [];
}

function formatTimeToken(token) {
    const t = String(token || "").trim();
    const m = t.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return t;
    return `${String(Number(m[1]))}h${m[2]}`;
}

function formatRange(range) {
    const raw = String(range || "").trim().replace(/\s+/g, "");
    const [start, end] = raw.split("-");
    if (!start || !end) return String(range || "");
    return `${formatTimeToken(start)}-${formatTimeToken(end)}`;
}

function toStringSet(arr) {
    return new Set(safeArr(arr).map((x) => String(x)));
}

function isAffected(affectedSet, id) {
    return affectedSet.has(id);
}

function normalizeActiveAnnouncements(docData) {
    const items = safeArr(docData?.items);

    return items
        .filter((x) => Boolean(x?.active))
        .map((x) => ({
            id: String(x?.id ?? ""),
            affectedProgramIds: safeArr(x?.affectedProgramIds).map((v) => String(v)),
            message: String(x?.message ?? "").trim(),
        }))
        .filter((x) => x.message.length > 0);
}

export default function Program() {
    const [docData, setDocData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
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
                setError("Nu am putut încărca anunțurile.");
                setLoading(false);
            }
        );

        return () => unsub();
    }, []);

    const activeAnnouncements = useMemo(() => normalizeActiveAnnouncements(docData), [docData]);

    const affectedIds = useMemo(() => {
        const all = [];
        activeAnnouncements.forEach((a) => all.push(...safeArr(a.affectedProgramIds)));
        return toStringSet(all);
    }, [activeAnnouncements]);

    const showAnnouncement = activeAnnouncements.length > 0;

    return (
        <section id="program" className="program-section">
            <div className="program-content">
                <div className="program-header">
                    <h2 className="program-title">Programul săptămânal</h2>
                </div>

                {loading ? (
                    <div className="program-inlineInfo">Se încarcă...</div>
                ) : error ? (
                    <div className="program-inlineError">{error}</div>
                ) : null}

                {showAnnouncement ? (
                    <div className="program-announcement" role="status" aria-live="polite">
                        <div className="program-announcement-head">
                            <div className="program-announcement-badge" aria-hidden="true">
                                !
                            </div>

                            <div className="program-announcement-headText">
                                <div className="program-announcement-title">Anunțuri speciale</div>
                            </div>
                        </div>

                        <div className="program-announcement-list">
                            {activeAnnouncements.map((a) => (
                                <div key={a.id || a.message.slice(0, 24)} className="program-announcement-item">
                                    {a.message}
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null}

                <div className="program-grid">
                    {LOCAL_PROGRAM_ITEMS.map((item, idx) => {
                        const id = String(item?.id ?? `${item?.day ?? "day"}-${idx}`);
                        const flagged = showAnnouncement && isAffected(affectedIds, id);
                        const times = safeArr(item?.times);

                        return (
                            <article key={id} className="program-card">
                                {flagged ? (
                                    <div className="program-flag" aria-label="Atenție">
                                        <span aria-hidden="true">!</span>
                                    </div>
                                ) : null}

                                <div className="program-day">{item?.day}</div>
                                <div className="program-activity">{item?.title}</div>

                                <div className="program-times">
                                    {times.map((t) => (
                                        <span key={`${id}-${t}`} className="program-time">
                                            {formatRange(t)}
                                        </span>
                                    ))}
                                </div>
                            </article>
                        );
                    })}
                </div>

                <div className="program-verse-highlight">
                    <div className="program-verse-content">
                        <p className="program-verse-text">„Mă bucur când mi se zice: «Haidem la Casa Domnului!»"</p>
                        <p className="program-verse-ref">Psalmul 122:1</p>
                    </div>
                </div>
            </div>
        </section>
    );
}