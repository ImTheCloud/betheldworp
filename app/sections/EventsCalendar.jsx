"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, serverTimestamp, setDoc, doc } from "firebase/firestore";
import { db } from "../lib/Firebase";
import "./EventsCalendar.css";

const WEEKDAY_LABELS = ["Lu", "Ma", "Mi", "Jo", "Vi", "Sâ", "Du"];

function getMondayIndex(jsDay) {
    return (jsDay + 6) % 7;
}

function pad2(n) {
    return String(n).padStart(2, "0");
}

function normalizeDateToIso(input) {
    const v = String(input || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;

    const m = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (m) {
        const dd = pad2(Number(m[1]));
        const mm = pad2(Number(m[2]));
        const yyyy = m[3];
        return `${yyyy}-${mm}-${dd}`;
    }

    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) {
        return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    }
    return v;
}

function formatDateBe(inputDate) {
    const iso = normalizeDateToIso(inputDate);
    const d = new Date(`${iso}T00:00:00`);
    return new Intl.DateTimeFormat("fr-BE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).format(d);
}

function formatMonthRo(firstOfMonth) {
    return firstOfMonth.toLocaleDateString("ro-RO", { month: "long", year: "numeric" });
}

function getEventAriaLabel(ev) {
    if (!ev) return "Eveniment";
    const parts = [ev.title || "Eveniment"];
    if (ev.description) parts.push(ev.description);
    if (ev.speaker) parts.push(`Prezentator: ${ev.speaker}`);
    if (ev.dateEvent) parts.push(ev.dateEvent);
    return parts.join(" · ");
}

function isSameMonth(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth();
}

export default function EventsCalendar() {
    const today = new Date();
    const todayIso = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
    const startOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [events, setEvents] = useState([]);
    const [eventsLoading, setEventsLoading] = useState(true);
    const [eventsError, setEventsError] = useState("");

    useEffect(() => {
        const unsub = onSnapshot(
            collection(db, "events"),
            (snap) => {
                const list = snap.docs
                    .map((d) => ({ ...d.data(), id: d.id }))
                    .filter((e) => e && e.dateEvent);
                setEvents(list);
                setEventsLoading(false);
                setEventsError("");
            },
            (err) => {
                console.error(err);
                setEventsError("Nu am putut încărca evenimentele.");
                setEventsLoading(false);
            }
        );
        return () => unsub();
    }, []);

    const eventsSorted = useMemo(() => {
        const copy = Array.isArray(events) ? [...events] : [];
        copy.sort((a, b) => normalizeDateToIso(a.dateEvent).localeCompare(normalizeDateToIso(b.dateEvent)));
        return copy;
    }, [events]);

    const eventsByDate = useMemo(() => {
        const map = new Map();
        for (const ev of eventsSorted) map.set(normalizeDateToIso(ev.dateEvent), ev);
        return map;
    }, [eventsSorted]);

    const [month, setMonth] = useState(startOfCurrentMonth);
    const [didPickMonth, setDidPickMonth] = useState(false);

    useEffect(() => {
        if (didPickMonth) return;
        if (!eventsSorted.length) return;

        const hasInCurrentMonth = eventsSorted.some((ev) => {
            const d = new Date(`${normalizeDateToIso(ev.dateEvent)}T00:00:00`);
            return isSameMonth(d, startOfCurrentMonth);
        });

        if (hasInCurrentMonth) {
            setMonth(startOfCurrentMonth);
            setDidPickMonth(true);
            return;
        }

        const next = eventsSorted.find((ev) => normalizeDateToIso(ev.dateEvent) >= todayIso) || eventsSorted[0];
        const nextDate = new Date(`${normalizeDateToIso(next.dateEvent)}T00:00:00`);
        setMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
        setDidPickMonth(true);
    }, [didPickMonth, eventsSorted, startOfCurrentMonth, todayIso]);

    const [eventOpen, setEventOpen] = useState(false);
    const [selectedId, setSelectedId] = useState(null);

    const selectedEvent = useMemo(
        () => eventsSorted.find((e) => e.id === selectedId) ?? null,
        [eventsSorted, selectedId]
    );

    useEffect(() => {
        if (!eventsSorted.length) return;
        if (selectedId && eventsSorted.some((e) => e.id === selectedId)) return;

        const todayEvent = eventsByDate.get(todayIso);
        const nextEvent = eventsSorted.find((ev) => normalizeDateToIso(ev.dateEvent) >= todayIso);
        setSelectedId((todayEvent?.id) || (nextEvent?.id) || eventsSorted[0].id);
    }, [eventsSorted, eventsByDate, todayIso, selectedId]);

    const openEvent = (ev) => {
        setSelectedId(ev.id);
        setEventOpen(true);
    };

    const closeEvent = () => setEventOpen(false);

    useEffect(() => {
        if (!eventOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prev;
        };
    }, [eventOpen]);

    const [email, setEmail] = useState("");
    const [sending, setSending] = useState(false);
    const [success, setSuccess] = useState(false);
    const [successText, setSuccessText] = useState("");
    const [error, setError] = useState("");

    const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

    const onSubscribe = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess(false);
        setSuccessText("");

        const cleanEmail = String(email || "").trim();
        const normalized = cleanEmail.toLowerCase();

        if (!isValidEmail(cleanEmail)) {
            setError("Te rugăm să introduci un email valid.");
            return;
        }

        try {
            setSending(true);

            await setDoc(doc(db, "newsletter", normalized), {
                email: normalized,
                createdAt: serverTimestamp(),
            });

            setSuccess(true);
            setSuccessText("Înscriere reușită ✓");
            setEmail("");
        } catch (err) {
            if (err?.code === "permission-denied") {
                setSuccess(true);
                setSuccessText("Ești deja abonat(ă) ✓");
                setEmail("");
                return;
            }

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
            const isToday = year === today.getFullYear() && m === today.getMonth() && day === today.getDate();
            cells.push({ type: "day", key: dateKey, day, isToday, event });
        }

        while (cells.length % 7 !== 0) cells.push({ type: "blank", key: `blank-end-${cells.length}` });
        return cells;
    }, [month, eventsByDate, today]);

    const goPrevMonth = () => setMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    const goNextMonth = () => setMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));

    const mapQuery = selectedEvent
        ? encodeURIComponent([selectedEvent.place, selectedEvent.address].filter(Boolean).join(", "))
        : "";

    return (
        <>
            <section id="evenimente" className="ec-section">
                <div className="ec-content">
                    <div className="ec-header">
                        <h2 className="ec-title">Evenimente</h2>
                    </div>

                    {eventsLoading && <div className="ec-inlineInfo">Se încarcă evenimentele...</div>}
                    {eventsError && <div className="ec-inlineError">{eventsError}</div>}

                    <div className="ec-card">
                        <div className="ec-head">
                            <button className="ec-navBtn" onClick={goPrevMonth} aria-label="Previous month">‹</button>
                            <div className="ec-month">{formatMonthRo(month)}</div>
                            <button className="ec-navBtn" onClick={goNextMonth} aria-label="Next month">›</button>
                        </div>

                        <div className="ec-weekdays">
                            {WEEKDAY_LABELS.map((d) => (
                                <div key={d} className="ec-weekday">{d}</div>
                            ))}
                        </div>

                        <div className="ec-grid">
                            {calendarCells.map((cell) => {
                                if (cell.type === "blank") return <div key={cell.key} className="ec-cell ec-blank" />;

                                const hasEvent = Boolean(cell.event);

                                return (
                                    <div
                                        key={cell.key}
                                        className={`ec-cell ${cell.isToday ? "is-today" : ""} ${hasEvent ? "has-events" : ""}`}
                                    >
                                        {!hasEvent && <div className="ec-dayBadge">{cell.day}</div>}

                                        {hasEvent ? (
                                            <button
                                                type="button"
                                                className="ec-eventCellBtn"
                                                onClick={() => openEvent(cell.event)}
                                                title={getEventAriaLabel(cell.event)}
                                                aria-label={getEventAriaLabel(cell.event)}
                                            >
                                                <img
                                                    className="ec-eventBg"
                                                    src={cell.event.image}
                                                    alt="Event"
                                                    loading="lazy"
                                                    decoding="async"
                                                />
                                            </button>
                                        ) : (
                                            <div className="ec-emptyBody" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="nl-section">
                        <div className="nl-header">
                            <h3 className="nl-subtitle">Newsletter</h3>
                        </div>

                        <div className="nl-card">
                            <p className="nl-description">
                                Abonează-te și vei primi anunțuri când apar evenimente noi
                            </p>

                            {success ? (
                                <div className="nl-success">
                                    <div className="nl-success-title">{successText || "Înscriere reușită ✓"}</div>
                                    <div className="nl-success-text">Mulțumim! Vei primi următoarele evenimente pe email.</div>
                                </div>
                            ) : (
                                <form className="nl-form" onSubmit={onSubscribe}>
                                    {error && <div className="nl-error">{error}</div>}

                                    <div className="nl-input-group">
                                        <input
                                            className="nl-input"
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="nume@email.com"
                                            autoComplete="email"
                                            disabled={sending}
                                        />
                                        <button className="nl-button" type="submit" disabled={sending}>
                                            {sending ? "Se trimite..." : "Abonează-te"}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {eventOpen && selectedEvent && (
                <div className="ev-overlay" onClick={closeEvent}>
                    <div className="ev-modal" onClick={(e) => e.stopPropagation()}>
                        <header className="ev-header">
                            <div className="ev-headText">
                                <h2 className="ev-title">{selectedEvent.title || "Eveniment"}</h2>
                                {selectedEvent.description ? <p className="ev-desc">{selectedEvent.description}</p> : null}
                            </div>

                            <button type="button" className="ev-close" onClick={closeEvent} aria-label="Close">
                                ×
                            </button>
                        </header>

                        <div className="ev-body">
                            <div className="ev-heroImgWrap">
                                <img className="ev-heroImg" src={selectedEvent.image} alt="Event" />
                            </div>

                            <div className="ev-infoGrid">
                                <div className="ev-infoCard">
                                    <div className="ev-infoLabel">Ora</div>
                                    <div className="ev-infoValue">{selectedEvent.time}</div>
                                </div>

                                <div className="ev-infoCard">
                                    <div className="ev-infoLabel">Data</div>
                                    <div className="ev-infoValue">{formatDateBe(selectedEvent.dateEvent)}</div>
                                </div>

                                <div className="ev-infoCard ev-infoCard--wide">
                                    <div className="ev-infoLabel">Locație</div>
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