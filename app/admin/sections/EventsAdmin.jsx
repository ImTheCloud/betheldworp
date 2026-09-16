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
import { IconChevronDown, IconPlus, IconSave, IconTrash } from "../components/AdminIcons";

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

function normalizeSlotTimes(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const res = {};
    Object.entries(value).forEach(([k, v]) => {
        const s = safeStr(v).trim();
        if (s) res[k] = s;
    });
    return res;
}

function normalizeImages(d) {
    if (Array.isArray(d?.images)) {
        return d.images.map((x) => safeStr(x).trim()).filter(Boolean);
    }
    if (d?.image && typeof d.image === "string" && d.image.trim()) {
        return [d.image.trim()];
    }
    return [];
}

function cleanEvent(draft) {
    const imgs = normalizeImages(draft);
    return {
        dateEvent: safeStr(draft?.dateEvent).trim(),
        time: safeStr(draft?.time).trim(),
        slotTimes: normalizeSlotTimes(draft?.slotTimes),
        image: imgs[0] || "",
        images: imgs,
        title: normalizeLangMap(draft?.title),
        description: normalizeLangMap(draft?.description),
        place: safeStr(draft?.place).trim(),
        address: safeStr(draft?.address).trim(),
    };
}

function pickFallback(map) {
    const m = map || emptyLangMap();
    return safeStr(m.ro).trim() || safeStr(m.en).trim() || safeStr(m.fr).trim() || safeStr(m.nl).trim() || "";
}

function normalizeEvent(data) {
    const d = data || {};
    const imgs = normalizeImages(d);
    return {
        dateEvent: safeStr(d.dateEvent).trim(),
        time: safeStr(d.time).trim(),
        slotTimes: normalizeSlotTimes(d.slotTimes),
        image: imgs[0] || "",
        images: imgs,
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

const SLOT_DEFINITIONS = {
    mon: { id: "mon", label: "Monday · Youth & Teens (20:00 - 21:30)", shortLabel: "Monday · Youth & Teens", defaultTime: "20:00 - 21:30" },
    tue_fast: { id: "tue_fast", label: "Tuesday Morning · Fasting (10:00 - 14:00)", shortLabel: "Tuesday Morning · Fasting", defaultTime: "10:00 - 14:00" },
    tue: { id: "tue", label: "Tuesday Evening · Prayer (20:00 - 21:30)", shortLabel: "Tuesday Evening · Prayer", defaultTime: "20:00 - 21:30" },
    wed: { id: "wed", label: "Wednesday · Mixed Choir (20:00 - 21:30)", shortLabel: "Wednesday · Mixed Choir", defaultTime: "20:00 - 21:30" },
    thu: { id: "thu", label: "Thursday · Men's Choir (20:00 - 21:30)", shortLabel: "Thursday · Men's Choir", defaultTime: "20:00 - 21:30" },
    fri: { id: "fri", label: "Friday · Prayer (20:00 - 21:30)", shortLabel: "Friday · Prayer", defaultTime: "20:00 - 21:30" },
    sat: { id: "sat", label: "Saturday · Kids (11:00 - 13:30)", shortLabel: "Saturday · Kids", defaultTime: "11:00 - 13:30" },
    sun_am: { id: "sun_am", label: "Sunday Morning · Service (10:00 - 12:00)", shortLabel: "Sunday Morning · Service", defaultTime: "10:00 - 12:00" },
    sun_pm: { id: "sun_pm", label: "Sunday Evening · Service (18:00 - 20:00)", shortLabel: "Sunday Evening · Service", defaultTime: "18:00 - 20:00" },
};

function dateToSlots(dateStr) {
    if (!dateStr) return [];
    const d = new Date(`${dateStr}T12:00:00Z`);
    if (isNaN(d)) return [];
    const day = d.getUTCDay();
    const map = {
        0: [SLOT_DEFINITIONS.sun_am, SLOT_DEFINITIONS.sun_pm],
        1: [SLOT_DEFINITIONS.mon],
        2: [SLOT_DEFINITIONS.tue_fast, SLOT_DEFINITIONS.tue],
        3: [SLOT_DEFINITIONS.wed],
        4: [SLOT_DEFINITIONS.thu],
        5: [SLOT_DEFINITIONS.fri],
        6: [SLOT_DEFINITIONS.sat],
    };
    return map[day] ?? [];
}

function dateToSlotIds(dateStr) {
    return dateToSlots(dateStr).map((s) => s.id);
}

function IconHistory(props) {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
            <path d="M12 8v4l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3.05 11a9 9 0 1 1 .5 9m-.5-9v-5.5h-5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function EventCard({ item, expanded, draft, saveState, activeLang, onToggle, onLangChange, onChangeField, onSave, onDelete, overriddenSlots = [], overriddenSlotTimes = {} }) {
    const id = safeStr(item?.id);
    const langKey = activeLang || "ro";

    const title = pickFallback(draft?.title);
    const date = safeStr(draft?.dateEvent);

    const availableSlots = useMemo(() => dateToSlots(draft?.dateEvent), [draft?.dateEvent]);
    const availableSlotIds = useMemo(() => availableSlots.map((s) => s.id), [availableSlots]);

    const selectedSlotIds = useMemo(() => {
        if (draft?.overrideSlots !== undefined) {
            return draft.overrideSlots;
        }
        if (draft?.isOverride !== undefined) {
            return draft.isOverride ? availableSlotIds : [];
        }
        return overriddenSlots;
    }, [draft?.overrideSlots, draft?.isOverride, overriddenSlots, availableSlotIds]);

    const isOverrideActive = selectedSlotIds.length > 0;
    const hasMultipleSlots = isOverrideActive && selectedSlotIds.length > 1;

    const currentSlotTimes = useMemo(() => {
        if (draft?.slotTimes !== undefined) return draft.slotTimes;
        if (item?.slotTimes && Object.keys(item.slotTimes).length > 0) return item.slotTimes;
        return overriddenSlotTimes || {};
    }, [draft?.slotTimes, item?.slotTimes, overriddenSlotTimes]);

    const isDirtyOverride = useMemo(() => {
        if (draft?.overrideSlots === undefined && draft?.isOverride === undefined) return false;
        if (selectedSlotIds.length !== overriddenSlots.length) return true;
        return !selectedSlotIds.every((s) => overriddenSlots.includes(s));
    }, [draft?.overrideSlots, draft?.isOverride, selectedSlotIds, overriddenSlots]);

    const dirty = !eventEqual(draft, item) || isDirtyOverride;

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
                    <div className="adminGrid2">
                        <label className="adminLabel">
                            Date
                            <input
                                type="date"
                                className="adminInput"
                                value={safeStr(draft?.dateEvent)}
                                onChange={(e) => {
                                    const newDate = e.target.value;
                                    onChangeField(id, "dateEvent", null, newDate);
                                    const newSlots = dateToSlots(newDate).map((s) => s.id);
                                    if (isOverrideActive) {
                                        const newTimes = {};
                                        newSlots.forEach((sid) => {
                                            newTimes[sid] = SLOT_DEFINITIONS[sid]?.defaultTime || "";
                                        });
                                        onChangeField(id, "overrideSlots", null, newSlots);
                                        onChangeField(id, "slotTimes", null, newTimes);
                                        const combined = newSlots.map((sid) => newTimes[sid]).filter(Boolean).join(" & ");
                                        if (combined) {
                                            onChangeField(id, "time", null, combined);
                                        }
                                    }
                                }}
                            />
                        </label>
                        <label className="adminLabel">
                            Time
                            <input
                                className={`adminInput${hasMultipleSlots ? " is-disabled" : ""}`}
                                value={safeStr(draft?.time)}
                                disabled={hasMultipleSlots}
                                title={hasMultipleSlots ? "Calculated automatically from the schedule per slot below" : undefined}
                                onChange={(e) => onChangeField(id, "time", null, e.target.value)}
                            />
                        </label>
                    </div>

                    <div className={`adminOverrideSection ${isOverrideActive ? "is-active" : ""}`}>
                        <div
                            className="adminOverrideHeader"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (isOverrideActive) {
                                    onChangeField(id, "isOverride", null, false);
                                    onChangeField(id, "overrideSlots", null, []);
                                    onChangeField(id, "slotTimes", null, {});
                                } else {
                                    const initTimes = {};
                                    availableSlotIds.forEach((sid) => {
                                        initTimes[sid] = SLOT_DEFINITIONS[sid]?.defaultTime || draft?.time || "";
                                    });
                                    onChangeField(id, "isOverride", null, true);
                                    onChangeField(id, "overrideSlots", null, availableSlotIds);
                                    onChangeField(id, "slotTimes", null, initTimes);
                                    const combined = availableSlotIds.map((sid) => initTimes[sid]).filter(Boolean).join(" & ");
                                    if (combined) {
                                        onChangeField(id, "time", null, combined);
                                    }
                                }
                            }}
                        >
                            <div className={`adminToggle ${isOverrideActive ? "is-active" : ""}`}>
                                <div className="adminToggleKnob" />
                            </div>
                            <div className="adminOverrideInfo">
                                <span className="adminOverrideTitle">Program Override</span>
                                <span className="adminOverrideSubtitle">
                                    {isOverrideActive
                                        ? "Overrides weekly program slot(s) on this date"
                                        : "Do not replace any weekly program slot"}
                                </span>
                            </div>
                        </div>

                        {isOverrideActive && availableSlots.length > 0 && (
                            <div className="adminOverrideSlotsContainer">
                                <div className="adminOverrideSlotsLabel">
                                    {availableSlots.length > 1
                                        ? "Select slot(s) to override:"
                                        : "Overridden slot:"}
                                </div>
                                <div className="adminOverrideSlotsGrid">
                                    {availableSlots.map((slot) => {
                                        const isSelected = selectedSlotIds.includes(slot.id);
                                        return (
                                            <button
                                                key={slot.id}
                                                type="button"
                                                className={`adminOverrideSlotBtn ${isSelected ? "is-on" : ""}`.trim()}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const next = isSelected
                                                        ? selectedSlotIds.filter((s) => s !== slot.id)
                                                        : [...selectedSlotIds, slot.id];
                                                    
                                                    const nextTimes = { ...currentSlotTimes };
                                                    if (!isSelected) {
                                                        if (!nextTimes[slot.id]) {
                                                            nextTimes[slot.id] = slot.defaultTime || draft?.time || "";
                                                        }
                                                    } else {
                                                        delete nextTimes[slot.id];
                                                    }

                                                    onChangeField(id, "overrideSlots", null, next);
                                                    onChangeField(id, "slotTimes", null, nextTimes);
                                                    onChangeField(id, "isOverride", null, next.length > 0);

                                                    if (next.length > 0) {
                                                        const combined = next
                                                            .map((sid) => nextTimes[sid] || SLOT_DEFINITIONS[sid]?.defaultTime || "")
                                                            .filter(Boolean)
                                                            .join(" & ");
                                                        if (combined) {
                                                            onChangeField(id, "time", null, combined);
                                                        }
                                                    }
                                                }}
                                            >
                                                <span className="adminSlotCheck">{isSelected ? "✓" : ""}</span>
                                                <span>{slot.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>

                                {selectedSlotIds.length > 1 && (
                                    <div className="adminOverrideTimesContainer">
                                        <div className="adminOverrideSlotsLabel">
                                            Schedule per slot:
                                        </div>
                                        <div className="adminOverrideTimesGrid">
                                            {selectedSlotIds.map((slotId) => {
                                                const slotDef = SLOT_DEFINITIONS[slotId];
                                                const slotVal = (currentSlotTimes && currentSlotTimes[slotId] !== undefined)
                                                    ? currentSlotTimes[slotId]
                                                    : (slotDef?.defaultTime || draft?.time || "");
                                                return (
                                                    <div key={slotId} className="adminOverrideTimeRow">
                                                        <span className="adminOverrideTimeSlotName">
                                                            {slotDef?.shortLabel || slotDef?.label || slotId}
                                                        </span>
                                                        <input
                                                            type="text"
                                                            className="adminInput adminInput--small"
                                                            value={slotVal}
                                                            placeholder={slotDef?.defaultTime || "e.g. 20:00 - 21:30"}
                                                            onChange={(e) => {
                                                                const newTime = e.target.value;
                                                                const nextTimes = {
                                                                    ...currentSlotTimes,
                                                                    [slotId]: newTime,
                                                                };
                                                                onChangeField(id, "slotTimes", null, nextTimes);
                                                                const combined = selectedSlotIds
                                                                    .map((sid) => (sid === slotId ? newTime : (nextTimes[sid] ?? SLOT_DEFINITIONS[sid]?.defaultTime ?? "")))
                                                                    .filter(Boolean)
                                                                    .join(" & ");
                                                                if (combined) {
                                                                    onChangeField(id, "time", null, combined);
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
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
                            values={Array.isArray(draft?.images) ? draft.images : (draft?.image ? [draft.image] : [])}
                            onChange={(val) => onChangeField(id, "images", null, val)}
                        />
                    </div>

                    <div className="adminMsgActions" style={{ marginTop: "16px" }}>
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

    const availableSlots = useMemo(() => dateToSlots(draft?.dateEvent), [draft?.dateEvent]);
    const availableSlotIds = useMemo(() => availableSlots.map((s) => s.id), [availableSlots]);

    const isOverrideActive = draft?.isOverride !== undefined
        ? draft.isOverride
        : (draft?.overrideSlots !== undefined ? draft.overrideSlots.length > 0 : true);

    const selectedSlotIds = useMemo(() => {
        if (draft?.overrideSlots !== undefined) {
            return draft.overrideSlots;
        }
        return isOverrideActive ? availableSlotIds : [];
    }, [draft?.overrideSlots, isOverrideActive, availableSlotIds]);

    const currentSlotTimes = draft?.slotTimes || {};
    const hasMultipleSlots = isOverrideActive && selectedSlotIds.length > 1;

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
                            const template = templates.find((t) => t.id === selectedId);
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

                <div className="adminGrid2">
                    <label className="adminLabel">
                        Date
                        <input
                            type="date"
                            className="adminInput"
                            value={safeStr(draft?.dateEvent)}
                            onChange={(e) => {
                                const newDate = e.target.value;
                                const newSlots = dateToSlots(newDate).map((s) => s.id);
                                const newTimes = {};
                                newSlots.forEach((sid) => {
                                    newTimes[sid] = SLOT_DEFINITIONS[sid]?.defaultTime || "";
                                });
                                onChangeField("dateEvent", null, newDate);
                                onChangeField("overrideSlots", null, newSlots);
                                onChangeField("slotTimes", null, newTimes);
                                onChangeField("isOverride", null, true);
                                const combined = newSlots.map((sid) => newTimes[sid]).filter(Boolean).join(" & ");
                                if (combined) {
                                    onChangeField("time", null, combined);
                                }
                            }}
                        />
                    </label>
                    <label className="adminLabel">
                        Time
                        <input
                            className={`adminInput${hasMultipleSlots ? " is-disabled" : ""}`}
                            value={safeStr(draft?.time)}
                            disabled={hasMultipleSlots}
                            title={hasMultipleSlots ? "Calculated automatically from the schedule per slot below" : undefined}
                            onChange={(e) => onChangeField("time", null, e.target.value)}
                        />
                    </label>
                </div>

                <div className={`adminOverrideSection ${isOverrideActive ? "is-active" : ""}`}>
                    <div
                        className="adminOverrideHeader"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (isOverrideActive) {
                                onChangeField("isOverride", null, false);
                                onChangeField("overrideSlots", null, []);
                                onChangeField("slotTimes", null, {});
                            } else {
                                const initTimes = {};
                                availableSlotIds.forEach((sid) => {
                                    initTimes[sid] = SLOT_DEFINITIONS[sid]?.defaultTime || draft?.time || "";
                                });
                                onChangeField("isOverride", null, true);
                                onChangeField("overrideSlots", null, availableSlotIds);
                                onChangeField("slotTimes", null, initTimes);
                                const combined = availableSlotIds.map((sid) => initTimes[sid]).filter(Boolean).join(" & ");
                                if (combined) {
                                    onChangeField("time", null, combined);
                                }
                            }
                        }}
                    >
                        <div className={`adminToggle ${isOverrideActive ? "is-active" : ""}`}>
                            <div className="adminToggleKnob" />
                        </div>
                        <div className="adminOverrideInfo">
                            <span className="adminOverrideTitle">Program Override</span>
                            <span className="adminOverrideSubtitle">
                                {isOverrideActive
                                    ? "Overrides weekly program slot(s) on this date"
                                    : "Do not replace any weekly program slot"}
                            </span>
                        </div>
                    </div>

                    {isOverrideActive && availableSlots.length > 0 && (
                        <div className="adminOverrideSlotsContainer">
                            <div className="adminOverrideSlotsLabel">
                                {availableSlots.length > 1
                                    ? "Select slot(s) to override:"
                                    : "Overridden slot:"}
                            </div>
                            <div className="adminOverrideSlotsGrid">
                                {availableSlots.map((slot) => {
                                    const isSelected = selectedSlotIds.includes(slot.id);
                                    return (
                                        <button
                                            key={slot.id}
                                            type="button"
                                            className={`adminOverrideSlotBtn ${isSelected ? "is-on" : ""}`.trim()}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const next = isSelected
                                                    ? selectedSlotIds.filter((s) => s !== slot.id)
                                                    : [...selectedSlotIds, slot.id];
                                                
                                                const nextTimes = { ...currentSlotTimes };
                                                if (!isSelected) {
                                                    if (!nextTimes[slot.id]) {
                                                        nextTimes[slot.id] = slot.defaultTime || draft?.time || "";
                                                    }
                                                } else {
                                                    delete nextTimes[slot.id];
                                                }

                                                onChangeField("overrideSlots", null, next);
                                                onChangeField("slotTimes", null, nextTimes);
                                                onChangeField("isOverride", null, next.length > 0);

                                                if (next.length > 0) {
                                                    const combined = next
                                                        .map((sid) => nextTimes[sid] || SLOT_DEFINITIONS[sid]?.defaultTime || "")
                                                        .filter(Boolean)
                                                        .join(" & ");
                                                    if (combined) {
                                                        onChangeField("time", null, combined);
                                                    }
                                                }
                                            }}
                                        >
                                            <span className="adminSlotCheck">{isSelected ? "✓" : ""}</span>
                                            <span>{slot.label}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {selectedSlotIds.length > 1 && (
                                <div className="adminOverrideTimesContainer">
                                    <div className="adminOverrideSlotsLabel">
                                        Schedule per slot:
                                    </div>
                                    <div className="adminOverrideTimesGrid">
                                        {selectedSlotIds.map((slotId) => {
                                            const slotDef = SLOT_DEFINITIONS[slotId];
                                            const slotVal = (draft?.slotTimes && draft.slotTimes[slotId] !== undefined)
                                                ? draft.slotTimes[slotId]
                                                : (slotDef?.defaultTime || draft?.time || "");
                                            return (
                                                <div key={slotId} className="adminOverrideTimeRow">
                                                    <span className="adminOverrideTimeSlotName">
                                                        {slotDef?.shortLabel || slotDef?.label || slotId}
                                                    </span>
                                                    <input
                                                        type="text"
                                                        className="adminInput adminInput--small"
                                                        value={slotVal}
                                                        placeholder={slotDef?.defaultTime || "e.g. 20:00 - 21:30"}
                                                        onChange={(e) => {
                                                            const newTime = e.target.value;
                                                            const nextTimes = {
                                                                ...(draft?.slotTimes || {}),
                                                                [slotId]: newTime,
                                                            };
                                                            onChangeField("slotTimes", null, nextTimes);
                                                            const combined = selectedSlotIds
                                                                .map((sid) => (sid === slotId ? newTime : (nextTimes[sid] ?? SLOT_DEFINITIONS[sid]?.defaultTime ?? "")))
                                                                .filter(Boolean)
                                                                .join(" & ");
                                                            if (combined) {
                                                                onChangeField("time", null, combined);
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
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
                        values={Array.isArray(draft?.images) ? draft.images : (draft?.image ? [draft.image] : [])}
                        onChange={(val) => onChangeField("images", null, val)}
                    />
                </div>

                <div className="adminMsgActions" style={{ marginTop: "16px" }}>
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

    const getEventOverriddenData = useCallback((eventId, dateStr) => {
        if (!eventId || !dateStr) return { slots: [], slotTimes: {} };
        const wk = dateToWeekKey(dateStr);
        if (!wk) return { slots: [], slotTimes: {} };
        const override = overrides.find((o) => o.id === wk || o.weekKey === wk);
        if (!override || !override.replacements) return { slots: [], slotTimes: {} };
        const possibleSlots = dateToSlotIds(dateStr);
        const slots = possibleSlots.filter((s) => override.replacements[s] === eventId);
        const slotTimes = {};
        slots.forEach((s) => {
            if (override.customTimes && override.customTimes[s]) {
                slotTimes[s] = override.customTimes[s];
            }
        });
        return { slots, slotTimes };
    }, [overrides]);

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
        return items.filter((it) => {
            const title = pickFallback(it.title).toLowerCase();
            return title.includes(q) || safeStr(it.id).toLowerCase().includes(q);
        });
    }, [items, searchQuery]);

    const upcomingItems = filteredItems.filter((x) => x.upcoming);
    const historyItems = filteredItems.filter((x) => !x.upcoming);

    const upcomingPagination = usePagination(upcomingItems, PAGE_SIZE);
    const historyPagination = usePagination(historyItems, PAGE_SIZE);

    const isEventItemDirty = useCallback((item, draft) => {
        if (!item || !draft) return false;
        if (!eventEqual(item, draft)) return true;
        if (draft?.overrideSlots !== undefined || draft?.isOverride !== undefined) {
            const origData = getEventOverriddenData(item.id, item.dateEvent);
            const availableSlots = dateToSlotIds(draft?.dateEvent);
            const currentSlots = draft?.overrideSlots !== undefined 
                ? draft.overrideSlots 
                : (draft?.isOverride ? availableSlots : []);
            if (origData.slots.length !== currentSlots.length) return true;
            if (!origData.slots.every((s) => currentSlots.includes(s))) return true;
        }
        return false;
    }, [getEventOverriddenData]);

    // Report aggregate dirty state to parent
    useEffect(() => {
        if (!onDirtyChange) return;

        const anyExpandedDirty = Array.from(expandedIds).some((id) => {
            const item = items.find((it) => it.id === id);
            const draft = draftsById[id];
            return isEventItemDirty(item, draft);
        });

        // "New" form is dirty if it has any meaningful content or is just open
        const isNewDirty = showNew && (newDraft.dateEvent || pickFallback(newDraft.title));
        
        onDirtyChange(isNewDirty || anyExpandedDirty);
    }, [showNew, newDraft, expandedIds, draftsById, items, onDirtyChange, isEventItemDirty]);

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
            const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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
            isDirtyFn: isEventItemDirty,
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
            } else if (field === "images") {
                const imgs = Array.isArray(value) ? value.filter(Boolean) : (value ? [value] : []);
                next.images = imgs;
                next.image = imgs[0] || "";
            } else if (field === "image") {
                const img = safeStr(value).trim();
                next.image = img;
                next.images = img ? [img] : [];
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
            } else if (field === "images") {
                const imgs = Array.isArray(value) ? value.filter(Boolean) : (value ? [value] : []);
                next.images = imgs;
                next.image = imgs[0] || "";
            } else if (field === "image") {
                const img = safeStr(value).trim();
                next.image = img;
                next.images = img ? [img] : [];
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
            dateEvent: prev.dateEvent,
        }));
    };

    const syncOverride = async (eventId, dateStr, isOverride, targetSlotIds = null, targetSlotTimes = null, oldEventId = null, oldDateStr = null) => {
        if (!eventId || !dateStr) return;

        // If date or event ID changed, clean up previous week
        if (oldEventId && oldDateStr && (oldEventId !== eventId || oldDateStr !== dateStr)) {
            const oldWk = dateToWeekKey(oldDateStr);
            const oldSlots = dateToSlotIds(oldDateStr);
            if (oldWk && oldSlots.length > 0) {
                const oldOverride = overrides.find((o) => o.id === oldWk || o.weekKey === oldWk);
                if (oldOverride && oldOverride.replacements) {
                    const updates = {};
                    let changed = false;
                    for (const s of oldSlots) {
                        if (oldOverride.replacements[s] === oldEventId) {
                            updates[`replacements.${s}`] = deleteField();
                            updates[`customTimes.${s}`] = deleteField();
                            changed = true;
                        }
                    }
                    if (changed) {
                        updates['affectedProgramIds'] = (oldOverride.affectedProgramIds || []).filter((id) => {
                            if (oldSlots.includes(id) && oldOverride.replacements[id] === oldEventId) return false;
                            return true;
                        });
                        await updateDoc(doc(db, "program_overrides", oldWk), updates);
                    }
                }
            }
        }

        const wk = dateToWeekKey(dateStr);
        const daySlotIds = dateToSlotIds(dateStr);
        if (!wk || daySlotIds.length === 0) return;

        const overrideDoc = overrides.find((o) => o.id === wk || o.weekKey === wk);
        const base = overrideDoc || { weekKey: wk, affectedProgramIds: [], replacements: {}, customTimes: {} };
        const newReplacements = { ...(base.replacements || {}) };
        const newCustomTimes = { ...(base.customTimes || {}) };
        let affected = [...(base.affectedProgramIds || [])];

        const selectedSlots = isOverride 
            ? (Array.isArray(targetSlotIds) ? targetSlotIds : daySlotIds)
            : [];
        const slotTimesMap = targetSlotTimes || {};

        let changed = false;

        daySlotIds.forEach((slotId) => {
            if (selectedSlots.includes(slotId)) {
                if (newReplacements[slotId] !== eventId) {
                    newReplacements[slotId] = eventId;
                    changed = true;
                }
                if (!affected.includes(slotId)) {
                    affected.push(slotId);
                    changed = true;
                }
                const timeForSlot = safeStr(slotTimesMap[slotId] || (selectedSlots.length === 1 ? "" : SLOT_DEFINITIONS[slotId]?.defaultTime)).trim();
                if (timeForSlot && newCustomTimes[slotId] !== timeForSlot) {
                    newCustomTimes[slotId] = timeForSlot;
                    changed = true;
                } else if (!timeForSlot && newCustomTimes[slotId]) {
                    delete newCustomTimes[slotId];
                    changed = true;
                }
            } else {
                if (newReplacements[slotId] === eventId) {
                    delete newReplacements[slotId];
                    delete newCustomTimes[slotId];
                    changed = true;
                    affected = affected.filter((id) => id !== slotId);
                }
            }
        });

        if (changed) {
            if (selectedSlots.length > 0 || Object.keys(newReplacements).length > 0 || affected.length > 0) {
                await setDoc(doc(db, "program_overrides", wk), {
                    ...base,
                    weekKey: wk,
                    affectedProgramIds: [...new Set(affected)],
                    replacements: newReplacements,
                    customTimes: newCustomTimes
                }, { merge: true });
            } else if (overrideDoc) {
                await setDoc(doc(db, "program_overrides", wk), {
                    ...base,
                    weekKey: wk,
                    affectedProgramIds: [],
                    replacements: {},
                    customTimes: {}
                }, { merge: true });
            }
        }
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

        const availableSlots = dateToSlotIds(d.dateEvent);
        const isOv = newDraft?.isOverride !== undefined ? newDraft.isOverride : true;
        const targetSlots = newDraft?.overrideSlots !== undefined ? newDraft.overrideSlots : (isOv ? availableSlots : []);
        const targetSlotTimes = newDraft?.slotTimes !== undefined ? newDraft.slotTimes : {};

        setModal({
            isOpen: true,
            title: "Confirm New Event",
            message: "Are you sure you want to save this new event?",
            variant: "primary",
            onConfirm: async () => {
                setModal((m) => ({ ...m, isOpen: false }));
                setNewState("saving");

                try {
                    const ref = doc(collection(db, "events"));
                    await setDoc(ref, d);
                    await syncOverride(ref.id, d.dateEvent, isOv && targetSlots.length > 0, targetSlots, targetSlotTimes);

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
            const availableSlots = dateToSlotIds(d.dateEvent);
            const origData = getEventOverriddenData(original.id, original.dateEvent);
            const isOv = draft?.isOverride !== undefined 
                ? draft.isOverride 
                : (draft?.overrideSlots !== undefined ? draft.overrideSlots.length > 0 : origData.slots.length > 0);
            const targetSlots = draft?.overrideSlots !== undefined 
                ? draft.overrideSlots 
                : (isOv ? (origData.slots.length > 0 ? origData.slots : availableSlots) : []);
            const targetSlotTimes = draft?.slotTimes !== undefined
                ? draft.slotTimes
                : (original?.slotTimes || origData.slotTimes || {});

            if (dateChanged) {
                const ref = doc(collection(db, "events"));
                await setDoc(ref, d);
                await syncOverride(ref.id, d.dateEvent, isOv && targetSlots.length > 0, targetSlots, targetSlotTimes);

                if (!mountedRef.current) return;
                setDraftsById((prev) => ({ ...prev, [key]: normalizeEvent(original) }));
                setTransientState(key, "saved");
            } else {
                await setDoc(doc(db, "events", key), d, { merge: true });
                await syncOverride(key, d.dateEvent, isOv && targetSlots.length > 0, targetSlots, targetSlotTimes, key, original.dateEvent);

                if (!mountedRef.current) return;
                setDraftsById((prev) => ({ ...prev, [key]: normalizeEvent({ ...d, id: key }) }));
                setTransientState(key, "saved");
            }
        } catch (err) {
            console.error(err);
            if (!mountedRef.current) return;
            setSaveStateById((m) => ({ ...m, [key]: "error" }));
            openInfoModal("Save Error", "Could not save event.");
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
                    Events{" "}
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
                                {upcomingPagination.paginatedItems.map((it) => {
                                    const overrideData = getEventOverriddenData(it.id, it.dateEvent);
                                    return (
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
                                            overriddenSlots={overrideData.slots}
                                            overriddenSlotTimes={overrideData.slotTimes}
                                        />
                                    );
                                })}
                            </>
                        ) : (
                            <div className="adminList adminList--history">
                                {historyPagination.paginatedItems.map((it) => {
                                    const overrideData = getEventOverriddenData(it.id, it.dateEvent);
                                    return (
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
                                            overriddenSlots={overrideData.slots}
                                            overriddenSlotTimes={overrideData.slotTimes}
                                        />
                                    );
                                })}
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