"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { collection, deleteDoc, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../lib/Firebase";
import { usePagination } from "../hooks/usePagination";
import PaginationControls from "../components/PaginationControls";

const safeStr = (v) => String(v ?? "");

function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
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

function IconChevronDown(props) {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function SubscriberCard({ item, expanded, draftEmail, saveState, errorText, onToggle, onChange, onSave, onDelete }) {
    const id = safeStr(item?.id).trim();
    const draft = safeStr(draftEmail).trim();
    const dirty = draft.toLowerCase() !== id.toLowerCase();

    const onCardClick = (e) => {
        if (e.target.closest("button, input, textarea, select, label")) return;
        onToggle(id);
    };

    return (
        <div className="adminAnnCard" onClick={onCardClick}>
            <div className="adminAnnHeader">
                <div className="adminAnnIdChip">{id}</div>
                <div style={{ flex: 1 }} />

                <button
                    type="button"
                    className="adminSmallBtn"
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggle(id);
                    }}
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
                        Email
                        <input className="adminInput" value={draftEmail} onChange={(e) => onChange(id, e.target.value)} />
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
                            {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : "Save"}
                        </button>
                    </div>
                </>
            ) : null}
        </div>
    );
}

function NewSubscriberCard({ email, setEmail, errorText, saveState, onCancel, onSave }) {
    return (
        <div className="adminAnnCard is-active">
            <div className="adminAnnHeader">
                <div className="adminAnnIdChip">New Subscriber</div>
            </div>

            {errorText ? <div className="adminAlert">{errorText}</div> : null}

            <label className="adminLabel">
                Email
                <input className="adminInput" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>

            <div className="adminMsgActions">
                <button type="button" className="adminDeleteBtn" onClick={onCancel} disabled={saveState === "saving"}>
                    Cancel
                </button>

                <button type="button" className="adminMsgSaveBtn" onClick={onSave} disabled={saveState === "saving"}>
                    {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : "Save"}
                </button>
            </div>
        </div>
    );
}

const PAGE_SIZE = 5;

export default function NewsletterAdmin() {
    const mountedRef = useRef(true);
    const timeoutRef = useRef(null);

    const [loading, setLoading] = useState(true);
    const [globalError, setGlobalError] = useState("");

    const [items, setItems] = useState([]);
    const [draftsById, setDraftsById] = useState({});
    const [saveStateById, setSaveStateById] = useState({});
    const [errorById, setErrorById] = useState({});
    const [expandedIds, setExpandedIds] = useState(() => new Set());

    const [showNew, setShowNew] = useState(false);
    const [newEmail, setNewEmail] = useState("");
    const [newError, setNewError] = useState("");
    const [newState, setNewState] = useState("idle");

    // Pagination Hook
    const {
        page,
        totalPages,
        paginatedItems,
        nextPage,
        prevPage,
        totalItems,
    } = usePagination(items, PAGE_SIZE);

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

        const unsub = onSnapshot(
            collection(db, "newsletter"),
            (snap) => {
                if (!mountedRef.current) return;

                const list = snap.docs
                    .map((d) => ({ id: safeStr(d.id).trim() }))
                    .filter((x) => x.id);

                list.sort((a, b) => safeStr(a.id).localeCompare(safeStr(b.id)));
                setItems(list);

                setDraftsById((prev) => {
                    const next = { ...prev };
                    const alive = new Set(list.map((x) => x.id));

                    Object.keys(next).forEach((k) => {
                        if (!alive.has(k)) delete next[k];
                    });

                    list.forEach((it) => {
                        const id = it.id;
                        if (!next[id]) next[id] = id;
                        const cur = safeStr(next[id]).trim();
                        if (cur.toLowerCase() === id.toLowerCase()) next[id] = id;
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
                setGlobalError("Could not load newsletter.");
            }
        );

        return () => unsub();
    }, []);

    const toggleExpand = useCallback((id) => {
        const key = safeStr(id).trim();
        if (!key) return;
        setExpandedIds((prev) => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    }, []);

    const startNew = () => {
        setShowNew(true);
        setNewEmail("");
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
        const clean = safeStr(newEmail).trim().toLowerCase();

        if (!clean || !isValidEmail(clean)) {
            setNewError("Invalid email.");
            return;
        }

        setNewError("");
        setNewState("saving");

        try {
            const ref = doc(db, "newsletter", clean);
            const snap = await getDoc(ref);
            const prev = snap.exists() ? snap.data() || {} : {};
            const createdAt = prev.createdAt || serverTimestamp();

            await setDoc(
                ref,
                {
                    email: clean,
                    createdAt,
                    updatedAt: serverTimestamp(),
                },
                { merge: true }
            );

            if (!mountedRef.current) return;
            setNewState("saved");
            setTimeout(() => {
                if (!mountedRef.current) return;
                setShowNew(false);
                setExpandedIds((prevSet) => {
                    const next = new Set(prevSet);
                    next.add(clean);
                    return next;
                });
                setNewState("idle");
            }, 900);
        } catch (err) {
            console.error(err);
            if (!mountedRef.current) return;
            setNewState("error");
            setNewError("Could not save email.");
        }
    };

    const changeDraft = (id, value) => {
        const key = safeStr(id).trim();
        if (!key) return;

        setDraftsById((prev) => ({ ...prev, [key]: value }));
        setErrorById((m) => ({ ...m, [key]: "" }));
        if (globalError) setGlobalError("");
    };

    const saveOne = async (id) => {
        const key = safeStr(id).trim();
        if (!key) return;

        const curDraft = safeStr(draftsById[key] ?? key).trim();
        const clean = curDraft.toLowerCase();

        if (!clean || !isValidEmail(clean)) {
            setErrorById((m) => ({ ...m, [key]: "Invalid email." }));
            return;
        }

        setErrorById((m) => ({ ...m, [key]: "" }));
        setSaveStateById((m) => ({ ...m, [key]: "saving" }));

        try {
            if (clean !== key.toLowerCase()) {
                const ok = window.confirm(
                    `You changed the email.\n\nThis will create/update: ${clean}\nand delete the old one: ${key}\n\nContinue?`
                );
                if (!ok) {
                    setSaveStateById((m) => ({ ...m, [key]: "idle" }));
                    return;
                }
            }

            const oldRef = doc(db, "newsletter", key);
            const oldSnap = await getDoc(oldRef);
            const oldData = oldSnap.exists() ? oldSnap.data() || {} : {};
            const createdAt = oldData.createdAt || serverTimestamp();

            await setDoc(
                doc(db, "newsletter", clean),
                { email: clean, createdAt, updatedAt: serverTimestamp() },
                { merge: true }
            );

            if (clean !== key) {
                await deleteDoc(doc(db, "newsletter", key));
            }

            if (!mountedRef.current) return;

            if (clean !== key) {
                setDraftsById((prev) => {
                    const next = { ...prev };
                    next[key] = key;
                    return next;
                });

                setExpandedIds((prev) => {
                    const next = new Set(prev);
                    next.add(clean);
                    return next;
                });

                setSaveStateById((m) => ({ ...m, [key]: "idle" }));
                setTransientState(clean, "saved");
            } else {
                setTransientState(key, "saved");
            }
        } catch (err) {
            console.error(err);
            if (!mountedRef.current) return;
            setSaveStateById((m) => ({ ...m, [key]: "error" }));
            setErrorById((m) => ({ ...m, [key]: "Could not save email." }));
        }
    };

    const deleteOne = async (id) => {
        const key = safeStr(id).trim();
        if (!key) return;

        const ok = window.confirm(`Delete ${key} from newsletter?`);
        if (!ok) return;

        setGlobalError("");
        setErrorById((m) => ({ ...m, [key]: "" }));
        setSaveStateById((m) => ({ ...m, [key]: "saving" }));

        try {
            await deleteDoc(doc(db, "newsletter", key));

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
            setErrorById((m) => ({ ...m, [key]: "Could not delete email." }));
        }
    };

    return (
        <div className="adminFullPage">
            <div className="adminFullTop">
                <h2 className="adminTitle">Newsletter</h2>

                <div className="adminActions">
                    <div className="adminCountPill" title="Total subscribers">
                        <span className="adminCountDot" aria-hidden="true" />
                        {totalItems} subscriber{totalItems === 1 ? "" : "s"}
                    </div>

                    <button className="adminBtn adminBtn--new" type="button" onClick={startNew} disabled={loading || showNew}>
                        <span className="adminBtnIcon" aria-hidden="true">
                            <IconPlus />
                        </span>
                        New
                    </button>
                </div>
            </div>

            {loading ? <div className="adminSkeleton" style={{ margin: "0 24px" }} /> : null}

            {!loading ? (
                <div className="adminFullContent">
                    {globalError ? <div className="adminAlert">{globalError}</div> : null}

                    {showNew ? (
                        <div style={{ padding: "0 4px" }}>
                            <NewSubscriberCard
                                email={newEmail}
                                setEmail={setNewEmail}
                                errorText={newError}
                                saveState={newState}
                                onCancel={cancelNew}
                                onSave={saveNew}
                            />
                        </div>
                    ) : null}


                    <div className="adminFullList">
                        {paginatedItems.map((it) => (
                            <SubscriberCard
                                key={it.id}
                                item={it}
                                expanded={expandedIds.has(it.id)}
                                draftEmail={safeStr(draftsById[it.id] ?? it.id)}
                                saveState={saveStateById[it.id] || "idle"}
                                errorText={errorById[it.id] || ""}
                                onToggle={toggleExpand}
                                onChange={changeDraft}
                                onSave={saveOne}
                                onDelete={deleteOne}
                            />
                        ))}

                        {!items.length && !showNew ? <div className="adminEmpty">No subscribers. Click “New”.</div> : null}

                        <PaginationControls
                            page={page}
                            totalPages={totalPages}
                            onNext={nextPage}
                            onPrev={prevPage}
                        />
                    </div>
                </div>
            ) : null}
        </div>
    );
}