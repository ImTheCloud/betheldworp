"use client";

import { useEffect, useMemo, useState, useCallback, useId, useRef } from "react";
import Image from "next/image";
import { collection, onSnapshot } from "firebase/firestore";
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

function safeStr(v) {
    return typeof v === "string" ? v : (v == null ? "" : String(v));
}

function normalizeDateToIso(input) {
    const v = String(input || "").trim();
    if (!v) return "";
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

function getDatesInRange(startIso, endIso) {
    if (!startIso) return [];
    if (!endIso || endIso <= startIso) return [startIso];

    const dates = [];
    const current = new Date(`${startIso}T12:00:00Z`);
    const end = new Date(`${endIso}T12:00:00Z`);

    if (Number.isNaN(current.getTime()) || Number.isNaN(end.getTime())) {
        return [startIso];
    }

    let count = 0;
    while (current <= end && count < 366) {
        dates.push(current.toISOString().slice(0, 10));
        current.setUTCDate(current.getUTCDate() + 1);
        count++;
    }
    return dates.length > 0 ? dates : [startIso];
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

// Petites icônes de la fenêtre d'un événement, dans le trait des autres
// pictos du site. Le libellé reste lisible par les lecteurs d'écran.
function EventInfoIcon({ kind, label }) {
    const paths = {
        time: (
            <>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
            </>
        ),
        date: (
            <>
                <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
                <path d="M3.5 10h17M8 3v4M16 3v4" />
            </>
        ),
        place: (
            <>
                <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
                <circle cx="12" cy="10" r="2.4" />
            </>
        ),
    };
    return (
        <svg
            className="ev-infoIcon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            role="img"
            aria-label={label}
        >
            {paths[kind]}
        </svg>
    );
}

// Description d'un événement : un paragraphe par bloc séparé d'une ligne vide.
// Une première ligne courte terminée par une virgule (« Pacea Domnului, ») est
// une salutation : elle est mise en valeur plutôt que fondue dans le texte.
function EventDescription({ text }) {
    const blocks = String(text ?? "").split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
    if (!blocks.length) return null;
    return (
        <div className="ev-desc">
            {blocks.map((block, i) => {
                const isGreeting = i === 0 && block.length <= 40 && !block.includes("\n") && /,$/.test(block);
                return (
                    <p key={i} className={isGreeting ? "ev-descGreeting" : undefined}>{block}</p>
                );
            })}
        </div>
    );
}

export default function EventsCalendar() {
    const { lang } = useLang();
    const t = useMemo(() => makeT(tr, lang), [lang]);
    const locale = useMemo(() => getLocale(lang), [lang]);

    const weekdayLabels = useMemo(() => {
        const map = tr?.[lang]?.weekday_labels || tr?.ro?.weekday_labels;
        return Array.isArray(map) ? map : ["Lu", "Ma", "Mi", "Jo", "Vi", "Sâ", "Du"];
    }, [lang]);

    // Figés au montage, et non recalculés à chaque rendu.
    //
    // startOfCurrentMonth est un objet Date : recréé à chaque rendu, il changeait
    // d'identité à chaque fois et faisait re-tourner l'effet de sélection du mois
    // à chaque rendu de la page, l'effet ne faisait rien une fois le mois choisi,
    // mais il tournait quand même.
    //
    // Conséquence assumée : une page laissée ouverte en passant minuit garde la
    // date d'hier jusqu'au prochain rechargement. C'était déjà le cas en pratique,
    // puisque le mois sélectionné n'est calculé qu'une fois.
    const { todayIso, startOfCurrentMonth } = useMemo(() => {
        const maintenant = new Date();
        return {
            todayIso: `${maintenant.getFullYear()}-${pad2(maintenant.getMonth() + 1)}-${pad2(maintenant.getDate())}`,
            startOfCurrentMonth: new Date(maintenant.getFullYear(), maintenant.getMonth(), 1),
        };
    }, []);

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
                        const endDate = normalizeDateToIso(data.endDate);
                        return {
                            ...data,
                            id: d.id,
                            dateEvent,
                            endDate: endDate && endDate > dateEvent ? endDate : "",
                            time: String(data?.time ?? "").trim(),
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
            const startIso = String(ev.dateEvent || "").trim();
            const endIso = String(ev.endDate || "").trim();
            const dates = getDatesInRange(startIso, endIso);
            for (const date of dates) {
                if (!map.has(date)) {
                    map.set(date, []);
                }
                map.get(date).push(ev);
            }
        }
        return map;
    }, [eventsSorted]);

    const [month, setMonth] = useState(startOfCurrentMonth);
    const [didPickMonth, setDidPickMonth] = useState(false);

    useEffect(() => {
        if (didPickMonth) return;
        if (!eventsSorted.length) return;

        const hasInCurrentMonth = eventsSorted.some((ev) => {
            const dStart = new Date(`${ev.dateEvent}T00:00:00`);
            const dEnd = ev.endDate ? new Date(`${ev.endDate}T00:00:00`) : dStart;
            return isSameMonth(dStart, startOfCurrentMonth) || isSameMonth(dEnd, startOfCurrentMonth);
        });

        if (hasInCurrentMonth) {
            setMonth(startOfCurrentMonth);
            setDidPickMonth(true);
            return;
        }

        const next = eventsSorted.find((ev) => (ev.endDate || ev.dateEvent) >= todayIso) || eventsSorted[0];
        const nextDate = new Date(`${next.dateEvent}T00:00:00`);
        setMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
        setDidPickMonth(true);
    }, [didPickMonth, eventsSorted, startOfCurrentMonth, todayIso]);

    const [selectedDate, setSelectedDate] = useState(null);
    const [eventIndex, setEventIndex] = useState(0);
    const preventNextScrollRef = useRef(false);
    const internalNavRef = useRef(false);
    const touchStartRef = useRef(null);
    const eventScrollRef = useRef(null);
    const closeButtonRef = useRef(null);
    const eventTitleId = useId();

    const eventsForSelectedDate = useMemo(() => {
        if (!selectedDate) return [];
        return eventsByDate.get(selectedDate) || [];
    }, [eventsByDate, selectedDate]);

    const selectedEvent = useMemo(() => {
        return eventsForSelectedDate[eventIndex] || null;
    }, [eventsForSelectedDate, eventIndex]);

    const selectedEventImages = useMemo(() => {
        if (!selectedEvent) return [];
        if (Array.isArray(selectedEvent.images) && selectedEvent.images.length > 0) {
            return selectedEvent.images.filter(Boolean);
        }
        if (selectedEvent.image) {
            return [selectedEvent.image];
        }
        return [];
    }, [selectedEvent]);

    // Keep gallery selection scoped to the event, including when navigating dates.
    const [gallerySelection, setGallerySelection] = useState(null);
    const [imageFormats, setImageFormats] = useState({});
    const imageIndex = gallerySelection && gallerySelection.eventId === selectedEvent?.id
        ? Math.min(gallerySelection.index, Math.max(0, selectedEventImages.length - 1)) : 0;
    const activeImage = selectedEventImages[imageIndex];
    const imageFormat = activeImage ? (imageFormats[activeImage]?.format || "landscape") : "none";

    useEffect(() => {
        if (eventScrollRef.current) eventScrollRef.current.scrollTop = 0;
    }, [selectedEvent?.id]);

    useEffect(() => {
        if (!eventsSorted.length) return;
        if (selectedDate && eventsByDate.has(selectedDate)) return;

        const nextEvent = eventsSorted.find((ev) => (ev.endDate || ev.dateEvent) >= todayIso) || eventsSorted[0];
        setSelectedDate(nextEvent.dateEvent);
        setEventIndex(0);
    }, [eventsSorted, eventsByDate, todayIso, selectedDate]);

    const [eventOpen, setEventOpen] = useState(false);
    const [eventClosing, setEventClosing] = useState(false);
    const closeTimerRef = useRef(null);

    const openEvent = useCallback((date, index = 0, eventIdOverride = null) => {
        if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }
        setEventClosing(false);
        preventNextScrollRef.current = true;
        setSelectedDate(date);
        setEventIndex(index);
        setEventOpen(true);

        const dateEvents = eventsByDate.get(date) || [];
        const ev = eventIdOverride ? { id: eventIdOverride } : dateEvents[index];

        if (ev?.id && typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            params.set("event", ev.id);
            window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
        }
    }, [eventsByDate]);

    // Handle deep-linking on initial load
    useEffect(() => {
        if (eventsLoading || !eventsSorted.length) return;
        if (eventOpen) return;

        if (typeof window === "undefined") return;
        const params = new URLSearchParams(window.location.search);
        const eventId = params.get("event");
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

            if (!preventNextScrollRef.current) {
                setTimeout(() => {
                    const section = document.getElementById("evenimente");
                    if (section) section.scrollIntoView({ behavior: "smooth" });
                }, 500);
            }
            preventNextScrollRef.current = false;
        }
    }, [eventsLoading, eventsSorted, eventsByDate, eventOpen]);

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
        const previousFocus = document.activeElement;
        document.body.style.overflow = "hidden";
        closeButtonRef.current?.focus({ preventScroll: true });
        return () => {
            document.body.style.overflow = prev;
            previousFocus?.focus({ preventScroll: true });
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

    const formatEventDateRange = (startIso, endIso) => {
        if (!startIso) return "";
        if (!endIso || endIso <= startIso) {
            return formatDate(startIso);
        }
        const dStart = new Date(`${startIso}T00:00:00`);
        const dEnd = new Date(`${endIso}T00:00:00`);
        if (Number.isNaN(dStart.getTime()) || Number.isNaN(dEnd.getTime())) {
            return formatDate(startIso);
        }

        const sameYear = dStart.getFullYear() === dEnd.getFullYear();
        const sameMonth = sameYear && dStart.getMonth() === dEnd.getMonth();

        if (sameMonth) {
            const endFormatted = formatDate(endIso);
            return `${dStart.getDate()} – ${endFormatted}`;
        }

        if (sameYear) {
            const startStr = dStart.toLocaleDateString(locale, { day: "numeric", month: "long" });
            const endStr = dEnd.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
            return `${startStr} – ${endStr}`;
        }

        return `${formatDate(startIso)} – ${formatDate(endIso)}`;
    };

    // Dans la fenêtre d'un événement, on nomme aussi le jour (« Vineri, 27 noiembrie
    // 2026 ») : c'est plus parlant que la date seule. Les périodes restent inchangées.
    const formatEventDateLong = (startIso, endIso) => {
        if (!startIso || (endIso && endIso > startIso)) return formatEventDateRange(startIso, endIso);
        const d = new Date(`${startIso}T00:00:00`);
        if (Number.isNaN(d.getTime())) return formatEventDateRange(startIso, endIso);
        const weekday = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(d);
        const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(d);
        return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${date}`;
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
        if (ev.dateEvent) parts.push(formatEventDateRange(ev.dateEvent, ev.endDate));
        if (ev.time) parts.push(ev.time);
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
        preventNextScrollRef.current = true;
        const nextIdx = (eventIndex - 1 + eventsForSelectedDate.length) % eventsForSelectedDate.length;
        setEventIndex(nextIdx);

        const ev = eventsForSelectedDate[nextIdx];
        if (ev?.id && typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            params.set("event", ev.id);
            window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
        }
    };

    const nextEventInList = () => {
        preventNextScrollRef.current = true;
        const nextIdx = (eventIndex + 1) % eventsForSelectedDate.length;
        setEventIndex(nextIdx);

        const ev = eventsForSelectedDate[nextIdx];
        if (ev?.id && typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            params.set("event", ev.id);
            window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
        }
    };

    const closeEvent = useCallback(() => {
        if (eventClosing) return;
        setEventClosing(true);

        if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }

        closeTimerRef.current = setTimeout(() => {
            setEventOpen(false);
            setEventClosing(false);
            closeTimerRef.current = null;
        }, 460);

        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            params.delete("event");
            const qs = params.toString();
            window.history.replaceState(null, "", `${window.location.pathname}${qs ? "?" + qs : ""}`);
        }
    }, [eventClosing]);

    useEffect(() => {
        if (!eventOpen) return;
        const handleEscape = (event) => {
            if (event.key === "Escape") closeEvent();
            if (event.key === "Tab") {
                const dialog = closeButtonRef.current?.closest('[role="dialog"]');
                const focusable = [...(dialog?.querySelectorAll('button, a[href], [tabindex="0"]') || [])]
                    .filter((element) => element.getClientRects().length > 0);
                if (!focusable?.length) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            }
        };
        window.addEventListener("keydown", handleEscape);
        return () => window.removeEventListener("keydown", handleEscape);
    }, [eventOpen, closeEvent]);

    useEffect(() => {
        return () => {
            if (closeTimerRef.current) {
                clearTimeout(closeTimerRef.current);
                closeTimerRef.current = null;
            }
        };
    }, []);

    const [copied, setCopied] = useState(false);
    const handleShare = async () => {
        if (!selectedEvent || typeof window === "undefined") return;
        const url = `${window.location.origin}${window.location.pathname}?event=${selectedEvent.id}`;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: selectedEvent.title || t("event"),
                    text: selectedEvent.description || "",
                    url: url,
                });
                return;
            } catch {
                // Partage annulé ou refusé : on retombe silencieusement sur la copie.
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

    const handleTouchStart = (e) => {
        touchStartRef.current = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
            target: e.target,
        };
    };

    const handleTouchEnd = (e) => {
        if (!touchStartRef.current) return;
        const touchEnd = {
            x: e.changedTouches[0].clientX,
            y: e.changedTouches[0].clientY,
        };

        const dx = touchEnd.x - touchStartRef.current.x;
        const dy = touchEnd.y - touchStartRef.current.y;
        const startTarget = touchStartRef.current.target;
        touchStartRef.current = null;

        // Swipe down to close (dragged down from header/drag-handle or dragged down when at the top)
        const isHeaderTouch = startTarget && (startTarget.closest?.(".ev-eventHeader, .ev-drag-handle"));
        if (isHeaderTouch && dy > 50 && Math.abs(dy) > Math.abs(dx)) {
            closeEvent();
            return;
        }

        // Threshold of 50px for horizontal swipe
        // Must be primarily horizontal (dx > dy)
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
            if (dx > 0) {
                prevEventInList();
            } else {
                nextEventInList();
            }
        }
    };



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
                <div className={`ev-overlay ${eventClosing ? "is-closing" : ""}`} onClick={closeEvent}>
                    <div
                        className={`ev-modal ev-eventModal ${eventClosing ? "is-closing" : ""}`}
                        style={{ "--ev-media-ratio": imageFormats[activeImage]?.ratio || 1.5 }}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={eventTitleId}
                        onClick={(e) => e.stopPropagation()}
                        onTouchStart={handleTouchStart}
                        onTouchEnd={handleTouchEnd}
                    >
                        <div className="ev-eventActions">
                            <button
                                type="button"
                                className={`ev-share-btn ${copied ? "is-copied" : ""}`}
                                onClick={handleShare}
                                aria-label={t("share")}
                            >
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    {copied ? <path d="m5 12 4 4L19 6" /> : <path d="M12 15V3m-4 4 4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />}
                                </svg>
                            </button>
                            {copied && <span className="ev-share-label" role="status">{t("copied")}</span>}
                            <button type="button" className="ev-close" ref={closeButtonRef} onClick={closeEvent} aria-label={t("close")}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
                                    <path d="m6 6 12 12M18 6 6 18" />
                                </svg>
                            </button>
                        </div>
                        <div className="ev-drag-handle" aria-hidden="true" />
                        <div className="ev-eventScroll" ref={eventScrollRef}>
                            <div
                                className={`ev-layout ev-layout--${imageFormat}`}
                            >
                                {activeImage && (
                                    <div className="ev-media">
                                        <a className="ev-imageLink" href={activeImage} target="_blank" rel="noopener noreferrer">
                                            <img
                                                key={activeImage}
                                                className="ev-heroImg"
                                                src={activeImage}
                                                alt={selectedEvent.title || t("event")}
                                                onLoad={({ currentTarget: img }) => {
                                                    const ratio = img.naturalWidth / img.naturalHeight;
                                                    const format = ratio < 0.85 ? "portrait" : ratio > 1.2 ? "landscape" : "square";
                                                    setImageFormats((previous) => previous[activeImage]?.format === format
                                                        ? previous : { ...previous, [activeImage]: { format, ratio } });
                                                }}
                                            />
                                        </a>
                                        {selectedEventImages.length > 1 && (
                                            <div className="ev-thumbnails" role="group" aria-label={t("event")}>
                                                {selectedEventImages.map((src, index) => (
                                                    <button type="button" key={`${index}-${src}`}
                                                        aria-label={`${selectedEvent.title || t("event")} — ${index + 1} / ${selectedEventImages.length}`}
                                                        aria-pressed={imageIndex === index}
                                                        onClick={() => setGallerySelection({ eventId: selectedEvent.id, index })}>
                                                        <img src={src} alt="" />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <header className="ev-eventHeader">
                                    <h2 className="ev-title" id={eventTitleId}>{selectedEvent.title || t("event")}</h2>
                                </header>

                                <div className="ev-details">
                                    <div className="ev-infoGrid">
                                        <div className="ev-schedule">
                                            <div className="ev-infoRow">
                                                <EventInfoIcon kind="date" label={t("date")} />
                                                <div className="ev-infoValue">
                                                    {formatEventDateLong(selectedEvent.dateEvent, selectedEvent.endDate)}
                                                </div>
                                            </div>

                                            {selectedEvent.time && (
                                                <div className="ev-infoRow">
                                                    <EventInfoIcon kind="time" label={t("time")} />
                                                    <div className="ev-infoValue">{selectedEvent.time}</div>
                                                </div>
                                            )}
                                        </div>

                                        {mapQuery && (
                                            <div className="ev-location">
                                                <div className="ev-infoRow">
                                                    <EventInfoIcon kind="place" label={t("location")} />
                                                    <div className="ev-infoValue">
                                                        {selectedEvent.place}
                                                        {selectedEvent.address && (
                                                            <a className="ev-infoSub ev-addressLink"
                                                                href={`https://www.google.com/maps?q=${mapQuery}`}
                                                                target="_blank" rel="noopener noreferrer"
                                                                title={t("open_map")}>
                                                                {selectedEvent.address} <span aria-hidden="true">↗</span>
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                                <a
                                                    className="ev-mapLink"
                                                    href={`https://www.google.com/maps?q=${mapQuery}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    {t("open_map")}
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                        <path d="M8 16 19 5M9 5h10v10" />
                                                    </svg>
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {selectedEvent.description && <EventDescription text={selectedEvent.description} />}
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

    const allImages = useMemo(() => {
        const list = [];
        events.forEach((ev) => {
            const imgs = Array.isArray(ev.images) && ev.images.length > 0
                ? ev.images.filter(Boolean)
                : (ev.image ? [ev.image] : []);
            imgs.forEach((imgSrc, i) => {
                list.push({ key: `${ev.id}-${i}-${imgSrc}`, src: imgSrc });
            });
        });
        return list;
    }, [events]);

    useEffect(() => {
        if (allImages.length <= 1) return;
        const timer = setInterval(() => {
            setIndex((prev) => (prev + 1) % allImages.length);
        }, 3000);
        return () => clearInterval(timer);
    }, [allImages.length]);

    if (allImages.length === 0) return null;

    return (
        <div className="ec-eventImgContainer">
            {allImages.map((item, i) => (
                <Image
                    key={item.key}
                    className={`ec-eventBg ${i === index ? "active" : ""}`}
                    src={item.src}
                    alt={t("event")}
                    fill
                    quality={90}
                    sizes="(max-width: 600px) 33vw, 160px"
                />
            ))}
        </div>
    );
}
