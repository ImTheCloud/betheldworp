"use client";

// app/sections/EventsCalendar.jsx
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
        couple: "Plăcintă Emanuel & Emima",
        date: "2026-04-12",
        time: "10:00 - 12:00",
        place: CHURCH_NAME,
        address: CHURCH_ADDRESS,
        image: WEDDING_IMAGE,
    },
    {
        id: "w2",
        couple: "Tudose Bogdan & Croitor Rebeka",
        date: "2026-04-26",
        time: "10:00 - 12:00",
        place: CHURCH_NAME,
        address: CHURCH_ADDRESS,
        image: WEDDING_IMAGE,
    },
];

const WEEKDAY_LABELS = ["Lu", "Ma", "Mi", "Jo", "Vi", "Sâ", "Du"];

function getMondayIndex(jsDay) {
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
    if (!couple) return "";
    const parts = couple.split("&").map((p) => p.trim()).filter(Boolean);
    const first = parts[0]?.split(" ").filter(Boolean)[0]?.[0] ?? "";
    const second = parts[1]?.split(" ").filter(Boolean)[0]?.[0] ?? "";
    if (first && second) return `${first} & ${second}`;
    return first || second || "";
}

export default function EventsCalendar() {
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;

    const eventsByDate = useMemo(() => {
        const map = new Map();
        for (const ev of EVENTS) map.set(ev.date, ev); // max 1 event per day
        return map;
    }, []);

    const initialMonth = useMemo(() => {
        if (eventsByDate.has(todayKey)) return new Date(today.getFullYear(), today.getMonth(), 1);
        const firstEvent = EVENTS[0] ? new Date(`${EVENTS[0].date}T00:00:00`) : today;
        return new Date(firstEvent.getFullYear(), firstEvent.getMonth(), 1);
    }, [eventsByDate, todayKey, today]);

    const [month, setMonth] = useState(initialMonth);

    // Event modal
    const [eventOpen, setEventOpen] = useState(false);
    const [selectedId, setSelectedId] = useState(EVENTS[0]?.id ?? null);

    const selectedEvent = useMemo(
        () => EVENTS.find((e) => e.id === selectedId) ?? null,
        [selectedId]
    );

    // Newsletter form state (under calendar)
    const [email, setEmail] = useState("");
    const [gdpr, setGdpr] = useState(false);
    const [sending, setSending] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");

    const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

    const openEvent = (ev) => {
        setSelectedId(ev.id);
        setEventOpen(true);
    };

    const closeEvent = () => setEventOpen(false);

    const onSubscribe = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess(false);

        const cleanEmail = email.trim();

        if (!isValidEmail(cleanEmail)) {
            setError("Te rugăm să introduci un email valid.");
            return;
        }

        if (!gdpr) {
            setError("Trebuie să accepți acordul GDPR pentru a te înscrie.");
            return;
        }

        try {
            setSending(true);

            // Demo front-only for now
            // Later: replace with POST /api/newsletter
            await new Promise((r) => setTimeout(r, 650));

            setSuccess(true);
            setEmail("");
            setGdpr(false);
        } catch (err) {
            console.error(err);
            setError("A apărut o eroare. Încearcă din nou.");
        } finally {
            setSending(false);
        }
    };

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

                    {/* ===== Newsletter directly under calendar ===== */}
                    <div className="nl-inlineWrap">
                        <div className="nl-inlineCard">
                            <div className="nl-inlineLeft">
                                <div className="nl-inlineTitle">Primește evenimente pe email</div>
                                <div className="nl-inlineSub">
                                    Abonează-te și vei primi anunțuri când apar evenimente noi.
                                </div>
                            </div>

                            <div className="nl-inlineRight">
                                {success ? (
                                    <div className="nl-inlineSuccess">
                                        Înscriere reușită ✅
                                        <div className="nl-inlineSuccessSub">Mulțumim! Vei primi următoarele evenimente pe email.</div>
                                    </div>
                                ) : (
                                    <form className="nl-inlineForm" onSubmit={onSubscribe}>
                                        <label className="nl-inlineField">
                                            <span>Email</span>
                                            <input
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                placeholder="ex: nume@email.com"
                                                autoComplete="email"
                                                inputMode="email"
                                                disabled={sending}
                                            />
                                        </label>

                                        <label className="nl-inlineGdpr">
                                            <input
                                                type="checkbox"
                                                checked={gdpr}
                                                onChange={(e) => setGdpr(e.target.checked)}
                                                disabled={sending}
                                            />
                                            <span>
                        Sunt de acord să primesc emailuri și accept prelucrarea datelor conform GDPR.
                      </span>
                                        </label>

                                        {error && <div className="nl-inlineError">{error}</div>}

                                        <button className="nl-inlineBtn" type="submit" disabled={sending}>
                                            {sending ? "Se trimite..." : "Înscrie-mă"}
                                        </button>
                                    </form>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ===== EVENT MODAL ===== */}
            {eventOpen && selectedEvent && (
                <div className="ev-overlay" onClick={closeEvent}>
                    <div className="ev-modal" onClick={(e) => e.stopPropagation()}>
                        <header className="ev-header">
                            <h2 className="ev-couple">{selectedEvent.couple}</h2>

                            <button type="button" className="ev-close" onClick={closeEvent} aria-label="Close" title="Close">
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