"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, setDoc, getDoc } from "firebase/firestore";
import { db } from "../../lib/Firebase";

const LANGS = [
    { key: "ro", label: "RO" },
    { key: "en", label: "EN" },
    { key: "fr", label: "FR" },
    { key: "nl", label: "NL" },
];

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

function pickByLang(value, lang) {
    if (!value) return "";
    if (typeof value === "string") return value.trim();
    if (typeof value === "object") {
        const v = value?.[lang] ?? value?.ro ?? value?.en ?? "";
        return String(v || "").trim();
    }
    return "";
}

function getBrusselsDayISO(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Brussels",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date);

    let y = "0000",
        m = "00",
        d = "00";
    parts.forEach((p) => {
        if (p.type === "year") y = p.value;
        if (p.type === "month") m = p.value;
        if (p.type === "day") d = p.value;
    });

    return `${y}-${m}-${d}`;
}

function parseISO(iso) {
    const m = safeStr(iso).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const yy = Number(m[1]);
    const mm = Number(m[2]);
    const dd = Number(m[3]);
    const dt = new Date(yy, mm - 1, dd);
    const time = dt.getTime();
    if (!Number.isFinite(time)) return null;
    return { yy, mm, dd, time };
}

function parseDMY(dmy) {
    const m = safeStr(dmy).trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (!m) return null;
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yy = Number(m[3]);
    const dt = new Date(yy, mm - 1, dd);
    const time = dt.getTime();
    if (!Number.isFinite(time)) return null;
    return { yy, mm, dd, time };
}

function parseDayFlexible(value) {
    const s = safeStr(value).trim();
    return parseDMY(s) || parseISO(s);
}

function formatDMYFromISO(iso) {
    const p = parseISO(iso);
    if (!p) return "";
    return `${String(p.dd).padStart(2, "0")}-${String(p.mm).padStart(2, "0")}-${String(p.yy).padStart(4, "0")}`;
}

function makeSummary(msgObj, max = 64) {
    const t = pickByLang(msgObj, "ro") || pickByLang(msgObj, "en") || pickByLang(msgObj, "fr") || pickByLang(msgObj, "nl") || "";
    const s = safeStr(t).trim();
    if (!s) return "—";
    return s.length <= max ? s : s.slice(0, max) + "…";
}

function normalizeAnnouncement(docId, data, todayTime) {
    const untilRaw = safeStr(data?.until || data?.date || "").trim();
    const untilParsed = parseDayFlexible(untilRaw);
    const untilISO = untilParsed
        ? `${String(untilParsed.yy).padStart(4, "0")}-${String(untilParsed.mm).padStart(2, "0")}-${String(untilParsed.dd).padStart(2, "0")}`
        : "";

    const message = normalizeLangMap(data?.message);
    const affectedProgramIds = safeArr(data?.affectedProgramIds)
        .map((v) => safeStr(v).trim())
        .filter(Boolean);

    const active = untilParsed ? todayTime <= untilParsed.time : false;

    return {
        id: safeStr(docId).trim(),
        active,
        untilRaw,
        untilISO,
        untilTime: untilParsed?.time ?? 0,
        affectedProgramIds,
        message,
    };
}

function isValidAllLangsMessage(msg) {
    const m = msg || emptyLangMap();
    return LANGS.every((l) => safeStr(m[l.key]).trim().length > 0);
}

function toSet(arr) {
    return new Set(safeArr(arr).map((x) => safeStr(x).trim()).filter(Boolean));
}

function sameArrayAsSet(arr, set) {
    const a = safeArr(arr).map((x) => safeStr(x).trim()).filter(Boolean);
    if (a.length !== set.size) return false;
    for (const x of a) if (!set.has(x)) return false;
    return true;
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

function AnnouncementCard({
                              item,
                              expanded,
                              activeLang,
                              draft,
                              saveState,
                              errorText,
                              onToggleExpand,
                              onChangeLang,
                              onToggleAffected,
                              onChangeUntilISO,
                              onChangeMessage,
                              onSave,
                              onDelete,
                          }) {
    const id = safeStr(item?.id).trim();
    const affectedSet = useMemo(() => toSet(draft?.affectedProgramIds ?? item?.affectedProgramIds), [draft, item]);
    const langKey = activeLang || "ro";

    const onCardClick = (e) => {
        if (e.target.closest("button, input, textarea, select, label")) return;
        onToggleExpand(id);
    };

    return (
        <div className={`adminAnnCard${item?.active ? " is-active" : ""}`} onClick={onCardClick}>
            <div className="adminAnnHeader">
                <div className="adminAnnIdChip">{id || "—"}</div>
                {!expanded ? <div className="adminSummary">{makeSummary(draft?.message ?? item?.message)}</div> : <div style={{ flex: 1 }} />}
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
                        Until
                        <input
                            className="adminInput"
                            type="date"
                            value={safeStr(draft?.untilISO ?? item?.untilISO)}
                            onChange={(e) => onChangeUntilISO(id, e.target.value)}
                        />
                    </label>

                    <div className="adminAffectGrid" aria-label="Zile afectate">
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

                    <div className="adminAffectGrid" aria-label="Limbă mesaj">
                        {LANGS.map((l) => (
                            <button
                                key={`${id}-lang-${l.key}`}
                                type="button"
                                className={`adminAffectChip ${langKey === l.key ? "is-on" : ""}`.trim()}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onChangeLang(id, l.key);
                                }}
                            >
                                {l.label}
                            </button>
                        ))}
                    </div>

                    <label className="adminLabel">
                        Mesaj ({langKey.toUpperCase()})
                        <textarea
                            className="adminTextarea"
                            value={safeStr(draft?.message?.[langKey] ?? item?.message?.[langKey])}
                            onChange={(e) => onChangeMessage(id, langKey, e.target.value)}
                            rows={5}
                            maxLength={1200}
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

function NewAnnouncementCard({
                                 draft,
                                 activeLang,
                                 saveState,
                                 errorText,
                                 onChangeLang,
                                 onToggleAffected,
                                 onChangeUntilISO,
                                 onChangeMessage,
                                 onCancel,
                                 onSave,
                             }) {
    const affectedSet = useMemo(() => toSet(draft?.affectedProgramIds), [draft]);
    const langKey = activeLang || "ro";

    return (
        <div className="adminAnnCard is-active">
            <div className="adminAnnHeader">
                <div className="adminAnnIdChip">Nou anunț</div>
                <div style={{ flex: 1 }} />
            </div>

            {errorText ? <div className="adminAlert">{errorText}</div> : null}

            <label className="adminLabel">
                Until
                <input
                    className="adminInput"
                    type="date"
                    value={safeStr(draft?.untilISO)}
                    onChange={(e) => onChangeUntilISO("__new__", e.target.value)}
                />
            </label>

            <div className="adminAffectGrid" aria-label="Zile afectate">
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

            <div className="adminAffectGrid" aria-label="Limbă mesaj">
                {LANGS.map((l) => (
                    <button
                        key={`new-lang-${l.key}`}
                        type="button"
                        className={`adminAffectChip ${langKey === l.key ? "is-on" : ""}`.trim()}
                        onClick={(e) => {
                            e.stopPropagation();
                            onChangeLang("__new__", l.key);
                        }}
                    >
                        {l.label}
                    </button>
                ))}
            </div>

            <label className="adminLabel">
                Mesaj ({langKey.toUpperCase()})
                <textarea
                    className="adminTextarea"
                    value={safeStr(draft?.message?.[langKey])}
                    onChange={(e) => onChangeMessage("__new__", langKey, e.target.value)}
                    rows={5}
                    maxLength={1200}
                />
            </label>

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

export default function ProgramAnnouncementsAdmin() {
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
    const [langById, setLangById] = useState({});

    const [showNew, setShowNew] = useState(false);
    const [newDraft, setNewDraft] = useState(() => ({
        untilISO: getBrusselsDayISO(),
        affectedProgramIds: [],
        message: emptyLangMap(),
    }));
    const [newLang, setNewLang] = useState("ro");
    const [newError, setNewError] = useState("");
    const [newState, setNewState] = useState("idle");

    const todayISO = useMemo(() => getBrusselsDayISO(), []);
    const todayTime = useMemo(() => parseISO(todayISO)?.time ?? Date.now(), [todayISO]);

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

        const ref = collection(db, "program_announcements");
        const unsub = onSnapshot(
            ref,
            (snap) => {
                if (!mountedRef.current) return;

                const list = [];
                snap.forEach((d) => list.push(normalizeAnnouncement(d.id, d.data() || {}, todayTime)));

                list.sort((a, b) => {
                    if (a.active !== b.active) return a.active ? -1 : 1;
                    if (a.active) return a.untilTime - b.untilTime || a.id.localeCompare(b.id);
                    return b.untilTime - a.untilTime || a.id.localeCompare(b.id);
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
                            untilISO: it.untilISO,
                            affectedProgramIds: safeArr(it.affectedProgramIds),
                            message: { ...it.message },
                        };

                        if (!next[id]) {
                            next[id] = base;
                            return;
                        }

                        const cur = next[id];
                        const dirtyUntil = safeStr(cur.untilISO).trim() !== safeStr(base.untilISO).trim();
                        const dirtyAffect = !sameArrayAsSet(cur.affectedProgramIds, toSet(base.affectedProgramIds));
                        const dirtyMsg = LANGS.some(
                            (l) => safeStr(cur?.message?.[l.key]).trim() !== safeStr(base?.message?.[l.key]).trim()
                        );

                        if (!dirtyUntil && !dirtyAffect && !dirtyMsg) next[id] = base;
                    });

                    return next;
                });

                setExpandedIds((prev) => {
                    const alive = new Set(list.map((x) => x.id));
                    const next = new Set();
                    prev.forEach((id) => alive.has(id) && next.add(id));
                    return next;
                });

                setLangById((prev) => {
                    const alive = new Set(list.map((x) => x.id));
                    const next = { ...prev };
                    Object.keys(next).forEach((k) => {
                        if (!alive.has(k)) delete next[k];
                    });
                    list.forEach((it) => {
                        if (!next[it.id]) next[it.id] = "ro";
                    });
                    return next;
                });

                setLoading(false);
            },
            (err) => {
                console.error(err);
                if (!mountedRef.current) return;
                setLoading(false);
                setGlobalError("Nu am putut încărca anunțurile.");
            }
        );

        return () => unsub();
    }, [todayTime]);

    const activeItems = useMemo(() => items.filter((x) => x.active), [items]);
    const historyItems = useMemo(() => items.filter((x) => !x.active), [items]);

    const toggleExpand = useCallback((id) => {
        const key = safeStr(id).trim();
        if (!key) return;
        setExpandedIds((prev) => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    }, []);

    const changeLang = (id, lang) => {
        const key = safeStr(id).trim();
        const l = safeStr(lang).trim();
        if (!l) return;

        if (key === "__new__") {
            setNewLang(l);
            return;
        }

        if (!key) return;
        setLangById((m) => ({ ...m, [key]: l }));
    };

    const changeUntilISO = (id, iso) => {
        const key = safeStr(id).trim();

        if (key === "__new__") {
            setNewDraft((d) => ({ ...d, untilISO: iso }));
            if (newError) setNewError("");
            if (globalError) setGlobalError("");
            return;
        }

        if (!key) return;
        setDraftsById((prev) => ({
            ...prev,
            [key]: { ...(prev[key] || { untilISO: "", affectedProgramIds: [], message: emptyLangMap() }), untilISO: iso },
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
            const cur = prev[key] || { untilISO: "", affectedProgramIds: [], message: emptyLangMap() };
            const set = toSet(cur.affectedProgramIds);
            set.has(p) ? set.delete(p) : set.add(p);
            return { ...prev, [key]: { ...cur, affectedProgramIds: Array.from(set) } };
        });
        setErrorById((m) => ({ ...m, [key]: "" }));
        if (globalError) setGlobalError("");
    };

    const changeMessage = (id, lang, value) => {
        const key = safeStr(id).trim();
        const l = safeStr(lang).trim();
        if (!l) return;

        if (key === "__new__") {
            setNewDraft((d) => ({ ...d, message: { ...(d.message || emptyLangMap()), [l]: value } }));
            if (newError) setNewError("");
            if (globalError) setGlobalError("");
            return;
        }

        if (!key) return;
        setDraftsById((prev) => {
            const cur = prev[key] || { untilISO: "", affectedProgramIds: [], message: emptyLangMap() };
            return { ...prev, [key]: { ...cur, message: { ...(cur.message || emptyLangMap()), [l]: value } } };
        });
        setErrorById((m) => ({ ...m, [key]: "" }));
        if (globalError) setGlobalError("");
    };

    const computeDocIdFromUntilISO = (untilISO) => {
        const iso = safeStr(untilISO).trim();
        const dmy = formatDMYFromISO(iso);
        if (!dmy) return "";
        return `ann_${dmy}`;
    };

    const ensureUniqueId = async (baseId) => {
        const id = safeStr(baseId).trim();
        if (!id) return "";
        const ref = doc(db, "program_announcements", id);
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
            untilISO: getBrusselsDayISO(),
            affectedProgramIds: [],
            message: emptyLangMap(),
        });
        setNewLang("ro");
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
        const iso = safeStr(newDraft?.untilISO).trim();
        const untilDMY = formatDMYFromISO(iso);
        const untilValid = Boolean(parseISO(iso)) && Boolean(untilDMY);

        const affected = safeArr(newDraft?.affectedProgramIds).map((x) => safeStr(x).trim()).filter(Boolean);
        const msg = normalizeLangMap(newDraft?.message);

        if (!untilValid) {
            setNewError("Completează data (until).");
            return;
        }
        if (!affected.length) {
            setNewError("Selectează cel puțin o zi afectată.");
            return;
        }
        if (!isValidAllLangsMessage(msg)) {
            setNewError("Completează mesajul pentru toate cele 4 limbi.");
            return;
        }

        setNewError("");
        setNewState("saving");

        try {
            const baseId = computeDocIdFromUntilISO(iso);
            const finalId = await ensureUniqueId(baseId);

            await setDoc(
                doc(db, "program_announcements", finalId),
                { until: untilDMY, affectedProgramIds: affected, message: msg },
                { merge: true }
            );

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
                setLangById((m) => ({ ...m, [finalId]: "ro" }));
                setNewState("idle");
            }, 900);
        } catch (err) {
            console.error(err);
            if (!mountedRef.current) return;
            setNewState("error");
            setNewError("Nu am putut salva anunțul nou.");
        }
    };

    const saveOne = async (id) => {
        const key = safeStr(id).trim();
        if (!key) return;

        const base = items.find((x) => x.id === key);
        const draft = draftsById[key] || {
            untilISO: base?.untilISO || "",
            affectedProgramIds: base?.affectedProgramIds || [],
            message: base?.message || emptyLangMap(),
        };

        const iso = safeStr(draft.untilISO).trim();
        const untilDMY = formatDMYFromISO(iso);
        const untilValid = Boolean(parseISO(iso)) && Boolean(untilDMY);

        const affected = safeArr(draft.affectedProgramIds).map((x) => safeStr(x).trim()).filter(Boolean);
        const msg = normalizeLangMap(draft.message);

        if (!untilValid) {
            setErrorById((m) => ({ ...m, [key]: "Completează data (until)." }));
            return;
        }
        if (!affected.length) {
            setErrorById((m) => ({ ...m, [key]: "Selectează cel puțin o zi afectată." }));
            return;
        }
        if (!isValidAllLangsMessage(msg)) {
            setErrorById((m) => ({ ...m, [key]: "Completează mesajul pentru toate cele 4 limbi." }));
            return;
        }

        setErrorById((m) => ({ ...m, [key]: "" }));
        setSaveStateById((m) => ({ ...m, [key]: "saving" }));

        try {
            const desiredBaseId = computeDocIdFromUntilISO(iso);

            if (desiredBaseId && desiredBaseId !== key) {
                const ok = window.confirm(
                    `Ai schimbat data (until).\n\nAsta va crea un nou anunț (${desiredBaseId}) cu aceleași date și îl va păstra pe cel vechi.\n\nContinui?`
                );
                if (!ok) {
                    setSaveStateById((m) => ({ ...m, [key]: "idle" }));
                    return;
                }
            }

            const targetId = desiredBaseId && desiredBaseId !== key ? await ensureUniqueId(desiredBaseId) : key;

            await setDoc(
                doc(db, "program_announcements", targetId),
                { until: untilDMY, affectedProgramIds: affected, message: msg },
                { merge: true }
            );

            if (!mountedRef.current) return;

            if (targetId !== key) {
                const baseCur = items.find((x) => x.id === key);
                if (baseCur) {
                    setDraftsById((prev) => ({
                        ...prev,
                        [key]: {
                            untilISO: baseCur.untilISO,
                            affectedProgramIds: safeArr(baseCur.affectedProgramIds),
                            message: { ...baseCur.message },
                        },
                    }));
                }
                setSaveStateById((m) => ({ ...m, [key]: "idle" }));
                setExpandedIds((prev) => {
                    const next = new Set(prev);
                    next.add(targetId);
                    return next;
                });
                setLangById((m) => ({ ...m, [targetId]: langById[key] || "ro" }));
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

        const ok = window.confirm("Ștergi definitiv acest anunț?");
        if (!ok) return;

        setGlobalError("");
        setErrorById((m) => ({ ...m, [key]: "" }));
        setSaveStateById((m) => ({ ...m, [key]: "saving" }));

        try {
            await deleteDoc(doc(db, "program_announcements", key));

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
            setLangById((prev) => {
                const next = { ...prev };
                delete next[key];
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
            setErrorById((m) => ({ ...m, [key]: "Nu am putut șterge anunțul." }));
        }
    };

    return (
        <div className="adminCard">
            <div className="adminTop">
                <h2 className="adminTitle">Anunțuri speciale</h2>
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
                        <NewAnnouncementCard
                            draft={newDraft}
                            activeLang={newLang}
                            saveState={newState}
                            errorText={newError}
                            onChangeLang={changeLang}
                            onToggleAffected={toggleAffected}
                            onChangeUntilISO={changeUntilISO}
                            onChangeMessage={changeMessage}
                            onCancel={cancelNew}
                            onSave={saveNew}
                        />
                    ) : null}

                    <div className="adminList">
                        {activeItems.map((it) => {
                            const id = it.id;
                            return (
                                <AnnouncementCard
                                    key={id}
                                    item={it}
                                    expanded={expandedIds.has(id)}
                                    activeLang={langById[id] || "ro"}
                                    draft={
                                        draftsById[id] || {
                                            untilISO: it.untilISO,
                                            affectedProgramIds: it.affectedProgramIds,
                                            message: it.message,
                                        }
                                    }
                                    saveState={saveStateById[id] || "idle"}
                                    errorText={errorById[id] || ""}
                                    onToggleExpand={toggleExpand}
                                    onChangeLang={changeLang}
                                    onToggleAffected={toggleAffected}
                                    onChangeUntilISO={changeUntilISO}
                                    onChangeMessage={changeMessage}
                                    onSave={saveOne}
                                    onDelete={deleteOne}
                                />
                            );
                        })}
                        {!activeItems.length ? <div className="adminEmpty">Nu există anunț activ. Apasă „Nou”.</div> : null}
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
                                    <AnnouncementCard
                                        key={id}
                                        item={it}
                                        expanded={expandedIds.has(id)}
                                        activeLang={langById[id] || "ro"}
                                        draft={
                                            draftsById[id] || {
                                                untilISO: it.untilISO,
                                                affectedProgramIds: it.affectedProgramIds,
                                                message: it.message,
                                            }
                                        }
                                        saveState={saveStateById[id] || "idle"}
                                        errorText={errorById[id] || ""}
                                        onToggleExpand={toggleExpand}
                                        onChangeLang={changeLang}
                                        onToggleAffected={toggleAffected}
                                        onChangeUntilISO={changeUntilISO}
                                        onChangeMessage={changeMessage}
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