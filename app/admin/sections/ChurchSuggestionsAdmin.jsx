"use client";

import React, { useEffect, useState, useCallback } from "react";
import { collection, doc, onSnapshot, updateDoc, setDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { db } from "../../lib/Firebase";
import ConfirmModal from "../components/ConfirmModal";
import ChurchFormFields from "../components/ChurchFormFields";
import { IconCheck, IconX, IconChevronDown, IconEyeOff, IconHistory, IconTrash } from "../components/ChurchIcons";
import { geocodeAddress } from "../utils/churchHelpers";

export default function ChurchSuggestionsAdmin({ onDirtyChange }) {
    const [suggestions, setSuggestions] = useState([]);
    const [processedSuggestions, setProcessedSuggestions] = useState([]);
    const [churchesById, setChurchesById] = useState({});
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);
    const [expandedIds, setExpandedIds] = useState(new Set());
    const [draftsById, setDraftsById] = useState({});
    const [modal, setModal] = useState({ isOpen: false, title: "", message: "", onConfirm: () => {} });
    const [showHistory, setShowHistory] = useState(false);
    const [, setDiffRecomputeTrigger] = useState(0);

    const FIELDS_TO_COMPARE = ["name", "locationTitle", "city", "country", "zipCode", "street", "number", "phone", "email", "website", "youtube", "instagram", "facebook", "lat", "lng"];

    // Load churches (needed to compare with suggestions)
    useEffect(() => {
        const unsub = onSnapshot(collection(db, "churches"), (snap) => {
            const map = {};
            snap.docs.forEach(d => { map[d.id] = { id: d.id, ...d.data() }; });
            setChurchesById(map);
        }, (error) => {
            console.error("ChurchSuggestionsAdmin churches snapshot error:", error);
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
        }, (error) => {
            console.error("ChurchSuggestionsAdmin suggestions snapshot error:", error);
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
                    if (!next[s.id].locationTitle) {
                        next[s.id].locationTitle = `Biserica penticostală ${next[s.id].name || ""} ${next[s.id].city || ""}`.trim();
                    }
                }
            });
            return hasChanges ? next : prev;
        });
    }, [suggestions, churchesById]);
    // Report aggregate dirty state to parent
    useEffect(() => {
        if (!onDirtyChange) return;

        const anyDirty = Array.from(expandedIds).some(id => {
            const s = suggestions.find(s => s.id === id);
            const draft = draftsById[id];
            if (!s || !draft) return false;

            const liveChurch = s.type === "edit" ? churchesById[s.originalChurchId] : null;
            const baseline = liveChurch ? { ...liveChurch, ...s.data } : { ...s.data };
            if (!baseline.locationTitle) {
                baseline.locationTitle = `Biserica penticostală ${baseline.name || ""} ${baseline.city || ""}`.trim();
            }

            return FIELDS_TO_COMPARE.some(f => String(draft[f] ?? "") !== String(baseline[f] ?? ""));
        });

        onDirtyChange(anyDirty);
    }, [expandedIds, draftsById, suggestions, churchesById, onDirtyChange]);

    // Compute diffs: compare suggestion data vs current DB church data
    // This runs whenever suggestions or churches change
    // Diff computation logic removed as it was used for sync comparisons

    const toggleExpand = useCallback((id) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            const isClosing = next.has(id);

            if (isClosing) {
                const suggestion = suggestions.find(s => s.id === id);
                const draft = draftsById[id];
                if (suggestion && draft) {
                    // Check if draft was modified compared to the INITIAL MERGED state
                    // (which includes live DB data for edits and falling back to a dummy title)
                    const liveChurch = suggestion.type === "edit" ? churchesById[suggestion.originalChurchId] : null;
                    const baseline = liveChurch ? { ...liveChurch, ...suggestion.data } : { ...suggestion.data };
                    
                    if (!baseline.locationTitle) {
                        baseline.locationTitle = `Biserica penticostală ${baseline.name || ""} ${baseline.city || ""}`.trim();
                    }

                    const hasChanges = FIELDS_TO_COMPARE.some(f => 
                        String(draft[f] ?? "") !== String(baseline[f] ?? "")
                    );
                    if (hasChanges) {
                        setModal({
                            isOpen: true,
                            title: "Unsaved Changes",
                            message: "Are you sure you want to cancel all changes?",
                            onConfirm: () => {
                                setModal(m => ({ ...m, isOpen: false }));
                                // Revert draft to initial baseline state
                                setDraftsById(d => ({ ...d, [id]: { ...baseline } }));
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
    };

    // handleSync functionality removed for manual-only flow

    const handleApprove = async (suggestion, saveAsDraft = false) => {
        const draft = draftsById[suggestion.id];
        if (!draft) return;

        setModal({
            isOpen: true,
            title: saveAsDraft ? "Confirm Save as Draft" : "Confirm Approval",
            message: saveAsDraft ? "Are you sure you want to save this suggestion as a draft?" : "Are you sure you want to approve this suggestion?",
            variant: "primary",
            onConfirm: async () => {
                setModal(m => ({ ...m, isOpen: false }));
                setProcessingId(suggestion.id);
                try {
                    const { type, originalChurchId } = suggestion;

                    let finalLat = parseFloat(draft.lat);
                    let finalLng = parseFloat(draft.lng);
                    let finalPlaceId = draft.place_id || "";

                    // If coordinates are missing or it's a new entry, try to geocode
                    if (!finalLat || !finalLng || type === "new") {
                        const geo = await geocodeAddress(draft);
                        if (geo) {
                            finalLat = geo.lat;
                            finalLng = geo.lng;
                            finalPlaceId = geo.place_id;
                        }
                    }

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
                        lat: finalLat || 0,
                        lng: finalLng || 0,
                        place_id: finalPlaceId,
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
            }
        });
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

    // handleDiscovery functionality removed for manual-only flow

    if (loading) return <div className="adminSectionLoading">Loading...</div>;

    const activeList = showHistory ? processedSuggestions : suggestions;

    return (
        <div className="adminFullPage">
            <div className="adminFullTop">
                <h2 className="adminTitle">
                    Suggestions {showHistory && <span className="adminTitleBadge">History</span>}
                </h2>

                <div className="adminActions">

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
                                                syncedFields={(() => {
                                                    const liveChurch = s.type === "edit" ? churchesById[s.originalChurchId] : null;
                                                    if (!liveChurch) return {};
                                                    const diffs = {};
                                                    FIELDS_TO_COMPARE.forEach(f => {
                                                        const newVal = String(draft[f] ?? "").trim();
                                                        const oldVal = String(liveChurch[f] ?? "").trim();
                                                        if (newVal !== oldVal) {
                                                            diffs[f] = { old: liveChurch[f] };
                                                        }
                                                    });
                                                    return diffs;
                                                })()}
                                                onRestore={(field, value) => handleRestore(s.id, field, value)}
                                                getHighlightClass={(field) => {
                                                    const liveChurch = s.type === "edit" ? churchesById[s.originalChurchId] : null;
                                                    if (!liveChurch) return "";
                                                    const newVal = String(draft[field] ?? "").trim();
                                                    const oldVal = String(liveChurch[field] ?? "").trim();
                                                    return newVal !== oldVal ? "is-suggestion-modified" : "";
                                                }}
                                                disabled={isProcessed}
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
                variant={modal.variant}
                onConfirm={modal.onConfirm}
                onCancel={() => setModal({ ...modal, isOpen: false })}
            />

        </div>
    );
}
