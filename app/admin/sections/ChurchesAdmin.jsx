"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { collection, addDoc, setDoc, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../../lib/Firebase";
import { usePagination } from "../hooks/usePagination";
import PaginationControls from "../components/PaginationControls";
import ConfirmModal from "../components/ConfirmModal";
import AdminSearch from "../components/AdminSearch";
import ChurchFormFields from "../components/ChurchFormFields";
import { PhotoLightbox } from "../components/SyncDiffLabel";
import { IconPlus, IconTrash, IconChevronDown, IconSave, IconEyeOff, IconEye, IconSync } from "../components/ChurchIcons";
import { safeStr, normalizeText, matchChurchSearch, hasDraftChanges, emptyChurch, COUNTRY_OPTIONS, geocodeAddress, fetchGooglePlaceData, uploadPhotosIfNeeded } from "../utils/churchHelpers";

const PAGE_SIZE = 10;

function ChurchCard({ item, expanded, drafts, saveState, errorText, onToggle, onChange, onSave, onDelete, setSaveStateById, setErrorById, onPhotoClick }) {
    const id = item.id;
    const isDraft = drafts.isDraft || false;
    const [syncedFields, setSyncedFields] = useState({});
    const [isSyncing, setIsSyncing] = useState(false);
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

    const handleSync = async () => {
        setIsSyncing(true);
        setSyncSuccess(false);
        try {
            const query = drafts.locationTitle || drafts.name;
            const data = await fetchGooglePlaceData(query, drafts.city, drafts.country, drafts.place_id);
            
            if (data) {
                const newSyncMap = {};
                Object.entries(data).forEach(([k, v]) => {
                    if (v !== undefined && v !== null) {
                        const currentVal = drafts[k];
                        if (String(currentVal || "") !== String(v || "")) {
                            newSyncMap[k] = { old: String(currentVal || "") };
                        }
                        onChange(id, k, v);
                    }
                });
                setSyncedFields(newSyncMap);
                setSyncSuccess(true);
                setTimeout(() => setSyncSuccess(false), 3000);
            }
        } finally {
            setIsSyncing(false);
        }
    };

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
                <div className="adminAnnBody">
                    {errorText ? <div className="adminAlert">{errorText}</div> : null}

                    {item.createdByInfo ? (
                        <div style={{ color: "rgba(10, 42, 67, 0.6)", fontWeight: 500, fontSize: 13, marginBottom: 4 }}>
                            Created by {item.createdByInfo.name} on {item.createdByInfo.date}
                        </div>
                    ) : item.createdAt ? (
                        <div style={{ color: "rgba(10, 42, 67, 0.6)", fontWeight: 500, fontSize: 13, marginBottom: 4 }}>
                            Created by Popadiuc Claudiu on {item.createdAt}
                        </div>
                    ) : null}

                    <ChurchFormFields
                        drafts={drafts}
                        onChange={handleFieldChange}
                        syncedFields={syncedFields}
                        onRestore={handleRestore}
                        getHighlightClass={getHighlightClass}
                        onSync={handleSync}
                        isSyncing={isSyncing}
                        syncSuccess={syncSuccess}
                        onPhotoClick={onPhotoClick}
                        showGoogleEnrichment={true}
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
                            onClick={(e) => { e.stopPropagation(); onSave(id, !drafts.isDraft); }}
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

function NewChurchCard({ drafts, setDraft, errorText, saveState, onCancel, onSave, onPhotoClick }) {
    const [syncedFields, setSyncedFields] = useState({});
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncSuccess, setSyncSuccess] = useState(false);

    useEffect(() => {
        if (saveState === "saved") {
            setSyncedFields({});
        }
    }, [saveState]);

    const handleFieldChange = (field, value) => {
        setDraft(field, value);
    };

    const handleRestore = (field, value) => {
        setDraft(field, value);
        setSyncedFields(prev => {
            const next = { ...prev };
            delete next[field];
            return next;
        });
    };

    const getHighlightClass = (field) => syncedFields[field] ? "is-synced-highlight" : "";

    const handleSync = async () => {
        setIsSyncing(true);
        setSyncSuccess(false);
        try {
            const data = await fetchGooglePlaceData(drafts.locationTitle || drafts.name, drafts.city, drafts.country, drafts.place_id);
            if (data) {
                const newSyncMap = {};
                Object.entries(data).forEach(([k, v]) => {
                    if (v !== undefined) {
                        if (String(drafts[k] || "") !== String(v || "")) {
                            newSyncMap[k] = { old: String(drafts[k] || "") };
                        }
                        setDraft(k, v);
                    }
                });
                setSyncedFields(newSyncMap);
                setSyncSuccess(true);
                setTimeout(() => setSyncSuccess(false), 3000);
            }
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="adminAnnCard is-active">
            <div className="adminAnnHeader">
                <div className="adminAnnIdChip">New Church</div>
            </div>

            <div className="adminAnnBody">
                {errorText ? <div className="adminAlert">{errorText}</div> : null}

                <ChurchFormFields
                    drafts={drafts}
                    onChange={handleFieldChange}
                    syncedFields={syncedFields}
                    onRestore={handleRestore}
                    getHighlightClass={getHighlightClass}
                    onSync={handleSync}
                    isSyncing={isSyncing}
                    syncSuccess={syncSuccess}
                    onPhotoClick={onPhotoClick}
                    showGoogleEnrichment={true}
                />

                <div className="adminMsgActions adminMsgActions--3" style={{ marginTop: "20px" }}>
                    <button type="button" className="adminDeleteBtn" onClick={onCancel} disabled={saveState === "saving"}>
                        Cancel
                    </button>

                    <button type="button" className="adminDraftBtn" onClick={() => onSave(true)} disabled={saveState === "saving"}>
                        <IconEyeOff />
                        Draft
                    </button>

                    <button type="button" className="adminMsgSaveBtn" onClick={() => onSave()} disabled={saveState === "saving"}>
                        <IconSave />
                        {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : "Save"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function ChurchesAdmin() {
    const mountedRef = useRef(true);
    const timeoutRef = useRef(null);

    const [loading, setLoading] = useState(true);
    const [globalError, setGlobalError] = useState("");

    const [items, setItems] = useState([]);
    const [draftsById, setDraftsById] = useState({});
    const [saveStateById, setSaveStateById] = useState({});
    const [errorById, setErrorById] = useState({});
    const [expandedIds, setExpandedIds] = useState(() => new Set());
    const [sortBy, setSortBy] = useState("az");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCountry, setSelectedCountry] = useState("");
    const [selectedCity, setSelectedCity] = useState("");

    const [showNew, setShowNew] = useState(false);
    const [newDrafts, setNewDrafts] = useState(emptyChurch());
    const [newError, setNewError] = useState("");
    const [newState, setNewState] = useState("idle");
    const [showDraftsOnly, setShowDraftsOnly] = useState(false);
    
    // Bulk Sync State
    const [isBulkSyncing, setIsBulkSyncing] = useState(false);
    const [bulkSyncProgress, setBulkSyncProgress] = useState({ current: 0, total: 0, suggestionsCreated: 0, churchName: "" });
    const [showBulkSyncConfirm, setShowBulkSyncConfirm] = useState(false);

    const [modal, setModal] = useState({ isOpen: false, title: "", message: "", onConfirm: () => { } });
    const [lightboxUrl, setLightboxUrl] = useState(null);

    const sortedItems = useMemo(() => {
        let arr = [...items];

        if (showDraftsOnly) {
            arr = arr.filter(it => it.isDraft === true);
        }

        if (selectedCountry) {
            arr = arr.filter(it => safeStr(it.country).toLowerCase() === selectedCountry.toLowerCase());
        }
        if (selectedCity) {
            arr = arr.filter(it => safeStr(it.city).toLowerCase() === selectedCity.toLowerCase());
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            arr = arr.filter(it => matchChurchSearch(it, q));
        }
        arr.sort((a, b) => {
            if (sortBy === "az") return a.name.localeCompare(b.name);
            if (sortBy === "za") return b.name.localeCompare(a.name);
            if (sortBy === "date-desc") return (b.createdAtMs || 0) - (a.createdAtMs || 0);
            if (sortBy === "date-asc") return (a.createdAtMs || 0) - (b.createdAtMs || 0);
            return 0;
        });
        return arr;
    }, [items, sortBy, searchQuery, selectedCountry, selectedCity, showDraftsOnly]);

    const draftCount = useMemo(() => items.filter(it => it.isDraft === true).length, [items]);

    const { page, setPage, totalPages, paginatedItems, nextPage, prevPage, totalItems } = usePagination(sortedItems, PAGE_SIZE);

    const uniqueCountries = useMemo(() => {
        const set = new Set(items.map(it => safeStr(it.country).trim()).filter(Boolean));
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [items]);

    const uniqueCities = useMemo(() => {
        let relevant = items;
        if (selectedCountry) {
            relevant = items.filter(it => safeStr(it.country).toLowerCase() === selectedCountry.toLowerCase());
        }
        const set = new Set(relevant.map(it => safeStr(it.city).trim()).filter(Boolean));
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [items, selectedCountry]);

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

    // Load churches from Firestore
    useEffect(() => {
        setLoading(true);
        setGlobalError("");

        const unsub = onSnapshot(
            collection(db, "churches"),
            (snap) => {
                if (!mountedRef.current) return;
                const list = snap.docs.map((d) => {
                    const data = d.data() || {};
                    let createdAtMs = 0;
                    let createdAtText = "";
                    if (data.createdAt) {
                        try {
                            const dObj = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
                            createdAtText = dObj.toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' });
                            createdAtMs = dObj.getTime();
                        } catch (e) { }
                    }

                    const formatAttribution = (attr) => {
                        if (!attr || !attr.name) return null;
                        let dateText = "";
                        if (attr.at) {
                            try {
                                const dObj = attr.at.toDate ? attr.at.toDate() : new Date(attr.at);
                                dateText = dObj.toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' });
                            } catch (e) { }
                        }
                        return { name: attr.name, date: dateText };
                    };

                    return { 
                        ...data, 
                        id: d.id, 
                        createdAtMs, 
                        createdAt: createdAtText,
                        createdByInfo: formatAttribution(data.createdBy)
                    };
                });

                setItems(list);
                setDraftsById((prev) => {
                    const next = { ...prev };
                    const alive = new Set(list.map((x) => x.id));
                    Object.keys(next).forEach((k) => { if (!alive.has(k)) delete next[k]; });
                    list.forEach((it) => {
                        if (!next[it.id]) {
                            next[it.id] = { ...it };
                        }
                    });
                    return next;
                });
                setLoading(false);
            },
            (err) => {
                console.error(err);
                if (!mountedRef.current) return;
                setLoading(false);
                setGlobalError("Could not load churches.");
            }
        );

        return () => unsub();
    }, []);

    const toggleExpand = useCallback((id) => {
        const key = safeStr(id).trim();
        if (!key) return;

        setExpandedIds((prev) => {
            const next = new Set(prev);
            const isClosing = next.has(key);

            if (isClosing) {
                const item = items.find(i => i.id === key);
                const draft = draftsById[key];
                if (hasDraftChanges(item, draft)) {
                    setModal({
                        isOpen: true,
                        title: "Unsaved Changes",
                        message: "Are you sure you want to cancel all changes?",
                        onConfirm: () => {
                            setModal({ isOpen: false });
                            if (item) setDraftsById(d => ({ ...d, [key]: { ...item } }));
                            setExpandedIds(curr => {
                                const n = new Set(curr);
                                n.delete(key);
                                return n;
                            });
                        }
                    });
                    return prev;
                }
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    }, [items, draftsById]);

    // --- NEW ---
    const startNew = () => {
        setShowNew(true);
        setNewDrafts(emptyChurch());
        setNewError("");
        setNewState("idle");
    };

    const cancelNew = () => {
        setShowNew(false);
        setNewError("");
        setNewState("idle");
    };

    const setNewField = (key, value) => {
        setNewDrafts((prev) => ({ ...prev, [key]: value }));
        if (newError) setNewError("");
    };

    const saveNew = async (forcedDraftStatus = null) => {
        let isDraftValue = forcedDraftStatus !== null ? forcedDraftStatus : (newDrafts.isDraft || false);
        
        if (!newDrafts.name.trim() || !newDrafts.city.trim()) {
            setNewError("The Church Name and City fields are required.");
            return;
        }
        setNewError("");
        setNewState("saving");

        let lat = parseFloat(newDrafts.lat);
        let lng = parseFloat(newDrafts.lng);

        if (isNaN(lat) || isNaN(lng)) {
            const coords = await geocodeAddress(newDrafts.street, newDrafts.number, newDrafts.city, newDrafts.zipCode, newDrafts.country, newDrafts.locationTitle);
            if (coords) {
                lat = coords.lat;
                lng = coords.lng;
                setNewDrafts((prev) => ({ ...prev, lat, lng }));
            } else {
                setNewState("error");
                setNewError("Could not automatically find coordinates. Please enter Latitude and Longitude manually.");
                return;
            }
        }

        try {
            const newDocRef = doc(collection(db, "churches"));
            const finalPhotos = await uploadPhotosIfNeeded(newDrafts.photos, newDocRef.id);

            await setDoc(newDocRef, {
                name: newDrafts.name.trim(),
                locationTitle: (newDrafts.locationTitle || "").trim(),
                street: (newDrafts.street || "").trim(),
                number: (newDrafts.number || "").trim(),
                city: (newDrafts.city || "").trim(),
                country: (newDrafts.country || "").trim(),
                zipCode: (newDrafts.zipCode || "").trim(),
                lat, lng,
                phone: newDrafts.phone.trim(),
                email: newDrafts.email.trim(),
                website: newDrafts.website.trim(),
                youtube: newDrafts.youtube.trim(),
                facebook: (newDrafts.facebook || "").trim(),
                instagram: (newDrafts.instagram || "").trim(),
                place_id: newDrafts.place_id || "",
                openingHours: newDrafts.openingHours || [],
                photos: finalPhotos,
                googleMapsUri: newDrafts.googleMapsUri || "",
                rating: newDrafts.rating || null,
                isDraft: isDraftValue,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                createdBy: { name: "Popadiuc Claudiu", at: serverTimestamp() }
            });

            if (!mountedRef.current) return;
            if (forcedDraftStatus !== null) {
                setNewDrafts((prev) => ({ ...prev, isDraft: isDraftValue }));
            }
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
            setNewError("Could not save church.");
        }
    };

    // --- EDIT ---
    const changeDraft = (id, key, value) => {
        setDraftsById((prev) => ({
            ...prev,
            [id]: { ...prev[id], [key]: value }
        }));
        setErrorById((m) => ({ ...m, [id]: "" }));
    };

    const saveOne = async (id, forcedDraftStatus = null) => {
        let draft = draftsById[id];
        if (!draft) return;

        let isDraftValue = forcedDraftStatus !== null ? forcedDraftStatus : (draft.isDraft || false);

        if (!draft.name?.trim() || !draft.city?.trim()) {
            setErrorById((m) => ({ ...m, [id]: "The Church Name and City fields are required." }));
            return;
        }

        setErrorById((m) => ({ ...m, [id]: "" }));
        setSaveStateById((m) => ({ ...m, [id]: "saving" }));

        let lat = parseFloat(draft.lat);
        let lng = parseFloat(draft.lng);

        const original = items.find(i => i.id === id);
        const addressChanged = original && (
            original.street !== draft.street ||
            original.number !== draft.number ||
            original.city !== draft.city ||
            original.country !== draft.country ||
            original.zipCode !== draft.zipCode ||
            original.locationTitle !== draft.locationTitle
        );

        if (isNaN(lat) || isNaN(lng) || addressChanged) {
            const coords = await geocodeAddress(draft.street, draft.number, draft.city, draft.zipCode, draft.country, draft.locationTitle);
            if (coords) {
                lat = coords.lat;
                lng = coords.lng;
                changeDraft(id, "lat", lat);
                changeDraft(id, "lng", lng);
            } else if (isNaN(lat) || isNaN(lng)) {
                setSaveStateById((m) => ({ ...m, [id]: "error" }));
                setErrorById((m) => ({ ...m, [id]: "Could not automatically find coordinates. Please enter Lat/Lng manually." }));
                return;
            }
        }

        try {
            const finalPhotos = await uploadPhotosIfNeeded(draft.photos, id);

            const finalData = {
                name: draft.name.trim(),
                locationTitle: (draft.locationTitle || "").trim(),
                street: (draft.street || "").trim(),
                number: (draft.number || "").trim(),
                city: (draft.city || "").trim(),
                country: (draft.country || "").trim(),
                zipCode: (draft.zipCode || "").trim(),
                lat, lng,
                phone: (draft.phone || "").trim(),
                email: (draft.email || "").trim(),
                website: (draft.website || "").trim(),
                youtube: (draft.youtube || "").trim(),
                facebook: (draft.facebook || "").trim(),
                instagram: (draft.instagram || "").trim(),
                place_id: draft.place_id || "",
                openingHours: draft.openingHours || [],
                photos: finalPhotos,
                googleMapsUri: draft.googleMapsUri || "",
                rating: draft.rating || null,
                isDraft: isDraftValue
            };

            await updateDoc(doc(db, "churches", id), { ...finalData, updatedAt: serverTimestamp() });

            if (!mountedRef.current) return;
            
            setDraftsById((prev) => ({
                ...prev,
                [id]: { ...prev[id], ...finalData }
            }));
            
            setTransientState(id, "saved");
        } catch (err) {
            console.error(err);
            if (!mountedRef.current) return;
            setSaveStateById((m) => ({ ...m, [id]: "error" }));
            setErrorById((m) => ({ ...m, [id]: "Could not save." }));
        }
    };

    const handleBulkSync = async () => {
        const targetChurches = items;
        if (targetChurches.length === 0) {
            setGlobalError("No churches to sync.");
            return;
        }

        setIsBulkSyncing(true);
        setBulkSyncProgress({ current: 0, total: targetChurches.length, suggestionsCreated: 0, churchName: "" });

        let suggestionsCreatedCount = 0;

        for (let i = 0; i < targetChurches.length; i++) {
            if (!mountedRef.current || !isBulkSyncing) {
                if (isBulkSyncing) break;
            }
            
            const church = targetChurches[i];
            setBulkSyncProgress(prev => ({ ...prev, current: i + 1, churchName: church.name }));

            try {
                const query = church.locationTitle || church.name;
                const googleData = await fetchGooglePlaceData(query, church.city, church.country, church.place_id);

                if (googleData) {
                    const fieldsToSync = ["phone", "email", "website", "youtube", "facebook", "instagram", "name", "place_id"];
                    const hasChanges = fieldsToSync.some(f => {
                        const newVal = googleData[f];
                        // Ignore if Google returned nothing — that's not a real change
                        if (newVal === undefined || newVal === null || String(newVal).trim() === "") return false;
                        return String(church[f] || "").trim() !== String(newVal).trim();
                    }) || (
                        // Only count hours as changed if Google returned non-empty hours
                        (googleData.openingHours?.length > 0) &&
                        JSON.stringify(church.openingHours || []) !== JSON.stringify(googleData.openingHours)
                    );

                    if (hasChanges) {
                        await addDoc(collection(db, "church_suggestions"), {
                            type: "edit",
                            status: "pending",
                            source: "auto_sync",
                            originalChurchId: church.id,
                            data: {
                                ...googleData,
                                ...Object.fromEntries(Object.entries(church).filter(([k]) => !fieldsToSync.includes(k) && k !== "openingHours" && k !== "photos" && k !== "id"))
                            },
                            createdAt: serverTimestamp(),
                            submitter: { name: "System Sync", at: serverTimestamp() }
                        });
                        suggestionsCreatedCount++;
                        setBulkSyncProgress(prev => ({ ...prev, suggestionsCreated: suggestionsCreatedCount }));
                    }
                }
            } catch (err) {
                console.error(`Sync failed for ${church.name}:`, err);
            }

            await new Promise(r => setTimeout(r, 400));
        }

        setIsBulkSyncing(false);
        setModal({
            isOpen: true,
            title: "Sync Complete",
            message: `The bulk synchronization is finished. ${suggestionsCreatedCount} new suggestions were created/updated.`,
            onConfirm: () => setModal(m => ({ ...m, isOpen: false }))
        });
    };

    // --- DELETE ---
    const deleteOne = async (id) => {
        const item = items.find((i) => i.id === id);
        setModal({
            isOpen: true,
            title: "Delete Church",
            message: `Are you sure you want to delete "${item?.name || id}"?`,
            onConfirm: async () => {
                setModal({ isOpen: false });
                setSaveStateById((m) => ({ ...m, [id]: "saving" }));
                try {
                    await deleteDoc(doc(db, "churches", id));
                    if (!mountedRef.current) return;
                    setDraftsById((prev) => { const next = { ...prev }; delete next[id]; return next; });
                    setExpandedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
                    setSaveStateById((prev) => { const next = { ...prev }; delete next[id]; return next; });
                    setErrorById((prev) => { const next = { ...prev }; delete next[id]; return next; });
                } catch (err) {
                    console.error(err);
                    if (!mountedRef.current) return;
                    setSaveStateById((m) => ({ ...m, [id]: "error" }));
                    setErrorById((m) => ({ ...m, [id]: "Could not delete." }));
                }
            }
        });
    };

    return (
        <div className="adminFullPage">
            <div className="adminFullTop">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        <h2 className="adminTitle" style={{ margin: 0, lineHeight: 1 }}>Churches</h2>
                        <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "rgba(10, 42, 67, 0.6)", fontWeight: 600 }}>
                            <span className="adminCountDot" aria-hidden="true" style={{ width: 6, height: 6, opacity: 0.3 }} />
                            {showDraftsOnly ? (
                                <>{draftCount} draft{draftCount === 1 ? "" : "s"}</>
                            ) : (
                                <>{totalItems} church{totalItems === 1 ? "" : "es"}</>
                            )}
                        </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#475569" }}>Drafts</span>
                        <label className="adminSwitch">
                            <input 
                                type="checkbox" 
                                checked={showDraftsOnly} 
                                onChange={(e) => setShowDraftsOnly(e.target.checked)}
                            />
                            <span className="adminSlider" />
                        </label>
                    </div>
                </div>

                <div className="adminActions" style={{ flexWrap: "wrap", justifyContent: "flex-end", gap: "12px" }}>
                    <select
                        className="adminSelect"
                        value={selectedCountry}
                        onChange={(e) => {
                            setSelectedCountry(e.target.value);
                            setSelectedCity("");
                            setPage(1);
                        }}
                        aria-label="Filter by country"
                    >
                        <option value="">All Countries</option>
                        {uniqueCountries.map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>

                    <select
                        className="adminSelect"
                        value={selectedCity}
                        onChange={(e) => {
                            setSelectedCity(e.target.value);
                            setPage(1);
                        }}
                        aria-label="Filter by city"
                        disabled={!uniqueCities.length}
                    >
                        <option value="">All Cities</option>
                        {uniqueCities.map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>

                    <select
                        className="adminSelect"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        aria-label="Sort churches"
                    >
                        <option value="date-desc">Newest first</option>
                        <option value="date-asc">Oldest first</option>
                        <option value="az">Alphabetical</option>
                    </select>

                    <button className="adminBtn adminBtn--new" type="button" onClick={() => setShowBulkSyncConfirm(true)} disabled={loading || isBulkSyncing}>
                        <span className="adminBtnIcon" aria-hidden="true"><IconSync /></span>
                        Sync All
                    </button>

                    <button className="adminBtn adminBtn--new" type="button" onClick={startNew} disabled={loading || showNew}>
                        <span className="adminBtnIcon" aria-hidden="true"><IconPlus /></span>
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

            {
                !loading ? (
                    <div className="adminFullContent">
                        {globalError ? <div className="adminAlert">{globalError}</div> : null}

                        {showNew ? (
                            <div>
                                <NewChurchCard
                                    drafts={newDrafts}
                                    setDraft={setNewField}
                                    errorText={newError}
                                    saveState={newState}
                                    onCancel={cancelNew}
                                    onSave={saveNew}
                                    onPhotoClick={setLightboxUrl}
                                />
                            </div>
                        ) : null}

                        <div className="adminFullList">
                            {paginatedItems.map((it) => (
                                <ChurchCard
                                    key={it.id}
                                    item={it}
                                    expanded={expandedIds.has(it.id)}
                                    drafts={draftsById[it.id] || it}
                                    saveState={saveStateById[it.id] || "idle"}
                                    errorText={errorById[it.id] || ""}
                                    onToggle={toggleExpand}
                                    onChange={changeDraft}
                                    onSave={saveOne}
                                    onDelete={deleteOne}
                                    setSaveStateById={setSaveStateById}
                                    setErrorById={setErrorById}
                                    onPhotoClick={setLightboxUrl}
                                />
                            ))}

                            {!items.length && !showNew ? <div className="adminEmpty">No churches yet. Click "New" to add one.</div> : null}
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
                            onConfirm={modal.onConfirm}
                            onCancel={() => setModal({ ...modal, isOpen: false })}
                        />

                        <PhotoLightbox 
                            url={lightboxUrl} 
                            onClose={() => setLightboxUrl(null)} 
                        />
                    </div>
                ) : null
            }

            {showBulkSyncConfirm && (
                <ConfirmModal
                    isOpen={true}
                    title="Bulk Synchronization with Google"
                    message={`This will check ALL churches in your database. 
                    - For churches already identified, it updates the info.
                    - For others, it will SEARCH on Google to find their Place ID and info.
                    
                    Any differences found will be added as "Suggestions".
                    
                    Estimated cost: $${(items.reduce((acc, c) => acc + (c.place_id ? 0.02 : 0.04), 0)).toFixed(2)}. Proceed?`}
                    onConfirm={() => { setShowBulkSyncConfirm(false); handleBulkSync(); }}
                    onCancel={() => setShowBulkSyncConfirm(false)}
                />
            )}

            {isBulkSyncing && (
                <div className="adminModalOverlay" style={{ zIndex: 3000 }}>
                    <div className="adminModal adminBulkSyncModal">
                        <div className="adminBulkSyncHeader">
                            <h3>Synchronisation en cours...</h3>
                            <span>{bulkSyncProgress.current} / {bulkSyncProgress.total}</span>
                        </div>
                        
                        <div className="adminBulkSyncProgressBar">
                            <div 
                                className="adminBulkSyncProgressFill" 
                                style={{ width: `${(bulkSyncProgress.current / bulkSyncProgress.total) * 100}%` }}
                            />
                        </div>

                        <div className="adminBulkSyncCurrentInfo">
                            <p>Analyse de : <strong>{bulkSyncProgress.churchName || "..."}</strong></p>
                            <p>Suggestions créées : <span className="adminBulkSyncCount">{bulkSyncProgress.suggestionsCreated}</span></p>
                        </div>
                        
                        <div className="adminBulkSyncWarning">
                            Ne fermez pas cette fenêtre pendant le processus.
                        </div>

                        <div className="adminModalActions" style={{ marginTop: 24, justifyContent: "center" }}>
                            <button className="adminDeleteBtn" onClick={() => setIsBulkSyncing(false)}>
                                Arrêter la synchronisation
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
