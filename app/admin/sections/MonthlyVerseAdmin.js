"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { doc, collection, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../lib/Firebase";
import { usePagination } from "../hooks/usePagination";
import PaginationControls from "../components/PaginationControls";
import ConfirmModal from "../components/ConfirmModal";
import AdminSearch from "../components/AdminSearch";
import { toggleExpandWithConfirm, toggleSingleExpandWithConfirm } from "../utils/adminUI";

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

function getArchiveId() {
    const now = new Date();
    return `${getTodayId()}-${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
}


function parseDateId(id) {
    const s = safeStr(id).trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:-|$)/);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0).getTime();
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

function normalizeVerse(data) {
    const d = data || {};
    return {
        reference: normalizeLangMap(d.reference),
        text: normalizeLangMap(d.text),
    };
}

function cleanVerse(draft) {
    const r = draft?.reference || emptyLangMap();
    const t = draft?.text || emptyLangMap();
    return {
        reference: {
            ro: safeStr(r.ro).trim(),
            en: safeStr(r.en).trim(),
            fr: safeStr(r.fr).trim(),
            nl: safeStr(r.nl).trim(),
        },
        text: {
            ro: safeStr(t.ro).trim(),
            en: safeStr(t.en).trim(),
            fr: safeStr(t.fr).trim(),
            nl: safeStr(t.nl).trim(),
        },
    };
}

function pickFallback(map) {
    const m = map || emptyLangMap();
    return safeStr(m.ro).trim() || safeStr(m.en).trim() || safeStr(m.fr).trim() || safeStr(m.nl).trim() || "";
}

function isVerseValidAllLangs(draft) {
    const v = cleanVerse(draft);
    for (const l of LANGS) {
        if (!v.reference[l.key] || !v.text[l.key]) return false;
    }
    return true;
}

function verseEqualTrim(a, b) {
    const va = cleanVerse(a);
    const vb = cleanVerse(b);
    for (const l of LANGS) {
        if (va.reference[l.key] !== vb.reference[l.key]) return false;
        if (va.text[l.key] !== vb.text[l.key]) return false;
    }
    return true;
}

function makeSummary(referenceMap, textMap, max = 60) {
    const ref = pickFallback(referenceMap);
    const t = pickFallback(textMap);
    if (ref) return ref;
    if (!t) return "—";
    return t.length <= max ? t : t.slice(0, max) + "…";
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

function IconPlus(props) {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

function VerseCard({
    label,
    expanded,
    summary,
    draft,
    dirty,
    saveState,
    activeLang,
    onToggle,
    onLangChange,
    onChangeField,
    onSave,
    onDelete,
    deleteTitle = "Delete",
}) {

    const langKey = activeLang || "ro";

    return (
        <div className="adminAnnCard">
            <div className="adminAnnHeader" style={{ cursor: "pointer", justifyContent: "space-between" }} onClick={() => onToggle()}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div className="adminAnnIdChip">{label}</div>
                    {!expanded && <div className="adminSummary">{summary}</div>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <button
                        type="button"
                        className="adminSmallBtn"
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
                        Reference ({langKey.toUpperCase()})
                        <input
                            className="adminInput"
                            value={safeStr(draft?.reference?.[langKey])}
                            onChange={(e) => onChangeField("reference", langKey, e.target.value)}
                            maxLength={80}
                        />
                    </label>

                    <label className="adminLabel">
                        Text ({langKey.toUpperCase()})
                        <textarea
                            className="adminTextarea"
                            value={safeStr(draft?.text?.[langKey])}
                            onChange={(e) => onChangeField("text", langKey, e.target.value)}
                            rows={6}
                            maxLength={1200}
                        />
                    </label>

                    <div className="adminMsgActions">
                        <button
                            type="button"
                            className="adminDeleteBtn"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete();
                            }}
                            title={deleteTitle}
                        >
                            <IconTrash />
                            Delete
                        </button>

                        <button
                            type="button"
                            className="adminMsgSaveBtn"
                            onClick={(e) => {
                                e.stopPropagation();
                                onSave();
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

function NewVerseCard({ newDraft, setNewDraft, newState, activeLang, onLangChange, onCancel, onSave }) {
    const langKey = activeLang || "ro";

    return (
        <div className="adminAnnCard is-active">
            <div className="adminAnnHeader">
                <div className="adminAnnIdChip">New Verse</div>
            </div>

            <div className="adminAnnBody">
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
                    Reference ({langKey.toUpperCase()})
                    <input
                        className="adminInput"
                        value={safeStr(newDraft?.reference?.[langKey])}
                        onChange={(e) =>
                            setNewDraft((d) => ({
                                ...d,
                                reference: { ...(d.reference || emptyLangMap()), [langKey]: e.target.value },
                            }))
                        }
                        maxLength={80}
                    />
                </label>

                <label className="adminLabel">
                    Text ({langKey.toUpperCase()})
                    <textarea
                        className="adminTextarea"
                        value={safeStr(newDraft?.text?.[langKey])}
                        onChange={(e) =>
                            setNewDraft((d) => ({
                                ...d,
                                text: { ...(d.text || emptyLangMap()), [langKey]: e.target.value },
                            }))
                        }
                        rows={6}
                        maxLength={1200}
                    />
                </label>

                <div className="adminMsgActions">
                    <button type="button" className="adminDeleteBtn" onClick={onCancel} disabled={newState === "saving"}>
                        Cancel
                    </button>

                    <button type="button" className="adminMsgSaveBtn" onClick={onSave} disabled={newState === "saving"}>
                        <IconSave />
                        {newState === "saving" ? "Saving…" : newState === "saved" ? "Saved ✓" : "Save"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function MonthlyVerseAdmin({ onDirtyChange }) {
    const mountedRef = useRef(true);
    const timeoutRef = useRef(null);

    const [loading, setLoading] = useState(true);

    const [current, setCurrent] = useState(() => ({ reference: emptyLangMap(), text: emptyLangMap() }));
    const [currentDraft, setCurrentDraft] = useState(() => ({ reference: emptyLangMap(), text: emptyLangMap() }));
    const [saveCurrentState, setSaveCurrentState] = useState("idle");
    const [expandedCurrent, setExpandedCurrent] = useState(false);
    const [currentLang, setCurrentLang] = useState("ro");

    const [showNew, setShowNew] = useState(false);
    const [newDraft, setNewDraft] = useState(() => ({ reference: emptyLangMap(), text: emptyLangMap() }));
    const [newState, setNewState] = useState("idle");
    const [newLang, setNewLang] = useState("ro");

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
    const [history, setHistory] = useState([]);
    const [expandedHistoryIds, setExpandedHistoryIds] = useState(() => new Set());
    const [historyDrafts, setHistoryDrafts] = useState({});
    const [savingHistoryById, setSavingHistoryById] = useState({});
    const [historyLangById, setHistoryLangById] = useState({});
    const [searchQuery, setSearchQuery] = useState("");

    const CURRENT_REF = useMemo(() => doc(db, "monthly_verse", "current"), []);

    const filteredHistory = useMemo(() => {
        if (!searchQuery.trim()) return history;
        const q = searchQuery.toLowerCase();
        return history.filter(h => {
            const ref = pickFallback(h.reference).toLowerCase();
            const txt = pickFallback(h.text).toLowerCase();
            return String(h.id).toLowerCase().includes(q) || ref.includes(q) || txt.includes(q);
        });
    }, [history, searchQuery]);

    const historyPagination = usePagination(filteredHistory, 10);

    const currentDirty = !verseEqualTrim(currentDraft, current);
    const currentSummary = useMemo(() => makeSummary(currentDraft.reference, currentDraft.text), [currentDraft]);

    // Report aggregate dirty state to parent
    useEffect(() => {
        if (!onDirtyChange) return;

        const anyHistoryDirty = Array.from(expandedHistoryIds).some(id => {
            const base = history.find(h => h.id === id);
            const draft = historyDrafts[id];
            return base && draft && !verseEqualTrim(draft, { reference: base.reference, text: base.text });
        });

        // "New" form is dirty if it has any meaningful content or is just open
        const isNewDirty = showNew && (pickFallback(newDraft.reference) || pickFallback(newDraft.text));
        
        // Current verse is dirty if expanded and has changes
        const isCurrentDirtyActual = expandedCurrent && currentDirty;

        onDirtyChange(isNewDirty || isCurrentDirtyActual || anyHistoryDirty);
    }, [showNew, newDraft, expandedCurrent, currentDirty, expandedHistoryIds, historyDrafts, history, onDirtyChange]);

    const setTransientState = (setter, value = "saved") => {
        setter(value);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => mountedRef.current && setter("idle"), 900);
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
        setSaveCurrentState("idle");

        const unsub = onSnapshot(
            CURRENT_REF,
            (snap) => {
                if (!mountedRef.current) return;
                const data = snap.exists() ? snap.data() || {} : {};
                const next = normalizeVerse(data);
                setCurrent(next);
                setCurrentDraft(next);
                setLoading(false);
            },
            (err) => {
                console.error(err);
                if (!mountedRef.current) return;
                setLoading(false);
                openInfoModal("Loading Error", "Could not load verse.");
            }
        );

        return () => unsub();
    }, [CURRENT_REF]);

    useEffect(() => {
        const unsub = onSnapshot(
            collection(db, "monthly_verse"),
            { includeMetadataChanges: false },
            (snap) => {
                if (!mountedRef.current) return;

                const list = [];
                snap.forEach((d) => {
                    if (d.id === "current") return;
                    const base = normalizeVerse(d.data() || {});
                    list.push({
                        id: d.id,
                        reference: base.reference,
                        text: base.text,
                        t: parseDateId(d.id) || 0,
                    });
                });

                list.sort((a, b) => b.t - a.t || String(b.id).localeCompare(String(a.id)));

                setHistory(list);

                setHistoryDrafts((prev) => {
                    const next = { ...prev };
                    const alive = new Set(list.map((x) => x.id));

                    Object.keys(next).forEach((k) => {
                        if (!alive.has(k)) delete next[k];
                    });

                    list.forEach((h) => {
                        const base = { reference: h.reference, text: h.text };
                        const cur = next[h.id];

                        if (!cur) {
                            next[h.id] = base;
                            return;
                        }

                        const dirty = !verseEqualTrim(cur, base);
                        if (!dirty) next[h.id] = base;
                    });

                    return next;
                });

                setExpandedHistoryIds((prev) => {
                    const alive = new Set(list.map((x) => x.id));
                    const next = new Set();
                    prev.forEach((id) => alive.has(id) && next.add(id));
                    return next;
                });

                setHistoryLangById((prev) => {
                    const alive = new Set(list.map((x) => x.id));
                    const next = { ...prev };
                    Object.keys(next).forEach((k) => {
                        if (!alive.has(k)) delete next[k];
                    });
                    list.forEach((h) => {
                        if (!next[h.id]) next[h.id] = "ro";
                    });
                    return next;
                });
            },
            (err) => console.error(err)
        );

        return () => unsub();
    }, []);


    const saveCurrent = async () => {
        if (!isVerseValidAllLangs(currentDraft)) {
            openInfoModal("Action Required", "Fill in reference and text for all 4 languages.");
            return;
        }

        setModal({
            isOpen: true,
            title: "Confirm Modification",
            message: "Are you sure you want to save these modifications?",
            variant: "primary",
            onConfirm: async () => {
                setModal(m => ({ ...m, isOpen: false }));
                setSaveCurrentState("saving");
                try {
                    const v = cleanVerse(currentDraft);
                    await setDoc(CURRENT_REF, { reference: v.reference, text: v.text }, { merge: true });

                    if (!mountedRef.current) return;
                    setCurrent(v);
                    setCurrentDraft(v);
                    setTransientState(setSaveCurrentState, "saved");
                } catch (err) {
                    console.error(err);
                    if (!mountedRef.current) return;
                    setSaveCurrentState("error");
                    openInfoModal("Save Error", "Saving failed.");
                }
            }
        });
    };

    const deleteCurrent = async () => {
        setModal({
            isOpen: true,
            title: "Delete Current Verse",
            message: "Are you sure you want to delete the current verse? This will remove it from the home page.",
            onConfirm: async () => {
                setModal({ isOpen: false });
                setSaveCurrentState("saving");
                try {
                    await deleteDoc(CURRENT_REF);

                    if (!mountedRef.current) return;
                    const empty = { reference: emptyLangMap(), text: emptyLangMap() };
                    setCurrent(empty);
                    setCurrentDraft(empty);
                    setTransientState(setSaveCurrentState, "saved");
                } catch (err) {
                    console.error(err);
                    if (!mountedRef.current) return;
                    setSaveCurrentState("error");
                    openInfoModal("Action Failed", "Could not delete current verse.");
                }
            }
        });
    };

    const cancelNew = () => {
        setShowNew(false);
        setNewDraft({ reference: emptyLangMap(), text: emptyLangMap() });
        setNewState("idle");
        setNewState("idle");
        setNewLang("ro");
    };

    const saveNew = async () => {
        if (!isVerseValidAllLangs(newDraft)) {
            openInfoModal("Action Required", "Fill in reference and text for all 4 languages.");
            return;
        }

        setModal({
            isOpen: true,
            title: "Confirm New Verse",
            message: "Are you sure you want to save this new verse?",
            variant: "primary",
            onConfirm: async () => {
                setModal(m => ({ ...m, isOpen: false }));
                setNewState("saving");

                try {
                    const prev = cleanVerse(current);
                    const hasPrev =
                        pickFallback(prev.reference) || pickFallback(prev.text);

                    if (hasPrev) {
                        await setDoc(doc(db, "monthly_verse", getArchiveId()), { reference: prev.reference, text: prev.text });
                    }

                    const v = cleanVerse(newDraft);
                    await setDoc(CURRENT_REF, { reference: v.reference, text: v.text }, { merge: true });

                    if (!mountedRef.current) return;
                    setNewState("saved");
                    setTimeout(() => mountedRef.current && cancelNew(), 900);
                } catch (err) {
                    console.error(err);
                    if (!mountedRef.current) return;
                    setNewState("error");
                    openInfoModal("Save Error", "Could not save new verse.");
                }
            }
        });
    };

    const toggleHistory = (id) => {
        toggleExpandWithConfirm({
            id,
            items: history,
            draftsById: historyDrafts,
            isDirtyFn: (item, draft) => !verseEqualTrim(item, draft),
            setModal,
            setExpandedIds: setExpandedHistoryIds,
            setDraftsById: setHistoryDrafts
        });
    };

    const setHistoryField = (id, field, lang, value) => {
        const key = safeStr(id).trim();
        if (!key) return;
        const l = safeStr(lang).trim() || "ro";
        setHistoryDrafts((prev) => {
            const base = prev[key] || { reference: emptyLangMap(), text: emptyLangMap() };
            return {
                ...prev,
                [key]: {
                    ...base,
                    [field]: { ...(base[field] || emptyLangMap()), [l]: value },
                },
            };
        });
    };

    const saveHistory = async (id) => {
        const key = safeStr(id).trim();
        if (!key) return;

        const base = history.find((h) => h.id === key);
        const draft = historyDrafts[key] || (base ? { reference: base.reference, text: base.text } : { reference: emptyLangMap(), text: emptyLangMap() });

        if (!isVerseValidAllLangs(draft)) {
            openInfoModal("Action Required", "Fill in reference and text for all 4 languages.");
            return;
        }

        if (base && verseEqualTrim(draft, { reference: base.reference, text: base.text })) return;

        setModal({
            isOpen: true,
            title: "Confirm Modification",
            message: "Are you sure you want to save these modifications to history?",
            variant: "primary",
            onConfirm: async () => {
                setModal(m => ({ ...m, isOpen: false }));
                setSavingHistoryById((m) => ({ ...m, [key]: "saving" }));

                try {
                    const v = cleanVerse(draft);
                    await setDoc(doc(db, "monthly_verse", key), { reference: v.reference, text: v.text }, { merge: true });

                    if (!mountedRef.current) return;
                    setSavingHistoryById((m) => ({ ...m, [key]: "saved" }));
                    setTimeout(() => mountedRef.current && setSavingHistoryById((m) => ({ ...m, [key]: "idle" })), 900);
                } catch (err) {
                    console.error(err);
                    if (!mountedRef.current) return;
                    setSavingHistoryById((m) => ({ ...m, [key]: "error" }));
                    openInfoModal("Save Error", "Could not save history verse.");
                }
            }
        });
    };

    const deleteHistory = async (id) => {
        const key = safeStr(id).trim();
        if (!key) return;

        setModal({
            isOpen: true,
            title: "Delete History Verse",
            message: "Permanently delete this verse from history? This action cannot be undone.",
            onConfirm: async () => {
                setModal({ isOpen: false });
                setSavingHistoryById((m) => ({ ...m, [key]: "saving" }));

                try {
                    await deleteDoc(doc(db, "monthly_verse", key));

                    if (!mountedRef.current) return;
                    setHistoryDrafts((prev) => {
                        const next = { ...prev };
                        delete next[key];
                        return next;
                    });
                    setExpandedHistoryIds((prev) => {
                        const next = new Set(prev);
                        next.delete(key);
                        return next;
                    });
                    setSavingHistoryById((m) => {
                        const next = { ...m };
                        delete next[key];
                        return next;
                    });
                    setHistoryLangById((prev) => {
                        const next = { ...prev };
                        delete next[key];
                        return next;
                    });
                } catch (err) {
                    console.error(err);
                    if (!mountedRef.current) return;
                    setSavingHistoryById((m) => ({ ...m, [key]: "error" }));
                    openInfoModal("Action Failed", "Could not delete history verse.");
                }
            }
        });
    };

    return (
        <div className="adminFullPage">
            <div className="adminFullTop">
                <h2 className="adminTitle">
                    Monthly Verse{' '}
                    {showHistory && <span className="adminTitleBadge">History</span>}
                </h2>

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
                        New
                    </button>

                    {history.length > 0 && (
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
                            <NewVerseCard
                                newDraft={newDraft}
                                setNewDraft={setNewDraft}
                                newState={newState}
                                activeLang={newLang}
                                onLangChange={setNewLang}
                                onCancel={cancelNew}
                                onSave={saveNew}
                            />
                        </div>
                    ) : null}

                    <div className="adminFullList">
                        {!showHistory ? (
                            <VerseCard
                                label="Current"
                                expanded={expandedCurrent}
                                summary={currentSummary}
                                draft={currentDraft}
                                dirty={currentDirty}
                                saveState={saveCurrentState}
                                activeLang={currentLang}
                                onLangChange={setCurrentLang}
                                onToggle={() => {
                                    toggleSingleExpandWithConfirm({
                                        item: current,
                                        draft: currentDraft,
                                        isDirtyFn: (item, draft) => !verseEqualTrim(item, draft),
                                        setModal,
                                        setExpanded: setExpandedCurrent,
                                        onResetDraft: () => setCurrentDraft(current)
                                    });
                                }}
                                onChangeField={(field, lang, value) => {
                                    const l = safeStr(lang).trim() || "ro";
                                    setCurrentDraft((s) => ({
                                        ...s,
                                        [field]: { ...(s[field] || emptyLangMap()), [l]: value },
                                    }));
                                    if (saveCurrentState !== "idle") setSaveCurrentState("idle");
                                }}
                                onSave={saveCurrent}
                                onDelete={deleteCurrent}
                                deleteTitle="Delete current verse"
                            />
                        ) : (
                            <div className="adminList adminList--history">
                                {historyPagination.paginatedItems.map((h) => {
                                    const expanded = expandedHistoryIds.has(h.id);
                                    const base = { reference: h.reference, text: h.text };
                                    const draft = historyDrafts[h.id] || base;
                                    const dirty = !verseEqualTrim(draft, base);
                                    const state = savingHistoryById[h.id] || "idle";
                                    const lang = historyLangById[h.id] || "ro";

                                    return (
                                        <VerseCard
                                            key={h.id}
                                            label={safeStr(h.id).split("-").slice(0, 3).join("-")}
                                            expanded={expanded}
                                            summary={makeSummary(h.reference, h.text)}
                                            draft={draft}
                                            dirty={dirty}
                                            saveState={state}
                                            activeLang={lang}
                                            onLangChange={(l) => setHistoryLangById((m) => ({ ...m, [h.id]: l }))}
                                            onToggle={() => toggleHistory(h.id)}
                                            onChangeField={(field, l, value) => setHistoryField(h.id, field, l, value)}
                                            onSave={() => saveHistory(h.id)}
                                            onDelete={() => deleteHistory(h.id)}
                                            deleteTitle="Delete from history"
                                        />
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="adminPaginationFooter">
                        {showHistory ? (
                            <PaginationControls
                                page={historyPagination.page}
                                totalPages={historyPagination.totalPages}
                                onNext={historyPagination.nextPage}
                                onPrev={historyPagination.prevPage}
                                onPageSet={historyPagination.setPage}
                            />
                        ) : null}
                    </div>

                    <ConfirmModal
                        isOpen={modal.isOpen}
                        title={modal.title}
                        message={modal.message}
                        variant={modal.variant}
                        onConfirm={modal.onConfirm}
                        onCancel={() => setModal({ ...modal, isOpen: false })}
                    />
                </div>
            )}
        </div>
    );
}