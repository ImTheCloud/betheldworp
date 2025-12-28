// ProgramOverridesAdmin.jsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collection, deleteDoc, doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../../lib/Firebase";

const AFFECT_OPTIONS = [
    { id: "mon", label: "Lun" },
    { id: "tue", label: "Mar" },
    { id: "wed", label: "Mie" },
    { id: "thu", label: "Joi" },
    { id: "fri", label: "Vin" },
    { id: "sat", label: "Sâm" },
    { id: "sun_am", label: "Dum AM" },
    { id: "sun_pm", label: "Dum PM" },
];

const safeArr = (v) => (Array.isArray(v) ? v : []);
const safeStr = (v) => String(v ?? "");

function toSet(arr) {
    return new Set(safeArr(arr).map((x) => safeStr(x).trim()).filter(Boolean));
}

function sameArrayAsSet(arr, set) {
    const a = safeArr(arr).map((x) => safeStr(x).trim()).filter(Boolean);
    if (a.length !== set.size) return false;
    for (const x of a) if (!set.has(x)) return false;
    return true;
}

function isValidWeekKey(v) {
    const s = safeStr(v).trim().toUpperCase();
    return /^\d{4}-W\d{2}$/.test(s);
}

function normalizeWeekKey(v) {
    const s = safeStr(v).trim().toUpperCase();
    return isValidWeekKey(s) ? s : "";
}

function parseWeekKey(weekKey) {
    const s = normalizeWeekKey(weekKey);
    if (!s) return null;
    const m = s.match(/^(\d{4})-W(\d{2})$/);
    if (!m) return null;
    const year = Number(m[1]);
    const week = Number(m[2]);
    if (!Number.isFinite(year) || !Number.isFinite(week) || week < 1 || week > 53) return null;
    return { year, week };
}

function startOfISOWeekUTC(isoYear, isoWeek) {
    const jan4 = new Date(Date.UTC(isoYear, 0, 4, 12, 0, 0));
    const day = jan4.getUTCDay() || 7;
    const mondayWeek1 = new Date(jan4.getTime() + (1 - day) * 86400000);
    return new Date(mondayWeek1.getTime() + (isoWeek - 1) * 7 * 86400000);
}

function getISOWeekYearAndNumberUTC(dateUTC) {
    const d = new Date(Date.UTC(dateUTC.getUTCFullYear(), dateUTC.getUTCMonth(), dateUTC.getUTCDate(), 12, 0, 0));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const isoYear = d.getUTCFullYear();
    const yearStart = new Date(Date.UTC(isoYear, 0, 1, 12, 0, 0));
    const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return { isoYear, week };
}

function getCurrentWeekKeyUTC() {
    const { isoYear, week } = getISOWeekYearAndNumberUTC(new Date());
    return `${String(isoYear).padStart(4, "0")}-W${String(week).padStart(2, "0")}`;
}

function labelForAffected(id) {
    return AFFECT_OPTIONS.find((x) => x.id === id)?.label || id;
}

function makeAffectedSummary(arr, max = 60) {
    const list = safeArr(arr).map((x) => safeStr(x).trim()).filter(Boolean);
    if (!list.length) return "—";
    const txt = list.map(labelForAffected).join(", ");
    return txt.length <= max ? txt : txt.slice(0, max) + "…";
}

function shortId(id) {
    const s = safeStr(id).trim();
    if (!s) return "—";
    return s.split("•")[0].trim().split(" ")[0].trim();
}

function normalizeOverride(docId, data, currentWeekStartUTC) {
    const idRaw = safeStr(docId).trim();
    const weekKey = normalizeWeekKey(data?.weekKey) || normalizeWeekKey(idRaw) || shortId(idRaw).toUpperCase();
    const parsed = parseWeekKey(weekKey);

    const affectedProgramIds = safeArr(data?.affectedProgramIds)
        .map((v) => safeStr(v).trim())
        .filter(Boolean);

    const weekStartUTC = parsed ? startOfISOWeekUTC(parsed.year, parsed.week) : null;
    const upcoming = weekStartUTC ? weekStartUTC.getTime() >= currentWeekStartUTC.getTime() : false;

    return {
        id: idRaw,
        weekKey,
        weekStartUTC: weekStartUTC?.getTime?.() ?? 0,
        upcoming,
        affectedProgramIds,
    };
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

function IconPlus(props) {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

function OverrideCard({ item, expanded, draft, saveState, errorText, onToggleExpand, onToggleAffected, onChangeWeekKey, onSave, onDelete }) {
    const id = safeStr(item?.id).trim();
    const affectedSet = useMemo(() => toSet(draft?.affectedProgramIds ?? item?.affectedProgramIds), [draft, item]);
    const weekKeyValue = safeStr(draft?.weekKey ?? item?.weekKey);

    const onCardClick = (e) => {
        if (e.target.closest("button, input, textarea, select, label")) return;
        onToggleExpand(id);
    };

    return (
        <div className={`adminAnnCard${item?.upcoming ? " is-active" : ""}`} onClick={onCardClick}>
            <div className="adminAnnHeader">
                <div className="adminAnnIdChip" title={weekKeyValue || id || ""}>
                    {shortId(weekKeyValue || id)}
                </div>

                {!expanded ? (
                    <div className="adminSummary">Anulat: {makeAffectedSummary(draft?.affectedProgramIds ?? item?.affectedProgramIds)}</div>
                ) : (
                    <div style={{ flex: 1 }} />
                )}

                <button
                    type="button"
                    className="adminSmallBtn"
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleExpand(id);
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
                    {errorText ? <div className="adminAlert">{errorText}</div> : null}

                    <label className="adminLabel">
                        Săptămână
                        <input
                            className="adminInput"
                            type="week"
                            value={weekKeyValue}
                            onChange={(e) => onChangeWeekKey(id, e.target.value)}
                        />
                    </label>

                    <div className="adminAffectGrid" aria-label="Crêneaux anulate">
                        {AFFECT_OPTIONS.map((opt) => {
                            const on = affectedSet.has(opt.id);
                            return (
                                <button
                                    key={`${id}-${opt.id}`}
                                    type="button"
                                    className={`adminAffectChip${on ? " is-on" : ""}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onToggleAffected(id, opt.id);
                                    }}
                                    title={opt.label}
                                >
                                    {opt.label}
                                </button>
                            );
                        })}
                    </div>

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
                            Șterge
                        </button>

                        <button
                            type="button"
                            className="adminMsgSaveBtn"
                            onClick={(e) => {
                                e.stopPropagation();
                                onSave(id);
                            }}
                            disabled={saveState === "saving"}
                        >
                            {saveState === "saving" ? "Se salvează…" : saveState === "saved" ? "Salvat ✓" : "Salvează"}
                        </button>
                    </div>
                </>
            ) : null}
        </div>
    );
}

function NewOverrideCard({ draft, saveState, errorText, onToggleAffected, onChangeWeekKey, onCancel, onSave }) {
    const affectedSet = useMemo(() => toSet(draft?.affectedProgramIds), [draft]);
    const weekKeyValue = safeStr(draft?.weekKey);

    return (
        <div className="adminAnnCard is-active">
            <div className="adminAnnHeader">
                <div className="adminAnnIdChip">Nouă anulare</div>
                <div style={{ flex: 1 }} />
            </div>

            {errorText ? <div className="adminAlert">{errorText}</div> : null}

            <label className="adminLabel">
                Săptămână
                <input className="adminInput" type="week" value={weekKeyValue} onChange={(e) => onChangeWeekKey("__new__", e.target.value)} />
            </label>

            <div className="adminAffectGrid" aria-label="Crêneaux anulate">
                {AFFECT_OPTIONS.map((opt) => {
                    const on = affectedSet.has(opt.id);
                    return (
                        <button
                            key={`new-${opt.id}`}
                            type="button"
                            className={`adminAffectChip${on ? " is-on" : ""}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleAffected("__new__", opt.id);
                            }}
                            title={opt.label}
                        >
                            {opt.label}
                        </button>
                    );
                })}
            </div>

            <div className="adminMsgActions">
                <button type="button" className="adminDeleteBtn" onClick={onCancel} disabled={saveState === "saving"}>
                    Anulează
                </button>

                <button type="button" className="adminMsgSaveBtn" onClick={onSave} disabled={saveState === "saving"}>
                    {saveState === "saving" ? "Se salvează…" : saveState === "saved" ? "Salvat ✓" : "Salvează"}
                </button>
            </div>
        </div>
    );
}

export default function ProgramOverridesAdmin() {
    const mountedRef = useRef(true);
    const timeoutRef = useRef(null);

    const [loading, setLoading] = useState(true);
    const [globalError, setGlobalError] = useState("");

    const [items, setItems] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [expandedIds, setExpandedIds] = useState(() => new Set());

    const [draftsById, setDraftsById] = useState({});
    const [saveStateById, setSaveStateById] = useState({});
    const [errorById, setErrorById] = useState({});

    const [showNew, setShowNew] = useState(false);
    const [newDraft, setNewDraft] = useState(() => ({
        weekKey: getCurrentWeekKeyUTC(),
        affectedProgramIds: [],
    }));
    const [newError, setNewError] = useState("");
    const [newState, setNewState] = useState("idle");

    const currentWeekKey = useMemo(() => getCurrentWeekKeyUTC(), []);
    const currentParsed = useMemo(() => parseWeekKey(currentWeekKey), [currentWeekKey]);
    const currentWeekStartUTC = useMemo(() => {
        if (!currentParsed) return new Date(Date.UTC(2000, 0, 1, 12, 0, 0));
        return startOfISOWeekUTC(currentParsed.year, currentParsed.week);
    }, [currentParsed]);

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

        const ref = collection(db, "program_overrides");
        const unsub = onSnapshot(
            ref,
            (snap) => {
                if (!mountedRef.current) return;

                const list = [];
                snap.forEach((d) => list.push(normalizeOverride(d.id, d.data() || {}, currentWeekStartUTC)));

                list.sort((a, b) => {
                    if (a.upcoming !== b.upcoming) return a.upcoming ? -1 : 1;
                    if (a.upcoming) return a.weekStartUTC - b.weekStartUTC || a.weekKey.localeCompare(b.weekKey);
                    return b.weekStartUTC - a.weekStartUTC || a.weekKey.localeCompare(b.weekKey);
                });

                setItems(list);

                setDraftsById((prev) => {
                    const next = { ...prev };
                    const alive = new Set(list.map((x) => x.id).filter(Boolean));

                    Object.keys(next).forEach((k) => {
                        if (!alive.has(k)) delete next[k];
                    });

                    list.forEach((it) => {
                        const id = it.id;
                        if (!id) return;

                        const base = {
                            weekKey: it.weekKey,
                            affectedProgramIds: safeArr(it.affectedProgramIds),
                        };

                        if (!next[id]) {
                            next[id] = base;
                            return;
                        }

                        const cur = next[id];
                        const dirtyWeek = safeStr(cur.weekKey).trim().toUpperCase() !== safeStr(base.weekKey).trim().toUpperCase();
                        const dirtyAffect = !sameArrayAsSet(cur.affectedProgramIds, toSet(base.affectedProgramIds));

                        if (!dirtyWeek && !dirtyAffect) next[id] = base;
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
                setGlobalError("Nu am putut încărca modificările programului.");
            }
        );

        return () => unsub();
    }, [currentWeekStartUTC]);

    const upcomingItems = useMemo(() => items.filter((x) => x.upcoming), [items]);
    const historyItems = useMemo(() => items.filter((x) => !x.upcoming), [items]);

    const toggleExpand = useCallback((id) => {
        const key = safeStr(id).trim();
        if (!key) return;
        setExpandedIds((prev) => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    }, []);

    const changeWeekKey = (id, wk) => {
        const key = safeStr(id).trim();
        const weekKey = normalizeWeekKey(wk);

        if (key === "__new__") {
            setNewDraft((d) => ({ ...d, weekKey: weekKey || safeStr(wk).trim() }));
            if (newError) setNewError("");
            if (globalError) setGlobalError("");
            return;
        }

        if (!key) return;
        setDraftsById((prev) => ({
            ...prev,
            [key]: { ...(prev[key] || { weekKey: "", affectedProgramIds: [] }), weekKey: weekKey || safeStr(wk).trim() },
        }));
        setErrorById((m) => ({ ...m, [key]: "" }));
        if (globalError) setGlobalError("");
    };

    const toggleAffected = (id, programId) => {
        const key = safeStr(id).trim();
        const p = safeStr(programId).trim();
        if (!p) return;

        if (key === "__new__") {
            setNewDraft((d) => {
                const set = toSet(d.affectedProgramIds);
                set.has(p) ? set.delete(p) : set.add(p);
                return { ...d, affectedProgramIds: Array.from(set) };
            });
            if (newError) setNewError("");
            if (globalError) setGlobalError("");
            return;
        }

        if (!key) return;
        setDraftsById((prev) => {
            const cur = prev[key] || { weekKey: "", affectedProgramIds: [] };
            const set = toSet(cur.affectedProgramIds);
            set.has(p) ? set.delete(p) : set.add(p);
            return { ...prev, [key]: { ...cur, affectedProgramIds: Array.from(set) } };
        });
        setErrorById((m) => ({ ...m, [key]: "" }));
        if (globalError) setGlobalError("");
    };

    const ensureUniqueId = async (baseId) => {
        const id = normalizeWeekKey(baseId) || safeStr(baseId).trim();
        if (!id) return "";
        const ref = doc(db, "program_overrides", id);
        const snap = await getDoc(ref);
        if (!snap.exists()) return id;
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, "0");
        const mm = String(now.getMinutes()).padStart(2, "0");
        const ss = String(now.getSeconds()).padStart(2, "0");
        return `${id}-${hh}${mm}${ss}`;
    };

    const startNew = () => {
        setShowNew(true);
        setNewDraft({
            weekKey: getCurrentWeekKeyUTC(),
            affectedProgramIds: [],
        });
        setNewError("");
        setNewState("idle");
        if (globalError) setGlobalError("");
    };

    const cancelNew = () => {
        setShowNew(false);
        setNewError("");
        setNewState("idle");
    };

    const saveNew = async () => {
        const wk = normalizeWeekKey(newDraft?.weekKey);
        const affected = safeArr(newDraft?.affectedProgramIds).map((x) => safeStr(x).trim()).filter(Boolean);

        if (!wk) {
            setNewError("Selectează o săptămână validă.");
            return;
        }
        if (!affected.length) {
            setNewError("Selectează cel puțin un crêneau anulat.");
            return;
        }

        setNewError("");
        setNewState("saving");

        try {
            const finalId = await ensureUniqueId(wk);
            await setDoc(doc(db, "program_overrides", finalId), { weekKey: wk, affectedProgramIds: affected }, { merge: true });

            if (!mountedRef.current) return;
            setNewState("saved");
            setTimeout(() => {
                if (!mountedRef.current) return;
                setShowNew(false);
                setExpandedIds((prev) => {
                    const next = new Set(prev);
                    next.add(finalId);
                    return next;
                });
                setNewState("idle");
            }, 900);
        } catch (err) {
            console.error(err);
            if (!mountedRef.current) return;
            setNewState("error");
            setNewError("Nu am putut salva modificarea.");
        }
    };

    const saveOne = async (id) => {
        const key = safeStr(id).trim();
        if (!key) return;

        const base = items.find((x) => x.id === key);
        const draft = draftsById[key] || {
            weekKey: base?.weekKey || "",
            affectedProgramIds: base?.affectedProgramIds || [],
        };

        const wk = normalizeWeekKey(draft.weekKey);
        const affected = safeArr(draft.affectedProgramIds).map((x) => safeStr(x).trim()).filter(Boolean);

        if (!wk) {
            setErrorById((m) => ({ ...m, [key]: "Selectează o săptămână validă." }));
            return;
        }
        if (!affected.length) {
            setErrorById((m) => ({ ...m, [key]: "Selectează cel puțin un crêneau anulat." }));
            return;
        }

        setErrorById((m) => ({ ...m, [key]: "" }));
        setSaveStateById((m) => ({ ...m, [key]: "saving" }));

        try {
            const desiredId = wk;

            if (desiredId && desiredId !== key) {
                const ok = window.confirm(
                    `Ai schimbat săptămâna.\n\nAsta va crea un nou document (${desiredId}) cu aceleași date și îl va păstra pe cel vechi.\n\nContinui?`
                );
                if (!ok) {
                    setSaveStateById((m) => ({ ...m, [key]: "idle" }));
                    return;
                }
            }

            const targetId = desiredId && desiredId !== key ? await ensureUniqueId(desiredId) : key;

            await setDoc(doc(db, "program_overrides", targetId), { weekKey: wk, affectedProgramIds: affected }, { merge: true });

            if (!mountedRef.current) return;

            if (targetId !== key) {
                const baseCur = items.find((x) => x.id === key);
                if (baseCur) {
                    setDraftsById((prev) => ({
                        ...prev,
                        [key]: { weekKey: baseCur.weekKey, affectedProgramIds: safeArr(baseCur.affectedProgramIds) },
                    }));
                }
                setSaveStateById((m) => ({ ...m, [key]: "idle" }));
                setExpandedIds((prev) => {
                    const next = new Set(prev);
                    next.add(targetId);
                    return next;
                });
                setTransientState(targetId, "saved");
            } else {
                setTransientState(key, "saved");
            }
        } catch (err) {
            console.error(err);
            if (!mountedRef.current) return;
            setSaveStateById((m) => ({ ...m, [key]: "error" }));
            setErrorById((m) => ({ ...m, [key]: "Nu am putut salva. Încearcă din nou." }));
        }
    };

    const deleteOne = async (id) => {
        const key = safeStr(id).trim();
        if (!key) return;

        const ok = window.confirm("Ștergi definitiv această anulare?");
        if (!ok) return;

        setGlobalError("");
        setErrorById((m) => ({ ...m, [key]: "" }));
        setSaveStateById((m) => ({ ...m, [key]: "saving" }));

        try {
            await deleteDoc(doc(db, "program_overrides", key));

            if (!mountedRef.current) return;
            setDraftsById((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
            setExpandedIds((prev) => {
                const next = new Set(prev);
                next.delete(key);
                return next;
            });
            setSaveStateById((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
            setErrorById((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
        } catch (err) {
            console.error(err);
            if (!mountedRef.current) return;
            setSaveStateById((m) => ({ ...m, [key]: "error" }));
            setErrorById((m) => ({ ...m, [key]: "Nu am putut șterge." }));
        }
    };

    return (
        <div className="adminCard">
            <div className="adminTop">
                <h2 className="adminTitle">Modificări program (anulări)</h2>
                <div className="adminActions">
                    <button className="adminBtn adminBtn--new" type="button" onClick={startNew} disabled={loading || showNew}>
                        <span className="adminBtnIcon" aria-hidden="true">
                            <IconPlus />
                        </span>
                        Nou
                    </button>
                </div>
            </div>

            {loading ? <div className="adminSkeleton" /> : null}

            {!loading ? (
                <div className="adminForm adminForm--edit">
                    {globalError ? <div className="adminAlert">{globalError}</div> : null}

                    {showNew ? (
                        <NewOverrideCard
                            draft={newDraft}
                            saveState={newState}
                            errorText={newError}
                            onToggleAffected={toggleAffected}
                            onChangeWeekKey={changeWeekKey}
                            onCancel={cancelNew}
                            onSave={saveNew}
                        />
                    ) : null}

                    <div className="adminList">
                        {upcomingItems.map((it) => {
                            const id = it.id;
                            return (
                                <OverrideCard
                                    key={id}
                                    item={it}
                                    expanded={expandedIds.has(id)}
                                    draft={
                                        draftsById[id] || {
                                            weekKey: it.weekKey,
                                            affectedProgramIds: it.affectedProgramIds,
                                        }
                                    }
                                    saveState={saveStateById[id] || "idle"}
                                    errorText={errorById[id] || ""}
                                    onToggleExpand={toggleExpand}
                                    onToggleAffected={toggleAffected}
                                    onChangeWeekKey={changeWeekKey}
                                    onSave={saveOne}
                                    onDelete={deleteOne}
                                />
                            );
                        })}
                        {!upcomingItems.length ? <div className="adminEmpty">Nu există anulări viitoare. Apasă „Nou”.</div> : null}
                    </div>

                    <div className="adminHistoryRow">
                        <button type="button" className="adminSmallBtn" onClick={() => setShowHistory((v) => !v)} disabled={!historyItems.length}>
                            {showHistory ? "Ascunde istoricul" : `Arată istoricul (${historyItems.length})`}
                        </button>
                    </div>

                    {showHistory ? (
                        <div className="adminList adminList--history">
                            {historyItems.map((it) => {
                                const id = it.id;
                                return (
                                    <OverrideCard
                                        key={id}
                                        item={it}
                                        expanded={expandedIds.has(id)}
                                        draft={
                                            draftsById[id] || {
                                                weekKey: it.weekKey,
                                                affectedProgramIds: it.affectedProgramIds,
                                            }
                                        }
                                        saveState={saveStateById[id] || "idle"}
                                        errorText={errorById[id] || ""}
                                        onToggleExpand={toggleExpand}
                                        onToggleAffected={toggleAffected}
                                        onChangeWeekKey={changeWeekKey}
                                        onSave={saveOne}
                                        onDelete={deleteOne}
                                    />
                                );
                            })}
                        </div>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}