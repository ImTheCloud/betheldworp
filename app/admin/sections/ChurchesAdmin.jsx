"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { collection, addDoc, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../../lib/Firebase";
import { usePagination } from "../hooks/usePagination";
import PaginationControls from "../components/PaginationControls";
import ConfirmModal from "../components/ConfirmModal";

const safeStr = (v) => String(v ?? "");

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

function IconSearch(props) {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
            <path d="M21 21l-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
    { key: "notes", label: "Notes / Message", type: "textarea" },
    { key: "likes", label: "Hearts / Likes", type: "number" },
];

function emptyChurch() {
    return { name: "", street: "", number: "", city: "", country: "", zipCode: "", lat: "", lng: "", phone: "", email: "", website: "", youtube: "", facebook: "", instagram: "", notes: "", likes: 0 };
}

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

function ChurchCard({ item, expanded, drafts, saveState, errorText, onToggle, onChange, onSave, onDelete }) {
    const id = item.id;

    return (
        <div className="adminAnnCard">
            <div className="adminAnnHeader" style={{ cursor: "pointer", justifyContent: "space-between" }} onClick={() => onToggle(id)}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <strong>{item.name}</strong>
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

                    {item.createdAt ? (
                        <div style={{ color: "rgba(10, 42, 67, 0.6)", fontWeight: 500, fontSize: 13, marginBottom: 12 }}>
                            Added on: {item.createdAt}
                        </div>
                    ) : null}

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
                        {FIELDS.map((f) => {
                            if (f.key === "number") return null;
                            if (f.key === "street") {
                                return (
                                    <div key="street-number" style={{ gridColumn: "span 2", display: "flex", gap: "12px" }}>
                                        <div style={{ flex: 3 }}>
                                            <label className="adminLabel">Street</label>
                                            <input
                                                className="adminInput"
                                                value={drafts.street ?? ""}
                                                onChange={(e) => onChange(id, "street", e.target.value)}
                                            />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label className="adminLabel">Number</label>
                                            <input
                                                className="adminInput"
                                                value={drafts.number ?? ""}
                                                onChange={(e) => onChange(id, "number", e.target.value)}
                                            />
                                        </div>
                                    </div>
                                );
                            }
                            return (
                                <label key={f.key} className="adminLabel" style={(f.key === "notes") ? { gridColumn: "span 2" } : {}}>
                                    {f.label}{f.required ? " *" : ""}
                                    {f.type === "select" ? (
                                        <select
                                            className="adminSelect"
                                            style={{ width: "100%", marginTop: 4 }}
                                            value={drafts[f.key] ?? ""}
                                            onChange={(e) => onChange(id, f.key, e.target.value)}
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
                                            style={{ resize: "vertical", marginTop: 4 }}
                                            value={drafts[f.key] ?? ""}
                                            onChange={(e) => onChange(id, f.key, e.target.value)}
                                        />
                                    ) : (
                                        <input
                                            className="adminInput"
                                            type={f.type}
                                            value={drafts[f.key] ?? ""}
                                            onChange={(e) => onChange(id, f.key, e.target.value)}
                                            step={f.type === "number" ? "any" : undefined}
                                        />
                                    )}
                                </label>
                            );
                        })}
                    </div>

                    <div className="adminMsgActions" style={{ marginTop: "20px" }}>
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
                            className="adminMsgSaveBtn"
                            onClick={(e) => { e.stopPropagation(); onSave(id); }}
                            disabled={saveState === "saving"}
                        >
                            {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : "Save"}
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

function NewChurchCard({ drafts, setDraft, errorText, saveState, onCancel, onSave }) {
    return (
        <div className="adminAnnCard is-active">
            <div className="adminAnnHeader">
                <div className="adminAnnIdChip">New Church</div>
            </div>

            <div className="adminAnnBody">
                {errorText ? <div className="adminAlert">{errorText}</div> : null}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
                    {FIELDS.map((f) => {
                        if (f.key === "number") return null;
                        if (f.key === "street") {
                            return (
                                <div key="street-number" style={{ gridColumn: "span 2", display: "flex", gap: "12px" }}>
                                    <div style={{ flex: 3 }}>
                                        <label className="adminLabel">Street</label>
                                        <input
                                            className="adminInput"
                                            value={drafts.street ?? ""}
                                            onChange={(e) => setDraft("street", e.target.value)}
                                        />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label className="adminLabel">Number</label>
                                        <input
                                            className="adminInput"
                                            value={drafts.number ?? ""}
                                            onChange={(e) => setDraft("number", e.target.value)}
                                        />
                                    </div>
                                </div>
                            );
                        }
                        return (
                            <label key={f.key} className="adminLabel" style={(f.key === "notes") ? { gridColumn: "span 2" } : {}}>
                                {f.label}{f.required ? " *" : ""}
                                {f.type === "select" ? (
                                    <select
                                        className="adminSelect"
                                        style={{ width: "100%", marginTop: 4 }}
                                        value={drafts[f.key] ?? ""}
                                        onChange={(e) => setDraft(f.key, e.target.value)}
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
                                        style={{ resize: "vertical", marginTop: 4 }}
                                        value={drafts[f.key] ?? ""}
                                        onChange={(e) => setDraft(f.key, e.target.value)}
                                    />
                                ) : (
                                    <input
                                        className="adminInput"
                                        type={f.type}
                                        value={drafts[f.key] ?? ""}
                                        onChange={(e) => setDraft(f.key, e.target.value)}
                                        step={f.type === "number" ? "any" : undefined}
                                    />
                                )}
                            </label>
                        );
                    })}
                </div>

                <div className="adminMsgActions" style={{ marginTop: "20px" }}>
                    <button type="button" className="adminDeleteBtn" onClick={onCancel} disabled={saveState === "saving"}>
                        Cancel
                    </button>
                    <button type="button" className="adminMsgSaveBtn" onClick={onSave} disabled={saveState === "saving"}>
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

    const [modal, setModal] = useState({ isOpen: false, title: "", message: "", onConfirm: () => { } });

    const sortedItems = useMemo(() => {
        let arr = [...items];

        if (selectedCountry) {
            arr = arr.filter(it => safeStr(it.country).toLowerCase() === selectedCountry.toLowerCase());
        }
        if (selectedCity) {
            arr = arr.filter(it => safeStr(it.city).toLowerCase() === selectedCity.toLowerCase());
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            arr = arr.filter(it => safeStr(it.name).toLowerCase().includes(q));
        }
        arr.sort((a, b) => {
            if (sortBy === "az") return a.name.localeCompare(b.name);
            if (sortBy === "za") return b.name.localeCompare(a.name);
            if (sortBy === "date-desc") return (b.createdAtMs || 0) - (a.createdAtMs || 0);
            if (sortBy === "date-asc") return (a.createdAtMs || 0) - (b.createdAtMs || 0);
            return 0;
        });
        return arr;
    }, [items, sortBy, searchQuery, selectedCountry, selectedCity]);

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
                    return { ...data, id: d.id, createdAtMs, createdAt: createdAtText };
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
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    }, []);

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

    const saveNew = async () => {
        if (!newDrafts.name.trim()) {
            setNewError("The Church Name field is required.");
            return;
        }
        setNewError("");
        setNewState("saving");

        let lat = parseFloat(newDrafts.lat);
        let lng = parseFloat(newDrafts.lng);

        if (isNaN(lat) || isNaN(lng)) {
            const coords = await geocodeAddress(newDrafts.street, newDrafts.number, newDrafts.city, newDrafts.zipCode, newDrafts.country);
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
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            if (!mountedRef.current) return;
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

    const saveOne = async (id) => {
        const draft = draftsById[id];
        if (!draft) return;

        if (!draft.name?.trim()) {
            setErrorById((m) => ({ ...m, [id]: "The Church Name field is required." }));
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
            original.country !== draft.country
        );

        if (isNaN(lat) || isNaN(lng) || addressChanged) {
            const coords = await geocodeAddress(draft.street, draft.number, draft.city, draft.zipCode, draft.country);
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
                updatedAt: serverTimestamp(),
            });

            if (!mountedRef.current) return;
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
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", height: 40 }}>
                    <h2 className="adminTitle" style={{ margin: 0, lineHeight: 1 }}>Churches</h2>
                    <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "rgba(10, 42, 67, 0.6)", fontWeight: 600, height: "100%" }}>
                        <span className="adminCountDot" aria-hidden="true" style={{ width: 6, height: 6, opacity: 0.3 }} />
                        {totalItems} church{totalItems === 1 ? "" : "es"}
                    </span>
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
                        <option value="az">Alphabetical (A-Z)</option>
                        <option value="za">Alphabetical (Z-A)</option>
                    </select>

                    <button className="adminBtn adminBtn--new" type="button" onClick={startNew} disabled={loading || showNew}>
                        <span className="adminBtnIcon" aria-hidden="true"><IconPlus /></span>
                        New
                    </button>
                </div>

                <div className="adminSearchWrapper">
                    <input
                        type="text"
                        className="adminSearchInput"
                        placeholder="Search by Name"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <IconSearch className="adminSearchIcon" />
                </div>
            </div>

            {loading ? <div className="adminSkeleton" style={{ margin: "0 24px" }} /> : null}

            {
                !loading ? (
                    <div className="adminFullContent">
                        {globalError ? <div className="adminAlert">{globalError}</div> : null}

                        {showNew ? (
                            <div style={{ padding: "0 4px" }}>
                                <NewChurchCard
                                    drafts={newDrafts}
                                    setDraft={setNewField}
                                    errorText={newError}
                                    saveState={newState}
                                    onCancel={cancelNew}
                                    onSave={saveNew}
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
                    </div>
                ) : null
            }
        </div >
    );
}
