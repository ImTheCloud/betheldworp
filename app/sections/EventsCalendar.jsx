"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
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

function pickByLang(value, lang) {
    if (!value) return "";
    if (typeof value === "string") return String(value || "").trim();
    if (typeof value === "object") {
        const v = value?.[lang] ?? value?.ro ?? value?.en ?? "";
        return String(v || "").trim();
    }
    return "";
}

export default function EventsCalendar() {
    const { lang } = useLang();
    const t = useMemo(() => makeT(tr, lang), [lang]);
    const locale = useMemo(() => getLocale(lang), [lang]);

    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

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
                const list = snap.docs
                    .map((d) => {
                        const data = d.data() || {};
                        const dateEvent = normalizeDateToIso(data.dateEvent);
                        return {
                            ...data,
                            id: d.id,
                            dateEvent,
                            title: pickByLang(data.title, lang),
                            description: pickByLang(data.description, lang),
                        };
                    })
                    .filter((e) => e && e.dateEvent);

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
    }, [lang, t]);

    const eventsSorted = useMemo(() => {
        const copy = Array.isArray(events) ? [...events] : [];
        copy.sort((a, b) => String(a.dateEvent || "").localeCompare(String(b.dateEvent || "")));
        return copy;
    }, [events]);

    const eventsByDate = useMemo(() => {
        const map = new Map();
        for (const ev of eventsSorted) {
            const date = String(ev.dateEvent || "");
            if (!map.has(date)) {
                map.set(date, []);
            }
            map.get(date).push(ev);
        }
        return map;
    }, [eventsSorted]);

    const [month, setMonth] = useState(startOfCurrentMonth);
    const [didPickMonth, setDidPickMonth] = useState(false);

    useEffect(() => {
        if (didPickMonth) return;
        if (!eventsSorted.length) return;

        const hasInCurrentMonth = eventsSorted.some((ev) => {
            const d = new Date(`${ev.dateEvent}T00:00:00`);
            return isSameMonth(d, startOfCurrentMonth);
        });

        if (hasInCurrentMonth) {
            setMonth(startOfCurrentMonth);
            setDidPickMonth(true);
            return;
        }

        const next = eventsSorted.find((ev) => ev.dateEvent >= todayIso) || eventsSorted[0];
        const nextDate = new Date(`${next.dateEvent}T00:00:00`);
        setMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
        setDidPickMonth(true);
    }, [didPickMonth, eventsSorted, startOfCurrentMonth, todayIso]);

    const [selectedDate, setSelectedDate] = useState(null);
    const [eventIndex, setEventIndex] = useState(0);
    const preventNextScrollRef = useRef(false);

    const eventsForSelectedDate = useMemo(() => {
        if (!selectedDate) return [];
        return eventsByDate.get(selectedDate) || [];
    }, [eventsByDate, selectedDate]);

    const selectedEvent = useMemo(() => {
        return eventsForSelectedDate[eventIndex] || null;
    }, [eventsForSelectedDate, eventIndex]);

    useEffect(() => {
        if (!eventsSorted.length) return;
        if (selectedDate && eventsByDate.has(selectedDate)) return;

        const nextEvent = eventsSorted.find((ev) => ev.dateEvent >= todayIso) || eventsSorted[0];
        setSelectedDate(nextEvent.dateEvent);
        setEventIndex(0);
    }, [eventsSorted, eventsByDate, todayIso, selectedDate]);

    const [eventOpen, setEventOpen] = useState(false);

    const openEvent = useCallback((date, index = 0, eventIdOverride = null) => {
        preventNextScrollRef.current = true;
        setSelectedDate(date);
        setEventIndex(index);
        setEventOpen(true);

        const dateEvents = eventsByDate.get(date) || [];
        const ev = eventIdOverride ? { id: eventIdOverride } : dateEvents[index];

        if (ev?.id) {
            const params = new URLSearchParams(searchParams.toString());
            params.set("event", ev.id);
            router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        }
    }, [eventsByDate, searchParams, router, pathname]);

    // Handle deep-linking on load
    useEffect(() => {
        if (eventsLoading || !eventsSorted.length) return;
        const eventId = searchParams.get("event");
        if (!eventId) return;

        const ev = eventsSorted.find((x) => x.id === eventId);
        if (ev) {
            // Navigate calendar to the event's month
            const d = new Date(`${ev.dateEvent}T00:00:00`);
            if (!Number.isNaN(d.getTime())) {
                setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
            }
            setSelectedDate(ev.dateEvent);
            const dateEvents = eventsByDate.get(ev.dateEvent) || [];
            const idx = dateEvents.findIndex(x => x.id === eventId);
            setEventIndex(idx >= 0 ? idx : 0);
            setEventOpen(true);

            // Scroll to the events section (only if not prevented)
            if (!preventNextScrollRef.current) {
                setTimeout(() => {
                    const section = document.getElementById("evenimente");
                    if (section) section.scrollIntoView({ behavior: "smooth" });
                }, 500);
            }
            preventNextScrollRef.current = false;
        }
    }, [eventsLoading, eventsSorted, eventsByDate, searchParams]);

    // Listen for "open-event" dispatched from WeeklyProgram
    useEffect(() => {
        const handler = (e) => {
            const eventId = e?.detail?.eventId;
            if (!eventId) return;
            preventNextScrollRef.current = true;
            const ev = eventsSorted.find((x) => x.id === eventId);
            if (!ev) return;

            // Navigate calendar to the event's month
            const d = new Date(`${ev.dateEvent}T00:00:00`);
            if (!Number.isNaN(d.getTime())) {
                setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
            }

            const dateEvents = eventsByDate.get(ev.dateEvent) || [];
            const idx = dateEvents.findIndex(x => x.id === eventId);
            openEvent(ev.dateEvent, idx >= 0 ? idx : 0, eventId);
        };
        window.addEventListener("open-event", handler);
        return () => window.removeEventListener("open-event", handler);
    }, [eventsSorted, eventsByDate, openEvent]);

    useEffect(() => {
        if (!eventOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prev;
        };
    }, [eventOpen]);



    const formatDate = (iso) => {
        const d = new Date(`${iso}T00:00:00`);
        return new Intl.DateTimeFormat(locale, {
            day: "2-digit",
            month: "long",
            year: "numeric",
        }).format(d);
    };

    const formatMonth = (firstOfMonth) => {
        return firstOfMonth.toLocaleDateString(locale, { month: "long", year: "numeric" });
    };

    const getEventAriaLabel = (evs) => {
        if (!evs || !evs.length) return t("event");
        if (evs.length > 1) return `${evs.length} ${t("events_count") || "evenimente"}`;
        const ev = evs[0];
        const parts = [ev.title || t("event")];
        if (ev.description) parts.push(ev.description);
        if (ev.dateEvent) parts.push(formatDate(ev.dateEvent));
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
            const dateEvents = eventsByDate.get(iso) ?? [];

            const isToday = iso === todayIso;
            const inCurrentMonth = d.getFullYear() === year && d.getMonth() === m;
            const isNextMonth = d.getTime() > lastOfMonth.getTime();

            cells.push({
                key: iso,
                iso,
                day: d.getDate(),
                isToday,
                inCurrentMonth,
                isNextMonth,
                dateEvents,
            });
        }

        return cells;
    }, [month, eventsByDate, todayIso]);

    const goPrevMonth = () => setMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    const goNextMonth = () => setMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));

    const prevEventInList = () => {
        const nextIdx = (eventIndex - 1 + eventsForSelectedDate.length) % eventsForSelectedDate.length;
        setEventIndex(nextIdx);

        const ev = eventsForSelectedDate[nextIdx];
        if (ev?.id) {
            const params = new URLSearchParams(searchParams.toString());
            params.set("event", ev.id);
            router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        }
    };

    const nextEventInList = () => {
        const nextIdx = (eventIndex + 1) % eventsForSelectedDate.length;
        setEventIndex(nextIdx);

        const ev = eventsForSelectedDate[nextIdx];
        if (ev?.id) {
            const params = new URLSearchParams(searchParams.toString());
            params.set("event", ev.id);
            router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        }
    };

    const closeEvent = () => {
        setEventOpen(false);
        const params = new URLSearchParams(searchParams.toString());
        params.delete("event");
        router.replace(`${pathname}${params.toString() ? "?" + params.toString() : ""}`, { scroll: false });
    };

    const [copied, setCopied] = useState(false);
    const handleShare = async () => {
        if (!selectedEvent) return;
        const url = `${window.location.origin}${pathname}?event=${selectedEvent.id}`;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: selectedEvent.title || t("event"),
                    text: selectedEvent.description || "",
                    url: url,
                });
                return;
            } catch (err) {
                // If sharing was cancelled or failed, fallback to copy
                console.log("Web Share cancelled/failed, falling back to copy.");
            }
        }

        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Clipboard copy failed:", err);
        }
    };

    const mapQuery = selectedEvent ? encodeURIComponent([selectedEvent.place, selectedEvent.address].filter(Boolean).join(", ")) : "";



    return (
        <>
            <section className="ec-section">
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
                                return (
                                    <div
                                        key={cell.key}
                                        className={[
                                            "ec-cell",
                                            cell.isToday ? "is-today" : "",
                                            cell.dateEvents.length > 0 ? "has-events" : "",
                                            (!cell.inCurrentMonth && !cell.isNextMonth) ? "is-outside" : "",
                                        ]
                                            .filter(Boolean)
                                            .join(" ")}
                                    >
                                        {cell.dateEvents.length === 0 ? (
                                            <div className="ec-dayBadge">{cell.day}</div>
                                        ) : null}

                                        {cell.dateEvents.length > 0 ? (
                                            <button
                                                type="button"
                                                className="ec-eventCellBtn"
                                                onClick={() => openEvent(cell.iso)}
                                                title={getEventAriaLabel(cell.dateEvents)}
                                                aria-label={getEventAriaLabel(cell.dateEvents)}
                                            >
                                                <CalendarCellImage events={cell.dateEvents} t={t} />
                                                <div className="ec-dayBadge">{cell.day}</div>
                                                {cell.dateEvents.length > 1 && (
                                                    <div className="ec-multiBadge">+{cell.dateEvents.length}</div>
                                                )}
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

            {eventOpen && selectedEvent && (
                <div className="ev-overlay" onClick={closeEvent}>
                    <div className="ev-modal" onClick={(e) => e.stopPropagation()}>
                        <header className="ev-header">
                            <div className="ev-headText">
                                <h2 className="ev-title">{selectedEvent.title || t("event")}</h2>
                            </div>

                            <button type="button" className="ev-close" onClick={closeEvent} aria-label={t("close")}>
                                ×
                            </button>

                            <button
                                type="button"
                                className={`ev-share-btn ${copied ? "is-copied" : ""}`}
                                onClick={handleShare}
                                aria-label={t("share") || "Share"}
                            >
                                {copied ? (
                                    <span className="ev-share-label">{t("copied") || "Copied!"}</span>
                                ) : (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                                        <polyline points="16 6 12 2 8 6" />
                                        <line x1="12" y1="2" x2="12" y2="15" />
                                    </svg>
                                )}
                            </button>

                            {eventsForSelectedDate.length > 1 && (
                                <div className="ev-modal-nav ev-modal-nav--desktop">
                                    <button className="ev-nav-btn prev" onClick={prevEventInList} aria-label={t("prev_event") || "Previous"}>
                                        ‹
                                    </button>
                                    <span className="ev-nav-indicator">
                                        {eventIndex + 1} / {eventsForSelectedDate.length}
                                    </span>
                                    <button className="ev-nav-btn next" onClick={nextEventInList} aria-label={t("next_event") || "Next"}>
                                        ›
                                    </button>
                                </div>
                            )}
                        </header>

                        <div className="ev-body">
                            {selectedEvent.description ? <p className="ev-desc" style={{ marginBottom: 20 }}>{selectedEvent.description}</p> : null}
                            <div className="ev-layout">
                                <div className="ev-media">
                                    <div className="ev-heroImgWrap">
                                        <div className="ev-imgBlurBg" style={{ backgroundImage: `url(${selectedEvent.image})` }} aria-hidden="true" />
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

                        {eventsForSelectedDate.length > 1 && (
                            <div className="ev-modal-nav ev-modal-nav--mobile">
                                <button className="ev-nav-btn prev" onClick={prevEventInList} aria-label={t("prev_event") || "Previous"}>
                                    ‹
                                </button>
                                <span className="ev-nav-indicator">
                                    {eventIndex + 1} / {eventsForSelectedDate.length}
                                </span>
                                <button className="ev-nav-btn next" onClick={nextEventInList} aria-label={t("next_event") || "Next"}>
                                    ›
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}

function CalendarCellImage({ events, t }) {
    const [index, setIndex] = useState(0);

    useEffect(() => {
        if (events.length <= 1) return;
        const timer = setInterval(() => {
            setIndex((prev) => (prev + 1) % events.length);
        }, 3000);
        return () => clearInterval(timer);
    }, [events.length]);

    return (
        <div className="ec-eventImgContainer">
            {events.map((ev, i) => (
                <img
                    key={ev.id}
                    className={`ec-eventBg ${i === index ? "active" : ""}`}
                    src={ev.image}
                    alt={t("event")}
                    loading="lazy"
                    decoding="async"
                />
            ))}
        </div>
    );
}