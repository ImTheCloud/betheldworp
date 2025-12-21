"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { collection, deleteDoc, doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../../lib/Firebase";

const LANGS = [
    { key: "ro", label: "RO" },
    { key: "en", label: "EN" },
    { key: "fr", label: "FR" },
    { key: "nl", label: "NL" },
];

const safeArr = (v) => (Array.isArray(v) ? v : []);
const safeStr = (v) => String(v ?? "");

function pad2(n) {
    return String(n).padStart(2, "0");
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

function formatDMYFromISO(iso) {
    const p = parseISO(iso);
    if (!p) return "";
    return `${String(p.dd).padStart(2, "0")}-${String(p.mm).padStart(2, "0")}-${String(p.yy).padStart(4, "0")}`;
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

function pickByLang(value) {
    if (!value) return "";
    if (typeof value === "string") return value.trim();
    if (typeof value === "object") {
        const v = value?.ro ?? value?.en ?? value?.fr ?? value?.nl ?? "";
        return String(v || "").trim();
    }
    return "";
}

function makeSummary(titleObj, max = 64) {
    const t = pickByLang(titleObj);
    const s = safeStr(t).trim();
    if (!s) return "—";
    return s.length <= max ? s : s.slice(0, max) + "…";
}

function isValidAllLangs(map) {
    const m = map || emptyLangMap();
    return LANGS.every((l) => safeStr(m[l.key]).trim().length > 0);
}

function computeDocIdFromDateISO(dateISO) {
    const iso = safeStr(dateISO).trim();
    const dmy = formatDMYFromISO(iso);
    if (!dmy) return "";
    return `event_${dmy}`;
}

async function ensureUniqueId(baseId) {
    const id = safeStr(baseId).trim();
    if (!id) return "";
    const ref = doc(db, "events", id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return id;

    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    return `${id}-${hh}${mm}${ss}`;
}

const DEFAULT_COMMON = {
    image: "/images/events/supper.jpg",
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

function EventCard({
                       ev,
                       expanded,
                       draft,
                       activeLang,
                       savingState,
                       errorText,
                       onToggleExpand,
                       onChangeLang,
                       onChangeField,
                       onChangeLangField,
                       onSave,
                       onDelete,
                   }) {
    const id = safeStr(ev?.id).trim();
    const langKey = activeLang || "ro";

    const dirty = useMemo(() => {
        const baseDate = safeStr(ev?.dateISO).trim();
        const baseTitle = ev?.title || emptyLangMap();
        const baseDesc = ev?.description || emptyLangMap();
        const baseImage = safeStr(ev?.image).trim();
        const baseTime = safeStr(ev?.time).trim();
        const basePlace = safeStr(ev?.place).trim();
        const baseAddress = safeStr(ev?.address).trim();

        const dDate = safeStr(draft?.dateISO).trim();
        const dTitle = draft?.title || emptyLangMap();
        const dDesc = draft?.description || emptyLangMap();
        const dImage = safeStr(draft?.image).trim();
        const dTime = safeStr(draft?.time).trim();
        const dPlace = safeStr(draft?.place).trim();
        const dAddress = safeStr(draft?.address).trim();

        if (dDate !== baseDate) return true;
        if (dImage !== baseImage) return true;
        if (dTime !== baseTime) return true;
        if (dPlace !== basePlace) return true;
        if (dAddress !== baseAddress) return true;

        for (const l of LANGS) {
            if (safeStr(dTitle?.[l.key]).trim() !== safeStr(baseTitle?.[l.key]).trim()) return true;
            if (safeStr(dDesc?.[l.key]).trim() !== safeStr(baseDesc?.[l.key]).trim()) return true;
        }
        return false;
    }, [draft, ev]);

    const summary = useMemo(() => makeSummary(draft?.title ?? ev?.title), [draft, ev]);

    const onCardClick = (e) => {
        if (e.target.closest("button, input, textarea, select, label")) return;
        onToggleExpand(id);
    };

    return (
        <div className="adminAnnCard" onClick={onCardClick}>
            <div className="adminAnnHeader adminAnnHeader--events">
                <div className="adminAnnIdChip adminAnnIdChip--eventFull">{id}</div>
                {!expanded ? <div className="adminSummary">{summary}</div> : <div style={{ flex: 1 }} />}
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
                        Dată
                        <input
                            className="adminInput"
                            type="date"
                            value={safeStr(draft?.dateISO)}
                            onChange={(e) => onChangeField(id, "dateISO", e.target.value)}
                        />
                    </label>

                    <div className="adminAffectGrid" aria-label="Limbă">
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
                        Titlu ({langKey.toUpperCase()})
                        <input
                            className="adminInput"
                            value={safeStr(draft?.title?.[langKey])}
                            onChange={(e) => onChangeLangField(id, "title", langKey, e.target.value)}
                            maxLength={120}
                        />
                    </label>

                    <label className="adminLabel">
                        Descriere ({langKey.toUpperCase()})
                        <textarea
                            className="adminTextarea"
                            value={safeStr(draft?.description?.[langKey])}
                            onChange={(e) => onChangeLangField(id, "description", langKey, e.target.value)}
                            rows={6}
                            maxLength={2200}
                        />
                    </label>

                    <label className="adminLabel">
                        Imagine (URL)
                        <input
                            className="adminInput"
                            value={safeStr(draft?.image)}
                            onChange={(e) => onChangeField(id, "image", e.target.value)}
                        />
                    </label>

                    <label className="adminLabel">
                        Orar
                        <input
                            className="adminInput"
                            value={safeStr(draft?.time)}
                            onChange={(e) => onChangeField(id, "time", e.target.value)}
                        />
                    </label>

                    <label className="adminLabel">
                        Locație
                        <input
                            className="adminInput"
                            value={safeStr(draft?.place)}
                            onChange={(e) => onChangeField(id, "place", e.target.value)}
                        />
                    </label>

                    <label className="adminLabel">
                        Adresă
                        <input
                            className="adminInput"
                            value={safeStr(draft?.address)}
                            onChange={(e) => onChangeField(id, "address", e.target.value)}
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
                            disabled={savingState === "saving"}
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
            ) : null}
        </div>
    );
}

function NewEventCard({
                          draft,
                          activeLang,
                          saveState,
                          errorText,
                          idPreview,
                          onChangeLang,
                          onChangeField,
                          onChangeLangField,
                          onCancel,
                          onSave,
                      }) {
    const langKey = activeLang || "ro";

    return (
        <div className="adminAnnCard is-active">
            <div className="adminAnnHeader">
                <div className="adminAnnIdChip">Nou eveniment</div>
            </div>

            {idPreview ? <div className="adminMutedLine">ID: {idPreview}</div> : null}
            {errorText ? <div className="adminAlert">{errorText}</div> : null}

            <label className="adminLabel">
                Dată
                <input
                    className="adminInput"
                    type="date"
                    value={safeStr(draft?.dateISO)}
                    onChange={(e) => onChangeField("__new__", "dateISO", e.target.value)}
                />
            </label>

            <div className="adminAffectGrid" aria-label="Limbă">
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
                Titlu ({langKey.toUpperCase()})
                <input
                    className="adminInput"
                    value={safeStr(draft?.title?.[langKey])}
                    onChange={(e) => onChangeLangField("__new__", "title", langKey, e.target.value)}
                    maxLength={120}
                />
            </label>

            <label className="adminLabel">
                Descriere ({langKey.toUpperCase()})
                <textarea
                    className="adminTextarea"
                    value={safeStr(draft?.description?.[langKey])}
                    onChange={(e) => onChangeLangField("__new__", "description", langKey, e.target.value)}
                    rows={6}
                    maxLength={2200}
                />
            </label>

            <label className="adminLabel">
                Imagine (URL)
                <input
                    className="adminInput"
                    value={safeStr(draft?.image)}
                    onChange={(e) => onChangeField("__new__", "image", e.target.value)}
                />
            </label>

            <label className="adminLabel">
                Orar
                <input
                    className="adminInput"
                    value={safeStr(draft?.time)}
                    onChange={(e) => onChangeField("__new__", "time", e.target.value)}
                />
            </label>

            <label className="adminLabel">
                Locație
                <input
                    className="adminInput"
                    value={safeStr(draft?.place)}
                    onChange={(e) => onChangeField("__new__", "place", e.target.value)}
                />
            </label>

            <label className="adminLabel">
                Adresă
                <input
                    className="adminInput"
                    value={safeStr(draft?.address)}
                    onChange={(e) => onChangeField("__new__", "address", e.target.value)}
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

export default function EventsAdmin() {
    const mountedRef = useRef(true);
    const timeoutRef = useRef(null);

    const [loading, setLoading] = useState(true);
    const [globalError, setGlobalError] = useState("");

    const [events, setEvents] = useState([]);
    const [draftsById, setDraftsById] = useState({});
    const [savingById, setSavingById] = useState({});
    const [errorById, setErrorById] = useState({});
    const [expandedIds, setExpandedIds] = useState(() => new Set());
    const [showHistory, setShowHistory] = useState(false);
    const [langById, setLangById] = useState({});

    const [showNew, setShowNew] = useState(false);
    const [newDraft, setNewDraft] = useState(() => ({
        dateISO: "",
        title: emptyLangMap(),
        description: emptyLangMap(),
        ...DEFAULT_COMMON,
    }));
    const [newLang, setNewLang] = useState("ro");
    const [newError, setNewError] = useState("");
    const [newState, setNewState] = useState("idle");

    const todayISO = useMemo(() => getBrusselsDayISO(), []);
    const todayTime = useMemo(() => parseISO(todayISO)?.time ?? Date.now(), [todayISO]);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    const setTransientState = (id, value = "saved") => {
        setSavingById((m) => ({ ...m, [id]: value }));
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            if (!mountedRef.current) return;
            setSavingById((m) => ({ ...m, [id]: "idle" }));
        }, 900);
    };

    useEffect(() => {
        setLoading(true);
        setGlobalError("");

        const unsub = onSnapshot(
            collection(db, "events"),
            (snap) => {
                if (!mountedRef.current) return;

                const list = snap.docs.map((d) => {
                    const data = d.data() || {};
                    const dateISO = normalizeDateToIso(data.dateEvent);
                    const ms = parseISO(dateISO)?.time ?? 0;

                    return {
                        id: d.id,
                        dateISO,
                        ms,
                        title: normalizeLangMap(data.title),
                        description: normalizeLangMap(data.description),
                        image: safeStr(data.image).trim(),
                        time: safeStr(data.time).trim(),
                        place: safeStr(data.place).trim(),
                        address: safeStr(data.address).trim(),
                    };
                });

                list.sort((a, b) => (a.ms || 0) - (b.ms || 0) || a.id.localeCompare(b.id));
                setEvents(list);

                setDraftsById((prev) => {
                    const next = { ...prev };
                    const alive = new Set(list.map((x) => x.id).filter(Boolean));

                    Object.keys(next).forEach((k) => {
                        if (!alive.has(k)) delete next[k];
                    });

                    list.forEach((ev) => {
                        const base = {
                            dateISO: ev.dateISO,
                            title: { ...ev.title },
                            description: { ...ev.description },
                            image: ev.image,
                            time: ev.time,
                            place: ev.place,
                            address: ev.address,
                        };

                        if (!next[ev.id]) {
                            next[ev.id] = base;
                            return;
                        }

                        const cur = next[ev.id];
                        const dirtyDate = safeStr(cur?.dateISO).trim() !== safeStr(base.dateISO).trim();
                        const dirtyImage = safeStr(cur?.image).trim() !== safeStr(base.image).trim();
                        const dirtyTime = safeStr(cur?.time).trim() !== safeStr(base.time).trim();
                        const dirtyPlace = safeStr(cur?.place).trim() !== safeStr(base.place).trim();
                        const dirtyAddress = safeStr(cur?.address).trim() !== safeStr(base.address).trim();

                        const dirtyLang = LANGS.some(
                            (l) =>
                                safeStr(cur?.title?.[l.key]).trim() !== safeStr(base?.title?.[l.key]).trim() ||
                                safeStr(cur?.description?.[l.key]).trim() !== safeStr(base?.description?.[l.key]).trim()
                        );

                        if (!dirtyDate && !dirtyImage && !dirtyTime && !dirtyPlace && !dirtyAddress && !dirtyLang) next[ev.id] = base;
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
                    list.forEach((ev) => {
                        if (!next[ev.id]) next[ev.id] = "ro";
                    });
                    return next;
                });

                setLoading(false);
            },
            (err) => {
                console.error(err);
                if (!mountedRef.current) return;
                setGlobalError("Nu am putut încărca evenimentele.");
                setLoading(false);
            }
        );

        return () => unsub();
    }, []);

    const { upcomingEvents, pastEvents } = useMemo(() => {
        const up = [];
        const past = [];
        events.forEach((ev) => {
            const t = ev.ms || 0;
            if (t && t < todayTime) past.push(ev);
            else up.push(ev);
        });

        up.sort((a, b) => (a.ms || 0) - (b.ms || 0) || a.id.localeCompare(b.id));
        past.sort((a, b) => (b.ms || 0) - (a.ms || 0) || a.id.localeCompare(b.id));

        return { upcomingEvents: up, pastEvents: past };
    }, [events, todayTime]);

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

    const changeField = (id, field, value) => {
        const key = safeStr(id).trim();

        if (key === "__new__") {
            setNewDraft((d) => ({ ...d, [field]: value }));
            if (newError) setNewError("");
            if (globalError) setGlobalError("");
            return;
        }

        if (!key) return;
        setDraftsById((prev) => ({
            ...prev,
            [key]: { ...(prev[key] || {}), [field]: value },
        }));
        setErrorById((m) => ({ ...m, [key]: "" }));
        if (globalError) setGlobalError("");
    };

    const changeLangField = (id, field, lang, value) => {
        const key = safeStr(id).trim();
        const l = safeStr(lang).trim();
        if (!l) return;

        if (key === "__new__") {
            setNewDraft((d) => ({ ...d, [field]: { ...(d[field] || emptyLangMap()), [l]: value } }));
            if (newError) setNewError("");
            if (globalError) setGlobalError("");
            return;
        }

        if (!key) return;
        setDraftsById((prev) => {
            const cur = prev[key] || {};
            return { ...prev, [key]: { ...cur, [field]: { ...(cur[field] || emptyLangMap()), [l]: value } } };
        });
        setErrorById((m) => ({ ...m, [key]: "" }));
        if (globalError) setGlobalError("");
    };

    const startNew = () => {
        setShowNew(true);
        setNewDraft({
            dateISO: "",
            title: emptyLangMap(),
            description: emptyLangMap(),
            ...DEFAULT_COMMON,
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

    const idPreview = useMemo(() => computeDocIdFromDateISO(newDraft?.dateISO), [newDraft?.dateISO]);

    const saveNew = async () => {
        const iso = safeStr(newDraft?.dateISO).trim();
        const okDate = Boolean(parseISO(iso)) && Boolean(formatDMYFromISO(iso));

        const title = normalizeLangMap(newDraft?.title);
        const description = normalizeLangMap(newDraft?.description);

        const image = safeStr(newDraft?.image).trim();
        const time = safeStr(newDraft?.time).trim();
        const place = safeStr(newDraft?.place).trim();
        const address = safeStr(newDraft?.address).trim();

        if (!okDate) {
            setNewError("Completează data evenimentului.");
            return;
        }
        if (!isValidAllLangs(title)) {
            setNewError("Completează titlul pentru toate cele 4 limbi.");
            return;
        }
        if (!isValidAllLangs(description)) {
            setNewError("Completează descrierea pentru toate cele 4 limbi.");
            return;
        }

        setNewError("");
        setNewState("saving");

        try {
            const baseId = computeDocIdFromDateISO(iso);
            const finalId = await ensureUniqueId(baseId);

            await setDoc(
                doc(db, "events", finalId),
                { dateEvent: iso, title, description, image, time, place, address },
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
            setNewError("Nu am putut salva evenimentul nou.");
        }
    };

    const saveOne = async (id) => {
        const key = safeStr(id).trim();
        if (!key) return;

        const base = events.find((e) => e.id === key);
        const draft = draftsById[key];
        if (!base || !draft) return;

        const iso = safeStr(draft?.dateISO).trim();
        const okDate = Boolean(parseISO(iso)) && Boolean(formatDMYFromISO(iso));

        const title = normalizeLangMap(draft?.title);
        const description = normalizeLangMap(draft?.description);

        const image = safeStr(draft?.image).trim();
        const time = safeStr(draft?.time).trim();
        const place = safeStr(draft?.place).trim();
        const address = safeStr(draft?.address).trim();

        if (!okDate) {
            setErrorById((m) => ({ ...m, [key]: "Completează data evenimentului." }));
            return;
        }
        if (!isValidAllLangs(title)) {
            setErrorById((m) => ({ ...m, [key]: "Completează titlul pentru toate cele 4 limbi." }));
            return;
        }
        if (!isValidAllLangs(description)) {
            setErrorById((m) => ({ ...m, [key]: "Completează descrierea pentru toate cele 4 limbi." }));
            return;
        }

        setErrorById((m) => ({ ...m, [key]: "" }));
        setSavingById((m) => ({ ...m, [key]: "saving" }));

        try {
            const desiredBaseId = computeDocIdFromDateISO(iso);

            if (desiredBaseId && desiredBaseId !== key) {
                const ok = window.confirm(
                    `Ai schimbat data evenimentului.\n\nAsta va crea un nou eveniment (${desiredBaseId}) cu aceleași date și îl va păstra pe cel vechi.\n\nContinui?`
                );
                if (!ok) {
                    setSavingById((m) => ({ ...m, [key]: "idle" }));
                    return;
                }
            }

            const targetId = desiredBaseId && desiredBaseId !== key ? await ensureUniqueId(desiredBaseId) : key;

            await setDoc(
                doc(db, "events", targetId),
                { dateEvent: iso, title, description, image, time, place, address },
                { merge: true }
            );

            if (!mountedRef.current) return;

            if (targetId !== key) {
                const baseCur = events.find((e) => e.id === key);
                if (baseCur) {
                    setDraftsById((prev) => ({
                        ...prev,
                        [key]: {
                            dateISO: baseCur.dateISO,
                            title: { ...baseCur.title },
                            description: { ...baseCur.description },
                            image: baseCur.image,
                            time: baseCur.time,
                            place: baseCur.place,
                            address: baseCur.address,
                        },
                    }));
                }
                setSavingById((m) => ({ ...m, [key]: "idle" }));
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
            setSavingById((m) => ({ ...m, [key]: "error" }));
            setErrorById((m) => ({ ...m, [key]: "Nu am putut salva evenimentul." }));
        }
    };

    const deleteOne = async (id) => {
        const key = safeStr(id).trim();
        if (!key) return;

        const ok = window.confirm("Ștergi definitiv acest eveniment?");
        if (!ok) return;

        setGlobalError("");
        setErrorById((m) => ({ ...m, [key]: "" }));
        setSavingById((m) => ({ ...m, [key]: "saving" }));

        try {
            await deleteDoc(doc(db, "events", key));

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
            setSavingById((prev) => {
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
            setSavingById((m) => ({ ...m, [key]: "error" }));
            setErrorById((m) => ({ ...m, [key]: "Nu am putut șterge evenimentul." }));
        }
    };

    return (
        <div className="adminCard">
            <div className="adminTop">
                <h2 className="adminTitle">Evenimente</h2>
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
                        <NewEventCard
                            draft={newDraft}
                            activeLang={newLang}
                            saveState={newState}
                            errorText={newError}
                            idPreview={idPreview}
                            onChangeLang={changeLang}
                            onChangeField={changeField}
                            onChangeLangField={changeLangField}
                            onCancel={cancelNew}
                            onSave={saveNew}
                        />
                    ) : null}

                    <div className="adminList">
                        {upcomingEvents.map((ev) => {
                            const d = draftsById[ev.id] || {
                                dateISO: ev.dateISO,
                                title: { ...ev.title },
                                description: { ...ev.description },
                                image: ev.image,
                                time: ev.time,
                                place: ev.place,
                                address: ev.address,
                            };

                            return (
                                <EventCard
                                    key={ev.id}
                                    ev={ev}
                                    expanded={expandedIds.has(ev.id)}
                                    draft={d}
                                    activeLang={langById[ev.id] || "ro"}
                                    savingState={savingById[ev.id] || "idle"}
                                    errorText={errorById[ev.id] || ""}
                                    onToggleExpand={toggleExpand}
                                    onChangeLang={changeLang}
                                    onChangeField={changeField}
                                    onChangeLangField={changeLangField}
                                    onSave={saveOne}
                                    onDelete={deleteOne}
                                />
                            );
                        })}

                        {!upcomingEvents.length && !showNew ? <div className="adminEmpty">Nu există evenimente viitoare. Apasă „Nou”.</div> : null}
                    </div>

                    <div className="adminHistoryRow">
                        <button type="button" className="adminSmallBtn" onClick={() => setShowHistory((v) => !v)} disabled={!pastEvents.length}>
                            {showHistory ? "Ascunde istoricul" : `Arată istoricul (${pastEvents.length})`}
                        </button>
                    </div>

                    {showHistory ? (
                        <div className="adminList adminList--history">
                            {pastEvents.map((ev) => {
                                const d = draftsById[ev.id] || {
                                    dateISO: ev.dateISO,
                                    title: { ...ev.title },
                                    description: { ...ev.description },
                                    image: ev.image,
                                    time: ev.time,
                                    place: ev.place,
                                    address: ev.address,
                                };

                                return (
                                    <EventCard
                                        key={ev.id}
                                        ev={ev}
                                        expanded={expandedIds.has(ev.id)}
                                        draft={d}
                                        activeLang={langById[ev.id] || "ro"}
                                        savingState={savingById[ev.id] || "idle"}
                                        errorText={errorById[ev.id] || ""}
                                        onToggleExpand={toggleExpand}
                                        onChangeLang={changeLang}
                                        onChangeField={changeField}
                                        onChangeLangField={changeLangField}
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