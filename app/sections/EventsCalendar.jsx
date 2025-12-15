"use client";

import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, onSnapshot, serverTimestamp } from "firebase/firestore";
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

function getEventCellLabel(ev) {
    return ev?.title || "Eveniment";
}

function getEventAriaLabel(ev) {
    if (!ev) return "Eveniment";
    const parts = [getEventCellLabel(ev)];
    if (ev.subtitle) parts.push(ev.subtitle);
    if (ev.people) parts.push(ev.people);
    if (ev.speaker) parts.push(`Prezentator: ${ev.speaker}`);
    if (ev.dateEvent) parts.push(ev.dateEvent);
    return parts.join(" · ");
}

function buildModalHeadline(ev) {
    if (!ev) return "Eveniment";

    const base = ev.subtitle
        ? `${ev.title || "Eveniment"} — ${ev.subtitle}`
        : ev.title || "Eveniment";

    if (ev.people) return `${base}: ${ev.people}`;
    if (ev.speaker) return `${base}: ${ev.speaker}`;
    return base;
}

function isSameMonth(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth();
}

export default function EventsCalendar() {
    const today = new Date();
    const todayIso = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
    const startOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // ===== Events from Firestore =====
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

    // ===== Month logic =====
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

    // ===== Selected event (modal) =====
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

    // ===== Newsletter =====
    const [email, setEmail] = useState("");
    const [gdpr, setGdpr] = useState(false);
    const [sending, setSending] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");

    const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

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

            await addDoc(collection(db, "newsleter"), {
                email: cleanEmail,
                createdAt: serverTimestamp(),
            });

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

    // ===== Calendar cells =====
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
                year === today.getFullYear() && m === today.getMonth() && day === today.getDate();

            cells.push({ type: "day", key: dateKey, day, isToday, event });
        }

        while (cells.length % 7 !== 0) cells.push({ type: "blank", key: `blank-end-${cells.length}` });
        return cells;
    }, [month, eventsByDate, today]);

    const goPrevMonth = () => setMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    const goNextMonth = () => setMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));

    const mapQuery = selectedEvent ? encodeURIComponent(`${selectedEvent.place}, ${selectedEvent.address}`) : "";

    return (
        <>
            <section id="evenimente" className="ec-section">
                <div className="ec-content">
                    <h2 className="ec-title">Evenimente</h2>

                    {eventsLoading && <div className="ec-inlineInfo">Se încarcă evenimentele...</div>}
                    {eventsError && <div className="ec-inlineError">{eventsError}</div>}

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
                                                title={getEventAriaLabel(cell.event)}
                                                aria-label={getEventAriaLabel(cell.event)}
                                            >
                                                <img className="ec-eventBg" src={cell.event.image} alt="Event" />
                                            </button>
                                        ) : (
                                            <div className="ec-emptyBody" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* ===== Newsletter under calendar ===== */}
                    <div className="nl-inlineWrap">
                        <div className="nl-inlineCard">
                            <div className="nl-inlineLeft">
                                <div className="nl-inlineTitle">Primește evenimente pe email</div>
                                <div className="nl-inlineSub">Abonează-te și vei primi anunțuri când apar evenimente noi.</div>
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
                                            <span>Sunt de acord să primesc emailuri și accept prelucrarea datelor conform GDPR.</span>
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
                            <h2 className="ev-couple">{buildModalHeadline(selectedEvent)}</h2>

                            <button
                                type="button"
                                className="ev-close"
                                onClick={closeEvent}
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
                                    <div className="ev-infoValue">{formatDateBe(selectedEvent.dateEvent)}</div>
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