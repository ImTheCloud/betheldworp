"use client";

import React, { useEffect, useState, useCallback } from "react";
import { collection, doc, onSnapshot, updateDoc, addDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { db } from "../../lib/Firebase";
import ConfirmModal from "../components/ConfirmModal";

function IconCheck(props) {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <polyline points="20 6 9 17 4 12" />
        </svg>
    );
}

function IconX(props) {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
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

function IconEyeOff(props) {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
    );
}

const COUNTRY_OPTIONS = [
    "Austria", "Belgium", "Bulgaria", "Croatia", "Cyprus", "Czech Republic",
    "Denmark", "Estonia", "Finland", "France", "Germany", "Greece", "Hungary",
    "Ireland", "Italy", "Latvia", "Lithuania", "Luxembourg", "Malta", "Moldova",
    "Netherlands", "Norway", "Poland", "Portugal", "Romania", "Slovakia", "Slovenia",
    "Spain", "Sweden", "Switzerland", "Ukraine", "United Kingdom", "United States", "Canada", "Australia"
].sort();

const FIELDS = [
    { key: "locationTitle", label: "Location Title (Directions)", type: "text" },
    { key: "name", label: "Name", type: "text", required: true },
    { key: "city", label: "City / Locality", type: "text", required: true },
    { key: "country", label: "Country", type: "select", options: COUNTRY_OPTIONS },
    { key: "zipCode", label: "Postal Code", type: "text" },
    { key: "street", label: "Street", type: "text" },
    { key: "number", label: "Number", type: "text" },
    { key: "phone", label: "Phone", type: "text" },
    { key: "email", label: "Email", type: "text" },
    { key: "website", label: "Website", type: "text" },
    { key: "youtube", label: "YouTube", type: "text" },
    { key: "facebook", label: "Facebook", type: "text" },
    { key: "instagram", label: "Instagram", type: "text" },
];

const geocodeAddress = async (street, number, city, zipCode, country) => {
    const query = [`${street || ""} ${number || ""}`.trim(), zipCode, city, country].map(s => (s || "").trim()).filter(Boolean).join(", ");
    if (!query) return null;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return null;
    try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.results && data.results.length > 0) {
            const loc = data.results[0].geometry.location;
            return { lat: loc.lat, lng: loc.lng };
        }
    } catch (e) {
        console.error("Geocoding failed:", e);
    }
    return null;
};

function IconHistory(props) {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="M12 8v4l3 3" />
            <path d="M3.05 11a9 9 0 1 1 .5 9m-.5-9v-5.5h-5.5" />
        </svg>
    );
}

function IconTrash(props) {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="M3 6h18" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
    );
}

export default function ChurchSuggestionsAdmin() {
    const [suggestions, setSuggestions] = useState([]);
    const [processedSuggestions, setProcessedSuggestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);
    const [expandedIds, setExpandedIds] = useState(new Set());
    const [draftsById, setDraftsById] = useState({});
    const [modal, setModal] = useState({ isOpen: false, title: "", message: "", onConfirm: () => {} });
    const [showHistory, setShowHistory] = useState(false);

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

            // Initialize drafts for pending suggestions
            setDraftsById(prev => {
                const next = { ...prev };
                pending.forEach(s => {
                    if (!next[s.id]) {
                        next[s.id] = { ...s.data };
                    }
                });
                return next;
            });

            setLoading(false);
        });
        return () => unsub();
    }, []);

    const toggleExpand = useCallback((id) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }, []);

    const changeDraft = (id, key, value) => {
        setDraftsById(prev => ({
            ...prev,
            [id]: { ...prev[id], [key]: value }
        }));
    };

    const handleApprove = async (suggestion, saveAsDraft = false) => {
        const draft = draftsById[suggestion.id];
        if (!draft) return;

        setProcessingId(suggestion.id);
        try {
            const { type, originalChurchId } = suggestion;

            // 1. Geocode
            const coords = await geocodeAddress(draft.street, draft.number, draft.city, draft.zipCode, draft.country);
            
            // 2. Attribution Info
            const submitter = suggestion.data?.submitter || {};
            const submitterName = `${submitter.firstName || ""} ${submitter.lastName || ""}`.trim() || "Unknown";
            const attribution = { name: submitterName, at: serverTimestamp() };

            const finalData = { 
                ...draft, 
                ...coords, 
                isDraft: saveAsDraft,
                updatedAt: serverTimestamp() 
            };

            if (type === "new") {
                finalData.createdBy = attribution;
                await addDoc(collection(db, "churches"), finalData);
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
                                        <button className="adminSmallBtn" style={{ flexShrink: 0 }}>
                                            <IconChevronDown style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }} />
                                        </button>
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

                                            <div className="adminForm">
                                                {FIELDS.map((f) => {
                                                    const originalValue = s.type === "edit" && s.originalData ? (s.originalData[f.key] ?? "") : "";
                                                    const currentValue = draft[f.key] ?? "";
                                                    const isModified = s.type === "edit" && String(originalValue).trim() !== String(currentValue).trim();
                                                    const modifiedStyle = isModified ? { border: "2px solid #f59e0b", backgroundColor: "#fffbeb" } : {};

                                                    if (f.key === "number") return null;
                                                    if (f.key === "street") {
                                                        const origNum = s.type === "edit" && s.originalData ? (s.originalData.number ?? "") : "";
                                                        const curNum = draft.number ?? "";
                                                        const isNumModified = s.type === "edit" && String(origNum).trim() !== String(curNum).trim();
                                                        const numModifiedStyle = isNumModified ? { border: "2px solid #f59e0b", backgroundColor: "#fffbeb" } : {};

                                                        return (
                                                            <div key="street-number" style={{ gridColumn: "span 2", display: "flex", gap: "12px" }}>
                                                                <div style={{ flex: 3 }}>
                                                                    <label className="adminLabel">
                                                                        Street
                                                                        {isModified && <span style={{ color: "#d97706", marginLeft: 8, fontSize: "0.80rem", fontWeight: "normal" }}>(Modified)</span>}
                                                                    </label>
                                                                    {isModified && <div style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: 4, fontWeight: "normal" }}>Original: <s>{originalValue || "empty"}</s></div>}
                                                                    <input
                                                                        className="adminInput"
                                                                        style={modifiedStyle}
                                                                        value={draft.street ?? ""}
                                                                        onChange={(e) => changeDraft(s.id, "street", e.target.value)}
                                                                        disabled={isProcessed}
                                                                    />
                                                                </div>
                                                                <div style={{ flex: 1 }}>
                                                                    <label className="adminLabel">
                                                                        Number
                                                                        {isNumModified && <span style={{ color: "#d97706", marginLeft: 8, fontSize: "0.80rem", fontWeight: "normal" }}>(Modified)</span>}
                                                                    </label>
                                                                    {isNumModified && <div style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: 4, fontWeight: "normal" }}>Original: <s>{origNum || "empty"}</s></div>}
                                                                    <input
                                                                        className="adminInput"
                                                                        style={numModifiedStyle}
                                                                        value={draft.number ?? ""}
                                                                        onChange={(e) => changeDraft(s.id, "number", e.target.value)}
                                                                        disabled={isProcessed}
                                                                    />
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                    return (
                                                        <label key={f.key} className="adminLabel" style={(f.key === "locationTitle" || f.key === "notes") ? { gridColumn: "span 2" } : {}}>
                                                            <div style={{ display: "flex", alignItems: "center" }}>
                                                                {f.label}{f.required ? " *" : ""}
                                                                {isModified && <span style={{ color: "#d97706", marginLeft: 8, fontSize: "0.80rem", fontWeight: "normal" }}>(Modified)</span>}
                                                            </div>

                                                            {isModified && <div style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: 4, marginTop: 2, fontWeight: "normal", whiteSpace: "pre-wrap" }}>Original: <s>{originalValue || "empty"}</s></div>}

                                                            {f.type === "select" ? (
                                                                <select
                                                                    className="adminSelect"
                                                                    style={{ width: "100%", marginTop: 4, ...modifiedStyle }}
                                                                    value={draft[f.key] ?? ""}
                                                                    onChange={(e) => changeDraft(s.id, f.key, e.target.value)}
                                                                    disabled={isProcessed}
                                                                >
                                                                    <option value="">-- Select Country --</option>
                                                                    {f.options.map(opt => (
                                                                        <option key={opt} value={opt}>{opt}</option>
                                                                    ))}
                                                                </select>
                                                            ) : f.type === "textarea" ? (
                                                                <textarea
                                                                    className="adminInput"
                                                                    rows="3"
                                                                    style={{ resize: "vertical", marginTop: 4, ...modifiedStyle }}
                                                                    value={draft[f.key] ?? ""}
                                                                    onChange={(e) => changeDraft(s.id, f.key, e.target.value)}
                                                                    disabled={isProcessed}
                                                                />
                                                            ) : (
                                                                <input
                                                                    className="adminInput"
                                                                    type={f.type}
                                                                    style={{ ...modifiedStyle, marginTop: 4 }}
                                                                    value={draft[f.key] ?? ""}
                                                                    onChange={(e) => changeDraft(s.id, f.key, e.target.value)}
                                                                    disabled={isProcessed}
                                                                />
                                                            )}
                                                        </label>
                                                    );
                                                })}
                                            </div>

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
        </div>
    );
}
