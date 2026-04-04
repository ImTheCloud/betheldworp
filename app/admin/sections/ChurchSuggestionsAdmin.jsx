"use client";

import React, { useEffect, useState, useCallback } from "react";
import { collection, doc, onSnapshot, updateDoc, setDoc, serverTimestamp, deleteDoc, addDoc } from "firebase/firestore";
import { db } from "../../lib/Firebase";
import ConfirmModal from "../components/ConfirmModal";
import ChurchFormFields from "../components/ChurchFormFields";
import { IconCheck, IconX, IconChevronDown, IconEyeOff, IconHistory, IconTrash } from "../components/ChurchIcons";
import SearchableSelect from "../../components/SearchableSelect";
import { geocodeAddress, fetchGooglePlaceData, PENTECOSTAL_NAMES, shuffleArray, normalizeText, emptyChurch, COUNTRY_OPTIONS } from "../utils/churchHelpers";
import { syncChurchBot } from "../services/churchSyncBot";

export default function ChurchSuggestionsAdmin() {
    const [suggestions, setSuggestions] = useState([]);
    const [processedSuggestions, setProcessedSuggestions] = useState([]);
    const [churchesById, setChurchesById] = useState({});
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);
    const [expandedIds, setExpandedIds] = useState(new Set());
    const [draftsById, setDraftsById] = useState({});
    const [syncedFieldsById, setSyncedFieldsById] = useState({});
    const [syncingById, setSyncingById] = useState({});
    const [syncSuccessById, setSyncSuccessById] = useState({});
    const [modal, setModal] = useState({ isOpen: false, title: "", message: "", onConfirm: () => {} });
    const [showHistory, setShowHistory] = useState(false);
    const [diffRecomputeTrigger, setDiffRecomputeTrigger] = useState(0);
    const [discoverCountry, setDiscoverCountry] = useState("");
    const [isDiscovering5, setIsDiscovering5] = useState(false);
    const [discover5Count, setDiscover5Count] = useState(0);
    const [discover5Status, setDiscover5Status] = useState("");
    const [isDiscoveryToolOpen, setIsDiscoveryToolOpen] = useState(false);
    const [discoveryTargetCount, setDiscoveryTargetCount] = useState(5);

    const FIELDS_TO_COMPARE = ["name", "locationTitle", "city", "country", "zipCode", "street", "number", "phone", "email", "website", "youtube", "instagram", "facebook", "lat", "lng"];

    // Load churches (needed to compare with suggestions)
    useEffect(() => {
        const unsub = onSnapshot(collection(db, "churches"), (snap) => {
            const map = {};
            snap.docs.forEach(d => { map[d.id] = { id: d.id, ...d.data() }; });
            setChurchesById(map);
        });
        return () => unsub();
    }, []);

    // Load suggestions
    useEffect(() => {
        const unsub = onSnapshot(collection(db, "church_suggestions"), (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            const pending = list
                .filter(s => s.status === "pending")
                .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

            const processed = list
                .filter(s => s.status === "approved" || s.status === "rejected")
                .sort((a, b) => (b.processedAt?.seconds || 0) - (a.processedAt?.seconds || 0));

            setSuggestions(pending);
            setProcessedSuggestions(processed);



            setLoading(false);
        });
        return () => unsub();
    }, []);
    
    // Initialize or Update drafts for pending suggestions
    // This runs whenever suggestions or church data arrives from Firestore
    useEffect(() => {
        if (!suggestions.length || Object.keys(churchesById).length === 0) return;
        
        setDraftsById(prev => {
            let next = { ...prev };
            let hasChanges = false;
            
            suggestions.forEach(s => {
                if (!next[s.id]) {
                    hasChanges = true;
                    // MERGE: If it's an edit of an existing church, start with live DB data
                    if (s.type === "edit" && s.originalChurchId) {
                        const liveChurch = churchesById[s.originalChurchId];
                        if (liveChurch) {
                            // Start with live data, then apply proposed changes
                            next[s.id] = { ...liveChurch, ...s.data };
                        } else {
                            next[s.id] = { ...s.data };
                        }
                    } else {
                        next[s.id] = { ...s.data };
                    }
                }
            });
            return hasChanges ? next : prev;
        });
    }, [suggestions, churchesById]);

    // Compute diffs: compare suggestion data vs current DB church data
    // This runs whenever suggestions or churches change
    useEffect(() => {
        const newSyncedFields = {};
        suggestions.forEach(s => {
            if (s.type !== "edit" || !s.originalChurchId) return;
            
            // Always compare against the LIVE database value
            const currentChurch = churchesById[s.originalChurchId];
            if (!currentChurch) return;

            const syncMap = {};
            FIELDS_TO_COMPARE.forEach(f => {
                const dbVal = String(currentChurch[f] ?? "").trim();
                const suggestionVal = String(s.data[f] ?? "").trim();
                if (dbVal !== suggestionVal && suggestionVal !== "") {
                    syncMap[f] = { old: dbVal };
                }
            });

            if (Object.keys(syncMap).length > 0) {
                newSyncedFields[s.id] = syncMap;
            }
        });
        setSyncedFieldsById(prev => {
            // Merge: keep any manually-added sync fields (from clicking Sync button), 
            // but reset computed ones
            const next = {};
            Object.keys(prev).forEach(id => {
                // Keep entries for IDs that aren't in the auto-computed set (e.g. manual sync)
                if (!suggestions.find(s => s.id === id && s.type === "edit")) {
                    next[id] = prev[id];
                }
            });
            // Apply computed diffs
            Object.assign(next, newSyncedFields);
            return next;
        });
    }, [suggestions, churchesById, diffRecomputeTrigger]);

    const toggleExpand = useCallback((id) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            const isClosing = next.has(id);

            if (isClosing) {
                const suggestion = suggestions.find(s => s.id === id);
                const draft = draftsById[id];
                if (suggestion && draft) {
                    // Check if draft was modified compared to original suggestion data
                    const original = suggestion.data;
                    const fieldsToCheck = ["name", "locationTitle", "city", "country", "zipCode", "street", "number", "phone", "email", "website", "youtube", "facebook", "instagram", "lat", "lng"];
                    const hasChanges = fieldsToCheck.some(f => 
                        String(draft[f] ?? "") !== String(original[f] ?? "")
                    );
                    if (hasChanges) {
                        setModal({
                            isOpen: true,
                            title: "Unsaved Changes",
                            message: "Are you sure you want to cancel all changes?",
                            onConfirm: () => {
                                setModal(m => ({ ...m, isOpen: false }));
                                // Revert draft to original suggestion data
                                setDraftsById(d => ({ ...d, [id]: { ...original } }));
                                // Trigger diff recomputation
                                setDiffRecomputeTrigger(c => c + 1);
                                setExpandedIds(curr => {
                                    const n = new Set(curr);
                                    n.delete(id);
                                    return n;
                                });
                            }
                        });
                        return prev; // Don't close until confirmed
                    }
                }
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, [suggestions, draftsById]);

    const changeDraft = (id, key, value) => {
        setDraftsById(prev => ({
            ...prev,
            [id]: { ...prev[id], [key]: value }
        }));
    };

    const handleRestore = (id, field, oldValue) => {
        changeDraft(id, field, oldValue);
        setSyncedFieldsById(prev => {
            const next = { ...prev };
            if (next[id]) {
                const fieldMap = { ...next[id] };
                delete fieldMap[field];
                next[id] = fieldMap;
            }
            return next;
        });
    };

    const handleSync = async (id) => {
        const draft = draftsById[id];
        if (!draft) return;

        setSyncingById(prev => ({ ...prev, [id]: true }));
        setSyncSuccessById(prev => ({ ...prev, [id]: false }));

        try {
            const query = draft.locationTitle || draft.name;
            const data = await fetchGooglePlaceData(query, draft.city, draft.country, draft.place_id);
            
            if (data) {
                const newSyncMap = { ...(syncedFieldsById[id] || {}) };
                Object.entries(data).forEach(([k, v]) => {
                    if (v !== undefined && v !== null) {
                        const currentVal = draft[k];
                        if (String(currentVal || "") !== String(v || "")) {
                            newSyncMap[k] = { old: String(currentVal || "") };
                        }
                        changeDraft(id, k, v);
                    }
                });
                setSyncedFieldsById(prev => ({ ...prev, [id]: newSyncMap }));
                setSyncSuccessById(prev => ({ ...prev, [id]: true }));
                setTimeout(() => setSyncSuccessById(prev => ({ ...prev, [id]: false })), 3000);
            }
        } finally {
            setSyncingById(prev => ({ ...prev, [id]: false }));
        }
    };

    const handleApprove = async (suggestion, saveAsDraft = false) => {
        const draft = draftsById[suggestion.id];
        if (!draft) return;

        setProcessingId(suggestion.id);
        try {
            const { type, originalChurchId } = suggestion;

            // 1. Geocode
            const coords = await geocodeAddress(draft.street, draft.number, draft.city, draft.zipCode, draft.country, draft.locationTitle);
            
            // 2. Attribution Info
            const submitter = suggestion.data?.submitter || {};
            const submitterName = `${submitter.firstName || ""} ${submitter.lastName || ""}`.trim() || "Unknown";
            const attribution = { name: submitterName, at: serverTimestamp() };

            let targetId = originalChurchId;
            let newDocRef = null;
            if (type === "new") {
                newDocRef = doc(collection(db, "churches"));
                targetId = newDocRef.id;
            }

            const finalData = { 
                ...draft, 
                lat: parseFloat(draft.lat) || coords?.lat || 0,
                lng: parseFloat(draft.lng) || coords?.lng || 0,
                isDraft: saveAsDraft,
                updatedAt: serverTimestamp() 
            };

            if (type === "new") {
                finalData.createdBy = attribution;
                await setDoc(newDocRef, finalData);
            } else if (type === "edit" && originalChurchId) {
                await updateDoc(doc(db, "churches", originalChurchId), finalData);
            }

            // 3. Mark suggestion as approved
            await updateDoc(doc(db, "church_suggestions", suggestion.id), {
                status: "approved",
                processedAt: serverTimestamp()
            });
        } catch (err) {
            console.error("Approval failed:", err);
            alert("Approval failed. Check console.");
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (suggestionId) => {
        setProcessingId(suggestionId);
        try {
            await updateDoc(doc(db, "church_suggestions", suggestionId), {
                status: "rejected",
                processedAt: serverTimestamp()
            });
            setModal({ ...modal, isOpen: false });
        } catch (err) {
            console.error("Rejection failed:", err);
        } finally {
            setProcessingId(null);
        }
    };

    const handleDelete = async (suggestionId) => {
        setProcessingId(suggestionId);
        try {
            await deleteDoc(doc(db, "church_suggestions", suggestionId));
            setModal({ ...modal, isOpen: false });
        } catch (err) {
            console.error("Deletion failed:", err);
            alert("Deletion failed.");
        } finally {
            setProcessingId(null);
        }
    };

    const handleDiscovery = async (targetCount, countryToSearch) => {
        if (isDiscovering5) return;

        setIsDiscovering5(true);
        setDiscover5Count(0);
        setDiscover5Status("Starting discovery...");
        setIsDiscoveryToolOpen(false); // Close modal when starting

        try {
            const existingPlaceIds = new Set();
            Object.values(churchesById).forEach(c => { if (c?.place_id) existingPlaceIds.add(String(c.place_id)); });
            [...suggestions, ...processedSuggestions].forEach(s => { if (s?.data?.place_id) existingPlaceIds.add(String(s.data.place_id)); });

            const country = (countryToSearch || "").trim();

            const namesToTry = shuffleArray(PENTECOSTAL_NAMES);
            let created = 0;

            for (let i = 0; i < namesToTry.length && created < targetCount; i++) {
                const churchName = namesToTry[i];
                setDiscover5Status(`Searching: "Biserica Penticostala ${churchName}"`);

                const googleCandidate = await fetchGooglePlaceData(`Biserica Penticostala ${churchName}`, "", country);
                if (!googleCandidate || (!googleCandidate.name && !googleCandidate.place_id)) continue;

                const normName = normalizeText(googleCandidate.name || "");
                const normLoc = normalizeText(googleCandidate.locationTitle || "");
                const isPentecostal = normName.includes("penticost") || normName.includes("pentecost") ||
                    normLoc.includes("penticost") || normLoc.includes("pentecost");
                if (!isPentecostal) continue;

                if (country && googleCandidate.country && normalizeText(googleCandidate.country) !== normalizeText(country)) continue;

                if (googleCandidate.place_id && existingPlaceIds.has(String(googleCandidate.place_id))) continue;

                setDiscover5Status(`Enriching: ${googleCandidate.name || churchName}`);
                const base = { ...emptyChurch(), country: "", city: "" };
                const enriched = await syncChurchBot({
                    ...base,
                    ...googleCandidate,
                    place_id: googleCandidate.place_id || "",
                    country: googleCandidate.country || country || "",
                    city: googleCandidate.city || ""
                }, (msg) => setDiscover5Status(msg), { googleData: googleCandidate });

                const submitter = {
                    firstName: "Discover",
                    lastName: "Bot",
                    phone: "",
                    email: "",
                    notes: `Auto-discovered via admin on ${new Date().toLocaleString()}.`
                };

                await addDoc(collection(db, "church_suggestions"), {
                    type: "new",
                    status: "pending",
                    source: "admin_discover_bot",
                    createdAt: serverTimestamp(),
                    data: {
                        ...enriched,
                        syncedAt: serverTimestamp(),
                        submitter
                    }
                });

                created++;
                setDiscover5Count(created);
                if (googleCandidate.place_id) existingPlaceIds.add(String(googleCandidate.place_id));

                // small pacing so the UI stays responsive and avoids burst limits
                await new Promise(r => setTimeout(r, 350));
            }

            if (created < targetCount) {
                setDiscover5Status(`Done: created ${created} suggestion(s). (Not enough matches for ${targetCount}.)`);
            } else {
                setDiscover5Status(`Done: created ${created} suggestions.`);
            }
            setTimeout(() => setDiscover5Status(""), 4000);
        } catch (e) {
            console.error("Discover 5 failed:", e);
            setDiscover5Status("Discovery failed. Check console.");
        } finally {
            setIsDiscovering5(false);
        }
    };

    if (loading) return <div className="adminSectionLoading">Loading...</div>;

    const activeList = showHistory ? processedSuggestions : suggestions;

    return (
        <div className="adminFullPage">
            <div className="adminFullTop">
                <h2 className="adminTitle">
                    Suggestions {showHistory && <span className="adminTitleBadge">History</span>}
                </h2>

                <div className="adminActions">
                    <div className="adminActionsGroup adminActionsGroup--suggestionsDiscover">
                        <button
                            type="button"
                            className="adminBtn adminBtn--discover"
                            disabled={isDiscovering5}
                            onClick={() => setIsDiscoveryToolOpen(true)}
                            title={discover5Status || "Discovery Tool: Find new churches and create suggestions"}
                        >
                            {isDiscovering5 ? (
                                <div className="adminSpinner" style={{ width: 14, height: 14, border: "2px solid #0a6b4a", borderTopColor: "transparent" }} />
                            ) : (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            )}
                            {isDiscovering5 ? `Discovering (${discover5Count}/${discoveryTargetCount})` : "Discover New Churches"}
                        </button>
                        {discover5Status && (
                             <span className="adminMuted" style={{ fontSize: '11px', fontWeight: '500', marginLeft: '8px' }}>
                                 {discover5Status}
                             </span>
                        )}
                    </div>

                    <button 
                        className="adminBtn adminBtn--new" 
                        type="button"
                        onClick={() => setShowHistory(!showHistory)}
                    >
                        <span className="adminBtnIcon" aria-hidden="true">
                            <IconHistory />
                        </span>
                        {showHistory ? "View Pending" : "History"}
                    </button>
                </div>
            </div>

            <div className="adminFullContent">
                <div className="adminFullList">
                    {activeList.length === 0 ? (
                        <div className="adminEmptyState">
                            {showHistory ? "No history yet." : "No pending suggestions. All caught up!"}
                        </div>
                    ) : (
                        activeList.map((s) => {
                            const isExpanded = expandedIds.has(s.id);
                            const draft = draftsById[s.id] || s.data;
                            const isProcessed = s.status !== "pending";
                            const cardBg = s.status === "approved" ? "#e8f5e9" : s.status === "rejected" ? "#ffebee" : "";
                            const syncedFields = syncedFieldsById[s.id] || {};

                            return (
                                <div key={s.id} className="adminAnnCard" style={isProcessed ? { backgroundColor: cardBg } : {}}>
                                    <div className="adminAnnHeader" style={{ justifyContent: "space-between", cursor: "pointer", gap: '12px' }} onClick={() => toggleExpand(s.id)}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                                            <span className={`adminChip ${s.type === "new" ? "adminChip--success" : "adminChip--warning"}`}>
                                                {s.type === "new" ? "NEW" : "EDIT"}
                                            </span>
                                            <strong style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{draft.name || s.data.name}</strong>
                                            <span className="adminMuted" style={{ fontSize: "0.8rem", marginLeft: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                • {draft.city || s.data.city}
                                            </span>
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                            <button className="adminSmallBtn" style={{ flexShrink: 0 }}>
                                                <IconChevronDown style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }} />
                                            </button>
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="adminAnnBody">
                                            <div style={{ 
                                                marginBottom: '16px', 
                                                paddingBottom: '12px', 
                                                borderBottom: '1px solid rgba(10, 42, 67, 0.05)',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}>
                                                <div className="adminMuted" style={{ fontSize: '0.75rem', fontWeight: '500' }}>
                                                    {isProcessed ? (
                                                        <>Processed on: <strong>{s.processedAt?.toDate().toLocaleDateString()}</strong></>
                                                    ) : (
                                                        <>Submitted on: <strong>{s.createdAt?.toDate().toLocaleDateString()}</strong></>
                                                    )}
                                                </div>
                                            </div>

                                            <ChurchFormFields
                                                drafts={draft}
                                                onChange={(field, value) => changeDraft(s.id, field, value)}
                                                syncedFields={syncedFields}
                                                onRestore={(field, oldValue) => handleRestore(s.id, field, oldValue)}
                                                getHighlightClass={(field) => syncedFields[field] ? "is-synced-highlight" : ""}
                                                onSync={!isProcessed ? () => handleSync(s.id) : undefined}
                                                isSyncing={syncingById[s.id] || false}
                                                syncSuccess={syncSuccessById[s.id] || false}
                                                disabled={isProcessed}
                                                showGoogleEnrichment={true}
                                            />

                                            <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px dashed rgba(10, 42, 67, 0.15)" }}>
                                                <h4 style={{ fontSize: "0.85rem", fontWeight: "800", color: "#0a2a43", textTransform: "uppercase", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                                        <circle cx="12" cy="7" r="4"></circle>
                                                    </svg>
                                                    Submitter Information
                                                </h4>
                                                <div className="adminForm" style={{ backgroundColor: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid rgba(10, 42, 67, 0.05)" }}>
                                                    <div>
                                                        <label className="adminLabel" style={{ fontSize: "10px", marginBottom: "2px" }}>First Name</label>
                                                        <div style={{ fontWeight: "600", color: "#0a2a43", fontSize: "13px" }}>{s.data?.submitter?.firstName || <span className="adminMuted">Not provided</span>}</div>
                                                    </div>
                                                    <div>
                                                        <label className="adminLabel" style={{ fontSize: "10px", marginBottom: "2px" }}>Last Name</label>
                                                        <div style={{ fontWeight: "600", color: "#0a2a43", fontSize: "13px" }}>{s.data?.submitter?.lastName || <span className="adminMuted">Not provided</span>}</div>
                                                    </div>
                                                    <div>
                                                        <label className="adminLabel" style={{ fontSize: "10px", marginBottom: "2px" }}>Phone</label>
                                                        <div style={{ fontWeight: "600", color: "#0a2a43", fontSize: "13px" }}>{s.data?.submitter?.phone || <span className="adminMuted">Not provided</span>}</div>
                                                    </div>
                                                    <div>
                                                        <label className="adminLabel" style={{ fontSize: "10px", marginBottom: "2px" }}>Email</label>
                                                        <div style={{ fontWeight: "600", color: "#0a2a43", fontSize: "13px" }}>{s.data?.submitter?.email || <span className="adminMuted">Not provided</span>}</div>
                                                    </div>
                                                    <div style={{ gridColumn: "span 2" }}>
                                                        <label className="adminLabel" style={{ fontSize: "10px", marginBottom: "2px" }}>Notes / Message</label>
                                                        <div style={{ fontWeight: "600", color: "#0a2a43", fontSize: "13px", whiteSpace: "pre-wrap", backgroundColor: "#fff", padding: "8px", borderRadius: "4px", border: "1px solid rgba(0,0,0,0.05)" }}>
                                                            {s.data?.submitter?.notes || <span className="adminMuted">No notes provided</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {!isProcessed && (
                                                <div className="adminMsgActions adminMsgActions--3" style={{ marginTop: "24px" }}>
                                                    <button
                                                        className="adminDeleteBtn"
                                                        style={{ height: "100%", padding: "10px" }}
                                                        onClick={() => setModal({ 
                                                            isOpen: true, 
                                                            title: "Reject Suggestion", 
                                                            message: "Are you sure you want to reject this church suggestion?",
                                                            onConfirm: () => handleReject(s.id)
                                                        })}
                                                        disabled={processingId === s.id}
                                                    >
                                                        <IconX style={{ marginRight: 6 }} /> Reject
                                                    </button>
                                                    <button
                                                        className="adminDraftBtn"
                                                        style={{ height: "100%", padding: "10px" }}
                                                        onClick={() => handleApprove(s, true)}
                                                        disabled={processingId === s.id}
                                                    >
                                                        <IconEyeOff style={{ marginRight: 6 }} /> Draft
                                                    </button>
                                                    <button
                                                        className="adminBtn"
                                                        style={{ height: "100%", padding: "10px", backgroundColor: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0", display: "flex", justifyContent: "center", width: "100%" }}
                                                        onClick={() => handleApprove(s, false)}
                                                        disabled={processingId === s.id}
                                                    >
                                                        <IconCheck style={{ marginRight: 6 }} /> Approve
                                                    </button>
                                                </div>
                                            )}

                                            {isProcessed && (
                                                <div className="adminMsgActions" style={{ marginTop: "24px" }}>
                                                    <button
                                                        className="adminDeleteBtn"
                                                        style={{ height: "100%", padding: "10px" }}
                                                        onClick={() => setModal({ 
                                                            isOpen: true, 
                                                            title: "Delete Suggestion", 
                                                            message: "Are you sure you want to permanently delete this suggestion from history?",
                                                            onConfirm: () => handleDelete(s.id)
                                                        })}
                                                        disabled={processingId === s.id}
                                                    >
                                                        <IconTrash style={{ marginRight: 6 }} /> Delete
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            <ConfirmModal
                isOpen={modal.isOpen}
                title={modal.title}
                message={modal.message}
                onConfirm={modal.onConfirm}
                onCancel={() => setModal({ ...modal, isOpen: false })}
            />

            {isDiscoveryToolOpen && (
                <div className="adminModalOverlay">
                    <div className="adminConfirmModal" style={{ maxWidth: '450px' }}>
                        <div className="adminModalHeader">
                            <h3 className="adminModalTitle" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                Discovery Tool
                            </h3>
                            <button className="adminModalClose" onClick={() => setIsDiscoveryToolOpen(false)} aria-label="Close">
                                <IconX />
                            </button>
                        </div>
                        
                        <div className="adminModalBody">
                            <p className="adminModalMessage" style={{ marginBottom: '20px' }}>
                                Automatically find new churches via Google and create pending suggestions.
                            </p>
                            
                            <div className="adminForm" style={{ gap: '20px' }}>
                                <div className="adminLabel">
                                    <span>Country to explore</span>
                                    <SearchableSelect
                                        value={discoverCountry}
                                        options={COUNTRY_OPTIONS}
                                        onChange={(val) => setDiscoverCountry(val)}
                                        placeholder="Select a country (optional)"
                                        inputClassName="adminSearchInput"
                                    />
                                </div>
                                <div className="adminLabel">
                                    <span>Desired quantity (1-10)</span>
                                    <select 
                                        className="adminInput"
                                        value={discoveryTargetCount}
                                        onChange={(e) => setDiscoveryTargetCount(parseInt(e.target.value))}
                                        style={{ height: '40px' }}
                                    >
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                                            <option key={n} value={n}>{n} churches</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        <div className="adminModalFooter">
                            <button className="adminModalBtn adminModalBtn--cancel" onClick={() => setIsDiscoveryToolOpen(false)}>
                                Cancel
                            </button>
                            <button 
                                className="adminModalBtn adminModalBtn--primary" 
                                onClick={() => handleDiscovery(discoveryTargetCount, discoverCountry)}
                                style={{ background: '#0a6b4a' }}
                            >
                                Start Discovery
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
