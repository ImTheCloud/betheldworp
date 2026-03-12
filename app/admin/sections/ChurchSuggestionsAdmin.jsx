"use client";

import React, { useEffect, useState, useCallback } from "react";
import { collection, doc, onSnapshot, updateDoc, addDoc, serverTimestamp } from "firebase/firestore";
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

const COUNTRY_OPTIONS = [
    "Austria", "Belgium", "Bulgaria", "Croatia", "Cyprus", "Czech Republic",
    "Denmark", "Estonia", "Finland", "France", "Germany", "Greece", "Hungary",
    "Ireland", "Italy", "Latvia", "Lithuania", "Luxembourg", "Malta", "Moldova",
    "Netherlands", "Norway", "Poland", "Portugal", "Romania", "Slovakia", "Slovenia",
    "Spain", "Sweden", "Switzerland", "Ukraine", "United Kingdom", "United States", "Canada", "Australia"
].sort();

const FIELDS = [
    { key: "name", label: "Name", type: "text", required: true },
    { key: "country", label: "Country", type: "select", options: COUNTRY_OPTIONS },
    { key: "city", label: "City / Locality", type: "text" },
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

export default function ChurchSuggestionsAdmin() {
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);
    const [expandedIds, setExpandedIds] = useState(new Set());
    const [draftsById, setDraftsById] = useState({});
    const [modal, setModal] = useState({ isOpen: false, suggestionId: null });

    useEffect(() => {
        const unsub = onSnapshot(collection(db, "church_suggestions"), (snap) => {
            const list = snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter(s => s.status === "pending")
                .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

            setSuggestions(list);

            // Initialize drafts
            setDraftsById(prev => {
                const next = { ...prev };
                list.forEach(s => {
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

    const handleApprove = async (suggestion) => {
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
            setModal({ isOpen: false, suggestionId: null });
        } catch (err) {
            console.error("Rejection failed:", err);
        } finally {
            setProcessingId(null);
        }
    };

    if (loading) return <div className="adminSectionLoading">Loading...</div>;

    return (
        <div className="adminSection">
            <div className="adminSectionHeader">
                <h1 className="adminSectionTitle">Church Suggestions</h1>
            </div>

            <div className="adminList">
                {suggestions.length === 0 ? (
                    <div className="adminEmptyState">No pending suggestions. All caught up!</div>
                ) : (
                    suggestions.map((s) => {
                        const isExpanded = expandedIds.has(s.id);
                        const draft = draftsById[s.id] || s.data;

                        return (
                            <div key={s.id} className="adminAnnCard">
                                <div className="adminAnnHeader" style={{ justifyContent: "space-between", cursor: "pointer" }} onClick={() => toggleExpand(s.id)}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <span className={`adminChip ${s.type === "new" ? "adminChip--success" : "adminChip--warning"}`}>
                                            {s.type === "new" ? "NEW" : "EDIT"}
                                        </span>
                                        <strong>{draft.name || s.data.name}</strong>
                                        <span className="adminMuted" style={{ fontSize: "0.8rem", marginLeft: 8 }}>
                                            • {draft.city || s.data.city}
                                        </span>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                        <div className="adminMuted" style={{ fontSize: "0.8rem" }}>
                                            {s.createdAt?.toDate().toLocaleDateString()}
                                        </div>
                                        <button className="adminSmallBtn">
                                            <IconChevronDown style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }} />
                                        </button>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="adminAnnBody">
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px" }}>
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
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                return (
                                                    <label key={f.key} className="adminLabel" style={(f.key === "notes") ? { gridColumn: "span 2" } : {}}>
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
                                                            />
                                                        ) : (
                                                            <input
                                                                className="adminInput"
                                                                type={f.type}
                                                                style={{ ...modifiedStyle, marginTop: 4 }}
                                                                value={draft[f.key] ?? ""}
                                                                onChange={(e) => changeDraft(s.id, f.key, e.target.value)}
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
                                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", backgroundColor: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid rgba(10, 42, 67, 0.05)" }}>
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

                                        <div className="adminAnnActions" style={{ marginTop: "24px", display: "flex", gap: "12px" }}>
                                            <button
                                                className="adminBtn"
                                                style={{ flex: 1, padding: "10px", backgroundColor: "#ffebee", color: "#c62828", border: "1px solid #ffcdd2" }}
                                                onClick={() => setModal({ isOpen: true, suggestionId: s.id })}
                                                disabled={processingId === s.id}
                                            >
                                                <IconX style={{ marginRight: 6 }} /> Reject
                                            </button>
                                            <button
                                                className="adminBtn"
                                                style={{ flex: 1, padding: "10px", backgroundColor: "#e8f5e9", color: "#2e7d32", border: "1px solid #c8e6c9" }}
                                                onClick={() => handleApprove(s)}
                                                disabled={processingId === s.id}
                                            >
                                                <IconCheck style={{ marginRight: 6 }} /> Approve
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            <ConfirmModal
                isOpen={modal.isOpen}
                title="Reject Suggestion"
                message="Are you sure you want to reject this church suggestion? This action cannot be undone."
                onConfirm={() => handleReject(modal.suggestionId)}
                onCancel={() => setModal({ isOpen: false, suggestionId: null })}
            />
        </div>
    );
}
