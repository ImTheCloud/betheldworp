"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { doc, collection, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../lib/Firebase";

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
                       deleteTitle = "Șterge",
                   }) {
    const onCardClick = (e) => {
        if (e.target.closest("button, input, textarea, select, label")) return;
        onToggle();
    };

    const langKey = activeLang || "ro";

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
                        Referință ({langKey.toUpperCase()})
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

function NewVerseCard({ newDraft, setNewDraft, newError, newState, activeLang, onLangChange, onCancel, onSave }) {
    const langKey = activeLang || "ro";

    return (
        <div className="adminAnnCard is-active">
            <div className="adminAnnHeader">
                <div className="adminAnnIdChip">Nou verset</div>
            </div>

            {newError ? <div className="adminAlert">{newError}</div> : null}

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
                Referință ({langKey.toUpperCase()})
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
                    Anulează
                </button>

                <button type="button" className="adminMsgSaveBtn" onClick={onSave} disabled={newState === "saving"}>
                    {newState === "saving" ? "Se salvează…" : newState === "saved" ? "Salvat ✓" : "Salvează"}
                </button>
            </div>
        </div>
    );
}

export default function MonthlyVerseAdmin() {
    const mountedRef = useRef(true);
    const timeoutRef = useRef(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [current, setCurrent] = useState(() => ({ reference: emptyLangMap(), text: emptyLangMap() }));
    const [currentDraft, setCurrentDraft] = useState(() => ({ reference: emptyLangMap(), text: emptyLangMap() }));
    const [saveCurrentState, setSaveCurrentState] = useState("idle");
    const [expandedCurrent, setExpandedCurrent] = useState(false);
    const [currentLang, setCurrentLang] = useState("ro");

    const [showNew, setShowNew] = useState(false);
    const [newDraft, setNewDraft] = useState(() => ({ reference: emptyLangMap(), text: emptyLangMap() }));
    const [newState, setNewState] = useState("idle");
    const [newError, setNewError] = useState("");
    const [newLang, setNewLang] = useState("ro");

    const [showHistory, setShowHistory] = useState(false);
    const [history, setHistory] = useState([]);
    const [expandedHistoryIds, setExpandedHistoryIds] = useState(() => new Set());
    const [historyDrafts, setHistoryDrafts] = useState({});
    const [savingHistoryById, setSavingHistoryById] = useState({});
    const [historyLangById, setHistoryLangById] = useState({});

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

    useEffect(() => {
        setLoading(true);
        setError("");
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
                setError("Nu am putut încărca versetul.");
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
                const sliced = list.slice(0, 12);

                setHistory(sliced);

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

                        const dirty = !verseEqualTrim(cur, base);
                        if (!dirty) next[h.id] = base;
                    });

                    return next;
                });

                setExpandedHistoryIds((prev) => {
                    const alive = new Set(sliced.map((x) => x.id));
                    const next = new Set();
                    prev.forEach((id) => alive.has(id) && next.add(id));
                    return next;
                });

                setHistoryLangById((prev) => {
                    const alive = new Set(sliced.map((x) => x.id));
                    const next = { ...prev };
                    Object.keys(next).forEach((k) => {
                        if (!alive.has(k)) delete next[k];
                    });
                    sliced.forEach((h) => {
                        if (!next[h.id]) next[h.id] = "ro";
                    });
                    return next;
                });
            },
            (err) => console.error(err)
        );

        return () => unsub();
    }, []);

    const currentDirty = !verseEqualTrim(currentDraft, current);

    const currentSummary = useMemo(() => makeSummary(currentDraft.reference, currentDraft.text), [currentDraft]);

    const saveCurrent = async () => {
        setError("");
        if (!isVerseValidAllLangs(currentDraft)) {
            setError("Completează referința și textul pentru toate cele 4 limbi.");
            return;
        }

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
            setError("Salvarea a eșuat.");
        }
    };

    const deleteCurrent = async () => {
        const ok = window.confirm("Ștergi versetul curent?");
        if (!ok) return;

        setError("");
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
            setError("Nu am putut șterge versetul curent.");
        }
    };

    const cancelNew = () => {
        setShowNew(false);
        setNewDraft({ reference: emptyLangMap(), text: emptyLangMap() });
        setNewState("idle");
        setNewError("");
        setNewLang("ro");
    };

    const saveNew = async () => {
        if (!isVerseValidAllLangs(newDraft)) {
            setNewError("Completează referința și textul pentru toate cele 4 limbi.");
            return;
        }

        setNewState("saving");
        setNewError("");

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
            setNewError("Nu am putut salva versetul nou.");
        }
    };

    const toggleHistory = (id) => {
        const key = safeStr(id).trim();
        if (!key) return;
        setExpandedHistoryIds((prev) => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
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
        if (error) setError("");
    };

    const saveHistory = async (id) => {
        const key = safeStr(id).trim();
        if (!key) return;

        const base = history.find((h) => h.id === key);
        const draft = historyDrafts[key] || (base ? { reference: base.reference, text: base.text } : { reference: emptyLangMap(), text: emptyLangMap() });

        if (!isVerseValidAllLangs(draft)) {
            setError("Completează referința și textul pentru toate cele 4 limbi.");
            return;
        }

        if (base && verseEqualTrim(draft, { reference: base.reference, text: base.text })) return;

        setSavingHistoryById((m) => ({ ...m, [key]: "saving" }));
        setError("");

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
                            activeLang={newLang}
                            onLangChange={setNewLang}
                            onCancel={cancelNew}
                            onSave={saveNew}
                        />
                    ) : null}

                    <VerseCard
                        label="Curent"
                        expanded={expandedCurrent}
                        summary={currentSummary}
                        draft={currentDraft}
                        dirty={currentDirty}
                        saveState={saveCurrentState}
                        activeLang={currentLang}
                        onLangChange={setCurrentLang}
                        onToggle={() => setExpandedCurrent((v) => !v)}
                        onChangeField={(field, lang, value) => {
                            const l = safeStr(lang).trim() || "ro";
                            setCurrentDraft((s) => ({
                                ...s,
                                [field]: { ...(s[field] || emptyLangMap()), [l]: value },
                            }));
                            if (error) setError("");
                            if (saveCurrentState !== "idle") setSaveCurrentState("idle");
                        }}
                        onSave={saveCurrent}
                        onDelete={deleteCurrent}
                        deleteTitle="Șterge versetul curent"
                    />

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

                    {showHistory ? (
                        <div className="adminList adminList--history">
                            {history.map((h) => {
                                const expanded = expandedHistoryIds.has(h.id);
                                const base = { reference: h.reference, text: h.text };
                                const draft = historyDrafts[h.id] || base;
                                const dirty = !verseEqualTrim(draft, base);
                                const state = savingHistoryById[h.id] || "idle";
                                const lang = historyLangById[h.id] || "ro";

                                return (
                                    <VerseCard
                                        key={h.id}
                                        label={h.id}
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