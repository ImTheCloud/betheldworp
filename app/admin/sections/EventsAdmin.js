"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { collection, deleteDoc, doc, onSnapshot, setDoc, updateDoc, deleteField } from "firebase/firestore";
import { db } from "../../lib/Firebase";
import { usePagination } from "../hooks/usePagination";
import PaginationControls from "../components/PaginationControls";
import ImagePicker from "../components/ImagePicker";
import ConfirmModal from "../components/ConfirmModal";
import AdminSearch from "../components/AdminSearch";
import { toggleExpandWithConfirm } from "../utils/adminUI";
import locationTr from "../../translations/Location.json";

// Prefilled on every new event; kept in sync with the Location section of the site.
const DEFAULT_PLACE = locationTr.ro.place;
const DEFAULT_ADDRESS = locationTr.ro.address;

function newEventDraft() {
    return cleanEvent({ place: DEFAULT_PLACE, address: DEFAULT_ADDRESS });
}

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

/** Converts YYYY-MM-DD to the ISO week key, e.g. "2026-W09" */
function dateToWeekKey(dateStr) {
    if (!dateStr) return null;
    const d = new Date(`${dateStr}T12:00:00Z`);
    if (isNaN(d)) return null;
    // Find Thursday of the current week (ISO week is defined by its Thursday)
    const day = d.getUTCDay() || 7; // Mon=1 ... Sun=7
    const thursday = new Date(d);
    thursday.setUTCDate(d.getUTCDate() + (4 - day));
    const year = thursday.getUTCFullYear();
    const jan1 = new Date(Date.UTC(year, 0, 1));
    const week = Math.ceil(((thursday - jan1) / 86400000 + 1) / 7);
    return `${year}-W${String(week).padStart(2, "0")}`;
}

function dateToSlotIds(dateStr) {
    if (!dateStr) return [];
    const d = new Date(`${dateStr}T12:00:00Z`);
    if (isNaN(d)) return [];
    const day = d.getUTCDay();
    const map = { 0: ["sun_am", "sun_pm"], 1: ["mon"], 2: ["tue_fast", "tue"], 3: ["wed"], 4: ["thu"], 5: ["fri"], 6: ["sat"] };
    return map[day] ?? [];
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

function IconSave(props) {
    return (
        <svg fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" {...props}>
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
        </svg>
    );
}

function EventCard({ item, expanded, draft, saveState, activeLang, onToggle, onLangChange, onChangeField, onSave, onDelete, isEventOverride, onToggleOverride }) {
    const id = safeStr(item?.id);
    const dirty = !eventEqual(draft, item) || (draft?.isOverride !== undefined && draft.isOverride !== isEventOverride);
    const langKey = activeLang || "ro";

    const title = pickFallback(draft?.title);
    const date = safeStr(draft?.dateEvent);

    return (
        <div className={`adminAnnCard${item?.upcoming ? " is-active" : ""}`}>
            <div className="adminAnnHeader" style={{ cursor: "pointer", justifyContent: "space-between" }} onClick={() => onToggle(id)}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <div className="adminAnnIdChip">{date || "No date"}</div>
                    <div className="adminSummary">{title || "No title"}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <button
                        type="button"
                        className="adminSmallBtn"
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
            </div>

            {expanded ? (
                <div className="adminAnnBody">
                    <div className="adminGrid-EventTop">
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
                        <div
                            className={`adminToggleWrap ${(draft?.isOverride !== undefined ? draft.isOverride : isEventOverride) ? 'is-active' : ''}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                const currentVal = draft?.isOverride !== undefined ? draft.isOverride : isEventOverride;
                                const newVal = !currentVal;
                                onChangeField(id, "isOverride", null, newVal);
                            }}
                        >
                            <div className={`adminToggle ${(draft?.isOverride !== undefined ? draft.isOverride : isEventOverride) ? 'is-active' : ''}`}>
                                <div className="adminToggleKnob" />
                            </div>
                            Program Override
                        </div>
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

                    <div className="adminLabel">
                        Image
                        <ImagePicker
                            value={safeStr(draft?.image)}
                            onChange={(val) => onChangeField(id, "image", null, val)}
                        />
                    </div>

                    <div className="adminMsgActions" style={{ marginTop: '16px' }}>
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
                            <IconSave />
                            {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : "Save"}
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

function NewEventCard({ draft, saveState, activeLang, onLangChange, onChangeField, onCancel, onSave, templates = [], onSelectTemplate }) {
    const langKey = activeLang || "ro";

    return (
        <div className="adminAnnCard is-active">
            <div className="adminAnnHeader">
                <div className="adminAnnIdChip">New Event</div>
            </div>

            <div className="adminAnnBody">
                <div className="adminTemplateSelector" style={{ marginBottom: 16 }}>
                    <label className="adminLabel" style={{ marginBottom: 4 }}>
                        Create from Template (Existing Events)
                    </label>
                    <select 
                        className="adminInput"
                        onChange={(e) => {
                            const selectedId = e.target.value;
                            const template = templates.find(t => t.id === selectedId);
                            if (template && onSelectTemplate) {
                                onSelectTemplate(template);
                            }
                        }}
                        defaultValue=""
                    >
                        <option value="" disabled>-- Select an existing event --</option>
                        {templates.map((t) => (
                            <option key={t.id} value={t.id}>
                                {pickFallback(t.title)} ({t.dateEvent})
                            </option>
                        ))}
                    </select>
                </div>

                <div className="adminGrid-EventTop">
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
                    <div
                        className={`adminToggleWrap ${(draft?.isOverride !== undefined ? draft.isOverride : true) ? 'is-active' : ''}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            const currentVal = draft?.isOverride !== undefined ? draft.isOverride : true;
                            onChangeField("isOverride", null, !currentVal);
                        }}
                    >
                        <div className={`adminToggle ${(draft?.isOverride !== undefined ? draft.isOverride : true) ? 'is-active' : ''}`}>
                            <div className="adminToggleKnob" />
                        </div>
                        Program Override
                    </div>
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

                <div className="adminLabel">
                    Image
                    <ImagePicker
                        value={safeStr(draft?.image)}
                        onChange={(val) => onChangeField("image", null, val)}
                    />
                </div>

                <div className="adminMsgActions" style={{ marginTop: '16px' }}>
                    <button type="button" className="adminDeleteBtn" onClick={onCancel} disabled={saveState === "saving"}>
                        Cancel
                    </button>

                    <button type="button" className="adminMsgSaveBtn" onClick={onSave} disabled={saveState === "saving"}>
                        <IconSave />
                        {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : "Save"}
                    </button>
                </div>
            </div>
        </div>
    );
}

const PAGE_SIZE = 10;

export default function EventsAdmin({ onCreateOverride, onDirtyChange }) {
    const mountedRef = useRef(true);
    const timeoutRef = useRef(null);

    const [loading, setLoading] = useState(true);
    const [overrides, setOverrides] = useState([]);
    const [items, setItems] = useState([]);
    const [draftsById, setDraftsById] = useState({});
    const [saveStateById, setSaveStateById] = useState({});
    const [expandedIds, setExpandedIds] = useState(() => new Set());
    const [activeLangById, setActiveLangById] = useState({});
    const [searchQuery, setSearchQuery] = useState("");

    const [showNew, setShowNew] = useState(false);
    const [newDraft, setNewDraft] = useState(newEventDraft);
    const [newState, setNewState] = useState("idle");
    const [newLang, setNewLang] = useState("ro");
    const [migrating, setMigrating] = useState(false);

    const [modal, setModal] = useState({ isOpen: false, title: "", message: "", onConfirm: () => { } });

    const openInfoModal = (title, message) => {
        setModal({
            isOpen: true,
            title,
            message,
            actions: [
                {
                    label: "OK",
                    variant: "primary",
                    onClick: () => setModal((prev) => ({ ...prev, isOpen: false }))
                }
            ]
        });
    };

    const [showHistory, setShowHistory] = useState(false);

    const templates = useMemo(() => {
        const sortedByDate = [...items].sort((a, b) => b.dateEvent.localeCompare(a.dateEvent));
        const res = [];
        const seenTitles = new Set();
        let latestWedding = null;

        for (const it of sortedByDate) {
            const t = pickFallback(it.title).trim();
            if (!t) continue;

            const isWedding = t.toLowerCase().startsWith("nuntă") || t.toLowerCase().startsWith("mariage");
            
            if (isWedding) {
                if (!latestWedding) {
                    latestWedding = it;
                }
            } else {
                if (!seenTitles.has(t)) {
                    seenTitles.add(t);
                    res.push(it);
                }
            }
        }

        if (latestWedding) res.push(latestWedding);

        return res.sort((a, b) => pickFallback(a.title).localeCompare(pickFallback(b.title)));
    }, [items]);

    const filteredItems = useMemo(() => {
        if (!searchQuery.trim()) return items;
        const q = searchQuery.toLowerCase();
        return items.filter(it => {
            const title = pickFallback(it.title).toLowerCase();
            return title.includes(q) || safeStr(it.id).toLowerCase().includes(q);
        });
    }, [items, searchQuery]);

    const upcomingItems = filteredItems.filter((x) => x.upcoming);
    const historyItems = filteredItems.filter((x) => !x.upcoming);

    const upcomingPagination = usePagination(upcomingItems, PAGE_SIZE);
    const historyPagination = usePagination(historyItems, PAGE_SIZE);

    // Report aggregate dirty state to parent
    useEffect(() => {
        if (!onDirtyChange) return;

        const anyExpandedDirty = Array.from(expandedIds).some(id => {
            const item = items.find(it => it.id === id);
            const draft = draftsById[id];
            return item && draft && !eventEqual(item, draft);
        });

        // "New" form is dirty if it has any meaningful content or is just open
        const isNewDirty = showNew && (newDraft.dateEvent || pickFallback(newDraft.title));
        
        onDirtyChange(isNewDirty || anyExpandedDirty);
    }, [showNew, newDraft, expandedIds, draftsById, items, onDirtyChange]);

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

        const unsubEvents = onSnapshot(
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
                console.error("EventsAdmin snapshot error:", err);
                if (!mountedRef.current) return;
                setLoading(false);
            }
        );

    const unsubOverrides = onSnapshot(collection(db, "program_overrides"), (snap) => {
            if (!mountedRef.current) return;
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setOverrides(list);
        });

        return () => {
            unsubEvents();
            unsubOverrides();
        };
    }, []);

    const toggleExpand = (id) => {
        toggleExpandWithConfirm({
            id,
            items,
            draftsById,
            isDirtyFn: (item, draft) => !eventEqual(item, draft) || (draft?.isOverride !== undefined && draft.isOverride !== isEventOverride(item.id, item.dateEvent)),
            setModal,
            setExpandedIds,
            setDraftsById
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
    };

    const startNew = () => {
        setShowNew(true);
        setNewDraft(newEventDraft());
        setNewState("idle");
    };

    const cancelNew = () => {
        setShowNew(false);
        setNewState("idle");
    };

    const applyTemplate = (templateItem) => {
        if (!templateItem) return;
        const d = normalizeEvent(templateItem);
        setNewDraft((prev) => ({
            ...d,
            dateEvent: prev.dateEvent, // Keep the date if user already started picking it
        }));
    };

    const saveNew = async () => {
        const d = cleanEvent(newDraft);
        if (!d.dateEvent) {
            openInfoModal("Action Required", "Fill in date (YYYY-MM-DD or DD.MM.YYYY).");
            return;
        }
        if (!pickFallback(d.title)) {
            openInfoModal("Action Required", "Fill in title for at least RO or EN.");
            return;
        }

        setModal({
            isOpen: true,
            title: "Confirm New Event",
            message: "Are you sure you want to save this new event?",
            variant: "primary",
            onConfirm: async () => {
                setModal(m => ({ ...m, isOpen: false }));
                setNewState("saving");

                try {
                    const ref = doc(collection(db, "events"));
                await setDoc(ref, d);
                const isOv = newDraft?.isOverride !== undefined ? newDraft.isOverride : true;
                await syncOverride(ref.id, d.dateEvent, isOv);

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
                    openInfoModal("Save Error", "Could not save event.");
                }
            }
        });
    };

    const saveOne = async (id) => {
        const key = safeStr(id);
        if (!key) return;

        const draft = draftsById[key];
        if (!draft) return;

        // Validations
        const d = cleanEvent(draft);
        if (!d.dateEvent) {
            openInfoModal("Action Required", "Fill in date.");
            return;
        }
        if (!pickFallback(d.title)) {
            openInfoModal("Action Required", "Fill in title.");
            return;
        }

        const original = items.find((x) => x.id === key);
        if (!original) return;

        // Check if date changed
        const dateChanged = original.dateEvent !== d.dateEvent;

        if (dateChanged) {
            setModal({
                isOpen: true,
                title: "Update Date or Duplicate?",
                message: "You have changed the date. Do you want to update the existing event's date, or create a new event and keep the original one as it is?",
                cancelText: "Cancel",
                actions: [
                    {
                        label: "Update",
                        variant: "primary",
                        onClick: () => {
                            setModal({ isOpen: false });
                            executeSaveOne(id, draft, original, false);
                        }
                    },
                    {
                        label: "Duplicate",
                        variant: "secondary",
                        onClick: () => {
                            setModal({ isOpen: false });
                            executeSaveOne(id, draft, original, true);
                        }
                    }
                ]
            });
            return;
        }

        setModal({
            isOpen: true,
            title: "Confirm Modification",
            message: "Are you sure you want to save these modifications?",
            variant: "primary",
            onConfirm: () => {
                setModal({ isOpen: false });
                executeSaveOne(id, draft, original, false);
            }
        });
    };

    const executeSaveOne = async (id, draft, original, dateChanged) => {
        const key = safeStr(id);
        const d = cleanEvent(draft);

        setSaveStateById((m) => ({ ...m, [key]: "saving" }));

        try {
            if (dateChanged) {
                // Create new event
                const ref = doc(collection(db, "events"));
                await setDoc(ref, d);
                const isOv = draft?.isOverride !== undefined ? draft.isOverride : (original ? isEventOverride(original.id, original.dateEvent) : true);
                await syncOverride(ref.id, d.dateEvent, isOv);

                if (!mountedRef.current) return;

                // Revert the original item's draft to match the original item (since we didn't modify it)
                // This prevents confusion in the UI
                setDraftsById((prev) => ({ ...prev, [key]: normalizeEvent(original) }));

                // Show success message but keep "saving" state briefly to show something happened
                setTransientState(key, "saved");

            } else {
                // Normal update
                await setDoc(doc(db, "events", key), d, { merge: true });
                const isOv = draft.isOverride !== undefined ? draft.isOverride : isEventOverride(original.id, original.dateEvent);
                await syncOverride(key, d.dateEvent, isOv, key, original.dateEvent);

                if (!mountedRef.current) return;

                setTransientState(key, "saved");
            }
        } catch (err) {
            console.error(err);
            if (!mountedRef.current) return;
            setSaveStateById((m) => ({ ...m, [key]: "error" }));
            openInfoModal("Save Error", "Could not save event.");
        }
    };

    
    const isEventOverride = useCallback((eventId, dateStr) => {
        if (!eventId || !dateStr) return false;
        const wk = dateToWeekKey(dateStr);
        if (!wk) return false;
        const override = overrides.find(o => o.id === wk || o.weekKey === wk);
        if (!override) return false;
        return Object.values(override.replacements || {}).includes(eventId);
    }, [overrides]);

    const syncOverride = async (eventId, dateStr, isOverride, oldEventId = null, oldDateStr = null) => {
        if (!eventId || !dateStr) return;

        if (oldEventId && oldDateStr && (oldEventId !== eventId || oldDateStr !== dateStr)) {
            const oldWk = dateToWeekKey(oldDateStr);
            const oldSlots = dateToSlotIds(oldDateStr);
            if (oldWk && oldSlots.length > 0) {
                const oldOverride = overrides.find(o => o.id === oldWk || o.weekKey === oldWk);
                if (oldOverride && oldOverride.replacements) {
                    const updates = {};
                    let changed = false;
                    for (const s of oldSlots) {
                        if (oldOverride.replacements[s] === oldEventId) {
                            updates[`replacements.${s}`] = deleteField();
                            changed = true;
                        }
                    }
                    if (changed) {
                        updates['affectedProgramIds'] = (oldOverride.affectedProgramIds || []).filter(id => {
                            if (oldSlots.includes(id) && oldOverride.replacements[id] === oldEventId) return false;
                            return true;
                        });
                        await updateDoc(doc(db, "program_overrides", oldWk), updates);
                    }
                }
            }
        }

        const wk = dateToWeekKey(dateStr);
        const slots = dateToSlotIds(dateStr);
        if (!wk || slots.length === 0) return;

        const overrideDoc = overrides.find(o => o.id === wk || o.weekKey === wk);
        const base = overrideDoc || { weekKey: wk, affectedProgramIds: [], replacements: {} };
        const newReplacements = { ...(base.replacements || {}) };
        
        let changed = false;
        if (isOverride) {
            slots.forEach(s => {
                if (newReplacements[s] !== eventId) {
                    newReplacements[s] = eventId;
                    changed = true;
                }
            });
            const newAffected = [...new Set([...(base.affectedProgramIds || []), ...slots])];
            if (changed || base.affectedProgramIds?.length !== newAffected.length) {
                await setDoc(doc(db, "program_overrides", wk), {
                    ...base,
                    affectedProgramIds: newAffected,
                    replacements: newReplacements
                }, { merge: true });
            }
        } else {
            if (overrideDoc) {
                const updates = {};
                const newAffected = (base.affectedProgramIds || []).filter(id => {
                    if (slots.includes(id) && newReplacements[id] === eventId) return false;
                    return true;
                });
                slots.forEach(s => {
                    if (newReplacements[s] === eventId) {
                        updates[`replacements.${s}`] = deleteField();
                        changed = true;
                    }
                });
                if (changed) {
                    updates['affectedProgramIds'] = newAffected;
                    await updateDoc(doc(db, "program_overrides", wk), updates);
                }
            }
        }
    };

    const deleteOne = async (id) => {
        const key = safeStr(id);
        if (!key) return;

        setModal({
            isOpen: true,
            title: "Delete Event",
            message: "Are you sure you want to delete this event? This action cannot be undone.",
            onConfirm: async () => {
                setModal({ isOpen: false });
                setSaveStateById((m) => ({ ...m, [key]: "saving" }));

                try {
                    const original = items.find((x) => x.id === key);
                    await deleteDoc(doc(db, "events", key));
                    if (original) await syncOverride(key, original.dateEvent, false);
                } catch (err) {
                    console.error(err);
                    if (!mountedRef.current) return;
                    setSaveStateById((m) => ({ ...m, [key]: "error" }));
                    openInfoModal("Action Failed", "Could not delete event.");
                }
            }
        });
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

                <AdminSearch
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Search"
                />
            </div>

            {loading ? (
                <div className="adminSkeleton" />
            ) : (
                <div className="adminFullContent">
                    {showNew ? (
                        <div>
                            <NewEventCard
                                draft={newDraft}
                                saveState={newState}
                                activeLang={newLang}
                                onLangChange={setNewLang}
                                onChangeField={changeNewField}
                                onCancel={cancelNew}
                                onSave={saveNew}
                                templates={templates}
                                onSelectTemplate={applyTemplate}
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
                                        activeLang={activeLangById[it.id]}
                                        onLangChange={(id, l) => setActiveLangById((m) => ({ ...m, [id]: l }))}
                                        onToggle={toggleExpand}
                                        onChangeField={changeField}
                                        onSave={saveOne}
                                        onDelete={deleteOne}
                                        isEventOverride={isEventOverride(it.id, it.dateEvent)}
                                        onToggleOverride={(id, dateStr, isOverride) => {
                                            syncOverride(id, dateStr, isOverride);
                                        }}
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

                    <ConfirmModal
                        isOpen={modal.isOpen}
                        title={modal.title}
                        message={modal.message}
                        confirmText={modal.confirmText}
                        cancelText={modal.cancelText}
                        variant={modal.variant}
                        onConfirm={modal.onConfirm}
                        onCancel={() => setModal({ ...modal, isOpen: false })}
                        actions={modal.actions}
                    />
                </div>
            )}
        </div>
    );
}