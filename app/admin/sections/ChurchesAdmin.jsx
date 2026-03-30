"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { collection, addDoc, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../../lib/Firebase";
import { usePagination } from "../hooks/usePagination";
import PaginationControls from "../components/PaginationControls";
import ConfirmModal from "../components/ConfirmModal";
import AdminSearch from "../components/AdminSearch";

const safeStr = (v) => String(v ?? "");

const normalizeText = (text) => {
    return (text || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
};

const matchChurchSearch = (c, q) => {
    if (!q) return true;
    const normalizedQuery = normalizeText(q);
    const fields = [c.name, c.city];
    return fields.some(val => normalizeText(val).includes(normalizedQuery));
};

function IconPlus(props) {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function IconTrash(props) {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
            <path d="M4 7h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M6 7l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

function IconSave(props) {
    return (
        <svg fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" {...props}>
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
        </svg>
    );
}

function IconEyeOff(props) {
    return (
        <svg fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" {...props}>
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
    );
}

function IconEye(props) {
    return (
        <svg fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" {...props}>
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    );
}

function IconSync(props) {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
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
    {key: "website", label: "Website", type: "text" },
    { key: "youtube", label: "YouTube", type: "text" },
    { key: "instagram", label: "Instagram", type: "text" },
    { key: "facebook", label: "Facebook", type: "text" },
];

function emptyChurch() {
    return { name: "", locationTitle: "", street: "", number: "", city: "", country: "Belgium", zipCode: "", lat: "", lng: "", phone: "", email: "", website: "", youtube: "", facebook: "", instagram: "", notes: "", isDraft: false, place_id: "", openingHours: [], photos: [], googleMapsUri: "", rating: null };
}

const geocodeAddress = async (street, number, city, zipCode, country, locationTitle = "") => {
    // 1. Try Places API via proxy if we have a locationTitle
    if (locationTitle) {
        try {
            const placeQuery = [locationTitle, city, country].filter(Boolean).join(", ");
            const res = await fetch(`/api/geocode?type=places&query=${encodeURIComponent(placeQuery)}`);
            const data = await res.json();
            if (data.results && data.results.length > 0) {
                const loc = data.results[0].geometry?.location;
                return { 
                    lat: loc?.lat ?? null, 
                    lng: loc?.lng ?? null 
                };
            }
        } catch (e) {
            console.error("Places Proxy Search failed:", e);
        }
    }

    // 2. Fallback to standard Geocoding API via proxy
    const addressQuery = [`${street || ""} ${number || ""}`.trim(), zipCode, city, country].map(s => (s || "").trim()).filter(Boolean).join(", ");
    if (!addressQuery) return null;

    try {
        const res = await fetch(`/api/geocode?type=geocode&address=${encodeURIComponent(addressQuery)}`);
        const data = await res.json();
        if (data.results && data.results.length > 0) {
            const loc = data.results[0].geometry.location;
            return { lat: loc.lat, lng: loc.lng };
        }
    } catch (e) {
        console.error("Geocoding Proxy failed:", e);
    }
    return null;
};

const hasDraftChanges = (item, draft) => {
    if (!item || !draft) return false;
    const fields = ["name", "locationTitle", "street", "number", "city", "country", "zipCode", "phone", "email", "website", "youtube", "facebook", "instagram", "lat", "lng", "place_id"];
    for (const f of fields) {
        if (String(item[f] || "") !== String(draft[f] || "")) return true;
    }
    // Also check hours & photos
    if (JSON.stringify(item.openingHours || []) !== JSON.stringify(draft.openingHours || [])) return true;
    if (JSON.stringify(item.photos || []) !== JSON.stringify(draft.photos || [])) return true;
    return false;
};

const processGoogleData = (res, components, originalQuery = "", placeId = "", fallbackUsed = false, googleError = null) => {
    const getComp = (types) => {
        const comp = components.find(c => c.types && types.some(t => c.types.includes(t)));
        return comp ? comp.long_name : null; // Return null if not found
    };

    const cityName = getComp(["locality", "postal_town"]);
    let countryName = getComp(["country"]);
    if (countryName) {
        const matched = COUNTRY_OPTIONS.find(c => c.toLowerCase() === countryName.toLowerCase());
        if (matched) countryName = matched;
    }

    let rawName = res.name || originalQuery || "";
    const noise = [
        "Biserica", "Penticostala", "Penticostală", "Penticostal", 
        "Crestina", "Creștină", "Crestin", "Creștin",
        "Christian", "Church", "Pentecostal"
    ];
    if (cityName) noise.push(cityName);
    
    const normalize = (s) => s ? s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";
    const noiseNormalized = new Set(noise.map(normalize));
    
    const words = rawName.split(/[\s,.;:„”"()\-–—\/]+/);
    let cleanedName = words
        .filter(w => w && !noiseNormalized.has(normalize(w)))
        .join(" ")
        .trim();

    if (cleanedName.length < 2) cleanedName = rawName;

    // Use a helper to only add defined/non-empty properties
    const result = {};
    const setIf = (key, val) => {
        if (val !== undefined && val !== null && val !== "") {
            result[key] = val;
        }
    };

    setIf("name", cleanedName);
    setIf("street", getComp(["route"]));
    setIf("number", getComp(["street_number"]));
    setIf("city", cityName);
    setIf("zipCode", getComp(["postal_code"]));
    setIf("country", countryName);
    setIf("phone", res.international_phone_number);
    setIf("website", res.website);
    setIf("lat", res.geometry?.location?.lat);
    setIf("lng", res.geometry?.location?.lng);
    setIf("place_id", res.place_id || placeId);
    
    // Always include these as we want to know if they are empty on Google
    // but only if they were actually fetched (details/places search)
    if (res.openingHours !== undefined) result.openingHours = res.openingHours || [];
    if (res.photos !== undefined) result.photos = res.photos || [];
    if (res.googleMapsUri !== undefined) result.googleMapsUri = res.googleMapsUri || "";
    if (res.rating !== undefined) result.rating = res.rating || null;

    result._partial = fallbackUsed;
    result._googleError = googleError;

    return result;
};

const fetchGooglePlaceData = async (query, city = "", country = "", placeId = "") => {
    // If we have a placeId, we go STRAIGHT to details (saves cost and is more accurate)
    if (placeId) {
        console.log("Syncing via Place ID (Priority):", placeId);
        try {
            const detailsRes = await fetch(`/api/geocode?type=details&place_id=${placeId}`);
            const detailsData = await detailsRes.json();
            
            if (detailsData.result) {
                return processGoogleData(detailsData.result, detailsData.result.address_components || [], query, placeId);
            }
        } catch (e) {
            console.error("Fetch by Place ID failed, will try search as fallback:", e);
        }
    }

    if (!query) return null;
    console.log("Searching Google for:", query, city, country);
    
    try {
        // 1. If country is "Belgium" (default), try searching with just the query first
        // to avoid restricting Romanian/other churches to Belgium.
        let results = [];
        let status = "ZERO_RESULTS";
        let fallbackUsed = false;
        let googleError = null;

        const performSearch = async (q) => {
            const res = await fetch(`/api/geocode?type=places&query=${encodeURIComponent(q)}`);
            return await res.json();
        };

        // Try with provided context first only if it's NOT the default Belgium
        if (country && country !== "Belgium") {
            const q = [query, city, country].filter(Boolean).join(", ");
            const data = await performSearch(q);
            results = data.results || [];
            status = data.status;
            googleError = data._googleError;
            fallbackUsed = data._fallback || false;
        }

        // 2. Fallback or primary search with just the query
        if (results.length === 0) {
            console.log("Searching with just query:", query);
            const data = await performSearch(query);
            results = data.results || [];
            status = data.status;
            googleError = data._googleError;
            fallbackUsed = data._fallback || false;
        }
        
        if (results.length === 0) {
            console.warn("No results found for query:", query);
            return null;
        }

        const firstResult = results[0];

        if (firstResult.address_components || fallbackUsed) {
            console.log("Using Geocoding/fallback data directly");
            return processGoogleData(firstResult, firstResult.address_components || [], query, "", fallbackUsed, googleError);
        }
        
        console.log("Found results, fetching details for:", firstResult.name);
        const detailsRes = await fetch(`/api/geocode?type=details&place_id=${firstResult.place_id || firstResult.id}`);
        const detailsData = await detailsRes.json();
        
        if (!detailsData.result) return null;
        return processGoogleData(detailsData.result, detailsData.result.address_components || [], query, "", fallbackUsed, googleError);

    } catch (e) {
        console.error("Fetch Google Place Data failed:", e);
        return null;
    }
};

const SyncDiffLabel = ({ field, syncedFields }) => {
    if (!syncedFields || !syncedFields[field]) return null;
    const { old } = syncedFields[field];
    return (
        <span 
            className="adminSyncDiffLabel" 
            title={old || "(vide)"}
            style={{ 
                backgroundColor: "rgba(239, 68, 68, 0.05)", 
                padding: "2px 6px", 
                borderRadius: "4px", 
                border: "1px solid rgba(239, 68, 68, 0.2)",
                marginLeft: "8px",
                maxWidth: "80px",
                display: "inline-block",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                verticalAlign: "middle",
                fontSize: "10px"
            }}
        >
            <span style={{ textDecoration: "line-through", color: "#ef4444", opacity: 0.6 }}>{old || "(vide)"}</span>
        </span>
    );
};

const SyncableIcon = () => (
    <span title="Synchronisable avec Google" style={{ 
        display: "inline-flex", 
        alignItems: "center", 
        justifyContent: "center",
        width: "18px",
        height: "18px",
        marginLeft: "8px",
        borderRadius: "4px",
        background: "transparent",
        color: "#2563eb",
        cursor: "help"
    }}>
        <IconSync style={{ width: 10, height: 10 }} />
    </span>
);

const PhotoLightbox = ({ url, onClose }) => {
    if (!url) return null;
    return (
        <div className="adminLightbox" onClick={onClose}>
            <img src={url} alt="Enlarged view" className="adminLightboxImage" onClick={(e) => e.stopPropagation()} />
        </div>
    );
};

function ChurchCard({ item, expanded, drafts, saveState, errorText, onToggle, onChange, onSave, onDelete, setSaveStateById, setErrorById, onPhotoClick }) {
    const id = item.id;
    const isDraft = drafts.isDraft || false;
    const [syncedFields, setSyncedFields] = useState({});
    const [photoIndex, setPhotoIndex] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncSuccess, setSyncSuccess] = useState(false);
    const photoRef = useRef(null);

    // Reset highlights on toggle/collapse to avoid stale visual cues
    useEffect(() => {
        if (!expanded) {
            setSyncedFields({});
            setPhotoIndex(0);
            setSyncSuccess(false);
        }
    }, [expanded]);

    // Clear highlights on successful save
    useEffect(() => {
        if (saveState === "saved") {
            setSyncedFields({});
        }
    }, [saveState]);

    const handleSync = async () => {
        const query = drafts.locationTitle || drafts.name;
        const data = await fetchGooglePlaceData(query, drafts.city, drafts.country, drafts.place_id);
        
        if (data) {
            const newSyncMap = {};
            Object.entries(data).forEach(([k, v]) => {
                if (v !== undefined && v !== null) {
                    const currentVal = drafts[k];
                    // Compare values (simplified string compare for most fields)
                    if (String(currentVal || "") !== String(v || "")) {
                        newSyncMap[k] = { old: String(currentVal || "") };
                    }
                    onChange(id, k, v);
                }
            });
            setSyncedFields(newSyncMap);
        }
    };

    const handleFieldChange = (field, value) => {
        // Keep the highlight as requested by the user, even if modified manually
        onChange(id, field, value);
    };

    const getHighlightClass = (field) => syncedFields[field] ? "is-synced-highlight" : "";

    return (
        <div className={`adminAnnCard ${isDraft ? "is-draft" : ""}`} style={isDraft ? { backgroundColor: "#fffbeb" } : {}}>
            <div className="adminAnnHeader" style={{ cursor: "pointer", justifyContent: "space-between" }} onClick={() => onToggle(id)}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="adminSummary">{item.name}</span>
                    {item.isDraft && (
                        <span style={{ 
                            fontSize: "0.7rem", 
                            fontWeight: 800, 
                            color: "#92400e", 
                            backgroundColor: "#fef3c7", 
                            padding: "2px 6px", 
                            borderRadius: "4px",
                            textTransform: "uppercase"
                        }}>
                            Draft
                        </span>
                    )}
                    <span className="adminMuted" style={{ fontSize: "0.8rem", marginLeft: 8 }}>
                        • {item.city}, {item.country}
                    </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <button
                        type="button"
                        className="adminSmallBtn"
                    >
                        <IconChevronDown style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }} />
                    </button>
                </div>
            </div>

            {expanded ? (
                <div className="adminAnnBody">
                    {errorText ? <div className="adminAlert">{errorText}</div> : null}

                    {item.createdByInfo ? (
                        <div style={{ color: "rgba(10, 42, 67, 0.6)", fontWeight: 500, fontSize: 13, marginBottom: 4 }}>
                            Created by {item.createdByInfo.name} on {item.createdByInfo.date}
                        </div>
                    ) : item.createdAt ? (
                        <div style={{ color: "rgba(10, 42, 67, 0.6)", fontWeight: 500, fontSize: 13, marginBottom: 4 }}>
                            Created by Popadiuc Claudiu on {item.createdAt}
                        </div>
                    ) : null}

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
                        {/* Row 0: Location Title (Directions) - Back to top */}
                        <div style={{ gridColumn: "span 2" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                                <label className="adminLabel" style={{ marginBottom: 0 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 8 }}>
                                        <span>Location Title (Directions)</span>
                                        <SyncDiffLabel field="locationTitle" syncedFields={syncedFields} />
                                    </div>
                                </label>
                                <button 
                                    type="button" 
                                    style={{ fontSize: 11, fontWeight: 700, color: "#2563eb", border: "none", background: "transparent", padding: "4px 0", borderRadius: 6, cursor: isSyncing ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s", opacity: isSyncing ? 0.5 : 1 }}
                                    disabled={isSyncing}
                                    onClick={async () => {
                                        setSaveStateById(m => ({ ...m, [id]: "saving" }));
                                        setIsSyncing(true);
                                        setSyncSuccess(false);
                                        try {
                                            await handleSync();
                                            // Don't set state to "saved" here as it clears the highlights!
                                            // Just return to idle so user can review the green fields.
                                            setSaveStateById(m => ({ ...m, [id]: "idle" }));
                                            setSyncSuccess(true);
                                            setTimeout(() => setSyncSuccess(false), 3000);
                                        } catch (e) {
                                            console.error("Sync failed:", e);
                                            setSaveStateById(m => ({ ...m, [id]: "error" }));
                                            setErrorById(m => ({ ...m, [id]: "Synchronization failed." }));
                                        } finally {
                                            setIsSyncing(false);
                                        }
                                    }}
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
                            </div>
                            <input 
                                className={`adminInput ${getHighlightClass("locationTitle")}`} 
                                value={drafts.locationTitle ?? ""} 
                                onChange={(e) => handleFieldChange("locationTitle", e.target.value)} 
                                placeholder="Search by name, address or place ID..."
                                disabled={isSyncing}
                            />
                        </div>

                        {/* Row 1: Name & City */}
                        <label className="adminLabel">
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                                <span>Name * <SyncableIcon /></span>
                                <SyncDiffLabel field="name" syncedFields={syncedFields} />
                            </div>
                            <input 
                                className={`adminInput ${getHighlightClass("name")}`} 
                                value={drafts.name ?? ""} 
                                onChange={(e) => handleFieldChange("name", e.target.value)} 
                            />
                        </label>
                        <label className="adminLabel">
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                                <span>City / Locality * <SyncableIcon /></span>
                                <SyncDiffLabel field="city" syncedFields={syncedFields} />
                            </div>
                            <input 
                                className={`adminInput ${getHighlightClass("city")}`} 
                                value={drafts.city ?? ""} 
                                onChange={(e) => handleFieldChange("city", e.target.value)} 
                            />
                        </label>

                        {/* Row 2: Country & Postal Code */}
                        <label className="adminLabel">
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                                <span>Country <SyncableIcon /></span>
                                <SyncDiffLabel field="country" syncedFields={syncedFields} />
                            </div>
                            <select 
                                className={`adminSelect ${getHighlightClass("country")}`} 
                                style={{ width: "100%", marginTop: 4 }} 
                                value={drafts.country ?? ""} 
                                onChange={(e) => handleFieldChange("country", e.target.value)}
                            >
                                <option value="">-- Select Country --</option>
                                {COUNTRY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </label>
                        <label className="adminLabel">
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                                <span>Postal Code <SyncableIcon /></span>
                                <SyncDiffLabel field="zipCode" syncedFields={syncedFields} />
                            </div>
                            <input 
                                className={`adminInput ${getHighlightClass("zipCode")}`} 
                                value={drafts.zipCode ?? ""} 
                                onChange={(e) => handleFieldChange("zipCode", e.target.value)} 
                            />
                        </label>

                        {/* Row 3: Street & Number */}
                        <div style={{ gridColumn: "span 2", display: "flex", gap: "12px" }}>
                            <div style={{ flex: 3 }}>
                                <label className="adminLabel">
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                                        <span>Street <SyncableIcon /></span>
                                        <SyncDiffLabel field="street" syncedFields={syncedFields} />
                                    </div>
                                    <input 
                                        className={`adminInput ${getHighlightClass("street")}`} 
                                        value={drafts.street ?? ""} 
                                        onChange={(e) => handleFieldChange("street", e.target.value)} 
                                    />
                                </label>
                            </div>
                            <div style={{ flex: 1 }}>
                                <label className="adminLabel">
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                                        <span>Number <SyncableIcon /></span>
                                        <SyncDiffLabel field="number" syncedFields={syncedFields} />
                                    </div>
                                    <input 
                                        className={`adminInput ${getHighlightClass("number")}`} 
                                        value={drafts.number ?? ""} 
                                        onChange={(e) => handleFieldChange("number", e.target.value)} 
                                    />
                                </label>
                            </div>
                        </div>

                        {/* Row 4: Phone & Email */}
                        <label className="adminLabel">
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                                <span>Phone <SyncableIcon /></span>
                                <SyncDiffLabel field="phone" syncedFields={syncedFields} />
                            </div>
                            <input 
                                className={`adminInput ${getHighlightClass("phone")}`} 
                                value={drafts.phone ?? ""} 
                                onChange={(e) => handleFieldChange("phone", e.target.value)} 
                            />
                        </label>
                        <label className="adminLabel">
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                                <span>Email</span>
                                <SyncDiffLabel field="email" syncedFields={syncedFields} />
                            </div>
                            <input 
                                className={`adminInput ${getHighlightClass("email")}`} 
                                value={drafts.email ?? ""} 
                                onChange={(e) => handleFieldChange("email", e.target.value)} 
                            />
                        </label>

                        {/* Row 5: Website & Youtube */}
                        <label className="adminLabel">
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                                <span>Website <SyncableIcon /></span>
                                <SyncDiffLabel field="website" syncedFields={syncedFields} />
                            </div>
                            <input 
                                className={`adminInput ${getHighlightClass("website")}`} 
                                placeholder="https://..." 
                                value={drafts.website ?? ""} 
                                onChange={(e) => handleFieldChange("website", e.target.value)} 
                            />
                        </label>
                        <label className="adminLabel">
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                                <span>YouTube</span>
                                <SyncDiffLabel field="youtube" syncedFields={syncedFields} />
                            </div>
                            <input 
                                className={`adminInput ${getHighlightClass("youtube")}`} 
                                placeholder="https://youtube.com/..." 
                                value={drafts.youtube ?? ""} 
                                onChange={(e) => handleFieldChange("youtube", e.target.value)} 
                            />
                        </label>

                        <label className="adminLabel">
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                                <span>Instagram</span>
                                <SyncDiffLabel field="instagram" syncedFields={syncedFields} />
                            </div>
                            <input 
                                className={`adminInput ${getHighlightClass("instagram")}`} 
                                placeholder="instagram.com/..." 
                                value={drafts.instagram ?? ""} 
                                onChange={(e) => handleFieldChange("instagram", e.target.value)} 
                            />
                        </label>
                        <label className="adminLabel">
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                                <span>Facebook</span>
                                <SyncDiffLabel field="facebook" syncedFields={syncedFields} />
                            </div>
                            <input 
                                className={`adminInput ${getHighlightClass("facebook")}`} 
                                placeholder="facebook.com/..." 
                                value={drafts.facebook ?? ""} 
                                onChange={(e) => handleFieldChange("facebook", e.target.value)} 
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
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                                    <span>Latitude <SyncableIcon /></span>
                                    <SyncDiffLabel field="lat" syncedFields={syncedFields} />
                                </div>
                                <input 
                                    className={`adminInput ${getHighlightClass("lat")}`} 
                                    type="number" 
                                    step="any" 
                                    value={drafts.lat ?? ""} 
                                    onChange={(e) => handleFieldChange("lat", e.target.value)} 
                                />
                            </label>
                            <label className="adminLabel">
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                                    <span>Longitude <SyncableIcon /></span>
                                    <SyncDiffLabel field="lng" syncedFields={syncedFields} />
                                </div>
                                <input 
                                    className={`adminInput ${getHighlightClass("lng")}`} 
                                    type="number" 
                                    step="any" 
                                    value={drafts.lng ?? ""} 
                                    onChange={(e) => handleFieldChange("lng", e.target.value)} 
                                />
                            </label>
                        </div>
                    </div>

                    {/* Google Enrichment Section: Hours & Photos */}
                    {(drafts.place_id || drafts.openingHours?.length > 0 || drafts.photos?.length > 0) && (
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
                                {/* Schedule */}
                                <div>
                                    <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.6, textTransform: "uppercase", display: "block", marginBottom: 8 }}>Schedule / Hours</span>
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

                                {/* Link */}
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
                                        <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.6, textTransform: "uppercase" }}>Photos</span>
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
                                            const photoUrl = `/api/geocode?type=photo&photo_name=${encodeURIComponent(p)}`;
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


                    <div className="adminMsgActions adminMsgActions--3" style={{ marginTop: "20px" }}>
                        <button
                            type="button"
                            className="adminDeleteBtn"
                            onClick={(e) => { e.stopPropagation(); onDelete(id); }}
                            disabled={saveState === "saving"}
                        >
                            <IconTrash />
                            Delete
                        </button>

                        <button
                            type="button"
                            className="adminDraftBtn"
                            onClick={(e) => { e.stopPropagation(); onSave(id, !drafts.isDraft); }}
                            disabled={saveState === "saving"}
                        >
                            {drafts.isDraft ? <IconEye /> : <IconEyeOff />}
                            {drafts.isDraft ? "Undraft" : "Draft"}
                        </button>

                        <button
                            type="button"
                            className="adminMsgSaveBtn"
                            onClick={(e) => { e.stopPropagation(); onSave(id); }}
                            disabled={saveState === "saving"}
                        >
                            <IconSave />
                            {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : "Save"}
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

function NewChurchCard({ drafts, setDraft, errorText, saveState, onCancel, onSave, onPhotoClick }) {
    const [syncedFields, setSyncedFields] = useState({});
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncSuccess, setSyncSuccess] = useState(false);
    const photoRef = useRef(null);

    // Clear highlights on successful save
    useEffect(() => {
        if (saveState === "saved") {
            setSyncedFields({});
        }
    }, [saveState]);

    const handleFieldChange = (field, value) => {
        // Keep the highlight
        setDraft(field, value);
    };
    const getHighlightClass = (field) => syncedFields[field] ? "is-synced-highlight" : "";

    return (
        <div className="adminAnnCard is-active">
            <div className="adminAnnHeader">
                <div className="adminAnnIdChip">New Church</div>
            </div>

            <div className="adminAnnBody">
                {errorText ? <div className="adminAlert">{errorText}</div> : null}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
                    {/* Row 0: Location Title (Directions) - Back to top */}
                    <div style={{ gridColumn: "span 2" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                            <label className="adminLabel" style={{ marginBottom: 0 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                                    <span>Location Title (Directions)</span>
                                    <SyncDiffLabel field="locationTitle" syncedFields={syncedFields} />
                                </div>
                            </label>
                            <button 
                                type="button" 
                                style={{ fontSize: 11, fontWeight: 700, color: "#2563eb", border: "none", background: "transparent", padding: "4px 0", borderRadius: 6, cursor: isSyncing ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s", opacity: isSyncing ? 0.5 : 1 }}
                                disabled={isSyncing}
                                onClick={async () => {
                                    setIsSyncing(true);
                                    setSyncSuccess(false);
                                    try {
                                        const data = await fetchGooglePlaceData(drafts.locationTitle || drafts.name, drafts.city, drafts.country, drafts.place_id);
                                        if (data) {
                                            const newSyncMap = {};
                                            Object.entries(data).forEach(([k, v]) => {
                                                if (v !== undefined) {
                                                    if (String(drafts[k] || "") !== String(v || "")) {
                                                        newSyncMap[k] = { old: String(drafts[k] || "") };
                                                    }
                                                    setDraft(k, v);
                                                }
                                            });
                                            setSyncedFields(newSyncMap);
                                            setSyncSuccess(true);
                                            setTimeout(() => setSyncSuccess(false), 3000);
                                        }
                                    } finally {
                                        setIsSyncing(false);
                                    }
                                }}
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
                        </div>
                        <input 
                            className={`adminInput ${getHighlightClass("locationTitle")}`} 
                            value={drafts.locationTitle ?? ""} 
                            onChange={(e) => handleFieldChange("locationTitle", e.target.value)} 
                        />
                    </div>

                    {/* Row 1: Name & City */}
                    <label className="adminLabel">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                            <span>Name * <SyncableIcon /></span>
                            <SyncDiffLabel field="name" syncedFields={syncedFields} />
                        </div>
                        <input 
                            className={`adminInput ${getHighlightClass("name")}`} 
                            value={drafts.name ?? ""} 
                            onChange={(e) => handleFieldChange("name", e.target.value)} 
                        />
                    </label>
                    <label className="adminLabel">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                            <span>City / Locality * <SyncableIcon /></span>
                            <SyncDiffLabel field="city" syncedFields={syncedFields} />
                        </div>
                        <input 
                            className={`adminInput ${getHighlightClass("city")}`} 
                            value={drafts.city ?? ""} 
                            onChange={(e) => handleFieldChange("city", e.target.value)} 
                        />
                    </label>

                    <label className="adminLabel">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                            <span>Country <SyncableIcon /></span>
                            <SyncDiffLabel field="country" syncedFields={syncedFields} />
                        </div>
                        <select 
                            className={`adminSelect ${getHighlightClass("country")}`} 
                            style={{ width: "100%", marginTop: 4 }} 
                            value={drafts.country ?? ""} 
                            onChange={(e) => handleFieldChange("country", e.target.value)}
                        >
                            <option value="">-- Select Country --</option>
                            {COUNTRY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                    </label>
                    <label className="adminLabel">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                            <span>Postal Code <SyncableIcon /></span>
                            <SyncDiffLabel field="zipCode" syncedFields={syncedFields} />
                        </div>
                        <input 
                            className={`adminInput ${getHighlightClass("zipCode")}`} 
                            value={drafts.zipCode ?? ""} 
                            onChange={(e) => handleFieldChange("zipCode", e.target.value)} 
                        />
                    </label>

                    <div style={{ gridColumn: "span 2", display: "flex", gap: "12px" }}>
                        <div style={{ flex: 3 }}>
                            <label className="adminLabel">
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                                    <span>Street <SyncableIcon /></span>
                                    <SyncDiffLabel field="street" syncedFields={syncedFields} />
                                </div>
                                <input 
                                    className={`adminInput ${getHighlightClass("street")}`} 
                                    value={drafts.street ?? ""} 
                                    onChange={(e) => handleFieldChange("street", e.target.value)} 
                                />
                            </label>
                        </div>
                        <div style={{ flex: 1 }}>
                            <label className="adminLabel">
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                                    <span>Number <SyncableIcon /></span>
                                    <SyncDiffLabel field="number" syncedFields={syncedFields} />
                                </div>
                                <input 
                                    className={`adminInput ${getHighlightClass("number")}`} 
                                    value={drafts.number ?? ""} 
                                    onChange={(e) => handleFieldChange("number", e.target.value)} 
                                />
                            </label>
                        </div>
                    </div>

                    {/* Row 4: Phone & Email */}
                    <label className="adminLabel">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                            <span>Phone <SyncableIcon /></span>
                            <SyncDiffLabel field="phone" syncedFields={syncedFields} />
                        </div>
                        <input 
                            className={`adminInput ${getHighlightClass("phone")}`} 
                            value={drafts.phone ?? ""} 
                            onChange={(e) => handleFieldChange("phone", e.target.value)} 
                        />
                    </label>
                    <label className="adminLabel">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                            <span>Email</span>
                            <SyncDiffLabel field="email" syncedFields={syncedFields} />
                        </div>
                        <input 
                            className={`adminInput ${getHighlightClass("email")}`} 
                            value={drafts.email ?? ""} 
                            onChange={(e) => handleFieldChange("email", e.target.value)} 
                        />
                    </label>

                    {/* Row 5: Website & Youtube */}
                    <label className="adminLabel">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                            <span>Website <SyncableIcon /></span>
                            <SyncDiffLabel field="website" syncedFields={syncedFields} />
                        </div>
                        <input 
                            className={`adminInput ${getHighlightClass("website")}`} 
                            placeholder="https://..." 
                            value={drafts.website ?? ""} 
                            onChange={(e) => handleFieldChange("website", e.target.value)} 
                        />
                    </label>
                    <label className="adminLabel">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                            <span>YouTube</span>
                            <SyncDiffLabel field="youtube" syncedFields={syncedFields} />
                        </div>
                        <input 
                            className={`adminInput ${getHighlightClass("youtube")}`} 
                            placeholder="https://youtube.com/..." 
                            value={drafts.youtube ?? ""} 
                            onChange={(e) => handleFieldChange("youtube", e.target.value)} 
                        />
                    </label>

                    <label className="adminLabel">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                            <span>Instagram</span>
                            <SyncDiffLabel field="instagram" syncedFields={syncedFields} />
                        </div>
                        <input 
                            className={`adminInput ${getHighlightClass("instagram")}`} 
                            placeholder="instagram.com/..." 
                            value={drafts.instagram ?? ""} 
                            onChange={(e) => handleFieldChange("instagram", e.target.value)} 
                        />
                    </label>
                    <label className="adminLabel">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                            <span>Facebook</span>
                            <SyncDiffLabel field="facebook" syncedFields={syncedFields} />
                        </div>
                        <input 
                            className={`adminInput ${getHighlightClass("facebook")}`} 
                            placeholder="facebook.com/..." 
                            value={drafts.facebook ?? ""} 
                            onChange={(e) => handleFieldChange("facebook", e.target.value)} 
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
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                                <span>Latitude <SyncableIcon /></span>
                                <SyncDiffLabel field="lat" syncedFields={syncedFields} />
                            </div>
                            <input 
                                className={`adminInput ${getHighlightClass("lat")}`} 
                                type="number" 
                                step="any" 
                                value={drafts.lat ?? ""} 
                                onChange={(e) => handleFieldChange("lat", e.target.value)} 
                            />
                        </label>
                        <label className="adminLabel">
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                                <span>Longitude <SyncableIcon /></span>
                                <SyncDiffLabel field="lng" syncedFields={syncedFields} />
                            </div>
                            <input 
                                className={`adminInput ${getHighlightClass("lng")}`} 
                                type="number" 
                                step="any" 
                                value={drafts.lng ?? ""} 
                                onChange={(e) => handleFieldChange("lng", e.target.value)} 
                            />
                        </label>
                    </div>
                </div>

                {/* Google Enrichment Section: Hours & Photos */}
                {(drafts.place_id || drafts.openingHours?.length > 0 || drafts.photos?.length > 0) && (
                    <div style={{ marginTop: 16, borderTop: "1px dashed rgba(10, 42, 67, 0.1)", paddingTop: 16 }}>
                        <h4 style={{ margin: "0 0 12px 0", fontSize: 14, color: "#134b7b", display: "flex", alignItems: "center", gap: 6 }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                            </svg>
                            Google Places Enrichment
                        </h4>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                            <div>
                                <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.6, textTransform: "uppercase", display: "block", marginBottom: 8 }}>Schedule</span>
                                {drafts.openingHours && drafts.openingHours.length > 0 ? (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                                        {drafts.openingHours.map((line, idx) => (
                                            <div key={idx} style={{ fontSize: 12, color: "#134b7b", fontWeight: 500 }}>{line}</div>
                                        ))}
                                    </div>
                                ) : (
                                    <span style={{ fontSize: 12, fontStyle: "italic", opacity: 0.5 }}>Not available</span>
                                )}
                            </div>
                            <div>
                                <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.6, textTransform: "uppercase", display: "block", marginBottom: 8 }}>Maps Link</span>
                                {drafts.googleMapsUri ? (
                                    <a href={drafts.googleMapsUri} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#3b82f6", fontWeight: 600 }}>
                                        View Listing
                                    </a>
                                ) : (
                                    <span style={{ fontSize: 12, fontStyle: "italic", opacity: 0.5 }}>None</span>
                                )}
                            </div>
                        </div>

                        {drafts.photos && drafts.photos.length > 0 && (
                            <div style={{ marginTop: 16 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                    <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.6, textTransform: "uppercase" }}>Photos Preview</span>
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
                                        const photoUrl = `/api/geocode?type=photo&photo_name=${encodeURIComponent(p)}`;
                                        return (
                                            <div 
                                                key={idx} 
                                                className="adminPhotoThumbnail adminPhotoItem"
                                                onClick={() => onPhotoClick?.(photoUrl)}
                                            >
                                                <img 
                                                    src={photoUrl} 
                                                    alt={`Preview ${idx}`} 
                                                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}


                <div className="adminMsgActions adminMsgActions--3" style={{ marginTop: "20px" }}>
                    <button type="button" className="adminDeleteBtn" onClick={onCancel} disabled={saveState === "saving"}>
                        Cancel
                    </button>

                    <button type="button" className="adminDraftBtn" onClick={() => onSave(true)} disabled={saveState === "saving"}>
                        <IconEyeOff />
                        Draft
                    </button>

                    <button type="button" className="adminMsgSaveBtn" onClick={() => onSave()} disabled={saveState === "saving"}>
                        <IconSave />
                        {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : "Save"}
                    </button>
                </div>
            </div>
        </div>
    );
}

const PAGE_SIZE = 10;

export default function ChurchesAdmin() {
    const mountedRef = useRef(true);
    const timeoutRef = useRef(null);

    const [loading, setLoading] = useState(true);
    const [globalError, setGlobalError] = useState("");

    const [items, setItems] = useState([]);
    const [draftsById, setDraftsById] = useState({});
    const [saveStateById, setSaveStateById] = useState({});
    const [errorById, setErrorById] = useState({});
    const [expandedIds, setExpandedIds] = useState(() => new Set());
    const [sortBy, setSortBy] = useState("az");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCountry, setSelectedCountry] = useState("");
    const [selectedCity, setSelectedCity] = useState("");

    const [showNew, setShowNew] = useState(false);
    const [newDrafts, setNewDrafts] = useState(emptyChurch());
    const [newError, setNewError] = useState("");
    const [newState, setNewState] = useState("idle");
    const [showDraftsOnly, setShowDraftsOnly] = useState(false);

    const [modal, setModal] = useState({ isOpen: false, title: "", message: "", onConfirm: () => { } });
    const [lightboxUrl, setLightboxUrl] = useState(null);

    const sortedItems = useMemo(() => {
        let arr = [...items];

        if (showDraftsOnly) {
            arr = arr.filter(it => it.isDraft === true);
        }

        if (selectedCountry) {
            arr = arr.filter(it => safeStr(it.country).toLowerCase() === selectedCountry.toLowerCase());
        }
        if (selectedCity) {
            arr = arr.filter(it => safeStr(it.city).toLowerCase() === selectedCity.toLowerCase());
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            arr = arr.filter(it => matchChurchSearch(it, q));
        }
        arr.sort((a, b) => {
            if (sortBy === "az") return a.name.localeCompare(b.name);
            if (sortBy === "za") return b.name.localeCompare(a.name);
            if (sortBy === "date-desc") return (b.createdAtMs || 0) - (a.createdAtMs || 0);
            if (sortBy === "date-asc") return (a.createdAtMs || 0) - (b.createdAtMs || 0);
            return 0;
        });
        return arr;
    }, [items, sortBy, searchQuery, selectedCountry, selectedCity, showDraftsOnly]);

    const draftCount = useMemo(() => items.filter(it => it.isDraft === true).length, [items]);

    const { page, setPage, totalPages, paginatedItems, nextPage, prevPage, totalItems } = usePagination(sortedItems, PAGE_SIZE);

    const uniqueCountries = useMemo(() => {
        const set = new Set(items.map(it => safeStr(it.country).trim()).filter(Boolean));
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [items]);

    const uniqueCities = useMemo(() => {
        let relevant = items;
        if (selectedCountry) {
            relevant = items.filter(it => safeStr(it.country).toLowerCase() === selectedCountry.toLowerCase());
        }
        const set = new Set(relevant.map(it => safeStr(it.city).trim()).filter(Boolean));
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [items, selectedCountry]);

    const setTransientState = (id, value = "saved") => {
        setSaveStateById((m) => ({ ...m, [id]: value }));
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            if (!mountedRef.current) return;
            setSaveStateById((m) => ({ ...m, [id]: "idle" }));
        }, 900);
    };

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    // Load churches from Firestore
    useEffect(() => {
        setLoading(true);
        setGlobalError("");

        const unsub = onSnapshot(
            collection(db, "churches"),
            (snap) => {
                if (!mountedRef.current) return;
                const list = snap.docs.map((d) => {
                    const data = d.data() || {};
                    let createdAtMs = 0;
                    let createdAtText = "";
                    if (data.createdAt) {
                        try {
                            const dObj = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
                            createdAtText = dObj.toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' });
                            createdAtMs = dObj.getTime();
                        } catch (e) { }
                    }

                    const formatAttribution = (attr) => {
                        if (!attr || !attr.name) return null;
                        let dateText = "";
                        if (attr.at) {
                            try {
                                const dObj = attr.at.toDate ? attr.at.toDate() : new Date(attr.at);
                                dateText = dObj.toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' });
                            } catch (e) { }
                        }
                        return { name: attr.name, date: dateText };
                    };

                    return { 
                        ...data, 
                        id: d.id, 
                        createdAtMs, 
                        createdAt: createdAtText,
                        createdByInfo: formatAttribution(data.createdBy)
                    };
                });

                setItems(list);
                setDraftsById((prev) => {
                    const next = { ...prev };
                    const alive = new Set(list.map((x) => x.id));
                    Object.keys(next).forEach((k) => { if (!alive.has(k)) delete next[k]; });
                    list.forEach((it) => {
                        if (!next[it.id]) {
                            next[it.id] = { ...it };
                        }
                    });
                    return next;
                });
                setLoading(false);
            },
            (err) => {
                console.error(err);
                if (!mountedRef.current) return;
                setLoading(false);
                setGlobalError("Could not load churches.");
            }
        );

        return () => unsub();
    }, []);

    const toggleExpand = useCallback((id) => {
        const key = safeStr(id).trim();
        if (!key) return;

        setExpandedIds((prev) => {
            const next = new Set(prev);
            const isClosing = next.has(key);

            if (isClosing) {
                const item = items.find(i => i.id === key);
                const draft = draftsById[key];
                if (hasDraftChanges(item, draft)) {
                    setModal({
                        isOpen: true,
                        title: "Unsaved Changes",
                        message: "Are you sure you want to cancel all changes?",
                        onConfirm: () => {
                            setModal({ isOpen: false });
                            // Revert draft
                            if (item) setDraftsById(d => ({ ...d, [key]: { ...item } }));
                            // Close
                            setExpandedIds(curr => {
                                const n = new Set(curr);
                                n.delete(key);
                                return n;
                            });
                        }
                    });
                    return prev; // Don't change until confirmed
                }
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    }, [items, draftsById]);

    // --- NEW ---
    const startNew = () => {
        setShowNew(true);
        setNewDrafts(emptyChurch());
        setNewError("");
        setNewState("idle");
    };

    const cancelNew = () => {
        setShowNew(false);
        setNewError("");
        setNewState("idle");
    };

    const setNewField = (key, value) => {
        setNewDrafts((prev) => ({ ...prev, [key]: value }));
        if (newError) setNewError("");
    };

    const saveNew = async (forcedDraftStatus = null) => {
        let isDraftValue = forcedDraftStatus !== null ? forcedDraftStatus : (newDrafts.isDraft || false);
        
        if (!newDrafts.name.trim() || !newDrafts.city.trim()) {
            setNewError("The Church Name and City fields are required.");
            return;
        }
        setNewError("");
        setNewState("saving");

        let lat = parseFloat(newDrafts.lat);
        let lng = parseFloat(newDrafts.lng);

        if (isNaN(lat) || isNaN(lng)) {
            const coords = await geocodeAddress(newDrafts.street, newDrafts.number, newDrafts.city, newDrafts.zipCode, newDrafts.country, newDrafts.locationTitle);
            if (coords) {
                lat = coords.lat;
                lng = coords.lng;
                setNewDrafts((prev) => ({ ...prev, lat, lng }));
            } else {
                setNewState("error");
                setNewError("Could not automatically find coordinates. Please enter Latitude and Longitude manually.");
                return;
            }
        }

        try {
            await addDoc(collection(db, "churches"), {
                name: newDrafts.name.trim(),
                locationTitle: (newDrafts.locationTitle || "").trim(),
                street: (newDrafts.street || "").trim(),
                number: (newDrafts.number || "").trim(),
                city: (newDrafts.city || "").trim(),
                country: (newDrafts.country || "").trim(),
                zipCode: (newDrafts.zipCode || "").trim(),
                lat, lng,
                phone: newDrafts.phone.trim(),
                email: newDrafts.email.trim(),
                website: newDrafts.website.trim(),
                youtube: newDrafts.youtube.trim(),
                facebook: (newDrafts.facebook || "").trim(),
                instagram: (newDrafts.instagram || "").trim(),
                place_id: newDrafts.place_id || "",
                openingHours: newDrafts.openingHours || [],
                photos: newDrafts.photos || [],
                googleMapsUri: newDrafts.googleMapsUri || "",
                rating: newDrafts.rating || null,
                isDraft: isDraftValue,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                createdBy: { name: "Popadiuc Claudiu", at: serverTimestamp() }
            });

            if (!mountedRef.current) return;
            if (forcedDraftStatus !== null) {
                setNewDrafts((prev) => ({ ...prev, isDraft: isDraftValue }));
            }
            setNewState("saved");
            setTimeout(() => {
                if (!mountedRef.current) return;
                setShowNew(false);
                setNewState("idle");
            }, 900);
        } catch (err) {
            console.error(err);
            if (!mountedRef.current) return;
            setNewState("error");
            setNewError("Could not save church.");
        }
    };

    // --- EDIT ---
    const changeDraft = (id, key, value) => {
        setDraftsById((prev) => ({
            ...prev,
            [id]: { ...prev[id], [key]: value }
        }));
        setErrorById((m) => ({ ...m, [id]: "" }));
    };

    const saveOne = async (id, forcedDraftStatus = null) => {
        let draft = draftsById[id];
        if (!draft) return;

        let isDraftValue = forcedDraftStatus !== null ? forcedDraftStatus : (draft.isDraft || false);

        if (!draft.name?.trim() || !draft.city?.trim()) {
            setErrorById((m) => ({ ...m, [id]: "The Church Name and City fields are required." }));
            return;
        }

        setErrorById((m) => ({ ...m, [id]: "" }));
        setSaveStateById((m) => ({ ...m, [id]: "saving" }));

        let lat = parseFloat(draft.lat);
        let lng = parseFloat(draft.lng);

        const original = items.find(i => i.id === id);
        const addressChanged = original && (
            original.street !== draft.street ||
            original.number !== draft.number ||
            original.city !== draft.city ||
            original.country !== draft.country ||
            original.zipCode !== draft.zipCode ||
            original.locationTitle !== draft.locationTitle
        );

        if (isNaN(lat) || isNaN(lng) || addressChanged) {
            const coords = await geocodeAddress(draft.street, draft.number, draft.city, draft.zipCode, draft.country, draft.locationTitle);
            if (coords) {
                lat = coords.lat;
                lng = coords.lng;
                changeDraft(id, "lat", lat);
                changeDraft(id, "lng", lng);
            } else if (isNaN(lat) || isNaN(lng)) {
                setSaveStateById((m) => ({ ...m, [id]: "error" }));
                setErrorById((m) => ({ ...m, [id]: "Could not automatically find coordinates. Please enter Lat/Lng manually." }));
                return;
            }
        }

        try {
            await updateDoc(doc(db, "churches", id), {
                name: draft.name.trim(),
                locationTitle: (draft.locationTitle || "").trim(),
                street: (draft.street || "").trim(),
                number: (draft.number || "").trim(),
                city: (draft.city || "").trim(),
                country: (draft.country || "").trim(),
                zipCode: (draft.zipCode || "").trim(),
                lat, lng,
                phone: (draft.phone || "").trim(),
                email: (draft.email || "").trim(),
                website: (draft.website || "").trim(),
                youtube: (draft.youtube || "").trim(),
                facebook: (draft.facebook || "").trim(),
                instagram: (draft.instagram || "").trim(),
                place_id: draft.place_id || "",
                openingHours: draft.openingHours || [],
                photos: draft.photos || [],
                googleMapsUri: draft.googleMapsUri || "",
                rating: draft.rating || null,
                isDraft: isDraftValue,
                updatedAt: serverTimestamp(),
            });

            if (!mountedRef.current) return;
            if (forcedDraftStatus !== null) {
                changeDraft(id, "isDraft", isDraftValue);
            }
            setTransientState(id, "saved");
        } catch (err) {
            console.error(err);
            if (!mountedRef.current) return;
            setSaveStateById((m) => ({ ...m, [id]: "error" }));
            setErrorById((m) => ({ ...m, [id]: "Could not save." }));
        }
    };

    // --- DELETE ---
    const deleteOne = async (id) => {
        const item = items.find((i) => i.id === id);
        setModal({
            isOpen: true,
            title: "Delete Church",
            message: `Are you sure you want to delete "${item?.name || id}"?`,
            onConfirm: async () => {
                setModal({ isOpen: false });
                setSaveStateById((m) => ({ ...m, [id]: "saving" }));
                try {
                    await deleteDoc(doc(db, "churches", id));
                    if (!mountedRef.current) return;
                    setDraftsById((prev) => { const next = { ...prev }; delete next[id]; return next; });
                    setExpandedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
                    setSaveStateById((prev) => { const next = { ...prev }; delete next[id]; return next; });
                    setErrorById((prev) => { const next = { ...prev }; delete next[id]; return next; });
                } catch (err) {
                    console.error(err);
                    if (!mountedRef.current) return;
                    setSaveStateById((m) => ({ ...m, [id]: "error" }));
                    setErrorById((m) => ({ ...m, [id]: "Could not delete." }));
                }
            }
        });
    };

    return (
        <div className="adminFullPage">
            <div className="adminFullTop">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        <h2 className="adminTitle" style={{ margin: 0, lineHeight: 1 }}>Churches</h2>
                        <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "rgba(10, 42, 67, 0.6)", fontWeight: 600 }}>
                            <span className="adminCountDot" aria-hidden="true" style={{ width: 6, height: 6, opacity: 0.3 }} />
                            {showDraftsOnly ? (
                                <>{draftCount} draft{draftCount === 1 ? "" : "s"}</>
                            ) : (
                                <>{totalItems} church{totalItems === 1 ? "" : "es"}</>
                            )}
                        </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#475569" }}>Drafts</span>
                        <label className="adminSwitch">
                            <input 
                                type="checkbox" 
                                checked={showDraftsOnly} 
                                onChange={(e) => setShowDraftsOnly(e.target.checked)}
                            />
                            <span className="adminSlider" />
                        </label>
                    </div>
                </div>

                <div className="adminActions" style={{ flexWrap: "wrap", justifyContent: "flex-end", gap: "12px" }}>
                    <select
                        className="adminSelect"
                        value={selectedCountry}
                        onChange={(e) => {
                            setSelectedCountry(e.target.value);
                            setSelectedCity(""); // Reset target city when country changes
                            setPage(1);
                        }}
                        aria-label="Filter by country"
                    >
                        <option value="">All Countries</option>
                        {uniqueCountries.map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>

                    <select
                        className="adminSelect"
                        value={selectedCity}
                        onChange={(e) => {
                            setSelectedCity(e.target.value);
                            setPage(1);
                        }}
                        aria-label="Filter by city"
                        disabled={!uniqueCities.length}
                    >
                        <option value="">All Cities</option>
                        {uniqueCities.map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>

                    <select
                        className="adminSelect"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        aria-label="Sort churches"
                    >
                        <option value="date-desc">Newest first</option>
                        <option value="date-asc">Oldest first</option>
                        <option value="az">Alphabetical</option>
                    </select>



                    <button className="adminBtn adminBtn--new" type="button" onClick={startNew} disabled={loading || showNew}>
                        <span className="adminBtnIcon" aria-hidden="true"><IconPlus /></span>
                        New
                    </button>
                </div>

                <AdminSearch
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Search"
                />
            </div>

            {loading ? <div className="adminSkeleton" /> : null}

            {
                !loading ? (
                    <div className="adminFullContent">
                        {globalError ? <div className="adminAlert">{globalError}</div> : null}

                        {showNew ? (
                            <div>
                                <NewChurchCard
                                    drafts={newDrafts}
                                    setDraft={setNewField}
                                    errorText={newError}
                                    saveState={newState}
                                    onCancel={cancelNew}
                                    onSave={saveNew}
                                    onPhotoClick={setLightboxUrl}
                                />
                            </div>
                        ) : null}

                        <div className="adminFullList">
                            {paginatedItems.map((it) => (
                                <ChurchCard
                                    key={it.id}
                                    item={it}
                                    expanded={expandedIds.has(it.id)}
                                    drafts={draftsById[it.id] || it}
                                    saveState={saveStateById[it.id] || "idle"}
                                    errorText={errorById[it.id] || ""}
                                    onToggle={toggleExpand}
                                    onChange={changeDraft}
                                    onSave={saveOne}
                                    onDelete={deleteOne}
                                    setSaveStateById={setSaveStateById}
                                    setErrorById={setErrorById}
                                    onPhotoClick={setLightboxUrl}
                                />
                            ))}

                            {!items.length && !showNew ? <div className="adminEmpty">No churches yet. Click "New" to add one.</div> : null}
                        </div>

                        <div className="adminPaginationFooter">
                            <PaginationControls
                                page={page}
                                totalPages={totalPages}
                                onNext={nextPage}
                                onPrev={prevPage}
                                onPageSet={setPage}
                            />
                        </div>

                        <ConfirmModal
                            isOpen={modal.isOpen}
                            title={modal.title}
                            message={modal.message}
                            onConfirm={modal.onConfirm}
                            onCancel={() => setModal({ ...modal, isOpen: false })}
                        />

                        <PhotoLightbox 
                            url={lightboxUrl} 
                            onClose={() => setLightboxUrl(null)} 
                        />
                    </div>
                ) : null
            }
        </div >
    );
}
