"use client";

import React from "react";
import { COUNTRY_OPTIONS } from "../utils/churchHelpers";
import { PreviewLinkButton, GoogleSearchButton } from "./SyncDiffLabel";
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
    const FieldDiffWrapper = ({ field, externalDiffs = {}, onRestore, children }) => {
        const hasExternal = externalDiffs && Object.prototype.hasOwnProperty.call(externalDiffs, field);
        const oldValue = hasExternal ? externalDiffs[field].old : null;

        return (
            <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
                {React.cloneElement(children, {
                    className: `${children.props.className || ""} ${hasExternal ? "is-magic-new" : ""}`.trim()
                })}
                {hasExternal && (oldValue !== undefined && oldValue !== null) && (
                    <div className="adminMagicOldValue" onClick={() => onRestore(field, oldValue)} title="Click to undo">
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
    return (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px" }}>
            {/* Row 0: Location Title (Directions) */}
            <div style={{ gridColumn: "span 2" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <label className="adminLabel" style={{ marginBottom: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, overflow: "hidden" }}>
                            <span>Title (Search/Sync)</span>
                        </div>
                    </label>
                </div>
                <FieldDiffWrapper field="locationTitle" externalDiffs={syncedFields} onRestore={onRestore}>
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
                    <GoogleSearchButton query={`${drafts.name || ""} ${drafts.city || ""} biserica penticostala`} />
                </div>
                <FieldDiffWrapper field="name" externalDiffs={syncedFields} onRestore={onRestore}>
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
                <FieldDiffWrapper field="city" externalDiffs={syncedFields} onRestore={onRestore}>
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
                <FieldDiffWrapper field="country" externalDiffs={syncedFields} onRestore={onRestore}>
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
                <FieldDiffWrapper field="zipCode" externalDiffs={syncedFields} onRestore={onRestore}>
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
                    <FieldDiffWrapper field="street" externalDiffs={syncedFields} onRestore={onRestore}>
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
                    <FieldDiffWrapper field="number" externalDiffs={syncedFields} onRestore={onRestore}>
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
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span>Phone</span>
                    <GoogleSearchButton query={`${drafts.name || ""} ${drafts.city || ""} phone number`} />
                </div>
                <FieldDiffWrapper field="phone" externalDiffs={syncedFields} onRestore={onRestore}>
                    <input 
                        className="adminInput" 
                        value={drafts.phone ?? ""} 
                        onChange={(e) => onChange("phone", e.target.value)} 
                        disabled={disabled}
                    />
                </FieldDiffWrapper>
            </label>
            <label className="adminLabel">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span>Email</span>
                    <GoogleSearchButton query={`${drafts.name || ""} ${drafts.city || ""} email`} />
                </div>
                <FieldDiffWrapper field="email" externalDiffs={syncedFields} onRestore={onRestore}>
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
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span>Website</span>
                    <div style={{ display: "flex", gap: 4 }}>
                        <GoogleSearchButton query={`${drafts.name || ""} ${drafts.city || ""} website`} />
                        {drafts.website && <PreviewLinkButton url={drafts.website} />}
                    </div>
                </div>
                <FieldDiffWrapper field="website" externalDiffs={syncedFields} onRestore={onRestore}>
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
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span>YouTube</span>
                    <div style={{ display: "flex", gap: 4 }}>
                        <GoogleSearchButton query={`${drafts.name || ""} ${drafts.city || ""} youtube`} />
                        {drafts.youtube && <PreviewLinkButton url={drafts.youtube} />}
                    </div>
                </div>
                <FieldDiffWrapper field="youtube" externalDiffs={syncedFields} onRestore={onRestore}>
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
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span>Instagram</span>
                    <div style={{ display: "flex", gap: 4 }}>
                        <GoogleSearchButton query={`${drafts.name || ""} ${drafts.city || ""} instagram`} />
                        {drafts.instagram && <PreviewLinkButton url={drafts.instagram} />}
                    </div>
                </div>
                <FieldDiffWrapper field="instagram" externalDiffs={syncedFields} onRestore={onRestore}>
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
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span>Facebook</span>
                    <div style={{ display: "flex", gap: 4 }}>
                        <GoogleSearchButton query={`${drafts.name || ""} ${drafts.city || ""} facebook`} />
                        {drafts.facebook && <PreviewLinkButton url={drafts.facebook} />}
                    </div>
                </div>
                <FieldDiffWrapper field="facebook" externalDiffs={syncedFields} onRestore={onRestore}>
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
                        <FieldDiffWrapper field="lat" externalDiffs={syncedFields} onRestore={onRestore}>
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
                        <FieldDiffWrapper field="lng" externalDiffs={syncedFields} onRestore={onRestore}>
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
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span>Google Place ID</span>
                            {drafts.place_id && (
                                <PreviewLinkButton url={`https://www.google.com/maps/search/?api=1&query=church&query_place_id=${drafts.place_id}`} />
                            )}
                        </div>
                        <FieldDiffWrapper field="place_id" externalDiffs={syncedFields} onRestore={onRestore}>
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
