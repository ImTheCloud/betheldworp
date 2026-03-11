"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { APIProvider, Map, AdvancedMarker, useMap } from "@vis.gl/react-google-maps";
import { useSearchParams } from "next/navigation";
import { collection, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, increment } from "firebase/firestore";
import { db } from "../lib/Firebase";
import Link from "next/link";
import { useLang } from "../components/LanguageProvider";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { makeT } from "../lib/i18n";
import worldMapTranslations from "../translations/WorldMap.json";
import "./WorldMap.css";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const MAP_ID = "5b50d76db2afedb8ba67cff4";
const BELGIUM_CENTER = { lat: 50.77198, lng: 4.30396 }; // Coordinates roughly near Brussels/Halle

const COUNTRY_FLAGS = {
    Belgium: "🇧🇪",
    Germany: "🇩🇪",
    "United Kingdom": "🇬🇧",
    France: "🇫🇷",
    Netherlands: "🇳🇱",
    Romania: "🇷🇴",
    Italy: "🇮🇹",
    Spain: "🇪🇸",
    USA: "🇺🇸",
    Austria: "🇦🇹",
    Bulgaria: "🇧🇬",
    Croatia: "🇭🇷",
    Cyprus: "🇨🇾",
    "Czech Republic": "🇨🇿",
    Denmark: "🇩🇰",
    Estonia: "🇪🇪",
    Finland: "🇫🇮",
    Greece: "🇬🇷",
    Hungary: "🇭🇺",
    Ireland: "🇮🇪",
    Latvia: "🇱🇻",
    Lithuania: "🇱🇹",
    Luxembourg: "🇱🇺",
    Malta: "🇲🇹",
    Moldova: "🇲🇩",
    Norway: "🇳🇴",
    Poland: "🇵🇱",
    Portugal: "🇵🇹",
    Slovakia: "🇸🇰",
    Slovenia: "🇸🇮",
    Sweden: "🇸🇪",
    Switzerland: "🇨🇭",
    Ukraine: "🇺🇦",
    "United States": "🇺🇸",
    Canada: "🇨🇦",
    Australia: "🇦🇺",
};



function getBoundsCenter(churches) {
    if (churches.length === 0) return { lat: 0, lng: 0 };
    let minLat = churches[0].lat;
    let maxLat = churches[0].lat;
    let minLng = churches[0].lng;
    let maxLng = churches[0].lng;

    for (let c of churches) {
        if (c.lat < minLat) minLat = c.lat;
        if (c.lat > maxLat) maxLat = c.lat;
        if (c.lng < minLng) minLng = c.lng;
        if (c.lng > maxLng) maxLng = c.lng;
    }

    return {
        lat: (minLat + maxLat) / 2,
        lng: (minLng + maxLng) / 2,
    };
}

function haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function formatDistance(km) {
    if (km < 1) return `${Math.round(km * 1000)} m`;
    if (km < 10) return `${km.toFixed(1)} km`;
    return `${Math.round(km)} km`;
}



function MapController({ selectedChurch, requestedLocation, isInitialLoad }) {
    const map = useMap();
    const prevChurchRef = useRef(null);
    const wasSelectedRef = useRef(false);

    useEffect(() => {
        if (!map) return;

        if (selectedChurch) {
            const target = { lat: selectedChurch.lat, lng: selectedChurch.lng };
            const currentZoom = map.getZoom() || 7;

            if (wasSelectedRef.current && prevChurchRef.current?.id !== selectedChurch.id) {
                // Switching between churches: always smooth pan, no zoom tricks
                map.panTo(target);
            } else {
                // First selection: smooth zoom in
                map.panTo(target);
                if (currentZoom < 12) {
                    const step1 = Math.min(currentZoom + 3, 11);
                    map.setZoom(step1);
                    setTimeout(() => map.setZoom(14), 600);
                }
            }

            prevChurchRef.current = selectedChurch;
            wasSelectedRef.current = true;
        } else {
            // Deselected: single smooth zoom out back to overview
            if (wasSelectedRef.current) {
                map.panTo(BELGIUM_CENTER);
                map.setZoom(8);
                prevChurchRef.current = null;
                wasSelectedRef.current = false;
            } else if (requestedLocation && isInitialLoad) {
                map.panTo({ lat: requestedLocation.lat, lng: requestedLocation.lng });
                setTimeout(() => map.setZoom(9), 500);
            }
        }
    }, [map, selectedChurch, requestedLocation, isInitialLoad]);

    return null;
}

function FilterController({ filteredChurches, activeCountryFilter }) {
    const map = useMap();
    const prevFilterRef = useRef("");

    useEffect(() => {
        if (!map) return;
        if (activeCountryFilter === prevFilterRef.current) return;
        prevFilterRef.current = activeCountryFilter;

        if (!activeCountryFilter) {
            // Reset to default view (Belgium)
            map.panTo(BELGIUM_CENTER);
            map.setZoom(8);
            return;
        }

        if (filteredChurches.length === 0) return;

        if (filteredChurches.length === 1) {
            map.panTo({ lat: filteredChurches[0].lat, lng: filteredChurches[0].lng });
            map.setZoom(12);
            return;
        }

        // Fit bounds to all filtered churches
        const bounds = new google.maps.LatLngBounds();
        filteredChurches.forEach((c) => bounds.extend({ lat: c.lat, lng: c.lng }));
        map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
    }, [map, filteredChurches, activeCountryFilter]);

    return null;
}

export default function ChurchMap() {
    const searchParams = useSearchParams();

    const [churches, setChurches] = useState([]);
    const [churchesLoading, setChurchesLoading] = useState(true);
    const [selectedChurch, setSelectedChurch] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [userLocation, setUserLocation] = useState(null);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [activeCountryFilter, setActiveCountryFilter] = useState("");
    const [hoveredMarker, setHoveredMarker] = useState(null);
    const [copied, setCopied] = useState(false);
    const [mobileShowMap, setMobileShowMap] = useState(false);
    const [bottomSheetMode, setBottomSheetMode] = useState("collapsed"); // "hidden" | "collapsed" | "expanded"
    const [filterOpen, setFilterOpen] = useState(false);
    const filterRef = useRef(null);
    const touchStartY = useRef(0);

    // Collaboration State
    const [likedChurches, setLikedChurches] = useState(new Set());

    useEffect(() => {
        try {
            const stored = localStorage.getItem("bethel_liked_churches");
            if (stored) {
                setLikedChurches(new Set(JSON.parse(stored)));
            }
        } catch (e) { }
    }, []);

    const handleLike = async (churchId) => {
        const isLiking = !likedChurches.has(churchId);
        const newLikes = new Set(likedChurches);

        if (isLiking) {
            newLikes.add(churchId);
        } else {
            newLikes.delete(churchId);
        }

        setLikedChurches(newLikes);
        try {
            localStorage.setItem("bethel_liked_churches", JSON.stringify([...newLikes]));
        } catch (e) { }

        const incrementValue = isLiking ? 1 : -1;

        if (selectedChurch?.id === churchId) {
            setSelectedChurch(prev => ({ ...prev, likes: Math.max(0, (prev.likes || 0) + incrementValue) }));
        }
        setChurches(prev => prev.map(c => c.id === churchId ? { ...c, likes: Math.max(0, (c.likes || 0) + incrementValue) } : c));

        try {
            const churchRef = doc(db, "churches", churchId);
            await updateDoc(churchRef, { likes: increment(incrementValue) });
        } catch (err) {
            console.error("Failed to update church recommendation:", err);
        }
    };

    const [showSuggestionModal, setShowSuggestionModal] = useState(false);
    const [suggestionType, setSuggestionType] = useState("new"); // "new" | "edit"
    const [suggestionSuccess, setSuggestionSuccess] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState("");
    const [suggestionForm, setSuggestionForm] = useState({
        name: "",
        city: "",
        street: "",
        number: "",
        phone: "",
        email: "",
        website: "",
        youtube: "",
        facebook: "",
        instagram: "",
        country: "Belgium",
        notes: ""
    });

    const SUGGESTION_COUNTRIES = Object.keys(COUNTRY_FLAGS).sort();

    const openSuggestionModal = (type = "new", church = null) => {
        setSuggestionType(type);
        if (type === "edit" && church) {
            setSuggestionForm({
                name: church.name || "",
                city: church.city || "",
                street: church.street || "",
                number: church.number || "",
                phone: church.phone || "",
                email: church.email || "",
                website: church.website || "",
                youtube: church.youtube || "",
                facebook: church.facebook || "",
                instagram: church.instagram || "",
                country: church.country || "Belgium",
                notes: church.notes || ""
            });
        } else {
            setSuggestionForm({
                name: "",
                city: "",
                street: "",
                number: "",
                phone: "",
                email: "",
                website: "",
                youtube: "",
                facebook: "",
                instagram: "",
                country: activeCountryFilter || "Belgium",
                notes: ""
            });
        }
        setShowSuggestionModal(true);
        setSuggestionSuccess(false);
        setFormError("");
    };

    const handleSuggestionSubmit = async (e) => {
        e.preventDefault();
        if (!suggestionForm.name || !suggestionForm.city) {
            setFormError("Nom et Ville sont requis.");
            return;
        }

        setIsSubmitting(true);
        try {
            await addDoc(collection(db, "church_suggestions"), {
                type: suggestionType,
                originalChurchId: suggestionType === "edit" ? selectedChurch?.id : null,
                originalData: suggestionType === "edit" ? selectedChurch : null,
                status: "pending",
                data: suggestionForm,
                createdAt: serverTimestamp()
            });
            setSuggestionSuccess(true);
            setTimeout(() => {
                setShowSuggestionModal(false);
                setSuggestionSuccess(false);
            }, 3000);
        } catch (err) {
            console.error(err);
            setFormError("Erreur lors de l'envoi. Réessayez.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const { lang } = useLang();
    const t = makeT(worldMapTranslations, lang);

    // Load churches from Firestore
    useEffect(() => {
        const unsub = onSnapshot(
            collection(db, "churches"),
            (snap) => {
                const list = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
                setChurches(list);
                setChurchesLoading(false);
            },
            (err) => {
                console.error("Failed to load churches:", err);
                setChurchesLoading(false);
            }
        );
        return () => unsub();
    }, []);

    // Load churches from Firestore
    useEffect(() => {
        function handleClickOutside(e) {
            if (filterRef.current && !filterRef.current.contains(e.target)) {
                setFilterOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Auto-select church from URL param
    useEffect(() => {
        if (churchesLoading || churches.length === 0) return;
        const churchSlug = searchParams.get("church");
        if (churchSlug) {
            const found = churches.find((c) => c.id === churchSlug);
            if (found) {
                setSelectedChurch(found);
                setIsInitialLoad(false);
            }
        }
    }, [searchParams, churches, churchesLoading]);

    // Auto-locate
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setUserLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    });
                },
                (err) => {
                    console.warn("Geolocation denied or unavailable.", err);
                },
                { timeout: 5000 }
            );
        }
    }, []);

    const selectChurch = useCallback((church) => {
        setSelectedChurch(church);
        setIsInitialLoad(false);
        setBottomSheetMode("hidden"); // Hide the list cleanly on mobile when a church is selected
        const url = new URL(window.location.href);
        url.searchParams.set("church", church.id);
        window.history.replaceState({}, "", url.toString());
    }, []);

    const deselectChurch = useCallback(() => {
        setSelectedChurch(null);
        setBottomSheetMode("collapsed"); // Show the list if it was hidden
        const url = new URL(window.location.href);
        url.searchParams.delete("church");
        window.history.replaceState({}, "", url.toString());
    }, []);

    const handleShare = useCallback(async (church) => {
        const url = `${window.location.origin}/world-map?church=${church.id}`;
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            const input = document.createElement("input");
            input.value = url;
            document.body.appendChild(input);
            input.select();
            document.execCommand("copy");
            document.body.removeChild(input);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }, []);

    const handleTouchStart = (e) => {
        touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e) => {
        const touchEndY = e.changedTouches[0].clientY;
        const distance = touchEndY - touchStartY.current;

        // Swipe up
        if (distance < -40) {
            if (bottomSheetMode === "hidden") setBottomSheetMode("collapsed");
            else if (bottomSheetMode === "collapsed") setBottomSheetMode("expanded");
        }
        // Swipe down
        if (distance > 40) {
            if (bottomSheetMode === "expanded") setBottomSheetMode("collapsed");
            else if (bottomSheetMode === "collapsed") setBottomSheetMode("hidden");
        }
    };

    if (!API_KEY) {
        return <div className="text-white p-8">Cheia API Google Maps nu este configurată.</div>;
    }

    const getCountryLabel = useCallback((country) => {
        if (!country) return "";
        const key = `country_${country}`;
        const translated = t(key);
        // If translation is the same as key, it means it's missing, so fallback to original
        return translated === key ? country : translated;
    }, [t]);

    const GLOBAL_BOUNDS_CENTER = useMemo(() => getBoundsCenter(churches), [churches]);
    const ALL_COUNTRIES = useMemo(() => {
        return [...new Set(churches.map((c) => c.country))].sort((a, b) => {
            return getCountryLabel(a).localeCompare(getCountryLabel(b), lang);
        });
    }, [churches, getCountryLabel, lang]);

    // Calculate counts independent of currently selected country, but dependent on search
    const countryCounts = useMemo(() => {
        let result = [...churches];
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(
                (c) =>
                    c.name.toLowerCase().includes(q) ||
                    c.city.toLowerCase().includes(q) ||
                    c.country.toLowerCase().includes(q)
            );
        }

        const counts = { all: result.length };
        for (const c of result) {
            counts[c.country] = (counts[c.country] || 0) + 1;
        }
        return counts;
    }, [churches, searchQuery]);

    // Filter + sort alphabetically by name
    const filteredChurches = useMemo(() => {
        let result = [...churches];
        if (activeCountryFilter) {
            result = result.filter((c) => c.country === activeCountryFilter);
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(
                (c) =>
                    c.name.toLowerCase().includes(q) ||
                    c.city.toLowerCase().includes(q) ||
                    c.country.toLowerCase().includes(q)
            );
        }
        result.sort((a, b) => a.name.localeCompare(b.name));
        return result;
    }, [searchQuery, activeCountryFilter, churches]);

    // Group by country only, sorted alphabetically
    const groupedChurches = useMemo(() => {
        const groups = {};
        for (const church of filteredChurches) {
            if (!groups[church.country]) {
                groups[church.country] = [];
            }
            groups[church.country].push(church);
        }
        // Sort country keys by translated name
        const sorted = {};
        Object.keys(groups)
            .sort((a, b) => getCountryLabel(a).localeCompare(getCountryLabel(b), lang))
            .forEach((key) => {
                sorted[key] = groups[key];
            });
        return sorted;
    }, [filteredChurches, getCountryLabel, lang]);

    // Distance map
    const distanceMap = useMemo(() => {
        if (!userLocation) return {};
        const map = {};
        for (const c of churches) {
            map[c.id] = haversineDistance(userLocation.lat, userLocation.lng, c.lat, c.lng);
        }
        return map;
    }, [userLocation, churches]);

    const getDirectionsUrl = (church) => {
        const fullAddress = `${church.street || ""} ${church.number || ""}, ${church.city || ""}, ${church.country || ""}`.trim();
        return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddress)}&destination_place_id=${encodeURIComponent(church.name)}`;
    };

    const activeFilterIcon = activeCountryFilter
        ? COUNTRY_FLAGS[activeCountryFilter] || "🌍"
        : "🌍";

    return (
        <div className={`churchMapLayout ${mobileShowMap ? "mapFocused" : ""}`}>
            {/* Sidebar */}
            <aside className="churchMapSidebar">
                <div className="churchMapSidebarHeader"></div>

                <div className="churchMapBottomSheet" data-mode={bottomSheetMode}>
                    <div
                        className="bottomSheetDragHandleArea"
                        onClick={() => {
                            if (bottomSheetMode === "hidden") setBottomSheetMode("collapsed");
                            else if (bottomSheetMode === "collapsed") setBottomSheetMode("expanded");
                            else setBottomSheetMode("collapsed");
                        }}
                        onTouchStart={handleTouchStart}
                        onTouchEnd={handleTouchEnd}
                    >
                        <div className="bottomSheetDragHandle"></div>
                    </div>

                    {/* Search and Country Filter Area */}
                    <div className="churchMapFilterContainer">
                        <div className="churchMapSearch">
                            <svg className="churchMapSearchIcon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                            <input
                                type="text"
                                placeholder={t("searchPlaceholder")}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <div className="countryFilterDropdown" ref={filterRef}>
                            <button
                                className={`countryFilterBtn ${activeCountryFilter ? "hasFilter" : ""}`}
                                onClick={() => setFilterOpen(!filterOpen)}
                                title={activeCountryFilter ? getCountryLabel(activeCountryFilter) : t("allCountries")}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>{activeFilterIcon}</span>
                                    <span style={{ fontSize: '0.95rem', fontWeight: '500', opacity: 0.9 }}>
                                        ({activeCountryFilter ? (countryCounts[activeCountryFilter] || 0) : (countryCounts.all || 0)})
                                    </span>
                                </div>
                                <svg className={`chevron ${filterOpen ? "open" : ""}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: 0 }}>
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                            </button>
                            {filterOpen && (
                                <div className="countryFilterMenu">
                                    <button
                                        className={`countryFilterOption ${!activeCountryFilter ? "active" : ""}`}
                                        onClick={() => {
                                            setActiveCountryFilter("");
                                            setFilterOpen(false);
                                        }}
                                        style={{ justifyContent: 'flex-start', padding: '10px 16px' }}
                                    >
                                        <span style={{ fontSize: '1.1rem' }}>🌍</span> {t("allCountries")}
                                        <span style={{ fontSize: '0.85rem', opacity: 0.7, marginLeft: 'auto' }}>({countryCounts.all || 0})</span>
                                    </button>
                                    {ALL_COUNTRIES.map((country) => (
                                        <button
                                            key={country}
                                            className={`countryFilterOption ${activeCountryFilter === country ? "active" : ""}`}
                                            onClick={() => {
                                                setActiveCountryFilter(country);
                                                setFilterOpen(false);
                                            }}
                                        >
                                            <span style={{ fontSize: '1.1rem' }}>{COUNTRY_FLAGS[country] || "🌍"}</span> {getCountryLabel(country)}
                                            <span style={{ fontSize: '0.85rem', opacity: 0.7, marginLeft: 'auto' }}>({countryCounts[country] || 0})</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="churchList">
                        {churchesLoading ? (
                            <div className="loaderContainer">
                                <div className="premiumLoader">
                                    <div className="loaderRing"></div>
                                    <div className="loaderRing"></div>
                                    <div className="loaderLogo">
                                        <img src="/icon.png" alt="Bethel Logo" />
                                    </div>
                                </div>
                                <span className="loaderText">{t("loadingChurches") || "Încărcare..."}</span>
                            </div>
                        ) : (
                            <>
                                {Object.entries(groupedChurches).map(([country, items]) => (
                                    <div key={country} className="churchCountryGroup">
                                        <h2 className="churchCountryHeader">
                                            <span className="countryFlag">{COUNTRY_FLAGS[country] || "🌍"}</span>
                                            {t(`country_${country}`) === `country_${country}` ? country : t(`country_${country}`)}
                                            <span className="countryCount">{items.length}</span>
                                        </h2>
                                        {items.map((church, idx) => {
                                            const isSelected = selectedChurch?.id === church.id;
                                            const dist = distanceMap[church.id];
                                            return (
                                                <button
                                                    key={idx}
                                                    className={`churchListItem ${isSelected ? "active" : ""}`}
                                                    onClick={() => {
                                                        selectChurch(church);
                                                    }}
                                                >
                                                    <div className="churchListItemIcon">
                                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                                                        </svg>
                                                    </div>
                                                    <div className="churchListItemContent">
                                                        <h3>{church.name}{church.city ? ` - ${church.city}` : ''}</h3>
                                                        <p>{church.street} {church.number}</p>
                                                    </div>
                                                    {dist != null && (
                                                        <span className="churchDistance">{formatDistance(dist)}</span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                ))}

                                {filteredChurches.length === 0 && (
                                    <div className="churchListEmpty">
                                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                            <circle cx="11" cy="11" r="8"></circle>
                                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                        </svg>
                                        <p>{t("noChurchFound")}</p>
                                        <div className="emptyActions">
                                            <button className="resetSearchBtn" onClick={() => { setSearchQuery(""); setActiveCountryFilter(""); }}>
                                                {t("resetSearch")}
                                            </button>
                                            <button className="suggestNewBtn" onClick={() => openSuggestionModal("new")}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M12 5v14M5 12h14"></path>
                                                </svg>
                                                {t("suggestChurch")}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <div className="churchSidebarFooter">
                        <button className="sidebarSuggestBtn" onClick={() => openSuggestionModal("new")}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 5v14M5 12h14"></path>
                            </svg>
                            {t("suggestChurch")}
                        </button>
                    </div>
                </div>

                {/* Mobile: Back to list */}
                {mobileShowMap && (
                    <button className="mobileBackToList" onClick={() => setMobileShowMap(false)}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="19" y1="12" x2="5" y2="12"></line>
                            <polyline points="12 19 5 12 12 5"></polyline>
                        </svg>
                        {t("backToList")}
                    </button>
                )}
            </aside>

            {/* Map */}
            <div className="churchMapContainer">
                {/* Map Overlay Title */}
                <div className="mapOverlayTitle">
                    <h1 className="mapOverlayHeading">{t("subtitle")}</h1>
                    <p className="mapOverlaySubtitle">{t("title")}</p>
                </div>

                <APIProvider apiKey={API_KEY}>
                    <Map
                        defaultCenter={BELGIUM_CENTER}
                        defaultZoom={8}
                        mapId={MAP_ID}
                        disableDefaultUI={true}
                        gestureHandling={"greedy"}
                    >
                        {filteredChurches.map((church, idx) => (
                            <AdvancedMarker
                                key={idx}
                                position={{ lat: church.lat, lng: church.lng }}
                                onClick={() => selectChurch(church)}
                                onMouseEnter={() => setHoveredMarker(church.id)}
                                onMouseLeave={() => setHoveredMarker(null)}
                            >
                                <div className="markerWrapper">
                                    <div className={`customMarker ${selectedChurch?.id === church.id ? "pulse" : ""}`}>
                                        <svg width="34" height="34" viewBox="0 0 24 24">
                                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                                        </svg>
                                    </div>
                                    {hoveredMarker === church.id && selectedChurch?.id !== church.id && (
                                        <div className="markerTooltip">{church.name}{church.city ? ` - ${church.city}` : ''}</div>
                                    )}
                                </div>
                            </AdvancedMarker>
                        ))}

                        {userLocation && (
                            <AdvancedMarker position={userLocation} zIndex={1001} title={t("youAreHere")}>
                                <div className="userLocationDot"></div>
                            </AdvancedMarker>
                        )}

                        <MapController
                            selectedChurch={selectedChurch}
                            requestedLocation={userLocation}
                            isInitialLoad={isInitialLoad}
                        />
                        <FilterController
                            filteredChurches={filteredChurches}
                            activeCountryFilter={activeCountryFilter}
                        />
                    </Map>

                    {/* Church Details Card */}
                    {selectedChurch && (
                        <div className="churchDetailsCard">
                            <button className="churchDetailsClose" onClick={deselectChurch}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>

                            <div className="churchDetailsContent" style={{ paddingTop: "32px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px", flexWrap: "wrap", paddingRight: "28px" }}>
                                    <h2 className="churchDetailsTitle" style={{ margin: 0 }}>
                                        {selectedChurch.name}{selectedChurch.city ? ` - ${selectedChurch.city}` : ''}
                                    </h2>
                                    <div className="churchLikeTooltipWrapper">
                                        <button
                                            className={`churchLikeBtn ${likedChurches.has(selectedChurch.id) ? "liked" : ""}`}
                                            onClick={() => handleLike(selectedChurch.id)}
                                            style={{ cursor: "pointer", margin: 0, padding: "4px 10px" }}
                                            title={likedChurches.has(selectedChurch.id) ? t("removeRecommendation") : t("recommendChurch")}
                                        >
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill={likedChurches.has(selectedChurch.id) ? "#ef4444" : "none"} stroke={likedChurches.has(selectedChurch.id) ? "#ef4444" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                                            </svg>
                                            <span className="churchLikeCount">{selectedChurch.likes || 0}</span>
                                        </button>
                                        <div className="churchLikeTooltipContent">
                                            {t("recommendInfo")}
                                        </div>
                                    </div>
                                </div>
                                <p className="churchDetailsAddress" style={{ marginTop: "4px" }}>{selectedChurch.street} {selectedChurch.number}</p>


                                <div className="churchDetailsInfoList">
                                    {selectedChurch.phone && (
                                        <div className="churchDetailsInfoItem">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                                <rect width="24" height="24" rx="5" fill="#10B981" />
                                                <g transform="translate(4.5, 4.5) scale(0.625)" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
                                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                                </g>
                                            </svg>
                                            <a href={`tel:${selectedChurch.phone}`}>{selectedChurch.phone}</a>
                                        </div>
                                    )}
                                    {selectedChurch.email && (
                                        <div className="churchDetailsInfoItem">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                                <rect width="24" height="24" rx="5" fill="#3B82F6" />
                                                <g transform="translate(4.5, 4.5) scale(0.625)" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
                                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                                    <polyline points="22,6 12,13 2,6" />
                                                </g>
                                            </svg>
                                            <a href={`mailto:${selectedChurch.email}`}>{selectedChurch.email}</a>
                                        </div>
                                    )}
                                    {selectedChurch.website && (
                                        <div className="churchDetailsInfoItem">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                                <rect width="24" height="24" rx="5" fill="#8B5CF6" />
                                                <g transform="translate(4.5, 4.5) scale(0.625)" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
                                                    <circle cx="12" cy="12" r="10" />
                                                    <line x1="2" y1="12" x2="22" y2="12" />
                                                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                                                </g>
                                            </svg>
                                            <a href={selectedChurch.website} target="_blank" rel="noopener noreferrer">
                                                {selectedChurch.website.replace(/^https?:\/\//, '')}
                                            </a>
                                        </div>
                                    )}
                                    {selectedChurch.youtube && (
                                        <div className="churchDetailsInfoItem youtubeItem">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="#FF0000">
                                                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                                            </svg>
                                            <a href={selectedChurch.youtube} target="_blank" rel="noopener noreferrer">
                                                YouTube
                                            </a>
                                        </div>
                                    )}
                                    {selectedChurch.facebook && (
                                        <div className="churchDetailsInfoItem facebookItem">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2">
                                                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                                            </svg>
                                            <a href={selectedChurch.facebook} target="_blank" rel="noopener noreferrer">
                                                Facebook
                                            </a>
                                        </div>
                                    )}
                                    {selectedChurch.instagram && (
                                        <div className="churchDetailsInfoItem instagramItem">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                                <defs>
                                                    <linearGradient id="ig-grad-new" x1="0%" y1="100%" x2="100%" y2="0%">
                                                        <stop offset="0%" stopColor="#f09433" />
                                                        <stop offset="25%" stopColor="#e6683c" />
                                                        <stop offset="50%" stopColor="#dc2743" />
                                                        <stop offset="75%" stopColor="#cc2366" />
                                                        <stop offset="100%" stopColor="#bc1888" />
                                                    </linearGradient>
                                                </defs>
                                                <rect width="24" height="24" rx="5" fill="url(#ig-grad-new)" />
                                                <g transform="translate(4.5, 4.5) scale(0.625)" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
                                                    <rect x="2" y="2" width="20" height="20" rx="5" />
                                                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                                                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                                                </g>
                                            </svg>
                                            <a href={selectedChurch.instagram} target="_blank" rel="noopener noreferrer">
                                                Instagram
                                            </a>
                                        </div>
                                    )}
                                </div>

                                <div className="churchDetailsActions">
                                    <a
                                        href={getDirectionsUrl(selectedChurch)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="churchDetailsDirectionsBtn"
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
                                        </svg>
                                        {t("directions")}
                                    </a>
                                    <button
                                        className="churchEditSuggestBtn"
                                        onClick={() => openSuggestionModal("edit", selectedChurch)}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                            <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                        </svg>
                                        {t("editChurch")}
                                    </button>
                                </div>

                                <p className="churchDetailsDisclaimer">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <line x1="12" y1="8" x2="12" y2="12"></line>
                                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                    </svg>
                                    {t("infoDisclaimer") || "Les informations peuvent avoir évolué. Pensez à vérifier avant votre visite."}
                                </p>
                            </div>
                        </div>
                    )}
                </APIProvider>
            </div>

            {/* Suggestion Modal */}
            {showSuggestionModal && (
                <div className="suggestionModalOverlay">
                    <div className="suggestionModal">
                        <div className="suggestionModalHeader">
                            <h3>{suggestionType === "new" ? t("suggestionTitleNew") : t("suggestionTitleEdit")}</h3>
                            <button className="suggestionModalClose" onClick={() => setShowSuggestionModal(false)}>&times;</button>
                        </div>

                        {suggestionSuccess ? (
                            <div className="suggestionSuccess">
                                <div className="successIcon">✓</div>
                                <p>{t("suggestionSuccess")}</p>
                            </div>
                        ) : (
                            <form className="suggestionForm" onSubmit={handleSuggestionSubmit}>
                                {formError && <div className="suggestionError">{formError}</div>}

                                <div className="suggestionFormBody">
                                    <div className="suggestionFormGroup">
                                        <label>{t("name")} *</label>
                                        <input
                                            type="text"
                                            required
                                            value={suggestionForm.name}
                                            onChange={(e) => setSuggestionForm({ ...suggestionForm, name: e.target.value })}
                                        />
                                    </div>

                                    <div className="suggestionFormRow">
                                        <div className="suggestionFormGroup">
                                            <label>{t("city")} *</label>
                                            <input
                                                type="text"
                                                required
                                                value={suggestionForm.city}
                                                onChange={(e) => setSuggestionForm({ ...suggestionForm, city: e.target.value })}
                                                placeholder={t.cityPlaceholder}
                                            />
                                        </div>
                                        <div className="suggestionFormGroup">
                                            <label>{t("country")}</label>
                                            <select
                                                value={suggestionForm.country}
                                                onChange={(e) => setSuggestionForm({ ...suggestionForm, country: e.target.value })}
                                            >
                                                {SUGGESTION_COUNTRIES.map(c => (
                                                    <option key={c} value={c}>{getCountryLabel(c)}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="suggestionFormRow">
                                        <div className="suggestionFormGroup" style={{ flex: 3 }}>
                                            <label>{t("street")}</label>
                                            <input
                                                type="text"
                                                value={suggestionForm.street}
                                                onChange={(e) => setSuggestionForm({ ...suggestionForm, street: e.target.value })}
                                            />
                                        </div>
                                        <div className="suggestionFormGroup" style={{ flex: 1 }}>
                                            <label>{t("number")}</label>
                                            <input
                                                type="text"
                                                value={suggestionForm.number}
                                                onChange={(e) => setSuggestionForm({ ...suggestionForm, number: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="suggestionFormRow">
                                        <div className="suggestionFormGroup">
                                            <label>{t("phone")}</label>
                                            <input
                                                type="tel"
                                                value={suggestionForm.phone}
                                                onChange={(e) => setSuggestionForm({ ...suggestionForm, phone: e.target.value })}
                                            />
                                        </div>
                                        <div className="suggestionFormGroup">
                                            <label>{t("email")}</label>
                                            <input
                                                type="email"
                                                value={suggestionForm.email}
                                                onChange={(e) => setSuggestionForm({ ...suggestionForm, email: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="suggestionFormRow">
                                        <div className="suggestionFormGroup">
                                            <label>{t("website")}</label>
                                            <input
                                                type="url"
                                                placeholder="https://..."
                                                value={suggestionForm.website}
                                                onChange={(e) => setSuggestionForm({ ...suggestionForm, website: e.target.value })}
                                            />
                                        </div>
                                        <div className="suggestionFormGroup">
                                            <label>{t("youtube")}</label>
                                            <input
                                                type="url"
                                                placeholder="https://youtube.com/..."
                                                value={suggestionForm.youtube}
                                                onChange={(e) => setSuggestionForm({ ...suggestionForm, youtube: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="suggestionFormRow">
                                        <div className="suggestionFormGroup">
                                            <label>{t("instagram")}</label>
                                            <input
                                                type="url"
                                                placeholder="https://instagram.com/..."
                                                value={suggestionForm.instagram}
                                                onChange={(e) => setSuggestionForm({ ...suggestionForm, instagram: e.target.value })}
                                            />
                                        </div>
                                        <div className="suggestionFormGroup">
                                            <label>{t("facebook")}</label>
                                            <input
                                                type="url"
                                                placeholder="https://facebook.com/..."
                                                value={suggestionForm.facebook}
                                                onChange={(e) => setSuggestionForm({ ...suggestionForm, facebook: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="suggestionFormRow">
                                        <div className="suggestionFormGroup" style={{ flex: 1 }}>
                                            <label>{t("notes")}</label>
                                            <textarea
                                                rows="3"
                                                value={suggestionForm.notes}
                                                onChange={(e) => setSuggestionForm({ ...suggestionForm, notes: e.target.value })}
                                                style={{
                                                    width: "100%", padding: "8px 12px", borderRadius: "10px",
                                                    border: "1px solid #e2e8f0", fontSize: "0.95rem", resize: "vertical",
                                                    minHeight: "60px"
                                                }} />
                                        </div>
                                    </div>
                                </div>

                                <div className="suggestionFormActions">
                                    <button type="button" className="btnCancel" onClick={() => setShowSuggestionModal(false)}>
                                        {t("cancel")}
                                    </button>
                                    <button type="submit" className="btnSubmit" disabled={isSubmitting}>
                                        {isSubmitting ? "..." : t("submit")}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
