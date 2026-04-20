"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { collection, deleteDoc, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../lib/Firebase";
import { usePagination } from "../hooks/usePagination";
import PaginationControls from "../components/PaginationControls";
import ConfirmModal from "../components/ConfirmModal";
import AdminSearch from "../components/AdminSearch";
import { toggleExpandWithConfirm } from "../utils/adminUI";

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


function IconSave(props) {
    return (
        <svg fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" {...props}>
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
        </svg>
    );
}


function IconCopy(props) {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function IconUndo(props) {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
            <path d="M3 7v6h6" />
            <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
        </svg>
    );
}

function SubscriberCard({ item, expanded, draftEmail, saveState, onToggle, onChange, onSave, onDelete, onResubscribe }) {
    const id = safeStr(item?.id).trim();
    const draft = safeStr(draftEmail).trim();
    const dirty = draft.toLowerCase() !== id.toLowerCase();
    const [copied, setCopied] = useState(false);

    const copyEmail = (e) => {
        e.stopPropagation();
        if (!id) return;
        navigator.clipboard.writeText(id).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className="adminAnnCard" style={item?.unsubscribed ? { backgroundColor: '#fef2f2', borderColor: '#fecaca' } : {}}>
            <div className="adminAnnHeader" style={{ cursor: "pointer", justifyContent: "space-between" }} onClick={() => onToggle(id)}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div className="adminAnnIdChip" style={{ fontWeight: 700, color: item?.unsubscribed ? '#dc2626' : 'inherit' }}>{id}</div>
                    {item?.unsubscribed && (
                        <span style={{ fontSize: 11, backgroundColor: '#fee2e2', color: '#dc2626', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>Unsubscribed</span>
                    )}
                    <button
                        type="button"
                        onClick={copyEmail}
                        className="adminSmallBtn"
                        style={{
                            border: "none",
                            padding: 2,
                            background: "transparent",
                            color: copied ? "#10b981" : "inherit",
                            minWidth: 20,
                            height: 20
                        }}
                        title="Copy email"
                    >
                        {copied ? (
                            <span style={{ fontSize: 12, fontWeight: 800 }}>✓</span>
                        ) : (
                            <IconCopy style={{ opacity: 0.6 }} />
                        )}
                    </button>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <button
                        type="button"
                        className="adminSmallBtn"
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
                    {item?.createdAt ? (
                        <div style={{ color: "rgba(10, 42, 67, 0.6)", fontWeight: 500, fontSize: 13, marginBottom: 12 }}>
                            Subscribed on: {item.createdAt}
                        </div>
                    ) : null}

                    <label className="adminLabel">
                        Email
                        <input className="adminInput" value={draftEmail} onChange={(e) => onChange(id, e.target.value)} />
                    </label>

                    <div className={`adminMsgActions ${item?.unsubscribed ? 'adminMsgActions--3' : ''}`}>
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

                        {item?.unsubscribed && (
                            <button
                                type="button"
                                className="adminResubscribeBtn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onResubscribe(id);
                                }}
                                disabled={saveState === "saving"}
                            >
                                <IconUndo />
                                Resubscribe
                            </button>
                        )}

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

function NewSubscriberCard({ email, setEmail, saveState, onCancel, onSave }) {
    return (
        <div className="adminAnnCard is-active">
            <div className="adminAnnHeader">
                <div className="adminAnnIdChip">New Subscriber</div>
            </div>

            <div className="adminAnnBody">
                <label className="adminLabel">
                    Email
                    <input className="adminInput" value={email} onChange={(e) => setEmail(e.target.value)} />
                </label>

                <div className="adminMsgActions">
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

export default function NewsletterAdmin({ onDirtyChange }) {
    const mountedRef = useRef(true);
    const timeoutRef = useRef(null);

    const [loading, setLoading] = useState(true);

    const [items, setItems] = useState([]);
    const [draftsById, setDraftsById] = useState({});
    const [saveStateById, setSaveStateById] = useState({});
    const [expandedIds, setExpandedIds] = useState(() => new Set());
    const [sortBy, setSortBy] = useState("date-desc");
    const [searchQuery, setSearchQuery] = useState("");

    const [showNew, setShowNew] = useState(false);
    const [newEmail, setNewEmail] = useState("");
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

    // Sorting logic
    const sortedItems = useMemo(() => {
        let arr = [...items];
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            arr = arr.filter(it => safeStr(it.id).toLowerCase().includes(q));
        }
        arr.sort((a, b) => {
            if (sortBy === "az") return a.id.localeCompare(b.id);
            if (sortBy === "za") return b.id.localeCompare(a.id);
            if (sortBy === "date-desc") return (b.createdAtMs || 0) - (a.createdAtMs || 0);
            if (sortBy === "date-asc") return (a.createdAtMs || 0) - (b.createdAtMs || 0);
            return 0;
        });
        return arr;
    }, [items, sortBy, searchQuery]);

    // Pagination Hook
    const {
        page,
        setPage,
        totalPages,
        paginatedItems,
        nextPage,
        prevPage,
        totalItems,
    } = usePagination(sortedItems, PAGE_SIZE);

    // Report aggregate dirty state to parent
    useEffect(() => {
        if (!onDirtyChange) return;

        const anyExpandedDirty = Array.from(expandedIds).some(id => {
            const draft = safeStr(draftsById[id] ?? id).trim();
            return draft.toLowerCase() !== id.toLowerCase();
        });

        // "New" form is dirty if it has any content
        const isNewDirty = showNew && newEmail.trim() !== "";
        
        onDirtyChange(isNewDirty || anyExpandedDirty);
    }, [showNew, newEmail, expandedIds, draftsById, onDirtyChange]);

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

        const unsub = onSnapshot(
            collection(db, "newsletter"),
            (snap) => {
                if (!mountedRef.current) return;

                const list = snap.docs
                    .map((d) => {
                        const data = d.data() || {};
                        let createdAtText = "";
                        let createdAtMs = 0;
                        if (data.createdAt) {
                            try {
                                const dObj = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
                                createdAtText = dObj.toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' });
                                createdAtMs = dObj.getTime();
                            } catch (e) {
                                // Default to empty string on parse error
                            }
                        }
                        return {
                            id: safeStr(d.id).trim(),
                            createdAt: createdAtText,
                            createdAtMs,
                            unsubscribed: !!data.unsubscribed
                        };
                    })
                    .filter((x) => x.id);

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
                openInfoModal("Loading Error", "Could not load newsletter.");
            }
        );

        return () => unsub();
    }, []);

    const toggleExpand = useCallback((id) => {
        toggleExpandWithConfirm({
            id,
            items,
            draftsById,
            isDirtyFn: (item, draft) => safeStr(draft).trim().toLowerCase() !== safeStr(item.id).trim().toLowerCase(),
            setModal,
            setExpandedIds,
            setDraftsById
        });
    }, [items, draftsById]);

    const startNew = () => {
        setShowNew(true);
        setNewEmail("");
        setNewState("idle");
    };

    const cancelNew = () => {
        setShowNew(false);
        setNewState("idle");
    };

    const saveNew = async () => {
        const clean = safeStr(newEmail).trim().toLowerCase();

        if (!clean || !isValidEmail(clean)) {
            openInfoModal("Action Required", "Please enter a valid email address.");
            return;
        }

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
            openInfoModal("Save Error", "Could not save email.");
        }
    };

    const changeDraft = (id, value) => {
        setDraftsById((prev) => ({ ...prev, [id]: value }));
    };

    const saveOne = async (id) => {
        const key = safeStr(id).trim();
        if (!key) return;

        const curDraft = safeStr(draftsById[key] ?? key).trim();
        const clean = curDraft.toLowerCase();

        if (!clean || !isValidEmail(clean)) {
            openInfoModal("Action Required", "Please enter a valid email address.");
            return;
        }

        setSaveStateById((m) => ({ ...m, [key]: "saving" }));

        try {
            if (clean !== key.toLowerCase()) {
                setModal({
                    isOpen: true,
                    title: "Change Email",
                    message: `You changed the email. This will create/update: ${clean} and delete the old one: ${key}. Continue?`,
                    onConfirm: () => {
                        setModal({ isOpen: false });
                        executeSaveOne(id, clean, key);
                    }
                });
                return;
            }

            executeSaveOne(id, clean, key);
        } catch (err) {
            console.error(err);
            if (!mountedRef.current) return;
            setSaveStateById((m) => ({ ...m, [key]: "error" }));
            openInfoModal("Save Error", "Could not save email.");
        }
    };

    const executeSaveOne = async (id, clean, key) => {
        setSaveStateById((m) => ({ ...m, [key]: "saving" }));

        try {
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
            openInfoModal("Save Error", "Could not save email.");
        }
    };

    const deleteOne = async (id) => {
        const key = safeStr(id).trim();
        if (!key) return;

        setModal({
            isOpen: true,
            title: "Delete Subscriber",
            message: `Are you sure you want to delete ${key} from the newsletter list?`,
            onConfirm: async () => {
                setModal({ isOpen: false });
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
                } catch (err) {
                    console.error(err);
                    if (!mountedRef.current) return;
                    setSaveStateById((m) => ({ ...m, [key]: "error" }));
                    openInfoModal("Action Failed", "Could not delete email.");
                }
            }
        });
    };

    const resubscribeOne = async (id) => {
        const key = safeStr(id).trim();
        if (!key) return;

        setSaveStateById((m) => ({ ...m, [key]: "saving" }));

        try {
            await setDoc(doc(db, "newsletter", key), { unsubscribed: false, updatedAt: serverTimestamp() }, { merge: true });
            
            if (!mountedRef.current) return;
            setTransientState(key, "saved");
        } catch (err) {
            console.error(err);
            if (!mountedRef.current) return;
            setSaveStateById((m) => ({ ...m, [key]: "error" }));
            openInfoModal("Action Failed", "Could not resubscribe.");
        }
    };

    return (
        <div className="adminFullPage">
            <div className="adminFullTop">
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", height: 40 }}>
                    <h2 className="adminTitle" style={{ margin: 0, lineHeight: 1 }}>Newsletter</h2>
                    <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "rgba(10, 42, 67, 0.6)", fontWeight: 600, height: "100%" }}>
                        <span className="adminCountDot" aria-hidden="true" style={{ width: 6, height: 6, opacity: 0.3 }} />
                        {totalItems} subscriber{totalItems === 1 ? "" : "s"}
                    </span>
                </div>
                <div className="adminActions">
                    <select
                        className="adminSelect"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        aria-label="Sort subscribers"
                    >
                        <option value="date-desc">Newest first</option>
                        <option value="date-asc">Oldest first</option>
                        <option value="az">Alphabetical</option>
                    </select>

                    <button className="adminBtn adminBtn--new" type="button" onClick={startNew} disabled={loading || showNew}>
                        <span className="adminBtnIcon" aria-hidden="true">
                            <IconPlus />
                        </span>
                        New
                    </button>
                </div>

                <AdminSearch
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Search"
                />
            </div>

            {loading ? <div className="adminSkeleton" /> : null}

            {!loading ? (
                <div className="adminFullContent">
                    {showNew ? (
                        <div>
                            <NewSubscriberCard
                                email={newEmail}
                                setEmail={setNewEmail}
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
                                onToggle={toggleExpand}
                                onChange={changeDraft}
                                onSave={saveOne}
                                onDelete={deleteOne}
                                onResubscribe={resubscribeOne}
                            />
                        ))}

                        {!items.length && !showNew ? <div className="adminEmpty">No subscribers. Click “New”.</div> : null}
                    </div>

                    <div className="adminPaginationFooter">
                        <PaginationControls
                            page={page}
                            totalPages={totalPages}
                            onNext={nextPage}
                            onPrev={prevPage}
                            onPageSet={setPage}
                        />
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
            ) : null}
        </div>
    );
}