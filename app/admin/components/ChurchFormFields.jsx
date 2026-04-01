"use client";

import React, { useRef } from "react";
import { COUNTRY_OPTIONS } from "../utils/churchHelpers";
import { IconSync, IconMap } from "./ChurchIcons";
import { SyncDiffLabel, GoogleSearchButton, PreviewLinkButton } from "./SyncDiffLabel";

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
    showGoogleEnrichment = true
}) {
    const searchQuery = `Biserica Penticostala ${drafts.name || ""} ${drafts.city || ""}`.trim();

    const hoursModified = !!syncedFields.openingHours;

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
                    <SyncDiffLabel field="locationTitle" syncedFields={syncedFields} onRestore={onRestore} />
                </div>

                {/* Row 1: Name & City */}
                <label className="adminLabel">
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
                        <span>Name *</span>
                    </div>
                    <input 
                        className={`adminInput ${getHighlightClass("name")}`} 
                        value={drafts.name ?? ""} 
                        onChange={(e) => onChange("name", e.target.value)} 
                        disabled={disabled}
                    />
                    <SyncDiffLabel field="name" syncedFields={syncedFields} onRestore={onRestore} />
                </label>
                <label className="adminLabel">
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
                        <span>City / Locality *</span>
                    </div>
                    <input 
                        className={`adminInput ${getHighlightClass("city")}`} 
                        value={drafts.city ?? ""} 
                        onChange={(e) => onChange("city", e.target.value)} 
                        disabled={disabled}
                    />
                    <SyncDiffLabel field="city" syncedFields={syncedFields} onRestore={onRestore} />
                </label>

                {/* Row 2: Country & Postal Code */}
                <label className="adminLabel">
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
                        <span>Country</span>
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
                    <SyncDiffLabel field="country" syncedFields={syncedFields} onRestore={onRestore} />
                </label>
                <label className="adminLabel">
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
                        <span>Postal Code</span>
                    </div>
                    <input 
                        className={`adminInput ${getHighlightClass("zipCode")}`} 
                        value={drafts.zipCode ?? ""} 
                        onChange={(e) => onChange("zipCode", e.target.value)} 
                        disabled={disabled}
                    />
                    <SyncDiffLabel field="zipCode" syncedFields={syncedFields} onRestore={onRestore} />
                </label>

                {/* Row 3: Street & Number */}
                <div style={{ gridColumn: "span 2", display: "flex", gap: "12px" }}>
                    <div style={{ flex: 3 }}>
                        <label className="adminLabel">
                            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
                                <span>Street</span>
                            </div>
                            <input 
                                className={`adminInput ${getHighlightClass("street")}`} 
                                value={drafts.street ?? ""} 
                                onChange={(e) => onChange("street", e.target.value)} 
                                disabled={disabled}
                            />
                            <SyncDiffLabel field="street" syncedFields={syncedFields} onRestore={onRestore} />
                        </label>
                    </div>
                    <div style={{ flex: 1 }}>
                        <label className="adminLabel">
                            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
                                <span>Number</span>
                            </div>
                            <input 
                                className={`adminInput ${getHighlightClass("number")}`} 
                                value={drafts.number ?? ""} 
                                onChange={(e) => onChange("number", e.target.value)} 
                                disabled={disabled}
                            />
                            <SyncDiffLabel field="number" syncedFields={syncedFields} onRestore={onRestore} />
                        </label>
                    </div>
                </div>

                {/* Row 4: Phone & Email */}
                <label className="adminLabel">
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
                        Phone
                        <GoogleSearchButton query={searchQuery} label="phone" />
                    </div>

                    <input 
                        className={`adminInput ${getHighlightClass("phone")}`} 
                        value={drafts.phone ?? ""} 
                        onChange={(e) => onChange("phone", e.target.value)} 
                        disabled={disabled}
                    />
                    <SyncDiffLabel field="phone" syncedFields={syncedFields} onRestore={onRestore} />
                </label>
                <label className="adminLabel">
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
                        Email
                        <GoogleSearchButton query={searchQuery} label="email" />
                    </div>
                    <input 
                        className={`adminInput ${getHighlightClass("email")}`} 
                        value={drafts.email ?? ""} 
                        onChange={(e) => onChange("email", e.target.value)} 
                        disabled={disabled}
                    />
                    <SyncDiffLabel field="email" syncedFields={syncedFields} onRestore={onRestore} />
                </label>

                {/* Row 5: Website & Youtube */}
                <label className="adminLabel">
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
                        Website
                        <GoogleSearchButton query={searchQuery} label="website" />
                    </div>
                    <div style={{ position: "relative" }}>
                        <input 
                            className={`adminInput adminInput--withIcon ${getHighlightClass("website")}`} 
                            placeholder="https://..." 
                            value={drafts.website ?? ""} 
                            onChange={(e) => onChange("website", e.target.value)} 
                            disabled={disabled}
                        />
                        <div className="adminInputIconWrapper">
                            <PreviewLinkButton url={drafts.website} />
                        </div>
                    </div>
                    <SyncDiffLabel field="website" syncedFields={syncedFields} onRestore={onRestore} showPreview={true} />
                </label>
                <label className="adminLabel">
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
                        YouTube
                        <GoogleSearchButton query={searchQuery} label="youtube" />
                    </div>

                    <div style={{ position: "relative" }}>
                        <input 
                            className={`adminInput adminInput--withIcon ${getHighlightClass("youtube")}`} 
                            placeholder="https://youtube.com/..." 
                            value={drafts.youtube ?? ""} 
                            onChange={(e) => onChange("youtube", e.target.value)} 
                            disabled={disabled}
                        />
                        <div className="adminInputIconWrapper">
                            <PreviewLinkButton url={drafts.youtube} />
                        </div>
                    </div>
                    <SyncDiffLabel field="youtube" syncedFields={syncedFields} onRestore={onRestore} showPreview={true} />
                </label>

                {/* Row 6: Instagram & Facebook */}
                <label className="adminLabel">
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
                        Instagram
                        <GoogleSearchButton query={searchQuery} label="instagram" />
                    </div>
                    <div style={{ position: "relative" }}>
                        <input 
                            className={`adminInput adminInput--withIcon ${getHighlightClass("instagram")}`} 
                            placeholder="instagram.com/..." 
                            value={drafts.instagram ?? ""} 
                            onChange={(e) => onChange("instagram", e.target.value)} 
                            disabled={disabled}
                        />
                        <div className="adminInputIconWrapper">
                            <PreviewLinkButton url={drafts.instagram} />
                        </div>
                    </div>
                    <SyncDiffLabel field="instagram" syncedFields={syncedFields} onRestore={onRestore} showPreview={true} />
                </label>
                <label className="adminLabel">
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
                        Facebook
                        <GoogleSearchButton query={searchQuery} label="facebook" />
                    </div>
                    <div style={{ position: "relative" }}>
                        <input 
                            className={`adminInput adminInput--withIcon ${getHighlightClass("facebook")}`} 
                            placeholder="facebook.com/..." 
                            value={drafts.facebook ?? ""} 
                            onChange={(e) => onChange("facebook", e.target.value)} 
                            disabled={disabled}
                        />
                        <div className="adminInputIconWrapper">
                            <PreviewLinkButton url={drafts.facebook} />
                        </div>
                    </div>
                    <SyncDiffLabel field="facebook" syncedFields={syncedFields} onRestore={onRestore} showPreview={true} />
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
                            <span>Latitude</span>
                        </div>
                        <input 
                            className={`adminInput ${getHighlightClass("lat")}`} 
                            type="number" 
                            step="any" 
                            value={drafts.lat ?? ""} 
                            onChange={(e) => onChange("lat", e.target.value)} 
                            disabled={disabled}
                        />
                        <SyncDiffLabel field="lat" syncedFields={syncedFields} onRestore={onRestore} />
                    </label>
                    <label className="adminLabel">
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span>Longitude</span>
                        </div>
                        <input 
                            className={`adminInput ${getHighlightClass("lng")}`} 
                            type="number" 
                            step="any" 
                            value={drafts.lng ?? ""} 
                            onChange={(e) => onChange("lng", e.target.value)} 
                            disabled={disabled}
                        />
                        <SyncDiffLabel field="lng" syncedFields={syncedFields} onRestore={onRestore} />
                    </label>
                </div>
            </div>

            {/* Google Enrichment Section: Hours */}
            {showGoogleEnrichment && (drafts.place_id || drafts.openingHours?.length > 0) && (
                <div style={{ marginTop: 20, borderTop: "1px dashed rgba(10, 42, 67, 0.12)", paddingTop: 20 }}>
                    <div className="adminHoursContainer">
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color: "rgba(10, 42, 67, 0.5)", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6 }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                Opening Hours
                            </span>
                            {hoursModified && <ModifiedBadge />}
                        </div>
                        
                        {drafts.openingHours && drafts.openingHours.length > 0 ? (
                            <div className="adminHoursGrid">
                                {drafts.openingHours.map((line, idx) => {
                                    const colonIndex = line.indexOf(": ");
                                    const day = line.substring(0, colonIndex);
                                    const time = line.substring(colonIndex + 2);
                                    
                                    return (
                                        <div key={idx} className="adminHoursRow">
                                            <span className="adminHoursDay">{day}</span>
                                            <span className="adminHoursTime">{time}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div style={{ fontSize: 12, fontStyle: "italic", color: "rgba(10, 42, 67, 0.4)", padding: "8px 0" }}>
                                No schedule available on Google Maps
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
