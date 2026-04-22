"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { collection, addDoc, setDoc, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../../lib/Firebase";
import { usePagination } from "../hooks/usePagination";
import PaginationControls from "../components/PaginationControls";
import ConfirmModal from "../components/ConfirmModal";
import AdminSearch from "../components/AdminSearch";
import ChurchFormFields from "../components/ChurchFormFields";
import { IconPlus, IconTrash, IconChevronDown, IconSave, IconEyeOff, IconEye, IconSync, IconMap, IconSearch } from "../components/ChurchIcons";
import { safeStr, normalizeText, matchChurchSearch, hasDraftChanges, emptyChurch, COUNTRY_OPTIONS, isMeaningfullyDifferent, geocodeAddress } from "../utils/churchHelpers";
import { toggleExpandWithConfirm } from "../utils/adminUI";

const PAGE_SIZE = 10;

function ChurchCard({ item, expanded, drafts, saveState, onToggle, onChange, onSave, onDelete, setSaveStateById }) {
    const id = item.id;
    const isDraft = drafts.isDraft || false;
    const [syncedFields, setSyncedFields] = useState({});
    const [syncSuccess, setSyncSuccess] = useState(false);

    useEffect(() => {
        if (!expanded) {
            setSyncedFields({});
            setSyncSuccess(false);
        }
    }, [expanded]);

    useEffect(() => {
        if (saveState === "saved") {
            setSyncedFields({});
        }
    }, [saveState]);

    const handleSync = null; // Sync function removed

    const handleFieldChange = (field, value) => {
        onChange(id, field, value);
    };

    const handleRestore = (field, value) => {
        onChange(id, field, value);
        setSyncedFields(prev => {
            const next = { ...prev };
            delete next[field];
            return next;
        });
    };

    const getHighlightClass = (field) => syncedFields[field] ? "is-synced-highlight" : "";

    return (
        <div className={`adminAnnCard ${isDraft ? "is-draft" : ""}`} style={isDraft ? { backgroundColor: "#fffbeb" } : {}}>
            <div className="adminAnnHeader" style={{ cursor: "pointer", justifyContent: "space-between" }} onClick={() => onToggle(id)}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="adminSummary">{item.name}</span>
                    {item.isDraft && (
                        <span style={{ 
                            fontSize: "0.7rem", 
                            fontWeight: 800, 
                            color: "#92400e", 
                            backgroundColor: "#fef3c7", 
                            padding: "2px 6px", 
                            borderRadius: "4px",
                            textTransform: "uppercase"
                        }}>
                            Draft
                        </span>
                    )}
                    <span className="adminMuted" style={{ fontSize: "0.8rem", marginLeft: 8 }}>
                        • {item.city}, {item.country}
                    </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <button type="button" className="adminSmallBtn">
                        <IconChevronDown style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }} />
                    </button>
                </div>
            </div>

            {expanded ? (
                <div className="adminAnnBody" style={isDraft ? { backgroundColor: "#fffbeb" } : {}}>
                    <ChurchFormFields
                        drafts={drafts}
                        onChange={handleFieldChange}
                        syncedFields={syncedFields}
                        onRestore={handleRestore}
                        getHighlightClass={getHighlightClass}
                    />

                    <div className="adminMsgActions adminMsgActions--3" style={{ marginTop: "20px" }}>
                        <button
                            type="button"
                            className="adminDeleteBtn"
                            onClick={(e) => { e.stopPropagation(); onDelete(id); }}
                            disabled={saveState === "saving"}
                        >
                            <IconTrash />
                            Delete
                        </button>

                        <button
                            type="button"
                            className="adminDraftBtn"
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                const newStatus = !drafts.isDraft;
                                onChange(id, "isDraft", newStatus);
                                onSave(id, newStatus); 
                            }}
                            disabled={saveState === "saving"}
                        >
                            {drafts.isDraft ? <IconEye /> : <IconEyeOff />}
                            {drafts.isDraft ? "Undraft" : "Draft"}
                        </button>

                        <button
                            type="button"
                            className="adminMsgSaveBtn"
                            onClick={(e) => { e.stopPropagation(); onSave(id); }}
                            disabled={saveState === "saving"}
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

function NewChurchCard({ drafts, setDraft, saveState, onCancel, onSave }) {
    const [syncedFields, setSyncedFields] = useState({});
    const [syncSuccess, setSyncSuccess] = useState(false);

    useEffect(() => {
        if (saveState === "saved") {
            setSyncedFields({});
        }
    }, [saveState]);

    const handleFieldChange = (field, value) => setDraft(field, value);

    const handleRestore = (field, value) => {
        setDraft(field, value);
        setSyncedFields(prev => {
            const next = { ...prev };
            delete next[field];
            return next;
        });
    };

    const getHighlightClass = (field) => syncedFields[field] ? "is-synced-highlight" : "";

    const handleSync = null; // Sync function removed

    return (
        <div className="adminAnnCard is-active">
            <div className="adminAnnHeader"><div className="adminAnnIdChip">New Church</div></div>
            <div className="adminAnnBody">
                <ChurchFormFields
                    drafts={drafts}
                    onChange={handleFieldChange}
                    syncedFields={syncedFields}
                    onRestore={handleRestore}
                    getHighlightClass={getHighlightClass}
                />
                <div className="adminMsgActions adminMsgActions--3" style={{ marginTop: "20px" }}>
                    <button type="button" className="adminDeleteBtn" onClick={onCancel} disabled={saveState === "saving"}>Cancel</button>
                    <button type="button" className="adminDraftBtn" onClick={() => onSave(true)} disabled={saveState === "saving"}><IconEyeOff />Draft</button>
                    <button type="button" className="adminMsgSaveBtn" onClick={() => onSave()} disabled={saveState === "saving"}>
                        <IconSave />{saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : "Save"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function ChurchesAdmin({ onDirtyChange }) {
    const mountedRef = useRef(true);
    const timeoutRef = useRef(null);

    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState([]);
    const [draftsById, setDraftsById] = useState({});
    const [saveStateById, setSaveStateById] = useState({});
    const [expandedIds, setExpandedIds] = useState(() => new Set());
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCountry, setSelectedCountry] = useState("");
    const [selectedCity, setSelectedCity] = useState("");

    const [showNew, setShowNew] = useState(false);
    const [newDrafts, setNewDrafts] = useState(emptyChurch());
    const [newState, setNewState] = useState("idle");
    const [showDraftsOnly, setShowDraftsOnly] = useState(false);
    
    const [showBulkSyncConfirm, setShowBulkSyncConfirm] = useState(false);

    const [modal, setModal] = useState({ isOpen: false, title: "", message: "", progress: null, onConfirm: null, actions: null });

    const openInfoModal = useCallback((title, message) => {
        setModal({
            isOpen: true,
            title,
            message,
            actions: [{ label: "OK", variant: "primary", onClick: () => setModal(prev => ({ ...prev, isOpen: false })) }]
        });
    }, []);

    const findDuplicateChurch = useCallback((name, city, excludeId = null) => {
        const normalizedName = normalizeText(safeStr(name).trim());
        const normalizedCity = normalizeText(safeStr(city).trim());
        if (!normalizedName || !normalizedCity) return null;
        return items.find(item => (excludeId && item.id === excludeId) ? false : (normalizeText(safeStr(item.name).trim()) === normalizedName && normalizeText(safeStr(item.city).trim()) === normalizedCity)) || null;
    }, [items]);

    const sortedItems = useMemo(() => {
        let arr = [...items];
        if (showDraftsOnly) arr = arr.filter(it => it.isDraft === true);
        if (selectedCountry) arr = arr.filter(it => safeStr(it.country).toLowerCase() === selectedCountry.toLowerCase());
        if (selectedCity) arr = arr.filter(it => safeStr(it.city).toLowerCase() === selectedCity.toLowerCase());
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            arr = arr.filter(it => matchChurchSearch(it, q));
        }
        // 1. Drafts first, then alphabetical by name
        arr.sort((a, b) => {
            if (a.isDraft !== b.isDraft) {
                return a.isDraft ? -1 : 1;
            }
            return safeStr(a.name).localeCompare(safeStr(b.name));
        });
        return arr;
    }, [items, searchQuery, selectedCountry, selectedCity, showDraftsOnly]);

    const draftCount = useMemo(() => items.filter(it => it.isDraft === true).length, [items]);

    const { page, setPage, totalPages, paginatedItems, nextPage, prevPage, totalItems } = usePagination(sortedItems, PAGE_SIZE);

    const uniqueCountries = useMemo(() => {
        const set = new Set(items.map(it => safeStr(it.country).trim()).filter(Boolean));
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [items]);

    const uniqueCities = useMemo(() => {
        let relevant = items;
        if (selectedCountry) relevant = items.filter(it => safeStr(it.country).toLowerCase() === selectedCountry.toLowerCase());
        const set = new Set(relevant.map(it => safeStr(it.city).trim()).filter(Boolean));
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [items, selectedCountry]);

    // Report aggregate dirty state to parent
    useEffect(() => {
        if (!onDirtyChange) return;

        const anyExpandedDirty = Array.from(expandedIds).some(id => {
            const item = items.find(it => it.id === id);
            const draft = draftsById[id];
            return item && draft && hasDraftChanges(item, draft);
        });

        // "New" form is always considered dirty if open
        onDirtyChange(showNew || anyExpandedDirty);
    }, [showNew, expandedIds, draftsById, items, onDirtyChange]);

    const setTransientState = (id, value = "saved") => {
        setSaveStateById(m => ({ ...m, [id]: value }));
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            if (!mountedRef.current) return;
            setSaveStateById(m => ({ ...m, [id]: "idle" }));
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
        const unsub = onSnapshot(collection(db, "churches"), (snap) => {
            if (!mountedRef.current) return;
            const list = snap.docs.map(d => {
                const data = d.data() || {};
                let createdAtMs = 0;
                if (data.createdAt) {
                    try {
                        const dObj = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
                        createdAtMs = dObj.getTime();
                    } catch (e) { }
                }
                return { id: d.id, ...data, createdAtMs };
            });
            setItems(list);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const toggleExpand = useCallback((id) => {
        toggleExpandWithConfirm({
            id,
            items,
            draftsById,
            isDirtyFn: (item, draft) => hasDraftChanges(item, draft),
            setModal,
            setExpandedIds,
            setDraftsById
        });
    }, [items, draftsById]);

    const startNew = () => { setShowNew(true); setNewDrafts(emptyChurch()); setNewState("idle"); };
    const cancelNew = () => { setShowNew(false); setNewState("idle"); };
    const setNewField = (key, value) => {
        setNewDrafts(prev => {
            let next = { ...prev, [key]: value };
            if (key === "name" || key === "city") {
                const oldAutoTitle = `Biserica penticostală ${prev.name || ""} ${prev.city || ""}`.trim();
                const currentTitle = (prev.locationTitle || "").trim();
                // If title was empty or matched the previous auto-generated formula, update it
                if (!currentTitle || currentTitle === oldAutoTitle) {
                    next.locationTitle = `Biserica penticostală ${next.name || ""} ${next.city || ""}`.trim();
                }
            }
            return next;
        });
    };

    const saveNew = async (forcedDraftStatus = null) => {
        let isDraftValue = forcedDraftStatus !== null ? forcedDraftStatus : (newDrafts.isDraft || false);
        if (!newDrafts.name.trim() || !newDrafts.city.trim()) { openInfoModal("Action Required", "The Church Name and City fields are required."); return; }
        if (findDuplicateChurch(newDrafts.name, newDrafts.city)) { openInfoModal("Duplicate Church", "A church already exists with this name and city."); return; }

        let lat = Number(newDrafts.lat);
        let lng = Number(newDrafts.lng);
        let place_id = newDrafts.place_id || "";

        if (!lat || !lng) {
            setNewState("saving");
            const geo = await geocodeAddress(newDrafts);
            if (geo) {
                lat = geo.lat;
                lng = geo.lng;
                place_id = geo.place_id;
            } else {
                lat = lat || 0;
                lng = lng || 0;
            }
        }

        try {
            const finalData = { ...newDrafts, lat, lng, place_id, isDraft: isDraftValue, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
            await setDoc(doc(collection(db, "churches")), finalData);
            setNewDrafts(finalData); // Update local state for immediate reflected UI
            setNewState("saved");
            setTimeout(() => { setShowNew(false); setNewState("idle"); }, 900);
        } catch (e) { setNewState("error"); }
    };

    const changeDraft = (id, key, value) => {
        setDraftsById(prev => {
            const current = prev[id] || items.find(i => i.id === id) || emptyChurch();
            let next = { ...current, [key]: value };

            if (key === "name" || key === "city") {
                const oldAutoTitle = `Biserica penticostală ${current.name || ""} ${current.city || ""}`.trim();
                const currentTitle = (current.locationTitle || "").trim();
                // If title was empty or matched the previous auto-generated formula, update it
                if (!currentTitle || currentTitle === oldAutoTitle) {
                    next.locationTitle = `Biserica penticostală ${next.name || ""} ${next.city || ""}`.trim();
                }
            }
            return { ...prev, [id]: next };
        });
    };

    const saveOne = async (id, forcedDraftStatus = null) => {
        const item = items.find(i => i.id === id);
        const draft = draftsById[id] || item;
        if (!draft) return;
        
        let isDraftValue = forcedDraftStatus !== null ? forcedDraftStatus : (draft.isDraft || false);
        let finalDraft = { ...draft };
        const addressChanged = 
            safeStr(item.street) !== safeStr(draft.street) ||
            safeStr(item.number) !== safeStr(draft.number) ||
            safeStr(item.city) !== safeStr(draft.city) ||
            safeStr(item.country) !== safeStr(draft.country);

        const infoChanged = 
            addressChanged ||
            safeStr(item.name) !== safeStr(draft.name) ||
            safeStr(item.locationTitle) !== safeStr(draft.locationTitle);

        setTransientState(id, "saving");

        if (infoChanged || !draft.lat || !draft.lng) {
            const geo = await geocodeAddress(draft);
            if (geo) {
                finalDraft = { ...finalDraft, lat: geo.lat, lng: geo.lng, place_id: geo.place_id };
            }
        }

        try {
            const finalData = { 
                ...finalDraft, 
                isDraft: isDraftValue, 
                updatedAt: serverTimestamp() 
            };
            await updateDoc(doc(db, "churches", id), finalData);
            setDraftsById(prev => ({ ...prev, [id]: finalData })); // Update local state for immediate reflected UI
            setTransientState(id, "saved");
            
            setTimeout(() => {
                setExpandedIds(prev => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                });
            }, 800);
        } catch (e) { setTransientState(id, "error"); }
    };

    const deleteOne = async id => {
        setModal({
            isOpen: true,
            title: "Delete Church",
            message: "Are you sure?",
            onConfirm: async () => {
                try { await deleteDoc(doc(db, "churches", id)); setModal({ isOpen: false }); } catch (e) { }
            }
        });
    };

    const handleBulkSync = null; // Bulk sync removed

    return (
        <div className="adminFullPage">
            <div className="adminFullTop">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        <h2 className="adminTitle">Churches</h2>
                        <span className="adminCountText">{totalItems} churches</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>Drafts</span>
                        <label className="adminSwitch"><input type="checkbox" checked={showDraftsOnly} onChange={e => setShowDraftsOnly(e.target.checked)} /><span className="adminSlider" /></label>
                    </div>
                </div>

                <div className="adminActions adminActions--churches">
                    <select className="adminSelect" style={{ width: 220 }} value={selectedCountry} onChange={e => { setSelectedCountry(e.target.value); setSelectedCity(""); setPage(1); }}>
                        <option value="">All Countries</option>
                        {uniqueCountries.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select className="adminSelect" style={{ width: 220 }} value={selectedCity} onChange={e => { setSelectedCity(e.target.value); setPage(1); }} disabled={!uniqueCities.length}>
                        <option value="">All Cities</option>
                        {uniqueCities.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button className="adminBtn adminBtn--new" onClick={startNew}><IconPlus />New</button>
                </div>
                <AdminSearch value={searchQuery} onChange={setSearchQuery} />
            </div>

            <div className="adminFullContent">
                {showNew && <NewChurchCard drafts={newDrafts} setDraft={setNewField} saveState={newState} onCancel={cancelNew} onSave={saveNew} />}
                <div className="adminFullList">
                    {paginatedItems.map(it => <ChurchCard key={it.id} item={it} expanded={expandedIds.has(it.id)} drafts={draftsById[it.id] || it} saveState={saveStateById[it.id] || "idle"} onToggle={toggleExpand} onChange={changeDraft} onSave={saveOne} onDelete={deleteOne} />)}
                </div>
                <PaginationControls page={page} totalPages={totalPages} onNext={nextPage} onPrev={prevPage} onPageSet={setPage} />
            </div>

            <ConfirmModal
                isOpen={modal.isOpen}
                title={modal.title}
                message={modal.message}
                progress={modal.progress}
                status={""}
                actions={modal.actions}
                onConfirm={modal.onConfirm}
                onCancel={() => setModal(m => ({ ...m, isOpen: false }))}
            />

        </div>
    );
}
