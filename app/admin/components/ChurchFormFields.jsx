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
        if (!drafts.locationTitle?.trim()) return;
        setIsResolving(true);
        const resolved = await resolveChurchFromTitle(drafts.locationTitle);
        setIsResolving(false);

        if (resolved) {
            const newDiff = {};
            // Bulk update all fields
            Object.keys(resolved).forEach(key => {
                const newValue = resolved[key];
                const oldValue = drafts[key];
                
                if (newValue && newValue !== oldValue) {
                    onChange(key, newValue);
                    // Only track diff if there was a previous value
                    if (oldValue) {
                        newDiff[key] = oldValue;
                    }
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

    const FieldDiffWrapper = ({ field, children }) => {
        const oldValue = magicDiff[field];
        const hasDiff = !!oldValue;

        return (
            <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
                {React.cloneElement(children, {
                    className: `${children.props.className || ""} ${hasDiff ? "is-magic-new" : ""}`.trim()
                })}
                {hasDiff && (
                    <div className="adminMagicOldValue" onClick={() => revertField(field)} title="Click to undo magic fill">
                        <span>Original: {oldValue}</span>
                        <div className="adminRevertIcon">Undo ↺</div>
                    </div>
                )}
            </div>
        );
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
                                            <IconMagic style={{ width: 14, height: 14, color: "#666" }} />
                                        )}
                                    </button>
                                    {(() => {
                                        const googleMapsLink = drafts.googleMapsUri 
                                            ? drafts.googleMapsUri 
                                            : drafts.place_id 
                                                ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Biserica penticostală ${drafts.name} ${drafts.city || ""}`.trim())}&query_place_id=${drafts.place_id}`
                                                : drafts.name 
                                                    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Biserica penticostală ${drafts.name} ${drafts.city || ""} ${drafts.country || ""}`.trim())}`
                                                    : null;
                                        
                                        return googleMapsLink ? <PreviewLinkButton url={googleMapsLink} /> : null;
                                    })()}
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
                    <FieldDiffWrapper field="name">
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
                    <FieldDiffWrapper field="city">
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
                    <FieldDiffWrapper field="country">
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
                    <FieldDiffWrapper field="zipCode">
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
                            <FieldDiffWrapper field="number">
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

                    <FieldDiffWrapper field="phone">
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
                        <div style={{ display: "flex", gap: 4 }}>
                            <GoogleSearchButton query={`${searchQuery} official website`} />
                            <PreviewLinkButton url={drafts.website} />
                        </div>
                    </div>
                    <input 
                        className={`adminInput ${getHighlightClass("website")}`} 
                        placeholder="https://..." 
                        value={drafts.website ?? ""} 
                        onChange={(e) => onChange("website", e.target.value)} 
                        disabled={disabled}
                    />
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

                    <input 
                        className={`adminInput ${getHighlightClass("youtube")}`} 
                        placeholder="https://youtube.com/..." 
                        value={drafts.youtube ?? ""} 
                        onChange={(e) => onChange("youtube", e.target.value)} 
                        disabled={disabled}
                    />
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
                    <input 
                        className={`adminInput ${getHighlightClass("instagram")}`} 
                        placeholder="instagram.com/..." 
                        value={drafts.instagram ?? ""} 
                        onChange={(e) => onChange("instagram", e.target.value)} 
                        disabled={disabled}
                    />
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
                    <input 
                        className={`adminInput ${getHighlightClass("facebook")}`} 
                        placeholder="facebook.com/..." 
                        value={drafts.facebook ?? ""} 
                        onChange={(e) => onChange("facebook", e.target.value)} 
                        disabled={disabled}
                    />
                    <SyncDiffLabel field="facebook" syncedFields={syncedFields} onRestore={onRestore} showPreview={true} />
                </label>
            </div>




            {/* Coordinates Section */}
            <div style={{ marginTop: 12, padding: 12, backgroundColor: "rgba(10, 42, 67, 0.03)", borderRadius: 8, border: "1px solid rgba(10, 42, 67, 0.08)" }}>
                <div style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(10, 42, 67, 0.7)" }}>Coordinates</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div className="adminFieldGroup">
                        <label className="adminLabel">LATITUDE</label>
                        <FieldDiffWrapper field="lat">
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
                        <FieldDiffWrapper field="lng">
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
                </div>
            </div>

        </>
    );
}
