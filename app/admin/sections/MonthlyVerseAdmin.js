"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { doc, collection, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../lib/Firebase";

/*
 * Helpers
 */
function safeStr(v) {
    return String(v ?? "");
}
function pad2(n) {
    return String(n).padStart(2, "0");
}

// YYYY-MM-DD
function getTodayId() {
    const now = new Date();
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

// Unique archive id but still sortable by day (ex: 2025-12-19-193027)
function getArchiveId() {
    const now = new Date();
    return `${getTodayId()}-${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
}

// Parse an ID back into a timestamp for sorting history (accepts YYYY-MM-DD and YYYY-MM-DD-xxxxx)
function parseDateId(id) {
    const s = safeStr(id).trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:-|$)/);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0).getTime();
}

function isVerseValid(reference, text) {
    return Boolean(safeStr(reference).trim() && safeStr(text).trim());
}

function makeSummary(reference, text, max = 60) {
    const ref = safeStr(reference).trim();
    const t = safeStr(text).trim();
    if (ref) return ref;
    if (!t) return "—";
    return t.length <= max ? t : t.slice(0, max) + "…";
}

/*
 * Icons
 */
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

/*
 * Reusable Verse card (current + history)
 */
function VerseCard({
                       label,
                       expanded,
                       summary,
                       draft,
                       dirty,
                       saveState,
                       onToggle,
                       onChangeField,
                       onSave,
                       onDelete,
                       deleteTitle = "Șterge",
                   }) {
    const onCardClick = (e) => {
        if (e.target.closest("button, input, textarea, select, label")) return;
        onToggle();
    };

    return (
        <div className="adminAnnCard" onClick={onCardClick}>
            <div className="adminAnnHeader">
                <div className="adminAnnIdChip">{label}</div>

                {!expanded ? <div className="adminSummary">{summary}</div> : <div style={{ flex: 1 }} />}

                <button
                    type="button"
                    className="adminSmallBtn"
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggle();
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

            {expanded ? (
                <>
                    <label className="adminLabel">
                        Referință
                        <input
                            className="adminInput"
                            value={safeStr(draft.reference)}
                            onChange={(e) => onChangeField("reference", e.target.value)}
                            maxLength={60}
                        />
                    </label>

                    <label className="adminLabel">
                        Text
                        <textarea
                            className="adminTextarea"
                            value={safeStr(draft.text)}
                            onChange={(e) => onChangeField("text", e.target.value)}
                            rows={6}
                            maxLength={800}
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
                            Șterge
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
                            {saveState === "saving" ? "Se salvează…" : saveState === "saved" ? "Salvat ✓" : "Salvează"}
                        </button>
                    </div>
                </>
            ) : null}
        </div>
    );
}

/*
 * NewVerseCard – add a brand new verse (becomes current)
 */
function NewVerseCard({ newDraft, setNewDraft, newError, newState, onCancel, onSave }) {
    return (
        <div className="adminAnnCard is-active">
            <div className="adminAnnHeader">
                <div className="adminAnnIdChip">Nou verset</div>
            </div>

            {newError ? <div className="adminAlert">{newError}</div> : null}

            <label className="adminLabel">
                Referință
                <input
                    className="adminInput"
                    value={safeStr(newDraft.reference)}
                    onChange={(e) => setNewDraft((d) => ({ ...d, reference: e.target.value }))}
                    maxLength={60}
                />
            </label>

            <label className="adminLabel">
                Text
                <textarea
                    className="adminTextarea"
                    value={safeStr(newDraft.text)}
                    onChange={(e) => setNewDraft((d) => ({ ...d, text: e.target.value }))}
                    rows={6}
                    maxLength={800}
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

/*
 * MonthlyVerseAdmin
 */
export default function MonthlyVerseAdmin() {
    const mountedRef = useRef(true);
    const timeoutRef = useRef(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [current, setCurrent] = useState({ reference: "", text: "" });
    const [currentDraft, setCurrentDraft] = useState({ reference: "", text: "" });
    const [saveCurrentState, setSaveCurrentState] = useState("idle");
    const [expandedCurrent, setExpandedCurrent] = useState(false);

    const [showNew, setShowNew] = useState(false);
    const [newDraft, setNewDraft] = useState({ reference: "", text: "" });
    const [newState, setNewState] = useState("idle");
    const [newError, setNewError] = useState("");

    const [showHistory, setShowHistory] = useState(false);
    const [history, setHistory] = useState([]); // [{id, reference, text, t}]
    const [expandedHistoryIds, setExpandedHistoryIds] = useState(() => new Set());

    const [historyDrafts, setHistoryDrafts] = useState({}); // id -> {reference, text}
    const [savingHistoryById, setSavingHistoryById] = useState({}); // id -> state

    const CURRENT_REF = useMemo(() => doc(db, "monthly_verse", "current"), []);

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

    // Current verse
    useEffect(() => {
        setLoading(true);
        setError("");
        setSaveCurrentState("idle");

        const unsub = onSnapshot(
            CURRENT_REF,
            (snap) => {
                if (!mountedRef.current) return;

                const data = snap.exists() ? snap.data() || {} : {};
                const next = { reference: safeStr(data.reference), text: safeStr(data.text) };

                setCurrent(next);
                setCurrentDraft(next);
                setLoading(false);
            },
            (err) => {
                console.error(err);
                if (!mountedRef.current) return;
                setLoading(false);
                setError("Nu am putut încărca versetul.");
            }
        );

        return () => unsub();
    }, [CURRENT_REF]);

    // History collection
    useEffect(() => {
        const unsub = onSnapshot(
            collection(db, "monthly_verse"),
            { includeMetadataChanges: false },
            (snap) => {
                if (!mountedRef.current) return;

                const list = [];
                snap.forEach((d) => {
                    if (d.id === "current") return;
                    const data = d.data() || {};
                    list.push({
                        id: d.id,
                        reference: safeStr(data.reference),
                        text: safeStr(data.text),
                        t: parseDateId(d.id) || 0,
                    });
                });

                list.sort((a, b) => b.t - a.t || String(b.id).localeCompare(String(a.id)));
                const sliced = list.slice(0, 12);

                setHistory(sliced);

                // keep drafts if user modified; otherwise sync from firestore
                setHistoryDrafts((prev) => {
                    const next = { ...prev };
                    const alive = new Set(sliced.map((x) => x.id));

                    Object.keys(next).forEach((k) => {
                        if (!alive.has(k)) delete next[k];
                    });

                    sliced.forEach((h) => {
                        const base = { reference: h.reference, text: h.text };
                        const cur = next[h.id];

                        if (!cur) {
                            next[h.id] = base;
                            return;
                        }

                        const dirty =
                            safeStr(cur.reference).trim() !== safeStr(base.reference).trim() ||
                            safeStr(cur.text).trim() !== safeStr(base.text).trim();

                        if (!dirty) next[h.id] = base;
                    });

                    return next;
                });

                // keep expanded ids only if still present
                setExpandedHistoryIds((prev) => {
                    const alive = new Set(sliced.map((x) => x.id));
                    const next = new Set();
                    prev.forEach((id) => alive.has(id) && next.add(id));
                    return next;
                });
            },
            (err) => console.error(err)
        );

        return () => unsub();
    }, []);

    // Derived states
    const currentDirty =
        safeStr(currentDraft.reference).trim() !== safeStr(current.reference).trim() ||
        safeStr(currentDraft.text).trim() !== safeStr(current.text).trim();

    const currentSummary = useMemo(
        () => makeSummary(currentDraft.reference, currentDraft.text),
        [currentDraft.reference, currentDraft.text]
    );

    // Current actions
    const saveCurrent = async () => {
        setError("");
        const ref = safeStr(currentDraft.reference).trim();
        const text = safeStr(currentDraft.text).trim();

        if (!isVerseValid(ref, text)) {
            setError("Completează referința și textul.");
            return;
        }

        setSaveCurrentState("saving");
        try {
            await setDoc(CURRENT_REF, { reference: ref, text }, { merge: true });

            if (!mountedRef.current) return;
            setCurrent({ reference: ref, text });
            setCurrentDraft({ reference: ref, text });
            setTransientState(setSaveCurrentState, "saved");
        } catch (err) {
            console.error(err);
            if (!mountedRef.current) return;
            setSaveCurrentState("error");
            setError("Salvarea a eșuat.");
        }
    };

    const deleteCurrent = async () => {
        const ok = window.confirm("Ștergi versetul curent?");
        if (!ok) return;

        setError("");
        setSaveCurrentState("saving");
        try {
            // delete doc "current"
            await deleteDoc(CURRENT_REF);

            if (!mountedRef.current) return;
            setCurrent({ reference: "", text: "" });
            setCurrentDraft({ reference: "", text: "" });
            setTransientState(setSaveCurrentState, "saved");
        } catch (err) {
            console.error(err);
            if (!mountedRef.current) return;
            setSaveCurrentState("error");
            setError("Nu am putut șterge versetul curent.");
        }
    };

    // New verse actions
    const cancelNew = () => {
        setShowNew(false);
        setNewDraft({ reference: "", text: "" });
        setNewState("idle");
        setNewError("");
    };

    const saveNew = async () => {
        const ref = safeStr(newDraft.reference).trim();
        const text = safeStr(newDraft.text).trim();

        if (!isVerseValid(ref, text)) {
            setNewError("Completează referința și textul.");
            return;
        }

        setNewState("saving");
        setNewError("");

        try {
            // archive previous current if any
            const prevRef = safeStr(current.reference).trim();
            const prevText = safeStr(current.text).trim();
            if (prevRef || prevText) {
                await setDoc(doc(db, "monthly_verse", getArchiveId()), { reference: prevRef, text: prevText });
            }

            // set new current
            await setDoc(CURRENT_REF, { reference: ref, text }, { merge: true });

            if (!mountedRef.current) return;
            setNewState("saved");
            setTimeout(() => mountedRef.current && cancelNew(), 900);
        } catch (err) {
            console.error(err);
            if (!mountedRef.current) return;
            setNewState("error");
            setNewError("Nu am putut salva versetul nou.");
        }
    };

    // History actions
    const toggleHistory = (id) => {
        const key = safeStr(id).trim();
        if (!key) return;
        setExpandedHistoryIds((prev) => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    };

    const setHistoryField = (id, field, value) => {
        const key = safeStr(id).trim();
        if (!key) return;
        setHistoryDrafts((prev) => ({
            ...prev,
            [key]: {
                ...(prev[key] || { reference: "", text: "" }),
                [field]: value,
            },
        }));
        if (error) setError("");
    };

    const saveHistory = async (id) => {
        const key = safeStr(id).trim();
        if (!key) return;

        const base = history.find((h) => h.id === key);
        const draft = historyDrafts[key] || { reference: "", text: "" };

        const ref = safeStr(draft.reference).trim();
        const text = safeStr(draft.text).trim();

        if (!isVerseValid(ref, text)) {
            setError("Completează referința și textul.");
            return;
        }

        // no changes
        if (
            base &&
            safeStr(base.reference).trim() === ref &&
            safeStr(base.text).trim() === text
        ) {
            return;
        }

        setSavingHistoryById((m) => ({ ...m, [key]: "saving" }));
        setError("");

        try {
            await setDoc(doc(db, "monthly_verse", key), { reference: ref, text }, { merge: true });

            if (!mountedRef.current) return;
            setSavingHistoryById((m) => ({ ...m, [key]: "saved" }));
            setTimeout(() => mountedRef.current && setSavingHistoryById((m) => ({ ...m, [key]: "idle" })), 900);
        } catch (err) {
            console.error(err);
            if (!mountedRef.current) return;
            setSavingHistoryById((m) => ({ ...m, [key]: "error" }));
            setError("Nu am putut salva versetul din istoric.");
        }
    };

    const deleteHistory = async (id) => {
        const key = safeStr(id).trim();
        if (!key) return;

        const ok = window.confirm("Ștergi definitiv acest verset din istoric?");
        if (!ok) return;

        setError("");
        setSavingHistoryById((m) => ({ ...m, [key]: "saving" }));

        try {
            await deleteDoc(doc(db, "monthly_verse", key));

            if (!mountedRef.current) return;
            // optimistic cleanup (snapshot will also refresh)
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
        } catch (err) {
            console.error(err);
            if (!mountedRef.current) return;
            setSavingHistoryById((m) => ({ ...m, [key]: "error" }));
            setError("Nu am putut șterge versetul din istoric.");
        }
    };

    return (
        <div className="adminCard">
            <div className="adminTop">
                <h2 className="adminTitle">Versetul lunii</h2>

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
                        <NewVerseCard
                            newDraft={newDraft}
                            setNewDraft={setNewDraft}
                            newError={newError}
                            newState={newState}
                            onCancel={cancelNew}
                            onSave={saveNew}
                        />
                    ) : null}

                    {/* Current verse (editable + delete + save) */}
                    <VerseCard
                        label="Curent"
                        expanded={expandedCurrent}
                        summary={currentSummary}
                        draft={currentDraft}
                        dirty={currentDirty}
                        saveState={saveCurrentState}
                        onToggle={() => setExpandedCurrent((v) => !v)}
                        onChangeField={(field, value) => {
                            setCurrentDraft((s) => ({ ...s, [field]: value }));
                            if (error) setError("");
                            if (saveCurrentState !== "idle") setSaveCurrentState("idle");
                        }}
                        onSave={saveCurrent}
                        onDelete={deleteCurrent}
                        deleteTitle="Șterge versetul curent"
                    />

                    {/* History toggle */}
                    <div className="adminHistoryRow">
                        <button
                            type="button"
                            className="adminSmallBtn"
                            onClick={() => setShowHistory((v) => !v)}
                            disabled={!history.length}
                        >
                            {showHistory ? "Ascunde istoricul" : `Arată istoricul (${history.length})`}
                        </button>
                    </div>

                    {/* History list (editable + delete + save per entry) */}
                    {showHistory ? (
                        <div className="adminList adminList--history">
                            {history.map((h) => {
                                const expanded = expandedHistoryIds.has(h.id);
                                const draft = historyDrafts[h.id] || { reference: h.reference, text: h.text };
                                const baseRef = safeStr(h.reference).trim();
                                const baseText = safeStr(h.text).trim();
                                const dirty =
                                    safeStr(draft.reference).trim() !== baseRef ||
                                    safeStr(draft.text).trim() !== baseText;

                                return (
                                    <VerseCard
                                        key={h.id}
                                        label={h.id}
                                        expanded={expanded}
                                        summary={makeSummary(h.reference, h.text)}
                                        draft={draft}
                                        dirty={dirty}
                                        saveState={savingHistoryById[h.id] || "idle"}
                                        onToggle={() => toggleHistory(h.id)}
                                        onChangeField={(field, value) => setHistoryField(h.id, field, value)}
                                        onSave={() => saveHistory(h.id)}
                                        onDelete={() => deleteHistory(h.id)}
                                        deleteTitle="Șterge din istoric"
                                    />
                                );
                            })}
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    );
}
