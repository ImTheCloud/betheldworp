"use client";

import { useEffect, useRef, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../../lib/Firebase";
import { usePagination } from "../hooks/usePagination";
import PaginationControls from "../components/PaginationControls";
import ImagePicker from "../components/ImagePicker";

function safeStr(v) {
    return String(v ?? "");
}

function pad2(n) {
    return String(n).padStart(2, "0");
}

function getTodayId() {
    const now = new Date();
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

const LANGS = [
    { key: "ro", label: "RO" },
    { key: "en", label: "EN" },
    { key: "fr", label: "FR" },
    { key: "nl", label: "NL" },
];

function emptyLangMap() {
    return { ro: "", en: "", fr: "", nl: "" };
}

function normalizeLangMap(value) {
    if (!value) return emptyLangMap();
    if (typeof value === "string") return { ro: safeStr(value).trim(), en: "", fr: "", nl: "" };
    if (typeof value === "object") {
        return {
            ro: safeStr(value?.ro).trim(),
            en: safeStr(value?.en).trim(),
            fr: safeStr(value?.fr).trim(),
            nl: safeStr(value?.nl).trim(),
        };
    }
    return emptyLangMap();
}

function cleanEvent(draft) {
    return {
        dateEvent: safeStr(draft.dateEvent).trim(),
        time: safeStr(draft.time).trim(),
        image: safeStr(draft.image).trim(),
        title: normalizeLangMap(draft.title),
        description: normalizeLangMap(draft.description),
        place: safeStr(draft.place).trim(),
        address: safeStr(draft.address).trim(),
    };
}

function pickFallback(map) {
    const m = map || emptyLangMap();
    return safeStr(m.ro).trim() || safeStr(m.en).trim() || safeStr(m.fr).trim() || safeStr(m.nl).trim() || "";
}

function normalizeEvent(data) {
    const d = data || {};
    return {
        dateEvent: safeStr(d.dateEvent).trim(),
        time: safeStr(d.time).trim(),
        image: safeStr(d.image).trim(),
        title: normalizeLangMap(d.title),
        description: normalizeLangMap(d.description),
        place: safeStr(d.place).trim(),
        address: safeStr(d.address).trim(),
    };
}

function eventEqual(a, b) {
    const ca = cleanEvent(a);
    const cb = cleanEvent(b);
    return JSON.stringify(ca) === JSON.stringify(cb);
}

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


function IconHistory(props) {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
            <path d="M12 8v4l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3.05 11a9 9 0 1 1 .5 9m-.5-9v-5.5h-5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

function EventCard({ item, expanded, draft, saveState, errorText, activeLang, onToggle, onLangChange, onChangeField, onSave, onDelete }) {
    const id = safeStr(item?.id);
    const dirty = !eventEqual(draft, item);
    const langKey = activeLang || "ro";

    const onCardClick = (e) => {
        if (e.target.closest("button, input, textarea, select, label")) return;
        onToggle(id);
    };

    const title = pickFallback(draft?.title);
    const date = safeStr(draft?.dateEvent);

    return (
        <div className={`adminAnnCard${item?.upcoming ? " is-active" : ""}`} onClick={onCardClick}>
            <div className="adminAnnHeader">
                <div className="adminAnnIdChip">{date || "No date"}</div>
                <div className="adminSummary">{title || "No title"}</div>
                <button
                    type="button"
                    className="adminSmallBtn"
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggle(id);
                    }}
                    aria-label={expanded ? "Hide details" : "Show details"}
                >
                    <IconChevronDown
                        style={{
                            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                            transition: "transform 0.2s ease",
                        }}
                    />
                </button>
            </div>

            {expanded ? (
                <>
                    {errorText ? <div className="adminAlert">{errorText}</div> : null}

                    <div className="adminGrid2">
                        <label className="adminLabel">
                            Date
                            <input
                                type="date"
                                className="adminInput"
                                value={safeStr(draft?.dateEvent)}
                                onChange={(e) => onChangeField(id, "dateEvent", null, e.target.value)}
                            />
                        </label>
                        <label className="adminLabel">
                            Time
                            <input
                                className="adminInput"
                                value={safeStr(draft?.time)}
                                onChange={(e) => onChangeField(id, "time", null, e.target.value)}
                            />
                        </label>
                    </div>

                    <label className="adminLabel">
                        Title ({langKey.toUpperCase()})
                        <input
                            className="adminInput"
                            value={safeStr(draft?.title?.[langKey])}
                            onChange={(e) => onChangeField(id, "title", langKey, e.target.value)}
                        />
                    </label>

                    <div className="adminAffectGrid">
                        {LANGS.map((l) => (
                            <button
                                key={l.key}
                                type="button"
                                className={`adminAffectChip ${langKey === l.key ? "is-on" : ""}`.trim()}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onLangChange(id, l.key);
                                }}
                            >
                                {l.label}
                            </button>
                        ))}
                    </div>

                    <label className="adminLabel">
                        Description ({langKey.toUpperCase()})
                        <textarea
                            className="adminTextarea"
                            value={safeStr(draft?.description?.[langKey])}
                            onChange={(e) => onChangeField(id, "description", langKey, e.target.value)}
                            rows={3}
                        />
                    </label>

                    <div className="adminGrid2">
                        <label className="adminLabel">
                            Location
                            <input
                                className="adminInput"
                                value={safeStr(draft?.place)}
                                onChange={(e) => onChangeField(id, "place", null, e.target.value)}
                            />
                        </label>
                        <label className="adminLabel">
                            Address
                            <input
                                className="adminInput"
                                value={safeStr(draft?.address)}
                                onChange={(e) => onChangeField(id, "address", null, e.target.value)}
                            />
                        </label>
                    </div>

                    <label className="adminLabel">
                        Image
                        <ImagePicker
                            value={safeStr(draft?.image)}
                            onChange={(val) => onChangeField(id, "image", null, val)}
                        />
                    </label>

                    <div className="adminMsgActions">
                        <button
                            type="button"
                            className="adminDeleteBtn"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(id);
                            }}
                            disabled={saveState === "saving"}
                        >
                            <IconTrash />
                            Delete
                        </button>

                        <button
                            type="button"
                            className="adminMsgSaveBtn"
                            onClick={(e) => {
                                e.stopPropagation();
                                onSave(id);
                            }}
                            disabled={!dirty || saveState === "saving"}
                        >
                            {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : "Save"}
                        </button>
                    </div>
                </>
            ) : null}
        </div>
    );
}

function NewEventCard({ draft, saveState, errorText, activeLang, onLangChange, onChangeField, onCancel, onSave }) {
    const langKey = activeLang || "ro";

    return (
        <div className="adminAnnCard is-active">
            <div className="adminAnnHeader">
                <div className="adminAnnIdChip">New Event</div>
            </div>

            {errorText ? <div className="adminAlert">{errorText}</div> : null}

            <div className="adminGrid2">
                <label className="adminLabel">
                    Date
                    <input
                        type="date"
                        className="adminInput"
                        value={safeStr(draft?.dateEvent)}
                        onChange={(e) => onChangeField("dateEvent", null, e.target.value)}
                    />
                </label>
                <label className="adminLabel">
                    Time
                    <input
                        className="adminInput"
                        value={safeStr(draft?.time)}
                        onChange={(e) => onChangeField("time", null, e.target.value)}
                    />
                </label>
            </div>

            <label className="adminLabel">
                Title ({langKey.toUpperCase()})
                <input
                    className="adminInput"
                    value={safeStr(draft?.title?.[langKey])}
                    onChange={(e) => onChangeField("title", langKey, e.target.value)}
                />
            </label>

            <div className="adminAffectGrid">
                {LANGS.map((l) => (
                    <button
                        key={l.key}
                        type="button"
                        className={`adminAffectChip ${langKey === l.key ? "is-on" : ""}`.trim()}
                        onClick={(e) => {
                            e.stopPropagation();
                            onLangChange(l.key);
                        }}
                    >
                        {l.label}
                    </button>
                ))}
            </div>

            <label className="adminLabel">
                Description ({langKey.toUpperCase()})
                <textarea
                    className="adminTextarea"
                    value={safeStr(draft?.description?.[langKey])}
                    onChange={(e) => onChangeField("description", langKey, e.target.value)}
                    rows={3}
                />
            </label>

            <div className="adminGrid2">
                <label className="adminLabel">
                    Location
                    <input
                        className="adminInput"
                        value={safeStr(draft?.place)}
                        onChange={(e) => onChangeField("place", null, e.target.value)}
                    />
                </label>
                <label className="adminLabel">
                    Address
                    <input
                        className="adminInput"
                        value={safeStr(draft?.address)}
                        onChange={(e) => onChangeField("address", null, e.target.value)}
                    />
                </label>
            </div>

            <label className="adminLabel">
                Image
                <ImagePicker
                    value={safeStr(draft?.image)}
                    onChange={(val) => onChangeField("image", null, val)}
                />
            </label>

            <div className="adminMsgActions">
                <button type="button" className="adminDeleteBtn" onClick={onCancel} disabled={saveState === "saving"}>
                    Cancel
                </button>

                <button type="button" className="adminMsgSaveBtn" onClick={onSave} disabled={saveState === "saving"}>
                    {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : "Save"}
                </button>
            </div>
        </div>
    );
}

const PAGE_SIZE = 10;

export default function EventsAdmin() {
    const mountedRef = useRef(true);
    const timeoutRef = useRef(null);

    const [loading, setLoading] = useState(true);
    const [globalError, setGlobalError] = useState("");

    const [items, setItems] = useState([]);
    const [draftsById, setDraftsById] = useState({});
    const [saveStateById, setSaveStateById] = useState({});
    const [errorById, setErrorById] = useState({});
    const [expandedIds, setExpandedIds] = useState(() => new Set());
    const [activeLangById, setActiveLangById] = useState({});

    const [showNew, setShowNew] = useState(false);
    const [newDraft, setNewDraft] = useState(() => cleanEvent({
        place: "",
        address: "",
        image: "",
        time: "",
        dateEvent: "",
        title: emptyLangMap(),
        description: emptyLangMap(),
    }));
    const [newError, setNewError] = useState("");
    const [newState, setNewState] = useState("idle");
    const [newLang, setNewLang] = useState("ro");

    const [showHistory, setShowHistory] = useState(false);

    const upcomingItems = items.filter((x) => x.upcoming);
    const historyItems = items.filter((x) => !x.upcoming);

    const upcomingPagination = usePagination(upcomingItems, PAGE_SIZE);
    const historyPagination = usePagination(historyItems, PAGE_SIZE);

    const setTransientState = (id, value = "saved") => {
        setSaveStateById((m) => ({ ...m, [id]: value }));
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            if (!mountedRef.current) return;
            setSaveStateById((m) => ({ ...m, [id]: "idle" }));
        }, 900);
    };

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    useEffect(() => {
        setLoading(true);
        setGlobalError("");

        const unsub = onSnapshot(
            collection(db, "events"),
            (snap) => {
                if (!mountedRef.current) return;

                const todayISO = getTodayId();
                const list = snap.docs.map((d) => {
                    const data = normalizeEvent(d.data());
                    // Simple compare, if dateEvent < todayISO => history
                    return {
                        id: d.id,
                        ...data,
                        upcoming: data.dateEvent >= todayISO,
                    };
                });

                list.sort((a, b) => {
                    if (a.upcoming !== b.upcoming) return a.upcoming ? -1 : 1;
                    if (a.upcoming) return a.dateEvent.localeCompare(b.dateEvent);
                    return b.dateEvent.localeCompare(a.dateEvent);
                });

                setItems(list);

                setDraftsById((prev) => {
                    const next = { ...prev };
                    const alive = new Set(list.map((x) => x.id));
                    Object.keys(next).forEach((k) => {
                        if (!alive.has(k)) delete next[k];
                    });
                    list.forEach((it) => {
                        if (!next[it.id]) next[it.id] = normalizeEvent(it);
                    });
                    return next;
                });

                setExpandedIds((prev) => {
                    const alive = new Set(list.map((x) => x.id));
                    const next = new Set();
                    prev.forEach((id) => alive.has(id) && next.add(id));
                    return next;
                });

                setLoading(false);
            },
            (err) => {
                console.error(err);
                if (!mountedRef.current) return;
                setLoading(false);
                setGlobalError("Could not load events.");
            }
        );

        return () => unsub();
    }, []);

    const toggleExpand = (id) => {
        const key = safeStr(id);
        if (!key) return;
        setExpandedIds((prev) => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    };

    const changeField = (id, field, lang, value) => {
        const key = safeStr(id);
        if (!key) return;

        setDraftsById((prev) => {
            const cur = prev[key] || cleanEvent({});
            const next = { ...cur };
            if (lang) {
                const sub = { ...(next[field] || emptyLangMap()) };
                sub[lang] = value;
                next[field] = sub;
            } else {
                next[field] = value;
            }
            return { ...prev, [key]: next };
        });
        setErrorById((m) => ({ ...m, [key]: "" }));
    };

    const changeNewField = (field, lang, value) => {
        setNewDraft((prev) => {
            const next = { ...prev };
            if (lang) {
                const sub = { ...(next[field] || emptyLangMap()) };
                sub[lang] = value;
                next[field] = sub;
            } else {
                next[field] = value;
            }
            return next;
        });
        setNewError("");
    };

    const startNew = () => {
        setShowNew(true);
        setNewDraft(cleanEvent({}));
        setNewError("");
        setNewState("idle");
    };

    const cancelNew = () => {
        setShowNew(false);
        setNewState("idle");
        setNewError("");
    };

    const saveNew = async () => {
        const d = cleanEvent(newDraft);
        if (!d.dateEvent) {
            setNewError("Fill in date (YYYY-MM-DD or DD.MM.YYYY).");
            return;
        }
        if (!pickFallback(d.title)) {
            setNewError("Fill in title for at least RO or EN.");
            return;
        }

        setNewState("saving");
        setNewError("");

        try {
            const ref = doc(collection(db, "events"));
            await setDoc(ref, d);

            if (!mountedRef.current) return;
            setNewState("saved");
            setTimeout(() => {
                if (!mountedRef.current) return;
                setShowNew(false);
                setNewState("idle");
            }, 900);
        } catch (err) {
            console.error(err);
            if (!mountedRef.current) return;
            setNewState("error");
            setNewError("Could not save event.");
        }
    };

    const saveOne = async (id) => {
        const key = safeStr(id);
        if (!key) return;

        const draft = draftsById[key];
        if (!draft) return;

        // Validations
        const d = cleanEvent(draft);
        if (!d.dateEvent) {
            setErrorById((m) => ({ ...m, [key]: "Fill in date." }));
            return;
        }
        if (!pickFallback(d.title)) {
            setErrorById((m) => ({ ...m, [key]: "Fill in title." }));
            return;
        }

        const original = items.find((x) => x.id === key);
        if (!original) return;

        // Check if date changed
        const dateChanged = original.dateEvent !== d.dateEvent;

        if (dateChanged) {
            const ok = window.confirm(
                "Changing the date will create a NEW event for the new date and keep the original event unchanged.\n\nContinue?"
            );
            if (!ok) return;
        }

        setSaveStateById((m) => ({ ...m, [key]: "saving" }));
        setErrorById((m) => ({ ...m, [key]: "" }));

        try {
            if (dateChanged) {
                // Create new event
                const ref = doc(collection(db, "events"));
                await setDoc(ref, d);

                if (!mountedRef.current) return;

                // Revert the original item's draft to match the original item (since we didn't modify it)
                // This prevents confusion in the UI
                setDraftsById((prev) => ({ ...prev, [key]: normalizeEvent(original) }));

                // Show success message but keep "saving" state briefly to show something happened
                setTransientState(key, "saved");
                alert("New event created successfully!");
            } else {
                // Normal update
                await setDoc(doc(db, "events", key), d, { merge: true });

                if (!mountedRef.current) return;
                setTransientState(key, "saved");
            }
        } catch (err) {
            console.error(err);
            if (!mountedRef.current) return;
            setSaveStateById((m) => ({ ...m, [key]: "error" }));
            setErrorById((m) => ({ ...m, [key]: "Could not save event." }));
        }
    };

    const deleteOne = async (id) => {
        const key = safeStr(id);
        if (!key) return;

        const ok = window.confirm("Delete this event?");
        if (!ok) return;

        setSaveStateById((m) => ({ ...m, [key]: "saving" }));
        setErrorById((m) => ({ ...m, [key]: "" }));

        try {
            await deleteDoc(doc(db, "events", key));
        } catch (err) {
            console.error(err);
            if (!mountedRef.current) return;
            setSaveStateById((m) => ({ ...m, [key]: "error" }));
            setErrorById((m) => ({ ...m, [key]: "Could not delete event." }));
        }
    };

    return (
        <div className="adminFullPage">
            <div className="adminFullTop">
                <h2 className="adminTitle">
                    Events{' '}
                    {showHistory && <span className="adminTitleBadge">History</span>}
                </h2>

                <div className="adminActions">
                    <button
                        className="adminBtn adminBtn--new"
                        type="button"
                        onClick={startNew}
                        disabled={loading || showNew}
                    >
                        <span className="adminBtnIcon" aria-hidden="true">
                            <IconPlus />
                        </span>
                        New
                    </button>

                    {historyItems.length > 0 && (
                        <button
                            className="adminBtn adminBtn--new"
                            type="button"
                            onClick={() => setShowHistory(!showHistory)}
                        >
                            <span className="adminBtnIcon" aria-hidden="true">
                                <IconHistory />
                            </span>
                            {showHistory ? "Hide history" : "History"}
                        </button>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="adminSkeleton" style={{ margin: "0 24px" }} />
            ) : (
                <div className="adminFullContent">
                    {globalError ? <div className="adminAlert">{globalError}</div> : null}

                    {showNew ? (
                        <div style={{ padding: "0 4px" }}>
                            <NewEventCard
                                draft={newDraft}
                                saveState={newState}
                                errorText={newError}
                                activeLang={newLang}
                                onLangChange={setNewLang}
                                onChangeField={changeNewField}
                                onCancel={cancelNew}
                                onSave={saveNew}
                            />
                        </div>
                    ) : null}

                    <div className="adminFullList">
                        {!showHistory ? (
                            <>
                                {upcomingPagination.paginatedItems.map((it) => (
                                    <EventCard
                                        key={it.id}
                                        item={it}
                                        expanded={expandedIds.has(it.id)}
                                        draft={draftsById[it.id]}
                                        saveState={saveStateById[it.id] || "idle"}
                                        errorText={errorById[it.id] || ""}
                                        activeLang={activeLangById[it.id]}
                                        onLangChange={(id, l) => setActiveLangById((m) => ({ ...m, [id]: l }))}
                                        onToggle={toggleExpand}
                                        onChangeField={changeField}
                                        onSave={saveOne}
                                        onDelete={deleteOne}
                                    />
                                ))}
                            </>
                        ) : (
                            <div className="adminList adminList--history">
                                {historyPagination.paginatedItems.map((it) => (
                                    <EventCard
                                        key={it.id}
                                        item={it}
                                        expanded={expandedIds.has(it.id)}
                                        draft={draftsById[it.id]}
                                        saveState={saveStateById[it.id] || "idle"}
                                        errorText={errorById[it.id] || ""}
                                        activeLang={activeLangById[it.id]}
                                        onLangChange={(id, l) => setActiveLangById((m) => ({ ...m, [id]: l }))}
                                        onToggle={toggleExpand}
                                        onChangeField={changeField}
                                        onSave={saveOne}
                                        onDelete={deleteOne}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="adminPaginationFooter">
                        {!showHistory ? (
                            <PaginationControls
                                page={upcomingPagination.page}
                                totalPages={upcomingPagination.totalPages}
                                onNext={upcomingPagination.nextPage}
                                onPrev={upcomingPagination.prevPage}
                                onPageSet={upcomingPagination.setPage}
                            />
                        ) : (
                            <PaginationControls
                                page={historyPagination.page}
                                totalPages={historyPagination.totalPages}
                                onNext={historyPagination.nextPage}
                                onPrev={historyPagination.prevPage}
                                onPageSet={historyPagination.setPage}
                            />
                        )}
                    </div>
                </div>
            )
            }
        </div >
    );
}