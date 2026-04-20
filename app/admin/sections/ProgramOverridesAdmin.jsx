// ProgramOverridesAdmin.jsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collection, deleteDoc, doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../../lib/Firebase";
import { usePagination } from "../hooks/usePagination";
import PaginationControls from "../components/PaginationControls";
import ConfirmModal from "../components/ConfirmModal";
import { toggleExpandWithConfirm } from "../utils/adminUI";

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
    const end = new Date(start.getTime() + 6 * 86400000);

    const d1 = pad2(start.getUTCDate());
    const m1 = start.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
    
    const d2 = pad2(end.getUTCDate());
    const m2 = end.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
    const y2 = end.getUTCFullYear();

    // If same month: "20 - 26 Apr 2026"
    // If different months: "30 Mar - 05 Apr 2026"
    if (m1 === m2) {
        return `${d1} - ${d2} ${m2} ${y2}`;
    }
    return `${d1} ${m1} - ${d2} ${m2} ${y2}`;
}

function labelForAffected(id) {
    return AFFECT_OPTIONS.find((x) => x.id === id)?.label || id;
}

function overrideEqual(a, b) {
    const dirtyWeek = safeStr(a.weekKey).trim().toUpperCase() !== safeStr(b.weekKey).trim().toUpperCase();
    const dirtyAffect = !sameArrayAsSet(a.affectedProgramIds, toSet(b.affectedProgramIds));
    const dirtyRepl = JSON.stringify(safeObj(a.replacements)) !== JSON.stringify(safeObj(b.replacements));
    const dirtyAdd = JSON.stringify(safeObj(a.additions)) !== JSON.stringify(safeObj(b.additions));
    return !dirtyWeek && !dirtyAffect && !dirtyRepl && !dirtyAdd;
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

function IconSave(props) {
    return (
        <svg fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" {...props}>
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
        </svg>
    );
}

function IconCalendar(props) {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function ProgramSlotGrid({ id, weekKey, replacements, additions, affectedSet, eventsList, onChangeReplacement, onChangeAddition }) {
    return (
        <div className="overrideGrid">
            {AFFECT_OPTIONS.map((opt) => {
                const isOverridden = affectedSet.has(opt.id);
                const hasAddition = !!safeStr(additions[opt.id]).trim();
                const currentValue = !isOverridden ? "__normal__" : (replacements[opt.id] || "");

                const slotDate = dateForSlot(weekKey, opt.id);
                const filtered = safeArr(eventsList).filter((ev) => !slotDate || ev.dateISO === slotDate);

                return (
                    <div key={`${id}-${opt.id}`} className={`overrideSlotCard${isOverridden ? (replacements[opt.id] ? " is-overridden" : " is-cancelled") : ""}${hasAddition ? " has-addition" : ""}`}>
                        <div className="overrideSlotLabel">
                            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <IconCalendar width="14" height="14" opacity="0.6" />
                                {opt.label}
                            </span>
                            <div className="overrideSlotBadgeGroup">
                                {isOverridden && !replacements[opt.id] && (
                                    <span className="adminChip" style={{ background: "#fee2e2", color: "#ef4444" }}>Cancelled</span>
                                )}
                                {replacements[opt.id] && (
                                    <span className="adminChip" style={{ background: "#fef9c3", color: "#854d0e" }}>Modified</span>
                                )}
                                {hasAddition && (
                                    <span className="adminChip" style={{ background: "#fef9c3", color: "#854d0e" }}>+Extra</span>
                                )}
                            </div>
                        </div>

                        <div className="overrideSlotFields">
                            <label className="overrideSlotField">
                                <span className="overrideSlotFieldLabel">
                                    <IconModify width="10" height="10" />
                                    Main Program
                                </span>
                                <select
                                    className="adminSelect"
                                    value={currentValue}
                                    onChange={(e) => onChangeReplacement(id, opt.id, e.target.value)}
                                >
                                    <option value="__normal__">Default Schedule</option>
                                    <option value="">Cancelled</option>
                                    {filtered.length > 0 && (
                                        <optgroup label="Replacement Events">
                                            {filtered.map((ev) => {
                                                const label = safeStr(ev.label).split("(")[0].trim();
                                                const timeStr = safeStr(ev.time).trim();
                                                return (
                                                    <option key={ev.id} value={ev.id}>
                                                        {label}{timeStr ? ` (${timeStr})` : ""}
                                                    </option>
                                                );
                                            })}
                                        </optgroup>
                                    )}
                                </select>
                            </label>
        
                            <label className="overrideSlotField">
                                <span className="overrideSlotFieldLabel">
                                    <IconPlus width="10" height="10" />
                                    Extra Event
                                </span>
                                <select
                                    className="adminSelect"
                                    value={safeStr(additions[opt.id])}
                                    onChange={(e) => onChangeAddition(id, opt.id, e.target.value)}
                                    disabled={filtered.length === 0}
                                >
                                    <option value="">{filtered.length === 0 ? "No events available" : "None"}</option>
                                    {filtered.map((ev) => {
                                        const label = safeStr(ev.label).split("(")[0].trim();
                                        const timeStr = safeStr(ev.time).trim();
                                        return (
                                            <option key={ev.id} value={ev.id}>
                                                {label}{timeStr ? ` (${timeStr})` : ""}
                                            </option>
                                        );
                                    })}
                                </select>
                            </label>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function OverrideCard({ item, expanded, draft, saveState, eventsList, weekKeyForCard, onToggleExpand, onToggleAffected, onChangeWeekKey, onChangeReplacement, onChangeAddition, onSave, onDelete }) {
    const id = safeStr(item?.id).trim();
    const affectedSet = useMemo(() => toSet(draft?.affectedProgramIds ?? item?.affectedProgramIds), [draft, item]);
    const weekKeyValue = safeStr(draft?.weekKey ?? item?.weekKey);
    const replacements = safeObj(draft?.replacements ?? item?.replacements);
    const additions = safeObj(draft?.additions ?? item?.additions);
    const additionsCount = Object.values(additions).filter(Boolean).length;

    return (
        <div className={`adminAnnCard${item?.upcoming ? " is-active" : ""}`}>
            <div className="adminAnnHeader" style={{ cursor: "pointer", justifyContent: "space-between" }} onClick={() => onToggleExpand(id)}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div className="adminAnnIdChip" title={weekKeyValue || id || ""}>
                        {shortId(weekKeyValue || id)}
                    </div>
                    {weekKeyValue && (
                        <span className="adminMuted" style={{ fontSize: "0.8rem", marginLeft: 8 }}>
                            • {formatWeekRange(weekKeyValue)}
                        </span>
                    )}
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
                    <div className="overrideWeekRow">
                        <div className="adminInputWrapper">
                            <div className="adminInputDisplay">
                                <IconCalendar width="16" height="16" />
                                <span>{weekKeyValue ? formatWeekRange(weekKeyValue) : "Select dates..."}</span>
                            </div>
                            <input
                                className="adminInputHidden"
                                type="week"
                                value={weekKeyValue}
                                onChange={(e) => onChangeWeekKey(id, e.target.value)}
                            />
                        </div>
                    </div>

                    <ProgramSlotGrid
                        id={id}
                        weekKey={weekKeyValue}
                        replacements={replacements}
                        additions={additions}
                        affectedSet={affectedSet}
                        eventsList={eventsList}
                        onChangeReplacement={onChangeReplacement}
                        onChangeAddition={onChangeAddition}
                    />

                    <div className="overrideActionsWrapper">
                        <div className="overrideActionsGrid">
                            <button
                                type="button"
                                className="adminDeleteBtn"
                                onClick={() => onDelete(id)}
                                disabled={saveState === "saving"}
                            >
                                <IconTrash />
                                Delete
                            </button>
                            <button
                                type="button"
                                className="adminMsgSaveBtn"
                                onClick={() => onSave(id)}
                                disabled={saveState === "saving" || overrideEqual(draft || item, item)}
                            >
                                <IconSave />
                                {saveState === "saving" ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

function NewOverrideCard({ draft, saveState, eventsList, weekKeyForCard, onToggleAffected, onChangeWeekKey, onChangeReplacement, onChangeAddition, onCancel, onSave }) {
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

            <div className="adminAnnBody">
                <div className="overrideWeekRow">
                    <div className="adminInputWrapper">
                        <div className="adminInputDisplay">
                            <IconCalendar width="16" height="16" />
                            <span>{weekKeyValue ? formatWeekRange(weekKeyValue) : "Select dates..."}</span>
                        </div>
                        <input
                            className="adminInputHidden"
                            type="week"
                            value={weekKeyValue}
                            onChange={(e) => onChangeWeekKey("__new__", e.target.value)}
                        />
                    </div>
                </div>

                <ProgramSlotGrid
                    id="__new__"
                    weekKey={weekKeyValue}
                    replacements={replacements}
                    additions={additions}
                    affectedSet={affectedSet}
                    eventsList={eventsList}
                    onChangeReplacement={onChangeReplacement}
                    onChangeAddition={onChangeAddition}
                />

                <div className="overrideActionsWrapper">
                    <div className="overrideActionsGrid">
                        <button type="button" className="adminDeleteBtn" onClick={onCancel} disabled={saveState === "saving"}>
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="adminMsgSaveBtn"
                            onClick={onSave}
                            disabled={saveState === "saving"}
                        >
                            <IconPlus />
                            {saveState === "saving" ? "Saving..." : "Create Override"}
                        </button>
                    </div>
                </div>
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

/** Maps a YYYY-MM-DD date string to the affected AFFECT_OPTIONS slot IDs */
function dateToSlotIds(dateStr) {
    if (!dateStr) return [];
    const d = new Date(`${dateStr}T12:00:00Z`);
    if (isNaN(d)) return [];
    const day = d.getUTCDay(); // 0=Sun, 1=Mon ... 6=Sat
    const map = { 0: ["sun_am", "sun_pm"], 1: ["mon"], 2: ["tue"], 3: ["wed"], 4: ["thu"], 5: ["fri"], 6: ["sat"] };
    return map[day] ?? [];
}

export default function ProgramOverridesAdmin({ initialOverride, onConsumed, onDirtyChange }) {
    const mountedRef = useRef(true);
    const timeoutRef = useRef(null);

    const [loading, setLoading] = useState(true);

    const [items, setItems] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [expandedIds, setExpandedIds] = useState(() => new Set());

    const [draftsById, setDraftsById] = useState({});
    const [saveStateById, setSaveStateById] = useState({});

    const [showNew, setShowNew] = useState(false);
    const [newDraft, setNewDraft] = useState(() => ({
        weekKey: getCurrentWeekKeyUTC(),
        affectedProgramIds: [],
        replacements: {},
        additions: {},
    }));
    const [newState, setNewState] = useState("idle");

    const [modal, setModal] = useState({ isOpen: false, title: "", message: "", onConfirm: () => { } });

    const openInfoModal = useCallback((title, message) => {
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
    }, []);

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

    // Report aggregate dirty state to parent
    useEffect(() => {
        if (!onDirtyChange) return;

        const anyExpandedDirty = Array.from(expandedIds).some(id => {
            const item = items.find(it => it.id === id);
            const draft = draftsById[id];
            return item && draft && !overrideEqual(draft, item);
        });

        // "New" form is dirty if it's open (it always has pre-filled weekKey)
        onDirtyChange(showNew || anyExpandedDirty);
    }, [showNew, expandedIds, draftsById, items, onDirtyChange]);

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

    // ── Consume the pre-filled override context from EventsAdmin shortcut ──
    useEffect(() => {
        // Wait until data is loaded so items is populated for the "already exists" check
        if (!initialOverride || loading) return;
        const { weekKey, eventId, dateStr } = initialOverride;
        const normalized = safeStr(weekKey).trim().toUpperCase();
        if (!normalized) return;

        // Compute affected day slots from the event date (same logic for both branches)
        const affectedSlots = dateToSlotIds(dateStr);

        const existing = items.find((it) => it.weekKey === normalized);
        if (existing) {
            // Expand the card and switch to the right history view
            setExpandedIds((prev) => new Set([...prev, existing.id]));
            setShowHistory(!existing.upcoming);

            // Merge the event into the existing override draft
            if (eventId && affectedSlots.length > 0) {
                setDraftsById((prev) => {
                    const base = prev[existing.id] || {
                        weekKey: existing.weekKey,
                        affectedProgramIds: safeArr(existing.affectedProgramIds),
                        replacements: safeObj(existing.replacements),
                        additions: safeObj(existing.additions),
                    };
                    // Merge the new affected slots into the existing ones
                    const mergedAffected = [...new Set([...safeArr(base.affectedProgramIds), ...affectedSlots])];
                    // Set the event as the replacement for each affected slot
                    const mergedReplacements = { ...safeObj(base.replacements) };
                    affectedSlots.forEach((slot) => { mergedReplacements[slot] = eventId; });
                    return {
                        ...prev,
                        [existing.id]: {
                            ...base,
                            affectedProgramIds: mergedAffected,
                            replacements: mergedReplacements,
                        },
                    };
                });
            }
        } else {
            // Build replacements object: map each affected slot to the event ID
            const replacements = {};
            affectedSlots.forEach((slot) => {
                if (eventId) replacements[slot] = eventId;
            });
            // Pre-fill the new override draft with everything
            setNewDraft({
                weekKey: normalized,
                affectedProgramIds: affectedSlots,
                replacements,
                additions: {},
            });
            setShowNew(true);
        }
        if (onConsumed) onConsumed();
        // Re-run when loading resolves, since items won't exist until then
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialOverride, loading]);


    useEffect(() => {
        setLoading(true);

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
                openInfoModal("Loading Error", "Could not load program overrides.");
            }
        );

        return () => unsub();
    }, [currentWeekStartUTC]);

    const upcomingItems = useMemo(() => items.filter((x) => x.upcoming), [items]);
    const historyItems = useMemo(() => items.filter((x) => !x.upcoming), [items]);

    const upcomingPagination = usePagination(upcomingItems, 10);
    const historyPagination = usePagination(historyItems, 10);

    const toggleExpand = useCallback((id) => {
        toggleExpandWithConfirm({
            id,
            items,
            draftsById,
            isDirtyFn: (item, draft) => !overrideEqual(item, draft),
            setModal,
            setExpandedIds,
            setDraftsById
        });
    }, [items, draftsById]);

    const changeWeekKey = (id, wk) => {
        const key = safeStr(id).trim();
        const weekKey = normalizeWeekKey(wk);

        if (key === "__new__") {
            const val = (weekKey || safeStr(wk).trim()).toUpperCase();
            
            // Smart Redirect: Check if this week already exists
            const existing = items.find(it => it.weekKey === val);
            if (existing) {
                setShowNew(false);
                setExpandedIds(new Set([existing.id]));
                return;
            }

            setNewDraft((d) => ({ ...d, weekKey: val }));
            return;
        }

        if (!key) return;
        setDraftsById((prev) => ({
            ...prev,
            [key]: { ...(prev[key] || { weekKey: "", affectedProgramIds: [] }), weekKey: weekKey || safeStr(wk).trim() },
        }));
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
    };

    const changeReplacement = (id, programId, eventId) => {
        const key = safeStr(id).trim();
        const p = safeStr(programId).trim();
        if (!p) return;

        if (key === "__new__") {
            setNewDraft((d) => {
                const affectedSet = toSet(d.affectedProgramIds);
                const repl = { ...safeObj(d.replacements) };

                if (eventId === "__normal__") {
                    affectedSet.delete(p);
                    delete repl[p];
                } else {
                    affectedSet.add(p);
                    if (eventId) repl[p] = eventId;
                    else delete repl[p];
                }

                return { ...d, affectedProgramIds: Array.from(affectedSet), replacements: repl };
            });
            return;
        }

        if (!key) return;
        setDraftsById((prev) => {
            const cur = prev[key] || { weekKey: "", affectedProgramIds: [], replacements: {}, additions: {} };
            const affectedSet = toSet(cur.affectedProgramIds);
            const repl = { ...safeObj(cur.replacements) };

            if (eventId === "__normal__") {
                affectedSet.delete(p);
                delete repl[p];
            } else {
                affectedSet.add(p);
                if (eventId) repl[p] = eventId;
                else delete repl[p];
            }

            return { ...prev, [key]: { ...cur, affectedProgramIds: Array.from(affectedSet), replacements: repl } };
        });
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
    };


    const startNew = () => {
        const defaultWeek = getCurrentWeekKeyUTC();
        
        // Smart Redirect: If current week already exists, just open it
        const existing = items.find(it => it.weekKey === defaultWeek);
        if (existing) {
            setExpandedIds(new Set([existing.id]));
            return;
        }

        setShowNew(true);
        setNewDraft({
            weekKey: defaultWeek,
            affectedProgramIds: [],
            replacements: {},
            additions: {},
        });
        setNewState("idle");
    };

    const cancelNew = () => {
        setShowNew(false);
        setNewState("idle");
    };

    const saveNew = async () => {
        const weekKey = safeStr(newDraft?.weekKey).trim().toUpperCase();
        if (!isValidWeekKey(weekKey)) {
            openInfoModal("Action Required", "Invalid week format (YYYY-Www).");
            return;
        }

        const alreadyExists = items.some((it) => it.weekKey === weekKey);
        if (alreadyExists) {
            openInfoModal("Duplicate Override", "An override already exists for this week.");
            return;
        }

        setNewState("saving");

        try {
            const id = weekKey;
            const data = {
                weekKey,
                affectedProgramIds: safeArr(newDraft.affectedProgramIds),
                replacements: safeObj(newDraft.replacements),
                additions: safeObj(newDraft.additions),
            };

            await setDoc(doc(db, "program_overrides", id), data);

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
            openInfoModal("Save Error", "Could not save new override.");
        }
    };

    const onSave = async (id) => {
        const key = safeStr(id).trim();
        if (!key) return;

        const draft = draftsById[key];
        if (!draft) return; // nothing to save

        const weekKey = safeStr(draft.weekKey).trim().toUpperCase();
        if (!isValidWeekKey(weekKey)) {
            openInfoModal("Action Required", "Invalid week (YYYY-Www).");
            return;
        }

        setSaveStateById((m) => ({ ...m, [key]: "saving" }));

        try {
            const data = {
                weekKey,
                affectedProgramIds: safeArr(draft.affectedProgramIds),
                replacements: safeObj(draft.replacements),
                additions: safeObj(draft.additions),
            };

            // Overwrite full override document so removed nested keys in replacements/additions
            // are actually deleted in Firestore (merge would keep stale map keys).
            await setDoc(doc(db, "program_overrides", key), data);

            if (!mountedRef.current) return;
            setTransientState(key, "saved");
        } catch (err) {
            console.error(err);
            if (!mountedRef.current) return;
            setSaveStateById((m) => ({ ...m, [key]: "error" }));
            openInfoModal("Save Error", "Could not save override.");
        }
    };

    const onDelete = async (id) => {
        const key = safeStr(id).trim();
        if (!key) return;

        setModal({
            isOpen: true,
            title: "Delete Override",
            message: `Are you sure you want to delete the program override for ${key}?`,
            onConfirm: async () => {
                setModal({ isOpen: false });
                setSaveStateById((m) => ({ ...m, [key]: "saving" }));

                try {
                    await deleteDoc(doc(db, "program_overrides", key));
                    if (!mountedRef.current) return;
                } catch (err) {
                    console.error(err);
                    if (!mountedRef.current) return;
                    setSaveStateById((m) => ({ ...m, [key]: "error" }));
                    openInfoModal("Action Failed", "Could not delete override.");
                }
            }
        });
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
                <div className="adminSkeleton" />
            ) : (
                <div className="adminFullContent">
                    <div className="adminFullList">
                        {showNew ? (
                            <div>
                                <NewOverrideCard
                                    draft={newDraft}
                                    saveState={newState}
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
                    <ConfirmModal
                        isOpen={modal.isOpen}
                        title={modal.title}
                        message={modal.message}
                        actions={modal.actions}
                        onConfirm={modal.onConfirm}
                        onCancel={() => setModal({ ...modal, isOpen: false })}
                    />
                </div>
            )}
        </div>
    );
}
