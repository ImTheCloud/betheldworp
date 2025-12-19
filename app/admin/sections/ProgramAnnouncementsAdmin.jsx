"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../../lib/Firebase";

/*
 * Constants and helpers
 */

// Days of the week used for affected program IDs
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

// Ensure a value is always treated as an array
function safeArr(v) {
    return Array.isArray(v) ? v : [];
}

// Coerce any value to a string
function safeStr(v) {
    return String(v ?? "");
}

// Convert a string id to a numeric value, or null
function parseNumericId(id) {
    const s = safeStr(id).trim();
    if (!s) return null;
    const n = Number(s);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.floor(n);
}

// Determine the next available numeric ID for a new announcement
function getNextNumericId(items) {
    let max = 0;
    safeArr(items).forEach((it) => {
        const n = parseNumericId(it?.id);
        if (n && n > max) max = n;
    });
    return max + 1;
}

// Normalise the Firestore document into a predictable array of announcements
function normalizeDoc(raw) {
    const data = raw || {};
    const incoming = safeArr(data.items).map((it) => ({
        id: safeStr(it?.id).trim(),
        active: Boolean(it?.active),
        affectedProgramIds: safeArr(it?.affectedProgramIds)
            .map((x) => safeStr(x).trim())
            .filter(Boolean),
        message: safeStr(it?.message ?? ""),
    }));

    let next = getNextNumericId(incoming);
    const items = incoming.map((it) => {
        if (parseNumericId(it.id)) return it;
        return { ...it, id: String(next++) };
    });

    items.sort((a, b) => {
        if (a.active !== b.active) return a.active ? -1 : 1;
        const na = parseNumericId(a.id) ?? 0;
        const nb = parseNumericId(b.id) ?? 0;
        return nb - na;
    });

    return { items };
}

/*
 * Icons
 */

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

/*
 * AnnouncementCard – represents a single announcement in the list.  It supports collapse/expand,
 * editing of the affected program IDs and message, saving and deletion.  The header row shows a
 * short summary when collapsed and includes an activation toggle plus a chevron for expansion.
 */

function AnnouncementCard({
                              it,
                              expanded,
                              drafts,
                              savingMessageById,
                              onToggleActive,
                              onToggleAffected,
                              onSetDraft,
                              onRemoveItem,
                              onSaveMessage,
                              toggleExpand,
                          }) {
    const key = safeStr(it.id).trim();

    // Build a set for the affected days
    const affectedSet = useMemo(
        () => new Set(safeArr(it.affectedProgramIds).map((x) => String(x))),
        [it.affectedProgramIds]
    );

    // Base and draft message values
    const baseMsg = safeStr(it.message);
    const draftMsg = typeof drafts[key] === "string" ? drafts[key] : baseMsg;
    const dirtyMsg = draftMsg !== baseMsg;
    const savingState = savingMessageById[key] || "idle";

    // Short summary for the collapsed state – either a truncated message or a dash
    const summary =
        draftMsg?.trim() && draftMsg.trim().length
            ? draftMsg.trim().length <= 60
                ? draftMsg.trim()
                : draftMsg.trim().slice(0, 60) + "…"
            : "—";

    // Card click handler toggles expansion unless the click originated on a form control
    const handleCardClick = (e) => {
        if (e.target.closest("button, input, textarea, select, label")) return;
        toggleExpand(key);
    };

    return (
        <div
            className={`adminAnnCard${it.active ? " is-active" : ""}`}
            onClick={handleCardClick}
        >
            {/* Header row */}
            <div className="adminAnnHeader">
                <div className="adminAnnIdChip">Anunț #{key}</div>
                {/* When collapsed, show the summary text in the centre */}
                {!expanded ? (
                    <div className="adminSummary">{summary}</div>
                ) : (
                    <div style={{ flex: 1 }} />
                )}

                {/* Activation toggle */}
                <button
                    type="button"
                    role="switch"
                    aria-checked={Boolean(it.active)}
                    className={`adminToggle${it.active ? " is-on" : ""}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleActive(key);
                    }}
                    title={it.active ? "Dezactivează" : "Activează"}
                >
                    <span className="adminToggleThumb" />
                </button>

                {/* Chevron */}
                <button
                    type="button"
                    className="adminSmallBtn"
                    onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(key);
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

            {/* Detail fields – rendered only when expanded */}
            {expanded && (
                <>
                    <div className="adminAnnAffectTitle">Afectează</div>

                    <div className="adminAffectGrid" aria-label="Zile afectate">
                        {AFFECT_OPTIONS.map((opt) => {
                            const on = affectedSet.has(opt.id);
                            return (
                                <button
                                    key={`${key}-${opt.id}`}
                                    type="button"
                                    className={`adminAffectChip${on ? " is-on" : ""}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onToggleAffected(key, opt.id);
                                    }}
                                    title={opt.label}
                                >
                                    {opt.label}
                                </button>
                            );
                        })}
                    </div>

                    <label className="adminLabel">
                        Mesaj
                        <textarea
                            className="adminTextarea"
                            value={draftMsg}
                            onChange={(e) => onSetDraft(key, e.target.value)}
                            rows={5}
                            placeholder="Scrie mesajul complet aici (inclusiv datele)."
                        />
                    </label>

                    <div className="adminMsgActions">
                        <button
                            type="button"
                            className="adminDeleteBtn"
                            onClick={(e) => {
                                e.stopPropagation();
                                onRemoveItem(key);
                            }}
                        >
                            <IconTrash />
                            Șterge
                        </button>

                        <button
                            type="button"
                            className="adminMsgSaveBtn"
                            onClick={(e) => {
                                e.stopPropagation();
                                onSaveMessage(it);
                            }}
                            disabled={!dirtyMsg || savingState === "saving"}
                        >
                            {savingState === "saving"
                                ? "Se salvează…"
                                : savingState === "saved"
                                    ? "Salvat ✓"
                                    : "Salvează"}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

/*
 * Main component for managing program announcements.  Handles loading from Firestore,
 * creation of new announcements, editing and deletion, and history display.  Uses a set
 * of expanded IDs to determine which announcement rows are open.
 */

export default function ProgramAnnouncementsAdmin() {
    const mountedRef = useRef(true);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [items, setItems] = useState([]);
    const [drafts, setDrafts] = useState({});
    const [savingMessageById, setSavingMessageById] = useState({});
    const [showHistory, setShowHistory] = useState(false);
    const [expandedIds, setExpandedIds] = useState(() => new Set());

    const DOC_REF = useMemo(() => doc(db, "program_announcements", "announcement"), []);

    useEffect(() => {
        mountedRef.current = true;
        return () => (mountedRef.current = false);
    }, []);

    // Subscribe to Firestore and normalise incoming data
    useEffect(() => {
        setLoading(true);
        setError("");

        const unsub = onSnapshot(
            DOC_REF,
            (snap) => {
                if (!mountedRef.current) return;

                const next = normalizeDoc(snap.exists() ? snap.data() : null);
                setItems(next.items);

                // Sync drafts with incoming data
                setDrafts((prev) => {
                    const nextDrafts = { ...prev };
                    const alive = new Set(next.items.map((x) => safeStr(x.id).trim()).filter(Boolean));

                    // Drop drafts for deleted items
                    Object.keys(nextDrafts).forEach((k) => {
                        if (!alive.has(k)) delete nextDrafts[k];
                    });

                    // Initialise drafts for new items
                    next.items.forEach((it) => {
                        const id = safeStr(it.id).trim();
                        if (!id) return;
                        const base = safeStr(it.message);
                        const current = nextDrafts[id];
                        if (typeof current !== "string") {
                            nextDrafts[id] = base;
                        } else if (current === base) {
                            nextDrafts[id] = base;
                        }
                    });
                    return nextDrafts;
                });

                // Keep only expanded IDs that still exist
                setExpandedIds((prev) => {
                    const nextSet = new Set();
                    next.items.forEach((it) => {
                        const id = safeStr(it.id).trim();
                        if (prev.has(id)) nextSet.add(id);
                    });
                    return nextSet;
                });

                setLoading(false);
            },
            (err) => {
                console.error(err);
                if (!mountedRef.current) return;
                setLoading(false);
                setError("Nu am putut încărca anunțurile.");
            }
        );

        return () => unsub();
    }, [DOC_REF]);

    // Compute active and history partitions
    const activeItems = useMemo(() => safeArr(items).filter((x) => Boolean(x.active)), [items]);
    const historyItems = useMemo(() => safeArr(items).filter((x) => !Boolean(x.active)), [items]);

    // Persist announcements to Firestore
    const persistItems = async (nextItems) => {
        setError("");
        try {
            await setDoc(DOC_REF, { items: nextItems }, { merge: true });
        } catch (err) {
            console.error(err);
            if (!mountedRef.current) return;
            setError("Salvarea automată a eșuat. Încearcă din nou.");
        }
    };

    // Toggle expansion for a specific announcement
    const toggleExpand = useCallback((id) => {
        const key = safeStr(id).trim();
        if (!key) return;
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }, []);

    // Create a new announcement and auto‑expand it
    const createNew = async () => {
        const nextId = String(getNextNumericId(items));
        const nextItem = { id: nextId, active: true, affectedProgramIds: [], message: "" };
        const nextItems = [nextItem, ...safeArr(items)];

        setItems(nextItems);
        setDrafts((m) => ({ ...m, [nextId]: "" }));
        setExpandedIds((prev) => {
            const next = new Set(prev);
            next.add(nextId);
            return next;
        });
        await persistItems(nextItems);
    };

    // Delete an announcement permanently
    const removeItem = async (id) => {
        const key = safeStr(id).trim();
        if (!key) return;

        const ok = window.confirm(
            "Ștergi definitiv acest anunț? (nu va mai exista în istoric)"
        );
        if (!ok) return;

        const nextItems = safeArr(items).filter((x) => safeStr(x.id).trim() !== key);
        setItems(nextItems);
        setDrafts((m) => {
            const n = { ...m };
            delete n[key];
            return n;
        });
        setExpandedIds((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
        });
        await persistItems(nextItems);
    };

    // Toggle the active/inactive status of an announcement
    const toggleActive = async (id) => {
        const key = safeStr(id).trim();
        if (!key) return;

        const nextItems = safeArr(items).map((it) =>
            safeStr(it.id).trim() === key ? { ...it, active: !Boolean(it.active) } : it
        );
        setItems(nextItems);
        await persistItems(nextItems);
    };

    // Toggle a specific day in the affectedProgramIds set
    const toggleAffected = async (id, programId) => {
        const itemId = safeStr(id).trim();
        const p = safeStr(programId).trim();
        if (!itemId || !p) return;

        const nextItems = safeArr(items).map((it) => {
            if (safeStr(it.id).trim() !== itemId) return it;
            const set = new Set(
                safeArr(it.affectedProgramIds)
                    .map((x) => safeStr(x).trim())
                    .filter(Boolean)
            );
            if (set.has(p)) set.delete(p);
            else set.add(p);
            return { ...it, affectedProgramIds: Array.from(set) };
        });
        setItems(nextItems);
        await persistItems(nextItems);
    };

    // Update a draft message for a particular announcement
    const setDraft = (id, value) => {
        const key = safeStr(id).trim();
        if (!key) return;
        setDrafts((m) => ({ ...m, [key]: String(value ?? "") }));
        if (error) setError("");
    };

    // Save a changed message back to Firestore
    const saveMessage = async (it) => {
        const key = safeStr(it?.id).trim();
        if (!key) return;
        const base = safeStr(it?.message);
        const draft = typeof drafts[key] === "string" ? drafts[key] : base;
        if (draft === base) return;

        setError("");
        setSavingMessageById((m) => ({ ...m, [key]: "saving" }));
        const nextItems = safeArr(items).map((x) =>
            safeStr(x.id).trim() === key ? { ...x, message: draft } : x
        );
        try {
            await setDoc(DOC_REF, { items: nextItems }, { merge: true });
            if (!mountedRef.current) return;
            setItems(nextItems);
            setSavingMessageById((m) => ({ ...m, [key]: "saved" }));
            setTimeout(
                () => mountedRef.current && setSavingMessageById((m) => ({ ...m, [key]: "idle" })),
                900
            );
        } catch (err) {
            console.error(err);
            if (!mountedRef.current) return;
            setSavingMessageById((m) => ({ ...m, [key]: "error" }));
            setError("Nu am putut salva mesajul. Încearcă din nou.");
        }
    };

    return (
        <div className="adminCard">
            <div className="adminTop">
                <h2 className="adminTitle">Anunțuri speciale</h2>
                <div className="adminActions">
                    <button
                        className="adminBtn adminBtn--new"
                        type="button"
                        onClick={createNew}
                        disabled={loading}
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
                    <div className="adminList">
                        {activeItems.map((it) => (
                            <AnnouncementCard
                                key={it.id}
                                it={it}
                                expanded={expandedIds.has(it.id)}
                                drafts={drafts}
                                savingMessageById={savingMessageById}
                                onToggleActive={toggleActive}
                                onToggleAffected={toggleAffected}
                                onSetDraft={setDraft}
                                onRemoveItem={removeItem}
                                onSaveMessage={saveMessage}
                                toggleExpand={toggleExpand}
                            />
                        ))}
                        {!activeItems.length ? (
                            <div className="adminEmpty">
                                Nu există anunț activ. Apasă „Nou”.
                            </div>
                        ) : null}
                    </div>
                    <div className="adminHistoryRow">
                        <button
                            type="button"
                            className="adminSmallBtn"
                            onClick={() => setShowHistory((v) => !v)}
                            disabled={!historyItems.length}
                        >
                            {showHistory
                                ? "Ascunde istoricul"
                                : `Arată istoricul (${historyItems.length})`}
                        </button>
                    </div>
                    {showHistory ? (
                        <div className="adminList adminList--history">
                            {historyItems.map((it) => (
                                <AnnouncementCard
                                    key={it.id}
                                    it={it}
                                    expanded={expandedIds.has(it.id)}
                                    drafts={drafts}
                                    savingMessageById={savingMessageById}
                                    onToggleActive={toggleActive}
                                    onToggleAffected={toggleAffected}
                                    onSetDraft={setDraft}
                                    onRemoveItem={removeItem}
                                    onSaveMessage={saveMessage}
                                    toggleExpand={toggleExpand}
                                />
                            ))}
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    );
}

