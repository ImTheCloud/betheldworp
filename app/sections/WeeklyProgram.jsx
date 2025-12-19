"use client";

import "./WeeklyProgram.css";
import { useEffect, useMemo, useRef, useState } from "react";
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

function safeStr(v) {
    return String(v ?? "");
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

function normalizeActiveAnnouncements(docData) {
    const items = safeArr(docData?.items);

    return items
        .filter((x) => Boolean(x?.active))
        .map((x) => {
            const id = safeStr(x?.id).trim();
            const affectedProgramIds = safeArr(x?.affectedProgramIds)
                .map((v) => safeStr(v).trim())
                .filter(Boolean);
            const message = safeStr(x?.message).trim();
            return { id, affectedProgramIds, message };
        })
        .filter((x) => x.message.length > 0);
}

export default function Program() {
    const [docData, setDocData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Toast
    const [toast, setToast] = useState(null); // { title, subtitle, message, moreCount }
    const [toastPhase, setToastPhase] = useState("enter"); // enter | exit
    const toastTimerRef = useRef(null);
    const toastExitRef = useRef(null);

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
                setError("Nu am putut încărca anunțurile.");
                setLoading(false);
            }
        );

        return () => unsub();
    }, []);

    const activeAnnouncements = useMemo(() => normalizeActiveAnnouncements(docData), [docData]);

    const affectedIds = useMemo(() => {
        const set = new Set();
        activeAnnouncements.forEach((a) => {
            a.affectedProgramIds.forEach((id) => set.add(id));
        });
        return set;
    }, [activeAnnouncements]);

    const showAnnouncement = activeAnnouncements.length > 0;

    const getMessagesForProgramId = (programId) => {
        const pid = safeStr(programId).trim();

        const specific = activeAnnouncements
            .filter((a) => a.affectedProgramIds.includes(pid))
            .map((a) => a.message)
            .filter(Boolean);

        if (specific.length > 0) return { messages: specific, specific: true };

        return {
            messages: activeAnnouncements.map((a) => a.message).filter(Boolean),
            specific: false,
        };
    };

    function clearToastTimers() {
        if (toastTimerRef.current) {
            window.clearTimeout(toastTimerRef.current);
            toastTimerRef.current = null;
        }
        if (toastExitRef.current) {
            window.clearTimeout(toastExitRef.current);
            toastExitRef.current = null;
        }
    }

    function closeToast() {
        clearToastTimers();
        setToastPhase("exit");
        toastExitRef.current = window.setTimeout(() => {
            setToast(null);
            setToastPhase("enter");
        }, 220);
    }

    function showToastForItem(item) {
        if (!showAnnouncement) return;

        const pid = safeStr(item?.id).trim();
        const { messages, specific } = getMessagesForProgramId(pid);

        const title = `${safeStr(item?.day)} — ${safeStr(item?.title)}`;
        const subtitle = specific ? "Anunț pentru acest program" : "Anunțuri generale";

        const first = messages?.[0] || "";
        const moreCount = Math.max(0, (messages?.length || 0) - 1);

        clearToastTimers();
        setToastPhase("enter");
        setToast({ title, subtitle, message: first, moreCount });

        toastTimerRef.current = window.setTimeout(() => {
            closeToast();
        }, 5000);
    }

    // Close toast on Escape
    useEffect(() => {
        if (!toast) return;

        const onKey = (e) => {
            if (e.key === "Escape") closeToast();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [toast]);

    useEffect(() => {
        return () => clearToastTimers();
    }, []);

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
                        const id = safeStr(item?.id || `${item?.day || "day"}-${idx}`);
                        const flagged = showAnnouncement && affectedIds.has(id);
                        const times = safeArr(item?.times);

                        return (
                            <article
                                key={id}
                                className={`program-card ${flagged ? "program-card--clickable" : ""}`}
                                role={flagged ? "button" : undefined}
                                tabIndex={flagged ? 0 : undefined}
                                aria-label={flagged ? "Apasă pentru a vedea anunțul" : undefined}
                                onClick={() => {
                                    if (flagged) showToastForItem(item);
                                }}
                                onKeyDown={(e) => {
                                    if (!flagged) return;
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        showToastForItem(item);
                                    }
                                }}
                            >
                                {flagged ? (
                                    <div className="program-flag program-flagStatic" aria-hidden="true">
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

            {/* Toast */}
            <div className="program-toastRegion" aria-live="polite" aria-atomic="true">
                {toast ? (
                    <div className={`program-toast ${toastPhase === "exit" ? "program-toast--exit" : "program-toast--enter"}`}>
                        <div className="program-toastTop">
                            <div className="program-toastIcon" aria-hidden="true">
                                !
                            </div>

                            <div className="program-toastText">
                                <div className="program-toastTitle">{toast.title}</div>
                                <div className="program-toastSubtitle">{toast.subtitle}</div>
                            </div>

                            <button type="button" className="program-toastClose" aria-label="Închide" onClick={closeToast}>
                                ✕
                            </button>
                        </div>

                        <div className="program-toastBody">
                            <div className="program-toastMsg">{toast.message}</div>
                            {toast.moreCount > 0 ? <div className="program-toastMore">+ {toast.moreCount} alte anunț(uri)</div> : null}
                        </div>
                    </div>
                ) : null}
            </div>
        </section>
    );
}