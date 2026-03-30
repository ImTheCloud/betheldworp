"use client";

import React, { useRef } from "react";
import { COUNTRY_OPTIONS } from "../utils/churchHelpers";
import { IconSync } from "./ChurchIcons";
import { SyncDiffLabel, SyncableIcon, GoogleSearchButton } from "./SyncDiffLabel";

/**
 * ChurchFormFields — Shared form fields component used by both ChurchCard, NewChurchCard, and Suggestions.
 * 
 * Props:
 *   drafts          - the current field values
 *   onChange         - (field, value) => void
 *   syncedFields    - map of { [field]: { old: string } } for strikethrough diffs
 *   onRestore       - (field, oldValue) => void — restore old value on click
 *   getHighlightClass - (field) => string — returns CSS class for green highlight
 *   onSync           - async () => void — sync button handler
 *   isSyncing        - boolean
 *   syncSuccess      - boolean
 *   disabled         - boolean — disable all fields (for processed suggestions)
 *   onPhotoClick     - (url) => void — photo lightbox
 *   showGoogleEnrichment - boolean — show hours/photos/maps section
 */
export default function ChurchFormFields({
    drafts,
    onChange,
    syncedFields = {},
    onRestore,
    getHighlightClass = () => "",
    onSync,
    isSyncing = false,
    syncSuccess = false,
    disabled = false,
    onPhotoClick,
    showGoogleEnrichment = true
}) {
    const photoRef = useRef(null);
    const searchQuery = `${drafts.name || ""} ${drafts.city || ""}`.trim();
    const hoursModified = !!syncedFields.openingHours;
    const photosModified = !!syncedFields.photos;

    const ModifiedBadge = ({ label }) => (
        <span style={{
            fontSize: 9,
            fontWeight: 800,
            color: "#065f46",
            backgroundColor: "#d1fae5",
            padding: "2px 6px",
            borderRadius: 4,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            marginLeft: 8,
            border: "1px solid #a7f3d0",
            whiteSpace: "nowrap"
        }}>
            {label || "Modified"}
        </span>
    );

    return (
        <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
                {/* Row 0: Location Title (Directions) */}
                <div style={{ gridColumn: "span 2" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                        <label className="adminLabel" style={{ marginBottom: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, overflow: "hidden" }}>
                                <span>Location Title (Directions)</span>
                                <SyncDiffLabel field="locationTitle" syncedFields={syncedFields} onRestore={onRestore} />
                            </div>
                        </label>
                        {onSync && !disabled && (
                            <button 
                                type="button" 
                                style={{ fontSize: 11, fontWeight: 700, color: "#2563eb", border: "none", background: "transparent", padding: "4px 0", borderRadius: 6, cursor: isSyncing ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s", opacity: isSyncing ? 0.5 : 1, flexShrink: 0 }}
                                disabled={isSyncing}
                                onClick={onSync}
                            >
                                {isSyncing ? (
                                    <div className="adminSpinner" style={{ width: 12, height: 12, border: "2px solid #2563eb", borderTopColor: "transparent" }} />
                                ) : syncSuccess ? (
                                    <span className="adminSyncSuccess">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M20 6L9 17l-5-5" /></svg>
                                        Done
                                    </span>
                                ) : (
                                    <>
                                        <IconSync style={{ width: 12, height: 12 }} />
                                        Synchronisation
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                    <input 
                        className={`adminInput ${getHighlightClass("locationTitle")}`} 
                        value={drafts.locationTitle ?? ""} 
                        onChange={(e) => onChange("locationTitle", e.target.value)} 
                        placeholder="Search by name, address or place ID..."
                        disabled={disabled || isSyncing}
                    />
                </div>

                {/* Row 1: Name & City */}
                <label className="adminLabel">
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
                        <span>Name * <SyncableIcon /></span>
                        <SyncDiffLabel field="name" syncedFields={syncedFields} onRestore={onRestore} />
                    </div>
                    <input 
                        className={`adminInput ${getHighlightClass("name")}`} 
                        value={drafts.name ?? ""} 
                        onChange={(e) => onChange("name", e.target.value)} 
                        disabled={disabled}
                    />
                </label>
                <label className="adminLabel">
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
                        <span>City / Locality * <SyncableIcon /></span>
                        <SyncDiffLabel field="city" syncedFields={syncedFields} onRestore={onRestore} />
                    </div>
                    <input 
                        className={`adminInput ${getHighlightClass("city")}`} 
                        value={drafts.city ?? ""} 
                        onChange={(e) => onChange("city", e.target.value)} 
                        disabled={disabled}
                    />
                </label>

                {/* Row 2: Country & Postal Code */}
                <label className="adminLabel">
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
                        <span>Country <SyncableIcon /></span>
                        <SyncDiffLabel field="country" syncedFields={syncedFields} onRestore={onRestore} />
                    </div>
                    <select 
                        className={`adminSelect ${getHighlightClass("country")}`} 
                        style={{ width: "100%", marginTop: 4 }} 
                        value={drafts.country ?? ""} 
                        onChange={(e) => onChange("country", e.target.value)}
                        disabled={disabled}
                    >
                        <option value="">-- Select Country --</option>
                        {COUNTRY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                </label>
                <label className="adminLabel">
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
                        <span>Postal Code <SyncableIcon /></span>
                        <SyncDiffLabel field="zipCode" syncedFields={syncedFields} onRestore={onRestore} />
                    </div>
                    <input 
                        className={`adminInput ${getHighlightClass("zipCode")}`} 
                        value={drafts.zipCode ?? ""} 
                        onChange={(e) => onChange("zipCode", e.target.value)} 
                        disabled={disabled}
                    />
                </label>

                {/* Row 3: Street & Number */}
                <div style={{ gridColumn: "span 2", display: "flex", gap: "12px" }}>
                    <div style={{ flex: 3 }}>
                        <label className="adminLabel">
                            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
                                <span>Street <SyncableIcon /></span>
                                <SyncDiffLabel field="street" syncedFields={syncedFields} onRestore={onRestore} />
                            </div>
                            <input 
                                className={`adminInput ${getHighlightClass("street")}`} 
                                value={drafts.street ?? ""} 
                                onChange={(e) => onChange("street", e.target.value)} 
                                disabled={disabled}
                            />
                        </label>
                    </div>
                    <div style={{ flex: 1 }}>
                        <label className="adminLabel">
                            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
                                <span>Number <SyncableIcon /></span>
                                <SyncDiffLabel field="number" syncedFields={syncedFields} onRestore={onRestore} />
                            </div>
                            <input 
                                className={`adminInput ${getHighlightClass("number")}`} 
                                value={drafts.number ?? ""} 
                                onChange={(e) => onChange("number", e.target.value)} 
                                disabled={disabled}
                            />
                        </label>
                    </div>
                </div>

                {/* Row 4: Phone & Email */}
                <label className="adminLabel">
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
                        Phone <SyncableIcon />
                        <GoogleSearchButton query={searchQuery} label="phone contact" />
                        <SyncDiffLabel field="phone" syncedFields={syncedFields} onRestore={onRestore} />
                    </div>
                    <input 
                        className={`adminInput ${getHighlightClass("phone")}`} 
                        value={drafts.phone ?? ""} 
                        onChange={(e) => onChange("phone", e.target.value)} 
                        disabled={disabled}
                    />
                </label>
                <label className="adminLabel">
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
                        Email
                        <GoogleSearchButton query={searchQuery} label="email" />
                        <SyncDiffLabel field="email" syncedFields={syncedFields} onRestore={onRestore} />
                    </div>
                    <input 
                        className={`adminInput ${getHighlightClass("email")}`} 
                        value={drafts.email ?? ""} 
                        onChange={(e) => onChange("email", e.target.value)} 
                        disabled={disabled}
                    />
                </label>

                {/* Row 5: Website & Youtube */}
                <label className="adminLabel">
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
                        Website <SyncableIcon />
                        <GoogleSearchButton query={searchQuery} label="website" />
                        <SyncDiffLabel field="website" syncedFields={syncedFields} onRestore={onRestore} />
                    </div>
                    <input 
                        className={`adminInput ${getHighlightClass("website")}`} 
                        placeholder="https://..." 
                        value={drafts.website ?? ""} 
                        onChange={(e) => onChange("website", e.target.value)} 
                        disabled={disabled}
                    />
                </label>
                <label className="adminLabel">
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
                        YouTube
                        <GoogleSearchButton query={searchQuery} label="youtube channel" />
                        <SyncDiffLabel field="youtube" syncedFields={syncedFields} onRestore={onRestore} />
                    </div>
                    <input 
                        className={`adminInput ${getHighlightClass("youtube")}`} 
                        placeholder="https://youtube.com/..." 
                        value={drafts.youtube ?? ""} 
                        onChange={(e) => onChange("youtube", e.target.value)} 
                        disabled={disabled}
                    />
                </label>

                {/* Row 6: Instagram & Facebook */}
                <label className="adminLabel">
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
                        Instagram
                        <GoogleSearchButton query={searchQuery} label="instagram" />
                        <SyncDiffLabel field="instagram" syncedFields={syncedFields} onRestore={onRestore} />
                    </div>
                    <input 
                        className={`adminInput ${getHighlightClass("instagram")}`} 
                        placeholder="instagram.com/..." 
                        value={drafts.instagram ?? ""} 
                        onChange={(e) => onChange("instagram", e.target.value)} 
                        disabled={disabled}
                    />
                </label>
                <label className="adminLabel">
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
                        Facebook
                        <GoogleSearchButton query={searchQuery} label="facebook" />
                        <SyncDiffLabel field="facebook" syncedFields={syncedFields} onRestore={onRestore} />
                    </div>
                    <input 
                        className={`adminInput ${getHighlightClass("facebook")}`} 
                        placeholder="facebook.com/..." 
                        value={drafts.facebook ?? ""} 
                        onChange={(e) => onChange("facebook", e.target.value)} 
                        disabled={disabled}
                    />
                </label>
            </div>

            {/* Coordinates Section */}
            <div style={{ marginTop: 12, padding: 12, backgroundColor: "rgba(10, 42, 67, 0.03)", borderRadius: 8, border: "1px solid rgba(10, 42, 67, 0.08)" }}>
                <div style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(10, 42, 67, 0.7)" }}>Coordinates</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <label className="adminLabel">
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span>Latitude <SyncableIcon /></span>
                            <SyncDiffLabel field="lat" syncedFields={syncedFields} onRestore={onRestore} />
                        </div>
                        <input 
                            className={`adminInput ${getHighlightClass("lat")}`} 
                            type="number" 
                            step="any" 
                            value={drafts.lat ?? ""} 
                            onChange={(e) => onChange("lat", e.target.value)} 
                            disabled={disabled}
                        />
                    </label>
                    <label className="adminLabel">
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span>Longitude <SyncableIcon /></span>
                            <SyncDiffLabel field="lng" syncedFields={syncedFields} onRestore={onRestore} />
                        </div>
                        <input 
                            className={`adminInput ${getHighlightClass("lng")}`} 
                            type="number" 
                            step="any" 
                            value={drafts.lng ?? ""} 
                            onChange={(e) => onChange("lng", e.target.value)} 
                            disabled={disabled}
                        />
                    </label>
                </div>
            </div>

            {/* Google Enrichment Section: Hours & Photos */}
            {showGoogleEnrichment && (drafts.place_id || drafts.openingHours?.length > 0 || drafts.photos?.length > 0) && (
                <div style={{ marginTop: 16, borderTop: "1px dashed rgba(10, 42, 67, 0.1)", paddingTop: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                        <h4 style={{ margin: 0, fontSize: 14, color: "#134b7b", display: "flex", alignItems: "center", gap: 6 }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                            </svg>
                            Google Places Data
                        </h4>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                        <div>
                            <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.6, textTransform: "uppercase", display: "flex", alignItems: "center", marginBottom: 8 }}>
                                Schedule / Hours
                                {hoursModified && <ModifiedBadge />}
                            </span>
                            {drafts.openingHours && drafts.openingHours.length > 0 ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                                    {drafts.openingHours.map((line, idx) => (
                                        <div key={idx} style={{ fontSize: 12, color: "#134b7b", fontWeight: 500 }}>{line}</div>
                                    ))}
                                </div>
                            ) : (
                                <span style={{ fontSize: 12, fontStyle: "italic", opacity: 0.5 }}>Not available on Google</span>
                            )}
                        </div>

                        <div>
                            <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.6, textTransform: "uppercase", display: "block", marginBottom: 8 }}>Maps Context</span>
                            {drafts.googleMapsUri ? (
                                <a href={drafts.googleMapsUri} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#3b82f6", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                                    View on Google Maps
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
                                    </svg>
                                </a>
                            ) : (
                                <span style={{ fontSize: 12, fontStyle: "italic", opacity: 0.5 }}>Link not available</span>
                            )}
                            {drafts.place_id && (
                                <div style={{ marginTop: 4, fontSize: 10, opacity: 0.4, fontFamily: "monospace" }}>ID: {drafts.place_id}</div>
                            )}
                        </div>
                    </div>

                    {/* Photos Gallery */}
                    {drafts.photos && drafts.photos.length > 0 && (
                        <div style={{ marginTop: 16 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.6, textTransform: "uppercase", display: "flex", alignItems: "center" }}>
                                    Photos ({drafts.photos.length})
                                    {photosModified && (() => {
                                        const oldCount = syncedFields.photos?.old?.length || 0;
                                        const newCount = drafts.photos.length;
                                        return oldCount !== newCount 
                                            ? <ModifiedBadge label={`${oldCount} → ${newCount}`} />
                                            : <ModifiedBadge />;
                                    })()}
                                </span>
                                {drafts.photos.length > 2 && (
                                    <div className="adminPhotoNav">
                                        <button 
                                            type="button" 
                                            className="adminPhotoNavBtn" 
                                            onClick={(e) => { 
                                                e.stopPropagation(); 
                                                photoRef.current?.scrollBy({ left: -200, behavior: "smooth" }); 
                                            }}
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M15 18l-6-6 6-6" /></svg>
                                        </button>
                                        <button 
                                            type="button" 
                                            className="adminPhotoNavBtn" 
                                            onClick={(e) => { 
                                                e.stopPropagation(); 
                                                photoRef.current?.scrollBy({ left: 200, behavior: "smooth" }); 
                                            }}
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M9 18l6-6-6-6" /></svg>
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="adminPhotoScrollContainer" ref={photoRef}>
                                {drafts.photos.map((p, idx) => {
                                    const photoUrl = p.startsWith("http") ? p : `/api/geocode?type=photo&photo_name=${encodeURIComponent(p)}`;
                                    return (
                                        <div 
                                            key={idx} 
                                            className="adminPhotoThumbnail adminPhotoItem"
                                            onClick={() => onPhotoClick?.(photoUrl)}
                                        >
                                            <img 
                                                src={photoUrl} 
                                                alt={`Church ${idx}`} 
                                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                                loading="lazy"
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </>
    );
}
