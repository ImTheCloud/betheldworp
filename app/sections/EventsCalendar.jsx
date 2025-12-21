"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, serverTimestamp, setDoc, doc } from "firebase/firestore";
import { db } from "../lib/Firebase";
import "./EventsCalendar.css";
import { useLang } from "../components/LanguageProvider";
import { getLocale, makeT } from "../lib/i18n";
import tr from "../translations/EventsCalendar.json";

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

function isSameMonth(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth();
}

export default function EventsCalendar() {
    const { lang } = useLang();
    const t = useMemo(() => makeT(tr, lang), [lang]);
    const locale = useMemo(() => getLocale(lang), [lang]);

    const weekdayLabels = useMemo(() => {
        const map = tr?.[lang]?.weekday_labels || tr?.ro?.weekday_labels;
        return Array.isArray(map) ? map : ["Lu", "Ma", "Mi", "Jo", "Vi", "Sâ", "Du"];
    }, [lang]);

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
                const list = snap.docs.map((d) => ({ ...d.data(), id: d.id })).filter((e) => e && e.dateEvent);
                setEvents(list);
                setEventsLoading(false);
                setEventsError("");
            },
            (err) => {
                console.error(err);
                setEventsError(t("error_load_events"));
                setEventsLoading(false);
            }
        );
        return () => unsub();
    }, [t]);

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

    const selectedEvent = useMemo(() => eventsSorted.find((e) => e.id === selectedId) ?? null, [eventsSorted, selectedId]);

    useEffect(() => {
        if (!eventsSorted.length) return;
        if (selectedId && eventsSorted.some((e) => e.id === selectedId)) return;

        const todayEvent = eventsByDate.get(todayIso);
        const nextEvent = eventsSorted.find((ev) => normalizeDateToIso(ev.dateEvent) >= todayIso);
        setSelectedId(todayEvent?.id || nextEvent?.id || eventsSorted[0].id);
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
            setError(t("email_invalid"));
            return;
        }

        try {
            setSending(true);

            await setDoc(doc(db, "newsletter", normalized), {
                email: normalized,
                createdAt: serverTimestamp(),
            });

            setSuccess(true);
            setSuccessText(t("subscribe_success_short"));
            setEmail("");
        } catch (err) {
            if (err?.code === "permission-denied") {
                setSuccess(true);
                setSuccessText(t("subscribe_already"));
                setEmail("");
                return;
            }

            console.error(err);
            setError(t("subscribe_error"));
        } finally {
            setSending(false);
        }
    };

    const formatDate = (inputDate) => {
        const iso = normalizeDateToIso(inputDate);
        const d = new Date(`${iso}T00:00:00`);
        return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
    };

    const formatMonth = (firstOfMonth) => {
        return firstOfMonth.toLocaleDateString(locale, { month: "long", year: "numeric" });
    };

    const getEventAriaLabel = (ev) => {
        if (!ev) return t("event");
        const parts = [ev.title || t("event")];
        if (ev.description) parts.push(ev.description);
        if (ev.dateEvent) parts.push(ev.dateEvent);
        return parts.join(" · ");
    };

    const calendarCells = useMemo(() => {
        const year = month.getFullYear();
        const m = month.getMonth();

        const firstOfMonth = new Date(year, m, 1);
        const lastOfMonth = new Date(year, m + 1, 0);

        const startOffset = getMondayIndex(firstOfMonth.getDay());
        const lastIndex = getMondayIndex(lastOfMonth.getDay());
        const endOffset = 6 - lastIndex;

        const gridStart = new Date(year, m, 1);
        gridStart.setDate(gridStart.getDate() - startOffset);

        const daysInMonth = lastOfMonth.getDate();
        const totalCells = daysInMonth + startOffset + endOffset;

        const cells = [];
        for (let i = 0; i < totalCells; i++) {
            const d = new Date(gridStart);
            d.setDate(gridStart.getDate() + i);

            const iso = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
            const event = eventsByDate.get(iso) ?? null;

            const isToday = iso === todayIso;
            const inCurrentMonth = d.getFullYear() === year && d.getMonth() === m;

            cells.push({
                key: iso,
                iso,
                day: d.getDate(),
                isToday,
                inCurrentMonth,
                event,
            });
        }

        return cells;
    }, [month, eventsByDate, todayIso]);

    const goPrevMonth = () => setMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    const goNextMonth = () => setMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));

    const mapQuery = selectedEvent ? encodeURIComponent([selectedEvent.place, selectedEvent.address].filter(Boolean).join(", ")) : "";

    return (
        <>
            <section id="evenimente" className="ec-section">
                <div className="ec-content">
                    <div className="ec-header">
                        <h2 className="ec-title">{t("title")}</h2>
                    </div>

                    {eventsLoading && <div className="ec-inlineInfo">{t("loading_events")}</div>}
                    {eventsError && <div className="ec-inlineError">{eventsError}</div>}

                    <div className="ec-card">
                        <div className="ec-head">
                            <button className="ec-navBtn" onClick={goPrevMonth} aria-label={t("prev_month")}>
                                ‹
                            </button>
                            <div className="ec-month">{formatMonth(month)}</div>
                            <button className="ec-navBtn" onClick={goNextMonth} aria-label={t("next_month")}>
                                ›
                            </button>
                        </div>

                        <div className="ec-weekdays">
                            {weekdayLabels.map((d) => (
                                <div key={d} className="ec-weekday">
                                    {d}
                                </div>
                            ))}
                        </div>

                        <div className="ec-grid">
                            {calendarCells.map((cell) => {
                                const hasEvent = Boolean(cell.event);

                                return (
                                    <div
                                        key={cell.key}
                                        className={[
                                            "ec-cell",
                                            cell.isToday ? "is-today" : "",
                                            hasEvent ? "has-events" : "",
                                            !cell.inCurrentMonth ? "is-outside" : "",
                                        ]
                                            .filter(Boolean)
                                            .join(" ")}
                                    >
                                        {!hasEvent ? <div className="ec-dayBadge">{cell.day}</div> : null}

                                        {hasEvent ? (
                                            <button
                                                type="button"
                                                className="ec-eventCellBtn"
                                                onClick={() => openEvent(cell.event)}
                                                title={getEventAriaLabel(cell.event)}
                                                aria-label={getEventAriaLabel(cell.event)}
                                            >
                                                <img className="ec-eventBg" src={cell.event.image} alt={t("event")} loading="lazy" decoding="async" />
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
                            <h3 className="nl-subtitle">{t("newsletter")}</h3>
                        </div>

                        <div className="nl-card">
                            <p className="nl-description">{t("newsletter_desc")}</p>

                            {success ? (
                                <div className="nl-success">
                                    <div className="nl-success-title">{successText || t("subscribe_success_short")}</div>
                                    <div className="nl-success-text">{t("subscribe_success_long")}</div>
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
                                            placeholder={t("email_placeholder")}
                                            autoComplete="email"
                                            disabled={sending}
                                        />
                                        <button className="nl-button" type="submit" disabled={sending}>
                                            {sending ? t("sending") : t("subscribe")}
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
                                <h2 className="ev-title">{selectedEvent.title || t("event")}</h2>
                                {selectedEvent.description ? <p className="ev-desc">{selectedEvent.description}</p> : null}
                            </div>

                            <button type="button" className="ev-close" onClick={closeEvent} aria-label={t("close")}>
                                ×
                            </button>
                        </header>

                        <div className="ev-body">
                            <div className="ev-layout">
                                <div className="ev-media">
                                    <div className="ev-heroImgWrap">
                                        <img className="ev-heroImg" src={selectedEvent.image} alt={t("event")} />
                                    </div>
                                </div>

                                <div className="ev-details">
                                    <div className="ev-infoGrid">
                                        <div className="ev-infoCard">
                                            <div className="ev-infoLabel">{t("time")}</div>
                                            <div className="ev-infoValue">{selectedEvent.time}</div>
                                        </div>

                                        <div className="ev-infoCard">
                                            <div className="ev-infoLabel">{t("date")}</div>
                                            <div className="ev-infoValue">{formatDate(selectedEvent.dateEvent)}</div>
                                        </div>

                                        <div className="ev-infoCard ev-infoCard--wide">
                                            <div className="ev-infoLabel">{t("location")}</div>
                                            <div className="ev-infoValue">
                                                {selectedEvent.place}
                                                <span className="ev-infoSub">{selectedEvent.address}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="ev-mapCard">
                                        <iframe
                                            className="ev-map"
                                            title={t("map_title")}
                                            loading="lazy"
                                            allowFullScreen
                                            referrerPolicy="no-referrer-when-downgrade"
                                            src={`https://www.google.com/maps?q=${mapQuery}&output=embed`}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}