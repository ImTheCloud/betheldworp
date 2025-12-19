"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../lib/Firebase";

const EVENT_TYPES = [
    { id: "cina", label: "Cina" },
    { id: "biserica", label: "Biserica" },
    { id: "conference", label: "Conferință" },
    { id: "wedding", label: "Nuntă" },
    { id: "children_blessing", label: "Binecuvântare copii" },
    { id: "botez", label: "Botez" },
    { id: "talantul_in_negot", label: "Talantul în negoț" },
    { id: "post", label: "Post" },
];

function safeStr(v) {
    return String(v ?? "");
}

function pad2(n) {
    return String(n).padStart(2, "0");
}

function getTodayRoSlash() {
    const d = new Date();
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function toIdDate(input) {
    const s = safeStr(input).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        const [yyyy, mm, dd] = s.split("-");
        return `${dd}-${mm}-${yyyy}`;
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
        const [dd, mm, yyyy] = s.split("/");
        return `${dd}-${mm}-${yyyy}`;
    }
    const m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (m) {
        const dd = m[1].padStart(2, "0");
        const mm = m[2].padStart(2, "0");
        const yyyy = m[3];
        return `${dd}-${mm}-${yyyy}`;
    }
    return s;
}

function parseDateEventToMs(input) {
    const s = safeStr(input).trim();
    if (!s) return null;

    let y, m, d;

    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        const parts = s.split("-").map(Number);
        y = parts[0];
        m = parts[1];
        d = parts[2];
    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
        const parts = s.split("/").map(Number);
        d = parts[0];
        m = parts[1];
        y = parts[2];
    } else if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
        const parts = s.split("-").map(Number);
        d = parts[0];
        m = parts[1];
        y = parts[2];
    } else {
        const mm = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
        if (!mm) return null;
        d = Number(mm[1]);
        m = Number(mm[2]);
        y = Number(mm[3]);
    }

    const dt = new Date(y, m - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
    dt.setHours(0, 0, 0, 0);
    return dt.getTime();
}

const DEFAULT_NEW = {
    title: "Cina Domnului și zi de post",
    description:
        'Pentru biserică, este o zi specială: va fi o zi de post până la aproximativ 16h. \n' +
        'De la 10:00 până la 12:30 va fi Cina Domnului în cadrul slujbei : Făcând acest lucru, ne amintim de fiecare dată de sacrificiul pe care Domnul Isus Hristos l-a făcut pe crucea de la Golgota, după aceea urmează o pauză până la 13:30, apoi reluăm programul bisericii până la 16:00. \n' +
        "Programul de seară de la 18h este anulat.",
    image: "/images/events/cina.png",
    time: "10:00 - 12:00",
    place: "Biserica Penticostala BETHEL Dworp",
    address: "Alsembergsesteenweg 572, 1653 Beersel",
};

function IconPlus(props) {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function IconTrash(props) {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
            <path d="M4 7h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path
                d="M6 7l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function IconChevronDown(props) {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function EventRow({ ev, expanded, onToggleExpand, draft, onChangeField, onRemove, onSave, savingState }) {
    const dirty = useMemo(() => {
        const fields = ["dateEvent", "title", "description", "image", "time", "place", "address"];
        return fields.some((f) => safeStr(draft?.[f]).trim() !== safeStr(ev?.[f]).trim());
    }, [draft, ev]);

    const summarySource = safeStr(ev.title).trim() || safeStr(ev.dateEvent).trim();
    const summary = summarySource.length <= 60 ? summarySource : summarySource.slice(0, 60) + "…";

    const handleCardClick = (e) => {
        if (e.target.closest("button, input, textarea, select, label")) return;
        onToggleExpand(ev.id);
    };

    return (
        <div className="adminAnnCard" onClick={handleCardClick}>
            <div className="adminAnnHeader">
                <div className="adminAnnIdChip">{ev.id}</div>
                {!expanded ? <div className="adminSummary">{summary}</div> : <div style={{ flex: 1 }} />}
                <button
                    type="button"
                    className="adminSmallBtn"
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleExpand(ev.id);
                    }}
                    aria-label={expanded ? "Ascunde detalii" : "Afișează detalii"}
                >
                    <IconChevronDown
                        style={{
                            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                            transition: "transform 0.2s ease",
                        }}
                    />
                </button>
            </div>

            {expanded && (
                <>
                    <div className="adminMutedLine">Tip: {ev.type || "(necunoscut)"}</div>

                    <label className="adminLabel">
                        Dată
                        <input
                            className="adminInput"
                            type="text"
                            value={safeStr(draft?.dateEvent)}
                            onChange={(e) => onChangeField(ev.id, "dateEvent", e.target.value)}
                            placeholder="dd/mm/yyyy sau yyyy-mm-dd"
                        />
                    </label>

                    <label className="adminLabel">
                        Titlu
                        <input
                            className="adminInput"
                            value={safeStr(draft?.title)}
                            onChange={(e) => onChangeField(ev.id, "title", e.target.value)}
                        />
                    </label>

                    <label className="adminLabel">
                        Descriere
                        <textarea
                            className="adminTextarea"
                            value={safeStr(draft?.description)}
                            onChange={(e) => onChangeField(ev.id, "description", e.target.value)}
                            rows={6}
                        />
                    </label>

                    <label className="adminLabel">
                        Imagine (URL)
                        <input
                            className="adminInput"
                            value={safeStr(draft?.image)}
                            onChange={(e) => onChangeField(ev.id, "image", e.target.value)}
                        />
                    </label>

                    <label className="adminLabel">
                        Orar
                        <input
                            className="adminInput"
                            value={safeStr(draft?.time)}
                            onChange={(e) => onChangeField(ev.id, "time", e.target.value)}
                        />
                    </label>

                    <label className="adminLabel">
                        Locație
                        <input
                            className="adminInput"
                            value={safeStr(draft?.place)}
                            onChange={(e) => onChangeField(ev.id, "place", e.target.value)}
                        />
                    </label>

                    <label className="adminLabel">
                        Adresă
                        <input
                            className="adminInput"
                            value={safeStr(draft?.address)}
                            onChange={(e) => onChangeField(ev.id, "address", e.target.value)}
                        />
                    </label>

                    <div className="adminMsgActions">
                        <button type="button" className="adminDeleteBtn" onClick={() => onRemove(ev.id)}>
                            <IconTrash />
                            Șterge
                        </button>

                        <button
                            type="button"
                            className="adminMsgSaveBtn"
                            onClick={() => onSave(ev)}
                            disabled={!dirty || savingState === "saving"}
                        >
                            {savingState === "saving"
                                ? "Se salvează…"
                                : savingState === "saved"
                                    ? "Salvat ✓"
                                    : "Salvează"}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

function NewEventCard({ newDraft, setNewDraft, newError, newState, onCancel, onSave, idPreview }) {
    return (
        <div className="adminAnnCard is-active">
            <div className="adminAnnHeader">
                <div className="adminAnnIdChip">Nou eveniment</div>
            </div>

            {idPreview ? <div className="adminMutedLine">ID: {idPreview}</div> : null}
            {newError ? <div className="adminAlert">{newError}</div> : null}

            <label className="adminLabel">
                Tip
                <select
                    className="adminInput"
                    value={safeStr(newDraft.type)}
                    onChange={(e) => setNewDraft((d) => ({ ...d, type: e.target.value }))}
                >
                    {EVENT_TYPES.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                            {opt.label}
                        </option>
                    ))}
                </select>
            </label>

            <label className="adminLabel">
                Dată
                <input
                    className="adminInput"
                    type="text"
                    placeholder="dd/mm/yyyy sau yyyy-mm-dd"
                    value={safeStr(newDraft.dateEvent)}
                    onChange={(e) => setNewDraft((d) => ({ ...d, dateEvent: e.target.value }))}
                />
            </label>

            <label className="adminLabel">
                Titlu
                <input
                    className="adminInput"
                    value={safeStr(newDraft.title)}
                    onChange={(e) => setNewDraft((d) => ({ ...d, title: e.target.value }))}
                />
            </label>

            <label className="adminLabel">
                Descriere
                <textarea
                    className="adminTextarea"
                    value={safeStr(newDraft.description)}
                    onChange={(e) => setNewDraft((d) => ({ ...d, description: e.target.value }))}
                    rows={6}
                />
            </label>

            <label className="adminLabel">
                Imagine (URL)
                <input
                    className="adminInput"
                    value={safeStr(newDraft.image)}
                    onChange={(e) => setNewDraft((d) => ({ ...d, image: e.target.value }))}
                />
            </label>

            <label className="adminLabel">
                Orar
                <input
                    className="adminInput"
                    value={safeStr(newDraft.time)}
                    onChange={(e) => setNewDraft((d) => ({ ...d, time: e.target.value }))}
                />
            </label>

            <label className="adminLabel">
                Locație
                <input
                    className="adminInput"
                    value={safeStr(newDraft.place)}
                    onChange={(e) => setNewDraft((d) => ({ ...d, place: e.target.value }))}
                />
            </label>

            <label className="adminLabel">
                Adresă
                <input
                    className="adminInput"
                    value={safeStr(newDraft.address)}
                    onChange={(e) => setNewDraft((d) => ({ ...d, address: e.target.value }))}
                />
            </label>

            <div className="adminMsgActions">
                <button type="button" className="adminDeleteBtn" onClick={onCancel} disabled={newState === "saving"}>
                    Anulează
                </button>

                <button type="button" className="adminMsgSaveBtn" onClick={onSave} disabled={newState === "saving"}>
                    {newState === "saving" ? "Se salvează…" : newState === "saved" ? "Salvat ✓" : "Salvează"}
                </button>
            </div>
        </div>
    );
}

export default function EventsAdmin() {
    const mountedRef = useRef(true);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [events, setEvents] = useState([]);
    const [drafts, setDrafts] = useState({});
    const [savingById, setSavingById] = useState({});
    const [expandedIds, setExpandedIds] = useState(() => new Set());
    const [showHistory, setShowHistory] = useState(false);

    const [showNew, setShowNew] = useState(false);
    const [newDraft, setNewDraft] = useState(() => ({
        type: "cina",
        dateEvent: getTodayRoSlash(),
        ...DEFAULT_NEW,
    }));
    const [newState, setNewState] = useState("idle");
    const [newError, setNewError] = useState("");

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        setLoading(true);
        setError("");

        const unsubscribe = onSnapshot(
            collection(db, "events"),
            (snap) => {
                if (!mountedRef.current) return;

                const list = snap.docs.map((d) => {
                    const data = d.data() || {};
                    return {
                        id: d.id,
                        type: safeStr(data.type),
                        dateEvent: safeStr(data.dateEvent),
                        title: safeStr(data.title),
                        description: safeStr(data.description),
                        image: safeStr(data.image),
                        time: safeStr(data.time),
                        place: safeStr(data.place),
                        address: safeStr(data.address),
                    };
                });

                setEvents(list);

                setDrafts((prev) => {
                    const next = { ...prev };
                    const alive = new Set(list.map((it) => it.id));

                    Object.keys(next).forEach((k) => {
                        if (!alive.has(k)) delete next[k];
                    });

                    list.forEach((ev) => {
                        if (!next[ev.id]) {
                            next[ev.id] = {
                                dateEvent: ev.dateEvent,
                                title: ev.title,
                                description: ev.description,
                                image: ev.image,
                                time: ev.time,
                                place: ev.place,
                                address: ev.address,
                            };
                        }
                    });

                    return next;
                });

                setExpandedIds((prev) => {
                    const next = new Set();
                    for (const ev of list) if (prev.has(ev.id)) next.add(ev.id);
                    return next;
                });

                setLoading(false);
            },
            (err) => {
                console.error(err);
                if (!mountedRef.current) return;
                setError("Nu am putut încărca evenimentele.");
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    const { upcomingEvents, pastEvents } = useMemo(() => {
        const copy = Array.isArray(events) ? [...events] : [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayMs = today.getTime();

        const tagged = copy.map((ev) => ({ ev, ms: parseDateEventToMs(ev.dateEvent) }));

        const upcoming = [];
        const past = [];

        tagged.forEach((x) => {
            if (x.ms != null && x.ms < todayMs) past.push(x);
            else upcoming.push(x);
        });

        upcoming.sort((a, b) => {
            if (a.ms != null && b.ms != null) {
                const cmp = a.ms - b.ms;
                if (cmp !== 0) return cmp;
            } else if (a.ms != null) return -1;
            else if (b.ms != null) return 1;
            return safeStr(a.ev.id).localeCompare(safeStr(b.ev.id));
        });

        past.sort((a, b) => {
            if (a.ms != null && b.ms != null) {
                const cmp = b.ms - a.ms;
                if (cmp !== 0) return cmp;
            } else if (a.ms != null) return -1;
            else if (b.ms != null) return 1;
            return safeStr(a.ev.id).localeCompare(safeStr(b.ev.id));
        });

        return { upcomingEvents: upcoming.map((x) => x.ev), pastEvents: past.map((x) => x.ev) };
    }, [events]);

    const toggleExpand = (id) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const setDraftField = (id, field, value) => {
        setDrafts((prev) => ({
            ...prev,
            [id]: {
                ...(prev[id] || {}),
                [field]: value,
            },
        }));
        if (error) setError("");
    };

    const saveEvent = async (ev) => {
        const id = ev.id;
        const draft = drafts[id];
        if (!draft) return;

        const payload = {};
        ["dateEvent", "title", "description", "image", "time", "place", "address"].forEach((f) => {
            const dVal = safeStr(draft[f]).trim();
            const bVal = safeStr(ev[f]).trim();
            if (dVal !== bVal) payload[f] = dVal;
        });

        if (!Object.keys(payload).length) return;

        setSavingById((m) => ({ ...m, [id]: "saving" }));
        setError("");

        try {
            await setDoc(doc(db, "events", id), payload, { merge: true });
            if (!mountedRef.current) return;

            setSavingById((m) => ({ ...m, [id]: "saved" }));
            setTimeout(() => {
                if (!mountedRef.current) return;
                setSavingById((m) => ({ ...m, [id]: "idle" }));
            }, 900);
        } catch (err) {
            console.error(err);
            if (!mountedRef.current) return;
            setSavingById((m) => ({ ...m, [id]: "error" }));
            setError("Nu am putut salva evenimentul.");
        }
    };

    const removeEvent = async (id) => {
        const ok = window.confirm("Ștergi definitiv acest eveniment? (nu va mai exista în listă)");
        if (!ok) return;

        setError("");
        try {
            await deleteDoc(doc(db, "events", id));
        } catch (err) {
            console.error(err);
            if (!mountedRef.current) return;
            setError("Nu am putut șterge evenimentul.");
        }
    };

    const resetNew = () => {
        setShowNew(false);
        setNewDraft({
            type: "cina",
            dateEvent: getTodayRoSlash(),
            ...DEFAULT_NEW,
        });
        setNewState("idle");
        setNewError("");
    };

    const idPreview = useMemo(() => {
        const t = safeStr(newDraft.type).trim();
        const d = safeStr(newDraft.dateEvent).trim();
        if (!t || !d) return "";
        return `${t}-${toIdDate(d)}`;
    }, [newDraft.type, newDraft.dateEvent]);

    const saveNewEvent = async () => {
        const cleanType = safeStr(newDraft.type).trim();
        const cleanDate = safeStr(newDraft.dateEvent).trim();

        if (!cleanType) {
            setNewError("Selectează tipul evenimentului.");
            return;
        }
        if (!cleanDate) {
            setNewError("Completează data evenimentului.");
            return;
        }

        const id = `${cleanType}-${toIdDate(cleanDate)}`;
        if (events.some((e) => e.id === id)) {
            setNewError("Există deja un eveniment cu acest ID.");
            return;
        }

        const data = {
            type: cleanType,
            dateEvent: cleanDate,
            title: safeStr(newDraft.title).trim(),
            description: safeStr(newDraft.description).trim(),
            image: safeStr(newDraft.image).trim(),
            time: safeStr(newDraft.time).trim(),
            place: safeStr(newDraft.place).trim(),
            address: safeStr(newDraft.address).trim(),
        };

        setNewState("saving");
        setNewError("");

        try {
            await setDoc(doc(db, "events", id), data, { merge: true });
            if (!mountedRef.current) return;

            setNewState("saved");
            setTimeout(() => {
                if (!mountedRef.current) return;
                resetNew();
            }, 900);
        } catch (err) {
            console.error(err);
            if (!mountedRef.current) return;
            setNewState("error");
            setNewError("Nu am putut salva evenimentul nou.");
        }
    };

    return (
        <div className="adminCard">
            <div className="adminTop">
                <h2 className="adminTitle">Evenimente</h2>
                <div className="adminActions">
                    <button
                        className="adminBtn adminBtn--new"
                        type="button"
                        onClick={() => setShowNew(true)}
                        disabled={loading || showNew}
                    >
                        <span className="adminBtnIcon" aria-hidden="true">
                            <IconPlus />
                        </span>
                        Nou
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="adminSkeleton" />
            ) : (
                <div className="adminForm adminForm--edit">
                    {error ? <div className="adminAlert">{error}</div> : null}

                    {showNew ? (
                        <NewEventCard
                            newDraft={newDraft}
                            setNewDraft={setNewDraft}
                            newError={newError}
                            newState={newState}
                            onCancel={resetNew}
                            onSave={saveNewEvent}
                            idPreview={idPreview}
                        />
                    ) : null}

                    <div className="adminList">
                        {upcomingEvents.map((ev) => (
                            <EventRow
                                key={ev.id}
                                ev={ev}
                                expanded={expandedIds.has(ev.id)}
                                onToggleExpand={toggleExpand}
                                draft={drafts[ev.id]}
                                onChangeField={setDraftField}
                                onRemove={removeEvent}
                                onSave={saveEvent}
                                savingState={savingById[ev.id] || "idle"}
                            />
                        ))}

                        {!upcomingEvents.length && !showNew ? (
                            <div className="adminEmpty">Nu există evenimente viitoare. Apasă „Nou”.</div>
                        ) : null}
                    </div>

                    <div className="adminHistoryRow">
                        <button
                            type="button"
                            className="adminSmallBtn"
                            onClick={() => setShowHistory((v) => !v)}
                            disabled={!pastEvents.length}
                        >
                            {showHistory ? "Ascunde istoricul" : `Arată istoricul (${pastEvents.length})`}
                        </button>
                    </div>

                    {showHistory ? (
                        <div className="adminList adminList--history">
                            {pastEvents.map((ev) => (
                                <EventRow
                                    key={ev.id}
                                    ev={ev}
                                    expanded={expandedIds.has(ev.id)}
                                    onToggleExpand={toggleExpand}
                                    draft={drafts[ev.id]}
                                    onChangeField={setDraftField}
                                    onRemove={removeEvent}
                                    onSave={saveEvent}
                                    savingState={savingById[ev.id] || "idle"}
                                />
                            ))}
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    );
}