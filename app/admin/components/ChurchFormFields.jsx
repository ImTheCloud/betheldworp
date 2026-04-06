"use client";

import React, { useRef } from "react";
import { COUNTRY_OPTIONS, resolveChurchFromTitle } from "../utils/churchHelpers";
import { IconMap, IconMagic } from "./ChurchIcons";
import { SyncDiffLabel, PreviewLinkButton, GoogleSearchButton } from "./SyncDiffLabel";
import SearchableSelect from "../../components/SearchableSelect";

/**
 * ChurchFormFields — Shared form fields component used by both ChurchCard, NewChurchCard, and Suggestions.
 * 
 * Props:
 *   drafts          - the current field values
 *   onChange         - (field, value) => void
 *   syncedFields    - map of { [field]: { old: string } } for strikethrough diffs
 *   onRestore       - (field, oldValue) => void — restore old value on click
 *   getHighlightClass - (field) => string — returns CSS class for green highlight
 *   disabled         - boolean — disable all fields (for processed suggestions)
 */
    const FieldDiffWrapper = ({ field, magicDiff, revertField, children }) => {
        const hasDiff = Object.prototype.hasOwnProperty.call(magicDiff, field);
        const oldValue = magicDiff[field];

        return (
            <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
                {React.cloneElement(children, {
                    className: `${children.props.className || ""} ${hasDiff ? "is-magic-new" : ""}`.trim()
                })}
                {hasDiff && oldValue && (
                    <div className="adminMagicOldValue" onClick={() => revertField(field)} title="Click to undo magic fill">
                        <span>Original: {oldValue}</span>
                        <div className="adminRevertIcon">Undo ↺</div>
                    </div>
                )}
            </div>
        );
    };

export default function ChurchFormFields({
    drafts,
    onChange,
    syncedFields = {},
    onRestore,
    getHighlightClass = () => "",
    disabled = false
}) {
    const [isResolving, setIsResolving] = React.useState(false);
    const [magicDiff, setMagicDiff] = React.useState({});
    const searchQuery = `Biserica penticostală ${drafts.name || ""} ${drafts.city || ""}`.trim();


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

    const handleMagicFill = async () => {
        let query = (drafts.locationTitle || "").trim();
        if (!query) {
            // Fallback to name + city if title is empty
            query = `${drafts.name || ""} ${drafts.city || ""}`.trim();
        }
        if (!query) return;

        // Ensure denominator is in query for better precision
        if (!query.toLowerCase().includes("biserica") && !query.toLowerCase().includes("penticostal")) {
            query = `Biserica penticostală ${query}`;
        }

        setIsResolving(true);
        const resolved = await resolveChurchFromTitle(query);
        setIsResolving(false);

        if (resolved) {
            const newDiff = {};
            // Bulk update all fields
            Object.keys(resolved).forEach(key => {
                if (key === "isLowConfidence") return; // Internal flag

                const newValue = resolved[key];
                const oldValue = drafts[key];
                
                // SAFETY: If result is a city center (low confidence), 
                // do NOT overwrite existing coordinates/Place ID.
                if (resolved.isLowConfidence && (key === "lat" || key === "lng" || key === "place_id")) {
                    if (oldValue && String(oldValue).trim() !== "0" && String(oldValue).trim() !== "") {
                        return; // Protect existing manual coordinates
                    }
                }

                if (newValue && newValue !== (oldValue ?? "")) {
                    onChange(key, newValue);
                    // Always track diff if newValue is different, even if oldValue was empty
                    newDiff[key] = oldValue ?? "";
                }
            });
            setMagicDiff(newDiff);
        }
    };

    const revertField = (field) => {
        if (magicDiff[field]) {
            onChange(field, magicDiff[field]);
            setMagicDiff(prev => {
                const next = { ...prev };
                delete next[field];
                return next;
            });
        }
    };

    return (
        <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
                {/* Row 0: Location Title (Directions) */}
                <div style={{ gridColumn: "span 2" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                        <label className="adminLabel" style={{ marginBottom: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, overflow: "hidden" }}>
                                <span>TITLE</span>
                                <div style={{ display: "flex", gap: 4 }}>
                                    <button 
                                        type="button" 
                                        className="adminLinkSearchBtn"
                                        title="Magic Fill everything from Title"
                                        onClick={handleMagicFill}
                                        disabled={isResolving || !drafts.locationTitle?.trim()}
                                        style={{ padding: 0, border: "none", background: "none", cursor: "pointer", display: "flex", alignItems: "center" }}
                                    >
                                        {isResolving ? (
                                            <div className="adminSpinner" style={{ width: 12, height: 12, borderWidth: 2, margin: 0 }} />
                                        ) : (
                                            <IconMagic />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </label>
                        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                        </div>
                    </div>
                    <input 
                        className={`adminInput ${getHighlightClass("locationTitle")}`} 
                        value={drafts.locationTitle ?? ""} 
                        onChange={(e) => onChange("locationTitle", e.target.value)} 
                        disabled={disabled}
                    />
                    <SyncDiffLabel field="locationTitle" syncedFields={syncedFields} onRestore={onRestore} />
                </div>

                {/* Row 1: Name & City */}
                <label className="adminLabel">
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
                        <span>Name *</span>
                    </div>
                    <FieldDiffWrapper field="name" magicDiff={magicDiff} revertField={revertField}>
                        <input 
                            className={`adminInput ${getHighlightClass("name")}`} 
                            value={drafts.name ?? ""} 
                            onChange={(e) => onChange("name", e.target.value)} 
                            disabled={disabled}
                        />
                    </FieldDiffWrapper>
                    <SyncDiffLabel field="name" syncedFields={syncedFields} onRestore={onRestore} />
                </label>
                <label className="adminLabel">
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
                        <span>City / Locality *</span>
                    </div>
                    <FieldDiffWrapper field="city" magicDiff={magicDiff} revertField={revertField}>
                        <input 
                            className={`adminInput ${getHighlightClass("city")}`} 
                            value={drafts.city ?? ""} 
                            onChange={(e) => onChange("city", e.target.value)} 
                            disabled={disabled}
                        />
                    </FieldDiffWrapper>
                    <SyncDiffLabel field="city" syncedFields={syncedFields} onRestore={onRestore} />
                </label>

                {/* Row 2: Country & Postal Code */}
                <label className="adminLabel">
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
                        <span>Country</span>
                    </div>
                    <FieldDiffWrapper field="country" magicDiff={magicDiff} revertField={revertField}>
                        <SearchableSelect
                            className={getHighlightClass("country")}
                            value={drafts.country ?? ""}
                            options={COUNTRY_OPTIONS}
                            onChange={(val) => onChange("country", val)}
                            disabled={disabled}
                            placeholder="Type to search country..."
                        />
                    </FieldDiffWrapper>
                    <SyncDiffLabel field="country" syncedFields={syncedFields} onRestore={onRestore} />
                </label>
                <label className="adminLabel">
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
                        <span>Postal Code</span>
                    </div>
                    <FieldDiffWrapper field="zipCode" magicDiff={magicDiff} revertField={revertField}>
                        <input 
                            className={`adminInput ${getHighlightClass("zipCode")}`} 
                            value={drafts.zipCode ?? ""} 
                            onChange={(e) => onChange("zipCode", e.target.value)} 
                            disabled={disabled}
                        />
                    </FieldDiffWrapper>
                    <SyncDiffLabel field="zipCode" syncedFields={syncedFields} onRestore={onRestore} />
                </label>

                {/* Row 3: Street & Number */}
                <div style={{ gridColumn: "span 2", display: "flex", gap: "12px" }}>
                    <div style={{ flex: 3 }}>
                        <label className="adminLabel">
                            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
                                <span>Street</span>
                            </div>
                            <FieldDiffWrapper field="street" magicDiff={magicDiff} revertField={revertField}>
                                <input 
                                    className={`adminInput ${getHighlightClass("street")}`} 
                                    value={drafts.street ?? ""} 
                                    onChange={(e) => onChange("street", e.target.value)} 
                                    disabled={disabled}
                                />
                            </FieldDiffWrapper>
                            <SyncDiffLabel field="street" syncedFields={syncedFields} onRestore={onRestore} />
                        </label>
                    </div>
                    <div style={{ flex: 1 }}>
                        <label className="adminLabel">
                            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
                                <span>Number</span>
                            </div>
                            <FieldDiffWrapper field="number" magicDiff={magicDiff} revertField={revertField}>
                                <input 
                                    className={`adminInput ${getHighlightClass("number")}`} 
                                    value={drafts.number ?? ""} 
                                    onChange={(e) => onChange("number", e.target.value)} 
                                    disabled={disabled}
                                />
                            </FieldDiffWrapper>
                            <SyncDiffLabel field="number" syncedFields={syncedFields} onRestore={onRestore} />
                        </label>
                    </div>
                </div>

                {/* Row 4: Phone & Email */}
                <label className="adminLabel">
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
                        Phone
                        <GoogleSearchButton query={`${searchQuery} phone number`} />
                    </div>

                    <FieldDiffWrapper field="phone" magicDiff={magicDiff} revertField={revertField}>
                        <input 
                            className={`adminInput ${getHighlightClass("phone")}`} 
                            value={drafts.phone ?? ""} 
                            onChange={(e) => onChange("phone", e.target.value)} 
                            disabled={disabled}
                        />
                    </FieldDiffWrapper>
                    <SyncDiffLabel field="phone" syncedFields={syncedFields} onRestore={onRestore} />
                </label>
                <label className="adminLabel">
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
                        Email
                        <GoogleSearchButton query={`${searchQuery} email address contact`} />
                    </div>
                    <FieldDiffWrapper field="email" magicDiff={magicDiff} revertField={revertField}>
                        <input 
                            className={`adminInput ${getHighlightClass("email")}`} 
                            value={drafts.email ?? ""} 
                            onChange={(e) => onChange("email", e.target.value)} 
                            disabled={disabled}
                        />
                    </FieldDiffWrapper>
                    <SyncDiffLabel field="email" syncedFields={syncedFields} onRestore={onRestore} />
                </label>

                {/* Row 5: Website & Youtube */}
                <label className="adminLabel">
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
                        Website
                        <div style={{ display: "flex", gap: 4 }}>
                            <GoogleSearchButton query={`${searchQuery} official website`} />
                            <PreviewLinkButton url={drafts.website} />
                        </div>
                    </div>
                    <FieldDiffWrapper field="website" magicDiff={magicDiff} revertField={revertField}>
                        <input 
                            className={`adminInput ${getHighlightClass("website")}`} 
                            placeholder="https://..." 
                            value={drafts.website ?? ""} 
                            onChange={(e) => onChange("website", e.target.value)} 
                            disabled={disabled}
                        />
                    </FieldDiffWrapper>
                    <SyncDiffLabel field="website" syncedFields={syncedFields} onRestore={onRestore} showPreview={true} />
                </label>
                <label className="adminLabel">
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
                        YouTube
                        <div style={{ display: "flex", gap: 4 }}>
                            <GoogleSearchButton query={`${searchQuery} youtube channel`} />
                            <PreviewLinkButton url={drafts.youtube} />
                        </div>
                    </div>

                    <FieldDiffWrapper field="youtube" magicDiff={magicDiff} revertField={revertField}>
                        <input 
                            className={`adminInput ${getHighlightClass("youtube")}`} 
                            placeholder="https://youtube.com/..." 
                            value={drafts.youtube ?? ""} 
                            onChange={(e) => onChange("youtube", e.target.value)} 
                            disabled={disabled}
                        />
                    </FieldDiffWrapper>
                    <SyncDiffLabel field="youtube" syncedFields={syncedFields} onRestore={onRestore} showPreview={true} />
                </label>

                {/* Row 6: Instagram & Facebook */}
                <label className="adminLabel">
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
                        Instagram
                        <div style={{ display: "flex", gap: 4 }}>
                            <GoogleSearchButton query={`${searchQuery} instagram`} />
                            <PreviewLinkButton url={drafts.instagram} />
                        </div>
                    </div>
                    <FieldDiffWrapper field="instagram" magicDiff={magicDiff} revertField={revertField}>
                        <input 
                            className={`adminInput ${getHighlightClass("instagram")}`} 
                            placeholder="instagram.com/..." 
                            value={drafts.instagram ?? ""} 
                            onChange={(e) => onChange("instagram", e.target.value)} 
                            disabled={disabled}
                        />
                    </FieldDiffWrapper>
                    <SyncDiffLabel field="instagram" syncedFields={syncedFields} onRestore={onRestore} showPreview={true} />
                </label>
                <label className="adminLabel">
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
                        Facebook
                        <div style={{ display: "flex", gap: 4 }}>
                            <GoogleSearchButton query={`${searchQuery} facebook page`} />
                            <PreviewLinkButton url={drafts.facebook} />
                        </div>
                    </div>
                    <FieldDiffWrapper field="facebook" magicDiff={magicDiff} revertField={revertField}>
                        <input 
                            className={`adminInput ${getHighlightClass("facebook")}`} 
                            placeholder="facebook.com/..." 
                            value={drafts.facebook ?? ""} 
                            onChange={(e) => onChange("facebook", e.target.value)} 
                            disabled={disabled}
                        />
                    </FieldDiffWrapper>
                    <SyncDiffLabel field="facebook" syncedFields={syncedFields} onRestore={onRestore} showPreview={true} />
                </label>
            </div>




            {/* Coordinates Section */}
            <div style={{ marginTop: 12, padding: 12, backgroundColor: "rgba(10, 42, 67, 0.03)", borderRadius: 8, border: "1px solid rgba(10, 42, 67, 0.08)" }}>
                <div style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(10, 42, 67, 0.7)" }}>Coordinates</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px" }}>
                    <div className="adminFieldGroup">
                        <label className="adminLabel">LATITUDE</label>
                        <FieldDiffWrapper field="lat" magicDiff={magicDiff} revertField={revertField}>
                            <input 
                                className={`adminInput ${getHighlightClass("lat")}`} 
                                type="number" 
                                step="any" 
                                value={drafts.lat ?? ""} 
                                onChange={(e) => onChange("lat", e.target.value)} 
                                disabled={disabled}
                            />
                        </FieldDiffWrapper>
                        <SyncDiffLabel field="lat" syncedFields={syncedFields} onRestore={onRestore} />
                    </div>
                    <div className="adminFieldGroup">
                        <label className="adminLabel">LONGITUDE</label>
                        <FieldDiffWrapper field="lng" magicDiff={magicDiff} revertField={revertField}>
                            <input 
                                className={`adminInput ${getHighlightClass("lng")}`} 
                                type="number" 
                                step="any" 
                                value={drafts.lng ?? ""} 
                                onChange={(e) => onChange("lng", e.target.value)} 
                                disabled={disabled}
                            />
                        </FieldDiffWrapper>
                        <SyncDiffLabel field="lng" syncedFields={syncedFields} onRestore={onRestore} />
                    </div>
                    
                    <div className="adminFieldGroup" style={{ gridColumn: "span 2" }}>
                        <label className="adminLabel" style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <span>PLACE ID</span>
                            {drafts.place_id && (
                                <PreviewLinkButton url={`https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${drafts.place_id}`} />
                            )}
                        </label>
                        <FieldDiffWrapper field="place_id" magicDiff={magicDiff} revertField={revertField}>
                            <input 
                                className={`adminInput ${getHighlightClass("place_id")}`} 
                                value={drafts.place_id ?? ""} 
                                onChange={(e) => onChange("place_id", e.target.value)} 
                                disabled={disabled}
                                placeholder="ChI..."
                            />
                        </FieldDiffWrapper>
                        <SyncDiffLabel field="place_id" syncedFields={syncedFields} onRestore={onRestore} />
                    </div>
                </div>
            </div>

        </>
    );
}
