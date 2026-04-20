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
    const FieldDiffWrapper = ({ field, magicDiff = {}, externalDiffs = {}, onRestore, onMagicRevert, children }) => {
        const hasMagic = Object.prototype.hasOwnProperty.call(magicDiff, field);
        const hasExternal = externalDiffs && Object.prototype.hasOwnProperty.call(externalDiffs, field);
        const hasDiff = hasMagic || hasExternal;
        
        // Priority to magic diff if both exist
        const oldValue = hasMagic ? magicDiff[field] : (hasExternal ? externalDiffs[field].old : null);
        const handleRevert = hasMagic ? () => onMagicRevert(field) : (hasExternal ? () => onRestore(field, oldValue) : null);

        return (
            <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
                {React.cloneElement(children, {
                    className: `${children.props.className || ""} ${hasDiff ? "is-magic-new" : ""}`.trim()
                })}
                {hasDiff && (oldValue !== undefined && oldValue !== null) && (
                    <div className="adminMagicOldValue" onClick={handleRevert} title="Click to undo">
                        <span>Original: {oldValue || "(empty)"}</span>
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

    const revertMagicField = (field) => {
        const oldValue = magicDiff[field];
        if (oldValue !== undefined) {
            onChange(field, oldValue);
            setMagicDiff(prev => {
                const next = { ...prev };
                delete next[field];
                return next;
            });
        }
    };


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

    return (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px" }}>
            {/* Row 0: Location Title (Directions) */}
            <div style={{ gridColumn: "span 2" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <label className="adminLabel" style={{ marginBottom: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, overflow: "hidden" }}>
                            <span>Title (Search/Sync)</span>
                            <div style={{ display: "flex", gap: 4 }}>
                                <button 
                                    type="button" 
                                    className="adminLinkSearchBtn"
                                    title="Magic Fill everything from Title"
                                    onClick={handleMagicFill}
                                    disabled={isResolving || !drafts.locationTitle?.trim()}
                                    style={{ padding: 0, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}
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
                </div>
                <FieldDiffWrapper field="locationTitle" magicDiff={magicDiff} externalDiffs={syncedFields} onRestore={onRestore} onMagicRevert={revertMagicField}>
                    <input 
                        className="adminInput" 
                        value={drafts.locationTitle ?? ""} 
                        onChange={(e) => onChange("locationTitle", e.target.value)} 
                        disabled={disabled}
                    />
                </FieldDiffWrapper>
            </div>

            {/* Row 1: Name & City */}
            <label className="adminLabel">
                <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
                    <span>Name *</span>
                </div>
                <FieldDiffWrapper field="name" magicDiff={magicDiff} externalDiffs={syncedFields} onRestore={onRestore} onMagicRevert={revertMagicField}>
                    <input 
                        className="adminInput" 
                        value={drafts.name ?? ""} 
                        onChange={(e) => onChange("name", e.target.value)} 
                        disabled={disabled}
                    />
                </FieldDiffWrapper>
            </label>
            <label className="adminLabel">
                <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
                    <span>City / Locality *</span>
                </div>
                <FieldDiffWrapper field="city" magicDiff={magicDiff} externalDiffs={syncedFields} onRestore={onRestore} onMagicRevert={revertMagicField}>
                    <input 
                        className="adminInput" 
                        value={drafts.city ?? ""} 
                        onChange={(e) => onChange("city", e.target.value)} 
                        disabled={disabled}
                    />
                </FieldDiffWrapper>
            </label>

            {/* Row 2: Country & Zip */}
            <label className="adminLabel">
                <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
                    <span>Country</span>
                </div>
                <FieldDiffWrapper field="country" magicDiff={magicDiff} externalDiffs={syncedFields} onRestore={onRestore} onMagicRevert={revertMagicField}>
                    <SearchableSelect
                        value={drafts.country ?? ""}
                        options={COUNTRY_OPTIONS}
                        onChange={(val) => onChange("country", val)}
                        disabled={disabled}
                        placeholder="Type to search country..."
                    />
                </FieldDiffWrapper>
            </label>
            <label className="adminLabel">
                <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
                    <span>Postal Code</span>
                </div>
                <FieldDiffWrapper field="zipCode" magicDiff={magicDiff} externalDiffs={syncedFields} onRestore={onRestore} onMagicRevert={revertMagicField}>
                    <input 
                        className="adminInput" 
                        value={drafts.zipCode ?? ""} 
                        onChange={(e) => onChange("zipCode", e.target.value)} 
                        disabled={disabled}
                    />
                </FieldDiffWrapper>
            </label>

            {/* Row 3: Street & Number */}
            <div style={{ gridColumn: "span 2", display: "flex", gap: "12px" }}>
                <label className="adminLabel" style={{ flex: 3 }}>
                    <span>Street</span>
                    <FieldDiffWrapper field="street" magicDiff={magicDiff} externalDiffs={syncedFields} onRestore={onRestore} onMagicRevert={revertMagicField}>
                        <input 
                            className="adminInput" 
                            value={drafts.street ?? ""} 
                            onChange={(e) => onChange("street", e.target.value)} 
                            disabled={disabled}
                        />
                    </FieldDiffWrapper>
                </label>
                <label className="adminLabel" style={{ flex: 1 }}>
                    <span>No.</span>
                    <FieldDiffWrapper field="number" magicDiff={magicDiff} externalDiffs={syncedFields} onRestore={onRestore} onMagicRevert={revertMagicField}>
                        <input 
                            className="adminInput" 
                            value={drafts.number ?? ""} 
                            onChange={(e) => onChange("number", e.target.value)} 
                            disabled={disabled}
                        />
                    </FieldDiffWrapper>
                </label>
            </div>

            {/* Row 4: Phone & Email */}
            <label className="adminLabel">
                <span>Phone</span>
                <FieldDiffWrapper field="phone" magicDiff={magicDiff} externalDiffs={syncedFields} onRestore={onRestore} onMagicRevert={revertMagicField}>
                    <input 
                        className="adminInput" 
                        value={drafts.phone ?? ""} 
                        onChange={(e) => onChange("phone", e.target.value)} 
                        disabled={disabled}
                    />
                </FieldDiffWrapper>
            </label>
            <label className="adminLabel">
                <span>Email</span>
                <FieldDiffWrapper field="email" magicDiff={magicDiff} externalDiffs={syncedFields} onRestore={onRestore} onMagicRevert={revertMagicField}>
                    <input 
                        className="adminInput" 
                        value={drafts.email ?? ""} 
                        onChange={(e) => onChange("email", e.target.value)} 
                        disabled={disabled}
                    />
                </FieldDiffWrapper>
            </label>

            {/* Row 5: Web & YouTube */}
            <label className="adminLabel">
                <span>Website</span>
                <FieldDiffWrapper field="website" magicDiff={magicDiff} externalDiffs={syncedFields} onRestore={onRestore} onMagicRevert={revertMagicField}>
                    <input 
                        className="adminInput" 
                        placeholder="https://..." 
                        value={drafts.website ?? ""} 
                        onChange={(e) => onChange("website", e.target.value)} 
                        disabled={disabled}
                    />
                </FieldDiffWrapper>
            </label>
            <label className="adminLabel">
                <span>YouTube</span>
                <FieldDiffWrapper field="youtube" magicDiff={magicDiff} externalDiffs={syncedFields} onRestore={onRestore} onMagicRevert={revertMagicField}>
                    <input 
                        className="adminInput" 
                        placeholder="https://youtube.com/..." 
                        value={drafts.youtube ?? ""} 
                        onChange={(e) => onChange("youtube", e.target.value)} 
                        disabled={disabled}
                    />
                </FieldDiffWrapper>
            </label>

            {/* Row 6: Instagram & Facebook */}
            <label className="adminLabel">
                <span>Instagram</span>
                <FieldDiffWrapper field="instagram" magicDiff={magicDiff} externalDiffs={syncedFields} onRestore={onRestore} onMagicRevert={revertMagicField}>
                    <input 
                        className="adminInput" 
                        placeholder="instagram.com/..." 
                        value={drafts.instagram ?? ""} 
                        onChange={(e) => onChange("instagram", e.target.value)} 
                        disabled={disabled}
                    />
                </FieldDiffWrapper>
            </label>
            <label className="adminLabel">
                <span>Facebook</span>
                <FieldDiffWrapper field="facebook" magicDiff={magicDiff} externalDiffs={syncedFields} onRestore={onRestore} onMagicRevert={revertMagicField}>
                    <input 
                        className="adminInput" 
                        placeholder="facebook.com/..." 
                        value={drafts.facebook ?? ""} 
                        onChange={(e) => onChange("facebook", e.target.value)} 
                        disabled={disabled}
                    />
                </FieldDiffWrapper>
            </label>

            {/* Coordinates Section */}
            <div style={{ gridColumn: "span 2", marginTop: 12, padding: 12, backgroundColor: "rgba(10, 42, 67, 0.03)", borderRadius: 8, border: "1px solid rgba(10, 42, 67, 0.08)" }}>
                <div style={{ marginBottom: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "rgba(10, 42, 67, 0.4)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Coordinates & ID</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px" }}>
                    <label className="adminLabel">
                        <span>Latitude</span>
                        <FieldDiffWrapper field="lat" magicDiff={magicDiff} externalDiffs={syncedFields} onRestore={onRestore} onMagicRevert={revertMagicField}>
                            <input 
                                className="adminInput" 
                                type="number" 
                                step="any" 
                                value={drafts.lat ?? ""} 
                                onChange={(e) => onChange("lat", e.target.value)} 
                                disabled={disabled}
                            />
                        </FieldDiffWrapper>
                    </label>
                    <label className="adminLabel">
                        <span>Longitude</span>
                        <FieldDiffWrapper field="lng" magicDiff={magicDiff} externalDiffs={syncedFields} onRestore={onRestore} onMagicRevert={revertMagicField}>
                            <input 
                                className="adminInput" 
                                type="number" 
                                step="any" 
                                value={drafts.lng ?? ""} 
                                onChange={(e) => onChange("lng", e.target.value)} 
                                disabled={disabled}
                            />
                        </FieldDiffWrapper>
                    </label>
                
                    <label className="adminLabel" style={{ gridColumn: "span 2" }}>
                        <span>Google Place ID</span>
                        <FieldDiffWrapper field="place_id" magicDiff={magicDiff} externalDiffs={syncedFields} onRestore={onRestore} onMagicRevert={revertMagicField}>
                            <input 
                                className="adminInput" 
                                value={drafts.place_id ?? ""} 
                                onChange={(e) => onChange("place_id", e.target.value)} 
                                disabled={disabled}
                                placeholder="ChI..."
                            />
                        </FieldDiffWrapper>
                    </label>
                </div>
            </div>
        </div>
    );
}
