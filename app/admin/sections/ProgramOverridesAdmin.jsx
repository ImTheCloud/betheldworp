// ProgramOverridesAdmin.jsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collection, deleteDoc, doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../../lib/Firebase";
import { usePagination } from "../hooks/usePagination";
import PaginationControls from "../components/PaginationControls";

const safeObj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});

const AFFECT_OPTIONS = [
    { id: "mon", label: "Monday" },
    { id: "tue", label: "Tuesday" },
    { id: "wed", label: "Wednesday" },
    { id: "thu", label: "Thursday" },
    { id: "fri", label: "Friday" },
    { id: "sat", label: "Saturday" },
    { id: "sun_am", label: "Sunday AM" },
    { id: "sun_pm", label: "Sunday PM" },
];

// Days offset from Monday (ISO week start) for each program slot
const DAY_OFFSET = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun_am: 6, sun_pm: 6 };

function pad2(n) { return String(n).padStart(2, "0"); }

/** Given a weekKey like "2026-W08" and a program slot id, return the ISO date string "YYYY-MM-DD" */
function dateForSlot(weekKey, slotId) {
    const parsed = parseWeekKey(weekKey);
    if (!parsed) return "";
    const monday = startOfISOWeekUTC(parsed.year, parsed.week);
    const offset = DAY_OFFSET[slotId];
    if (offset == null) return "";
    const d = new Date(monday.getTime() + offset * 86400000);
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** Normalize "dd-mm-yyyy" or "dd/mm/yyyy" to "yyyy-mm-dd"; pass through if already ISO */
function normalizeDateStr(v) {
    const s = String(v || "").trim();
    if (!s) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const m = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
    if (m) return `${m[3]}-${pad2(Number(m[2]))}-${pad2(Number(m[1]))}`;
    return s;
}

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

function formatWeekRange(weekKey) {
    const parsed = parseWeekKey(weekKey);
    if (!parsed) return "";
    const start = startOfISOWeekUTC(parsed.year, parsed.week);

    const dd = pad2(start.getUTCDate());
    const mm = start.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
    const yyyy = start.getUTCFullYear();

    return `${dd} ${mm} ${yyyy}`;
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

    const replacements = safeObj(data?.replacements);
    const additions = safeObj(data?.additions);

    const weekStartUTC = parsed ? startOfISOWeekUTC(parsed.year, parsed.week) : null;
    const upcoming = weekStartUTC ? weekStartUTC.getTime() >= currentWeekStartUTC.getTime() : false;

    return {
        id: idRaw,
        weekKey,
        weekStartUTC: weekStartUTC?.getTime?.() ?? 0,
        upcoming,
        affectedProgramIds,
        replacements,
        additions,
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

function IconCancel(props) {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function IconModify(props) {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
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

function OverrideCard({ item, expanded, draft, saveState, errorText, eventsList, weekKeyForCard, onToggleExpand, onToggleAffected, onChangeWeekKey, onChangeReplacement, onChangeAddition, onSave, onDelete }) {
    const id = safeStr(item?.id).trim();
    const affectedSet = useMemo(() => toSet(draft?.affectedProgramIds ?? item?.affectedProgramIds), [draft, item]);
    const weekKeyValue = safeStr(draft?.weekKey ?? item?.weekKey);
    const replacements = safeObj(draft?.replacements ?? item?.replacements);
    const additions = safeObj(draft?.additions ?? item?.additions);
    const additionsCount = Object.values(additions).filter(Boolean).length;

    const onCardClick = (e) => {
        if (e.target.closest("input, textarea, select, label")) return;
        onToggleExpand(id);
    };

    return (
        <div className={`adminAnnCard${item?.upcoming ? " is-active" : ""}`}>
            <div className="adminAnnHeader" onClick={onCardClick} style={{ cursor: "pointer" }}>
                <div className="adminAnnIdChip" title={weekKeyValue || id || ""}>
                    {shortId(weekKeyValue || id)}
                </div>

                <div style={{ flex: 1 }} />

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

            {expanded ? (
                <>
                    {errorText ? <div className="adminAlert">{errorText}</div> : null}

                    <label className="adminLabel">
                        Week
                        <div className="adminInputWrapper adminInputWrapper--week">
                            <input
                                className="adminInput adminInput--weekNative"
                                type="week"
                                value={weekKeyValue}
                                onChange={(e) => onChangeWeekKey(id, e.target.value)}
                            />
                            <div className="adminInput--weekCustom">
                                <span className="overrideDateRange">
                                    {formatWeekRange(weekKeyValue)}
                                </span>
                            </div>
                        </div>
                    </label>

                    {/* ── Section: Cancellations ── */}
                    <div className="overrideSection overrideSection--cancel">
                        <div className="overrideSectionHeader">
                            <span className="overrideSectionIcon overrideSectionIcon--cancel">
                                <IconCancel />
                            </span>
                            <span className="overrideSectionTitle">Cancellations</span>
                        </div>
                        <div className="adminAffectGrid" aria-label="Cancelled slots">
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
                    </div>

                    {/* ── Section: Modifications ── */}
                    {AFFECT_OPTIONS.filter((opt) => affectedSet.has(opt.id)).length > 0 && (
                        <div className="overrideSection overrideSection--modify">
                            <div className="overrideSectionHeader">
                                <span className="overrideSectionIcon overrideSectionIcon--modify">
                                    <IconModify />
                                </span>
                                <span className="overrideSectionTitle">Modifications</span>
                            </div>
                            {/* Replacement dropdowns for each affected day */}
                            <div className="overrideSelectGrid">
                                {AFFECT_OPTIONS.filter((opt) => affectedSet.has(opt.id)).map((opt) => {
                                    const slotDate = dateForSlot(weekKeyValue, opt.id);
                                    const filtered = safeArr(eventsList).filter((ev) => !slotDate || ev.dateISO === slotDate);
                                    return (
                                        <label className="overrideSelectCol" key={`${id}-repl-${opt.id}`}>
                                            <span className="overrideSlotDay">{opt.label}</span>
                                            <select
                                                className="adminSelect"
                                                value={safeStr(replacements[opt.id])}
                                                onChange={(e) => {
                                                    e.stopPropagation();
                                                    onChangeReplacement(id, opt.id, e.target.value);
                                                }}
                                            >
                                                <option value="">Cancelled</option>
                                                {filtered.map((ev) => (
                                                    <option key={ev.id} value={ev.id}>{ev.label}</option>
                                                ))}
                                            </select>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ── Section: Extra Event ── */}
                    <div className="overrideSection overrideSection--extra">
                        <div className="overrideSectionHeader">
                            <span className="overrideSectionIcon overrideSectionIcon--extra">
                                <IconPlus width="14" height="14" strokeWidth="3" />
                            </span>
                            <span className="overrideSectionTitle">Extra Event</span>
                        </div>
                        <div className="overrideSelectGrid">
                            {AFFECT_OPTIONS.map((opt) => {
                                const slotDate = dateForSlot(weekKeyValue, opt.id);
                                const filtered = safeArr(eventsList).filter((ev) => !slotDate || ev.dateISO === slotDate);
                                const hasAddition = !!safeStr(additions[opt.id]).trim();
                                if (!hasAddition && !filtered.length) return null;
                                return (
                                    <label className="overrideSelectCol" key={`${id}-add-${opt.id}`}>
                                        <span className="overrideSlotDay">{opt.label}</span>
                                        <select
                                            className="adminSelect"
                                            value={safeStr(additions[opt.id])}
                                            onChange={(e) => {
                                                e.stopPropagation();
                                                onChangeAddition(id, opt.id, e.target.value);
                                            }}
                                        >
                                            <option value="">No extra</option>
                                            {filtered.map((ev) => (
                                                <option key={ev.id} value={ev.id}>{ev.label}</option>
                                            ))}
                                        </select>
                                    </label>
                                );
                            })}
                        </div>
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
                            Delete
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
                            {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : "Save"}
                        </button>
                    </div>
                </>
            ) : null}
        </div>
    );
}

function NewOverrideCard({ draft, saveState, errorText, eventsList, weekKeyForCard, onToggleAffected, onChangeWeekKey, onChangeReplacement, onChangeAddition, onCancel, onSave }) {
    const affectedSet = useMemo(() => toSet(draft?.affectedProgramIds), [draft]);
    const weekKeyValue = safeStr(draft?.weekKey);
    const replacements = safeObj(draft?.replacements);
    const additions = safeObj(draft?.additions);

    return (
        <div className="adminAnnCard is-active">
            <div className="adminAnnHeader">
                <div className="adminAnnIdChip" style={{ background: "#0a2a43", color: "#fff" }}>NEW OVERRIDE</div>
                <div style={{ flex: 1 }} />
            </div>

            {errorText ? <div className="adminAlert">{errorText}</div> : null}

            <label className="adminLabel">
                Week
                <div className="adminInputWrapper adminInputWrapper--week">
                    <input
                        className="adminInput adminInput--weekNative"
                        type="week"
                        value={weekKeyValue}
                        onChange={(e) => onChangeWeekKey("__new__", e.target.value)}
                    />
                    <div className="adminInput--weekCustom">
                        <span className="overrideDateRange">
                            {formatWeekRange(weekKeyValue)}
                        </span>
                    </div>
                </div>
            </label>

            {/* ── Section: Cancellations ── */}
            <div className="overrideSection overrideSection--cancel">
                <div className="overrideSectionHeader">
                    <span className="overrideSectionIcon overrideSectionIcon--cancel">
                        <IconCancel />
                    </span>
                    <span className="overrideSectionTitle">Cancellations</span>
                </div>
                <div className="adminAffectGrid" aria-label="Cancelled slots">
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
            </div>

            {/* ── Section: Modifications ── */}
            {AFFECT_OPTIONS.filter((opt) => affectedSet.has(opt.id)).length > 0 && (
                <div className="overrideSection overrideSection--modify">
                    <div className="overrideSectionHeader">
                        <span className="overrideSectionIcon overrideSectionIcon--modify">
                            <IconModify />
                        </span>
                        <span className="overrideSectionTitle">Modifications</span>
                    </div>
                    <div className="overrideSelectGrid">
                        {AFFECT_OPTIONS.filter((opt) => affectedSet.has(opt.id)).map((opt) => {
                            const slotDate = dateForSlot(weekKeyValue, opt.id);
                            const filtered = safeArr(eventsList).filter((ev) => !slotDate || ev.dateISO === slotDate);
                            return (
                                <label className="overrideSelectCol" key={`new-repl-${opt.id}`}>
                                    <span className="overrideSlotDay">{opt.label}</span>
                                    <select
                                        className="adminSelect"
                                        value={safeStr(replacements[opt.id])}
                                        onChange={(e) => {
                                            e.stopPropagation();
                                            onChangeReplacement("__new__", opt.id, e.target.value);
                                        }}
                                    >
                                        <option value="">Cancelled</option>
                                        {filtered.map((ev) => (
                                            <option key={ev.id} value={ev.id}>{ev.label}</option>
                                        ))}
                                    </select>
                                </label>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Section: Extra Event ── */}
            <div className="overrideSection overrideSection--extra">
                <div className="overrideSectionHeader">
                    <span className="overrideSectionIcon overrideSectionIcon--extra">
                        <IconPlus width="14" height="14" strokeWidth="3" />
                    </span>
                    <span className="overrideSectionTitle">Extra Event</span>
                </div>
                <div className="overrideSelectGrid">
                    {AFFECT_OPTIONS.map((opt) => {
                        const slotDate = dateForSlot(weekKeyValue, opt.id);
                        const filtered = safeArr(eventsList).filter((ev) => !slotDate || ev.dateISO === slotDate);
                        const hasAddition = !!safeStr(additions[opt.id]).trim();
                        if (!hasAddition && !filtered.length) return null;
                        return (
                            <label className="overrideSelectCol" key={`new-add-${opt.id}`}>
                                <span className="overrideSlotDay">{opt.label}</span>
                                <select
                                    className="adminSelect"
                                    value={safeStr(additions[opt.id])}
                                    onChange={(e) => {
                                        e.stopPropagation();
                                        onChangeAddition("__new__", opt.id, e.target.value);
                                    }}
                                >
                                    <option value="">No extra</option>
                                    {filtered.map((ev) => (
                                        <option key={ev.id} value={ev.id}>{ev.label}</option>
                                    ))}
                                </select>
                            </label>
                        );
                    })}
                </div>
            </div>

            <div className="adminMsgActions">
                <button type="button" className="adminDeleteBtn" onClick={onCancel} disabled={saveState === "saving"}>
                    Cancel
                </button>

                <button type="button" className="adminMsgSaveBtn" onClick={onSave} disabled={saveState === "saving" || !!errorText}>
                    {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : "Save"}
                </button>
            </div>
        </div>
    );
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
        replacements: {},
        additions: {},
    }));
    const [newError, setNewError] = useState("");
    const [newState, setNewState] = useState("idle");

    // ── Events list for the dropdown ──
    const [eventsList, setEventsList] = useState([]);

    useEffect(() => {
        const unsub = onSnapshot(
            collection(db, "events"),
            (snap) => {
                if (!mountedRef.current) return;
                const list = snap.docs.map((d) => {
                    const data = d.data() || {};
                    const title = pickByLang(data.title);
                    const dateRaw = safeStr(data.dateEvent).trim();
                    const time = safeStr(data.time).trim();
                    // Normalize dateEvent to ISO for filtering
                    const dateISO = normalizeDateStr(dateRaw);
                    return {
                        id: d.id,
                        dateISO,
                        label: `${title}${dateRaw ? " (" + dateRaw + ")" : ""}${time ? " — " + time : ""}`,
                    };
                });
                list.sort((a, b) => a.label.localeCompare(b.label));
                setEventsList(list);
            },
            (err) => console.error("events fetch for overrides:", err)
        );
        return () => unsub();
    }, []);

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
                            replacements: safeObj(it.replacements),
                            additions: safeObj(it.additions),
                        };

                        if (!next[id]) {
                            next[id] = base;
                            return;
                        }

                        const cur = next[id];
                        const dirtyWeek = safeStr(cur.weekKey).trim().toUpperCase() !== safeStr(base.weekKey).trim().toUpperCase();
                        const dirtyAffect = !sameArrayAsSet(cur.affectedProgramIds, toSet(base.affectedProgramIds));
                        const dirtyRepl = JSON.stringify(safeObj(cur.replacements)) !== JSON.stringify(safeObj(base.replacements));
                        const dirtyAdd = JSON.stringify(safeObj(cur.additions)) !== JSON.stringify(safeObj(base.additions));

                        if (!dirtyWeek && !dirtyAffect && !dirtyRepl && !dirtyAdd) next[id] = base;
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
                setGlobalError("Could not load program overrides.");
            }
        );

        return () => unsub();
    }, [currentWeekStartUTC]);

    const upcomingItems = useMemo(() => items.filter((x) => x.upcoming), [items]);
    const historyItems = useMemo(() => items.filter((x) => !x.upcoming), [items]);

    const upcomingPagination = usePagination(upcomingItems, 10);
    const historyPagination = usePagination(historyItems, 10);

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
            const val = weekKey || safeStr(wk).trim();
            setNewDraft((d) => ({ ...d, weekKey: val }));

            // Immediate validation
            const alreadyExists = items.some((it) => it.weekKey === val);
            if (alreadyExists) {
                setNewError("An override already exists for this week.");
            } else if (!isValidWeekKey(val)) {
                setNewError("Invalid week (YYYY-Www).");
            } else {
                setNewError("");
            }

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
                // Also clean up replacements if unchecking
                const repl = { ...safeObj(d.replacements) };
                if (!set.has(p)) delete repl[p];
                return { ...d, affectedProgramIds: Array.from(set), replacements: repl };
            });
            if (newError) setNewError("");
            if (globalError) setGlobalError("");
            return;
        }

        if (!key) return;
        setDraftsById((prev) => {
            const cur = prev[key] || { weekKey: "", affectedProgramIds: [], replacements: {}, additions: {} };
            const set = toSet(cur.affectedProgramIds);
            set.has(p) ? set.delete(p) : set.add(p);
            const repl = { ...safeObj(cur.replacements) };
            if (!set.has(p)) delete repl[p];
            return { ...prev, [key]: { ...cur, affectedProgramIds: Array.from(set), replacements: repl } };
        });
        setErrorById((m) => ({ ...m, [key]: "" }));
        if (globalError) setGlobalError("");
    };

    const changeReplacement = (id, programId, eventId) => {
        const key = safeStr(id).trim();
        const p = safeStr(programId).trim();
        if (!p) return;

        if (key === "__new__") {
            setNewDraft((d) => {
                const repl = { ...safeObj(d.replacements) };
                if (eventId) repl[p] = eventId;
                else delete repl[p];
                return { ...d, replacements: repl };
            });
            if (newError) setNewError("");
            return;
        }

        if (!key) return;
        setDraftsById((prev) => {
            const cur = prev[key] || { weekKey: "", affectedProgramIds: [], replacements: {} };
            const repl = { ...safeObj(cur.replacements) };
            if (eventId) repl[p] = eventId;
            else delete repl[p];
            return { ...prev, [key]: { ...cur, replacements: repl } };
        });
        setErrorById((m) => ({ ...m, [key]: "" }));
    };

    const changeAddition = (id, programId, eventId) => {
        const key = safeStr(id).trim();
        const p = safeStr(programId).trim();
        if (!p) return;

        if (key === "__new__") {
            setNewDraft((d) => {
                const add = { ...safeObj(d.additions) };
                if (eventId) add[p] = eventId;
                else delete add[p];
                return { ...d, additions: add };
            });
            if (newError) setNewError("");
            return;
        }

        if (!key) return;
        setDraftsById((prev) => {
            const cur = prev[key] || { weekKey: "", affectedProgramIds: [], replacements: {}, additions: {} };
            const add = { ...safeObj(cur.additions) };
            if (eventId) add[p] = eventId;
            else delete add[p];
            return { ...prev, [key]: { ...cur, additions: add } };
        });
        setErrorById((m) => ({ ...m, [key]: "" }));
    };


    const startNew = () => {
        setShowNew(true);
        setNewDraft({
            weekKey: getCurrentWeekKeyUTC(),
            affectedProgramIds: [],
            replacements: {},
            additions: {},
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
        const weekKey = safeStr(newDraft?.weekKey).trim().toUpperCase();
        if (!isValidWeekKey(weekKey)) {
            setNewError("Invalid week (YYYY-Www).");
            return;
        }

        const alreadyExists = items.some((it) => it.weekKey === weekKey);
        if (alreadyExists) {
            setNewError("An override already exists for this week.");
            return;
        }

        setNewError("");
        setNewState("saving");

        try {
            const id = weekKey;
            const data = {
                weekKey,
                affectedProgramIds: safeArr(newDraft.affectedProgramIds),
                replacements: safeObj(newDraft.replacements),
                additions: safeObj(newDraft.additions),
            };

            await setDoc(doc(db, "program_overrides", id), data, { merge: true });

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
            setNewError("Could not save new override.");
        }
    };

    const onSave = async (id) => {
        const key = safeStr(id).trim();
        if (!key) return;

        const draft = draftsById[key];
        if (!draft) return; // nothing to save

        const weekKey = safeStr(draft.weekKey).trim().toUpperCase();
        if (!isValidWeekKey(weekKey)) {
            setErrorById((m) => ({ ...m, [key]: "Invalid week (YYYY-Www)." }));
            return;
        }

        setErrorById((m) => ({ ...m, [key]: "" }));
        setSaveStateById((m) => ({ ...m, [key]: "saving" }));

        try {
            const data = {
                weekKey,
                affectedProgramIds: safeArr(draft.affectedProgramIds),
                replacements: safeObj(draft.replacements),
                additions: safeObj(draft.additions),
            };

            // If ID changed (weekKey match), we might need to handle rename, but here ID is document ID, typically YYYY-Www
            // If the document ID is different from weekKey, we might want to migrate, but for now we just update the doc with new fields.
            await setDoc(doc(db, "program_overrides", key), data, { merge: true });

            if (!mountedRef.current) return;
            setTransientState(key, "saved");
        } catch (err) {
            console.error(err);
            if (!mountedRef.current) return;
            setSaveStateById((m) => ({ ...m, [key]: "error" }));
            setErrorById((m) => ({ ...m, [key]: "Could not save override." }));
        }
    };

    const onDelete = async (id) => {
        const key = safeStr(id).trim();
        if (!key) return;

        const ok = window.confirm(`Delete program override for ${key}?`);
        if (!ok) return;

        setGlobalError("");
        setErrorById((m) => ({ ...m, [key]: "" }));
        setSaveStateById((m) => ({ ...m, [key]: "saving" }));

        try {
            await deleteDoc(doc(db, "program_overrides", key));

            if (!mountedRef.current) return;
            // State cleanup happens via snapshot listener
        } catch (err) {
            console.error(err);
            if (!mountedRef.current) return;
            setSaveStateById((m) => ({ ...m, [key]: "error" }));
            setErrorById((m) => ({ ...m, [key]: "Could not delete override." }));
        }
    };

    return (
        <div className="adminFullPage">
            <div className="adminFullTop">
                <h2 className="adminTitle">
                    Program Overrides{' '}
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


                    <div className="adminFullList">
                        {showNew ? (
                            <div style={{ padding: "0 4px" }}>
                                <NewOverrideCard
                                    draft={newDraft}
                                    saveState={newState}
                                    errorText={newError}
                                    eventsList={eventsList}
                                    weekKeyForCard={newDraft.weekKey}
                                    onToggleAffected={toggleAffected}
                                    onChangeWeekKey={changeWeekKey}
                                    onChangeReplacement={changeReplacement}
                                    onChangeAddition={changeAddition}
                                    onCancel={cancelNew}
                                    onSave={saveNew}
                                />
                            </div>
                        ) : null}

                        {!showHistory ? (
                            <>
                                {upcomingPagination.paginatedItems.map((it) => (
                                    <OverrideCard
                                        key={it.id}
                                        item={it}
                                        expanded={expandedIds.has(it.id)}
                                        draft={draftsById[it.id]}
                                        saveState={saveStateById[it.id] || "idle"}
                                        errorText={errorById[it.id] || ""}
                                        eventsList={eventsList}
                                        weekKeyForCard={safeStr(draftsById[it.id]?.weekKey ?? it.weekKey)}
                                        onToggleExpand={toggleExpand}
                                        onToggleAffected={toggleAffected}
                                        onChangeWeekKey={changeWeekKey}
                                        onChangeReplacement={changeReplacement}
                                        onChangeAddition={changeAddition}
                                        onSave={onSave}
                                        onDelete={onDelete}
                                    />
                                ))}
                            </>
                        ) : (
                            <>
                                {historyPagination.paginatedItems.map((it) => (
                                    <OverrideCard
                                        key={it.id}
                                        item={it}
                                        expanded={expandedIds.has(it.id)}
                                        draft={draftsById[it.id]}
                                        saveState={saveStateById[it.id] || "idle"}
                                        errorText={errorById[it.id] || ""}
                                        eventsList={eventsList}
                                        weekKeyForCard={safeStr(draftsById[it.id]?.weekKey ?? it.weekKey)}
                                        onToggleExpand={toggleExpand}
                                        onToggleAffected={toggleAffected}
                                        onChangeWeekKey={changeWeekKey}
                                        onChangeReplacement={changeReplacement}
                                        onChangeAddition={changeAddition}
                                        onSave={onSave}
                                        onDelete={onDelete}
                                    />
                                ))}
                            </>
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
            )}
        </div>
    );
}