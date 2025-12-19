"use client";

import "./WeeklyProgram.css";
import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/Firebase";

const LOCAL_PROGRAM_ITEMS = [
    {
        day: "Luni",
        id: "mon",
        times: ["20:00-21:30"],
        title: "Seară de Tineret și Adolescenți",
    },
    {
        day: "Marți",
        id: "tue",
        times: ["20:00-21:30"],
        title: "Seară de rugăciune",
    },
    {
        day: "Miercuri",
        id: "wed",
        times: ["20:00-21:30"],
        title: "Repetiție cor Mixt",
    },
    {
        day: "Joi",
        id: "thu",
        times: ["20:00-21:30"],
        title: "Repetiție cor Bărbătesc",
    },
    {
        day: "Vineri",
        id: "fri",
        times: ["20:00-21:30"],
        title: "Seară de rugăciune",
    },
    {
        day: "Sâmbătă",
        id: "sat",
        times: ["11:00-13:30"],
        title: "Program cu copii",
    },
    {
        day: "Duminică",
        id: "sun_am",
        times: ["10:00-12:00"],
        title: "Serviciu Divin (Dimineață)",
    },
    {
        day: "Duminică",
        id: "sun_pm",
        times: ["18:00-20:00"],
        title: "Serviciu Divin (Seara)",
    },
];

function formatTimeToken(token) {
    const t = String(token || "").trim();
    const m = t.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return t;
    const hh = String(Number(m[1]));
    const mm = m[2];
    return `${hh}h${mm}`;
}

function formatRange(range) {
    const raw = String(range || "").trim().replace(/\s+/g, "");
    const parts = raw.split("-");
    if (parts.length !== 2) return range;
    const start = formatTimeToken(parts[0]);
    const end = formatTimeToken(parts[1]);
    return `${start}-${end}`;
}

function toStringSet(arr) {
    return new Set((Array.isArray(arr) ? arr : []).map((x) => String(x)));
}

const LEGACY_FLAG_ALIASES = {
    tue: ["tue_fri"],
    fri: ["tue_fri"],
    sun_am: ["sun"],
    sun_pm: ["sun"],
};

function isAffected(affectedSet, id) {
    if (affectedSet.has(id)) return true;
    const aliases = LEGACY_FLAG_ALIASES[id];
    return Array.isArray(aliases) ? aliases.some((a) => affectedSet.has(a)) : false;
}

export default function Program() {
    const programItems = LOCAL_PROGRAM_ITEMS;

    const [announcement, setAnnouncement] = useState(null);
    const [announcementLoading, setAnnouncementLoading] = useState(true);
    const [announcementError, setAnnouncementError] = useState("");

    useEffect(() => {
        const ref = doc(db, "program_announcements", "current");
        const unsub = onSnapshot(
            ref,
            (snap) => {
                setAnnouncement(snap.data() || null);
                setAnnouncementLoading(false);
                setAnnouncementError("");
            },
            (err) => {
                console.error(err);
                setAnnouncementError("Nu am putut încărca anunțurile.");
                setAnnouncementLoading(false);
            }
        );

        return () => unsub();
    }, []);

    const hasAnnouncement = Boolean(announcement?.active);

    const affectedIds = useMemo(() => {
        if (!hasAnnouncement) return new Set();
        return toStringSet(announcement?.affectedProgramIds);
    }, [hasAnnouncement, announcement]);

    return (
        <section id="program" className="program-section">
            <div className="program-content">
                <div className="program-header">
                    <h2 className="program-title">Programul săptămânal</h2>
                </div>

                {announcementLoading && (
                    <div className="ec-inlineInfo" style={{ textAlign: "center", marginBottom: 18 }}>
                        Se încarcă...
                    </div>
                )}

                {announcementError && (
                    <div className="ec-inlineError" style={{ textAlign: "center", marginBottom: 18 }}>
                        {announcementError}
                    </div>
                )}

                {hasAnnouncement ? (
                    <div className="program-announcement" role="status" aria-live="polite">
                        <div className="program-attention" aria-hidden="true">
                            !
                        </div>

                        <div className="program-announcement-body">
                            <div className="program-announcement-title">{announcement?.title || "Anunț"}</div>

                            {(announcement?.blocks || []).map((b, i) => (
                                <div key={i}>
                                    <div className="program-announcement-row">
                                        <div className="program-announcement-label">
                                            {String(b?.announcement || "")}
                                        </div>

                                        <div className="program-announcement-dates">
                                            {(b?.pills || []).map((p) => (
                                                <span key={p} className="program-pill">
                                                    {p}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {i !== (announcement?.blocks || []).length - 1 ? (
                                        <div className="program-announcement-sep" />
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null}

                <div className="program-grid">
                    {programItems.map((item, idx) => {
                        const id = String(item?.id ?? `${item?.day ?? "day"}-${idx}`);
                        const flagged = hasAnnouncement && isAffected(affectedIds, id);
                        const times = Array.isArray(item?.times) ? item.times : [];

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