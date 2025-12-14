"use client";

import { useMemo, useState } from "react";
import "./EventsCalendar.css";

const CHURCH_NAME = "Biserica Penticostala BETHEL Dworp";
const CHURCH_ADDRESS = "Alsembergsesteenweg 572, 1653 Beersel";

const WEDDING_IMAGE = "/image/wedding/Nunta.png";

const EVENTS = [
    {
        id: "w-today",
        couple: "Valentin & Liudunila",
        date: "2025-12-14",
        time: "10:00 - 12:00",
        place: CHURCH_NAME,
        address: CHURCH_ADDRESS,
        image: WEDDING_IMAGE,
    },
    {
        id: "w1",
        couple: "Emanuel & Emima",
        date: "2026-04-12",
        time: "10:00 - 12:00",
        place: CHURCH_NAME,
        address: CHURCH_ADDRESS,
        image: WEDDING_IMAGE,
    },
    {
        id: "w2",
        couple: "Bogdan & Rebeka",
        date: "2026-04-26",
        time: "10:00 - 12:00",
        place: CHURCH_NAME,
        address: CHURCH_ADDRESS,
        image: WEDDING_IMAGE,
    },
];

const WEEKDAY_LABELS = ["Lu", "Ma", "Mi", "Jo", "Vi", "Sâ", "Du"];

function getMondayIndex(jsDay) {
    // JS: 0=Sun..6=Sat => Monday-first: 0=Mon..6=Sun
    return (jsDay + 6) % 7;
}

function pad2(n) {
    return String(n).padStart(2, "0");
}

function formatDateRo(isoDate) {
    const d = new Date(`${isoDate}T00:00:00`);
    return d.toLocaleDateString("ro-RO", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}

function formatMonthRo(firstOfMonth) {
    return firstOfMonth.toLocaleDateString("ro-RO", { month: "long", year: "numeric" });
}

function getInitialsFromCouple(couple) {
    // Expected: "Name1 & Name2"
    // Fallback: take first letter of first two words
    if (!couple) return "";
    const parts = couple.split("&").map((p) => p.trim()).filter(Boolean);

    const first = parts[0]?.split(" ").filter(Boolean)[0]?.[0] ?? "";
    const second = parts[1]?.split(" ").filter(Boolean)[0]?.[0] ?? "";

    if (first && second) return `${first} & ${second}`;

    const words = couple.split(" ").filter(Boolean);
    const a = words[0]?.[0] ?? "";
    const b = words[1]?.[0] ?? "";
    return a && b ? `${a}${b}` : a || b || "";
}

export default function EventsCalendar() {
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;

    const eventsByDate = useMemo(() => {
        // One event max per day
        const map = new Map();
        for (const ev of EVENTS) map.set(ev.date, ev);
        return map;
    }, []);

    const initialMonth = useMemo(() => {
        // If there's an event today, start on today's month; otherwise on first event month.
        if (eventsByDate.has(todayKey)) return new Date(today.getFullYear(), today.getMonth(), 1);
        const firstEvent = EVENTS[0] ? new Date(`${EVENTS[0].date}T00:00:00`) : today;
        return new Date(firstEvent.getFullYear(), firstEvent.getMonth(), 1);
    }, [eventsByDate, todayKey, today]);

    const [month, setMonth] = useState(initialMonth);
    const [isOpen, setIsOpen] = useState(false);
    const [selectedId, setSelectedId] = useState(EVENTS[0]?.id ?? null);

    const selectedEvent = useMemo(
        () => EVENTS.find((e) => e.id === selectedId) ?? null,
        [selectedId]
    );

    const calendarCells = useMemo(() => {
        const year = month.getFullYear();
        const m = month.getMonth();

        const firstDay = new Date(year, m, 1);
        const daysInMonth = new Date(year, m + 1, 0).getDate();
        const startOffset = getMondayIndex(firstDay.getDay());

        const cells = [];

        for (let i = 0; i < startOffset; i++) cells.push({ type: "blank", key: `blank-${i}` });

        for (let day = 1; day <= daysInMonth; day++) {
            const dateKey = `${year}-${pad2(m + 1)}-${pad2(day)}`;
            const event = eventsByDate.get(dateKey) ?? null;

            const isToday =
                year === today.getFullYear() &&
                m === today.getMonth() &&
                day === today.getDate();

            cells.push({ type: "day", key: dateKey, day, isToday, event });
        }

        while (cells.length % 7 !== 0) cells.push({ type: "blank", key: `blank-end-${cells.length}` });

        return cells;
    }, [month, eventsByDate, today]);

    const goPrevMonth = () => setMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    const goNextMonth = () => setMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));

    const openEvent = (ev) => {
        setSelectedId(ev.id);
        setIsOpen(true);
    };

    const closeModal = () => setIsOpen(false);

    const mapQuery = selectedEvent
        ? encodeURIComponent(`${selectedEvent.place}, ${selectedEvent.address}`)
        : "";

    return (
        <>
            <section id="evenimente" className="ec-section">
                <div className="ec-content">
                    <h2 className="ec-title">Evenimente</h2>

                    <div className="ec-card">
                        <div className="ec-head">
                            <button className="ec-navBtn" onClick={goPrevMonth} aria-label="Previous month">
                                ‹
                            </button>

                            <div className="ec-month">{formatMonthRo(month)}</div>

                            <button className="ec-navBtn" onClick={goNextMonth} aria-label="Next month">
                                ›
                            </button>
                        </div>

                        <div className="ec-weekdays">
                            {WEEKDAY_LABELS.map((d) => (
                                <div key={d} className="ec-weekday">
                                    {d}
                                </div>
                            ))}
                        </div>

                        <div className="ec-grid">
                            {calendarCells.map((cell) => {
                                if (cell.type === "blank") return <div key={cell.key} className="ec-cell ec-blank" />;

                                const hasEvent = Boolean(cell.event);
                                const initials = hasEvent ? getInitialsFromCouple(cell.event.couple) : "";

                                return (
                                    <div
                                        key={cell.key}
                                        className={`ec-cell ${cell.isToday ? "is-today" : ""} ${hasEvent ? "has-events" : ""}`}
                                    >
                                        <div className="ec-dayBadge">{cell.day}</div>

                                        {hasEvent ? (
                                            <button
                                                type="button"
                                                className="ec-eventCellBtn"
                                                onClick={() => openEvent(cell.event)}
                                                title={cell.event.couple}
                                                aria-label={cell.event.couple}
                                            >
                                                <img className="ec-eventBg" src={cell.event.image} alt="Event" />

                                                <div className="ec-eventOverlay" aria-hidden="true">
                                                    <div className="ec-eventInitials">{initials}</div>
                                                </div>
                                            </button>
                                        ) : (
                                            <div className="ec-emptyBody" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </section>

            {isOpen && selectedEvent && (
                <div className="ev-overlay" onClick={closeModal}>
                    <div className="ev-modal" onClick={(e) => e.stopPropagation()}>
                        <header className="ev-header">
                            <h2 className="ev-couple">{selectedEvent.couple}</h2>

                            <button
                                type="button"
                                className="ev-close"
                                onClick={closeModal}
                                aria-label="Close"
                                title="Close"
                            >
                                ×
                            </button>
                        </header>

                        <div className="ev-body">
                            <div className="ev-heroImgWrap">
                                <img className="ev-heroImg" src={selectedEvent.image} alt="Event" />
                            </div>

                            <div className="ev-infoGrid">
                                <div className="ev-infoCard">
                                    <div className="ev-infoLabel">DATA</div>
                                    <div className="ev-infoValue">{formatDateRo(selectedEvent.date)}</div>
                                </div>

                                <div className="ev-infoCard">
                                    <div className="ev-infoLabel">ORA</div>
                                    <div className="ev-infoValue">{selectedEvent.time}</div>
                                </div>

                                <div className="ev-infoCard ev-infoCard--wide">
                                    <div className="ev-infoLabel">LOCAȚIE</div>
                                    <div className="ev-infoValue">
                                        {selectedEvent.place}
                                        <span className="ev-infoSub">{selectedEvent.address}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="ev-mapCard">
                                <iframe
                                    className="ev-map"
                                    title="Event location"
                                    loading="lazy"
                                    allowFullScreen
                                    referrerPolicy="no-referrer-when-downgrade"
                                    src={`https://www.google.com/maps?q=${mapQuery}&output=embed`}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}