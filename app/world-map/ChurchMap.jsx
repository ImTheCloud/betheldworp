"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { APIProvider, Map, AdvancedMarker, useMap } from "@vis.gl/react-google-maps";
import { useSearchParams } from "next/navigation";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../lib/Firebase";
import Link from "next/link";
import { useLang } from "../components/LanguageProvider";
import { makeT } from "../lib/i18n";
import worldMapTranslations from "../translations/WorldMap.json";
import "./WorldMap.css";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const MAP_ID = "5b50d76db2afedb8ba67cff4";
const DEFAULT_CENTER = { lat: 50.77198, lng: 4.30396 }; // Coordinates roughly near Brussels/Halle

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
                map.panTo(DEFAULT_CENTER);
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
            // Reset to default view
            map.panTo(DEFAULT_CENTER);
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
    const [filterOpen, setFilterOpen] = useState(false);
    const filterRef = useRef(null);

    const { lang, setLang } = useLang();
    const t = makeT(worldMapTranslations, lang);

    const LANG_OPTIONS = [
        { value: "ro", flagImg: "https://flagcdn.com/w40/ro.png" },
        { value: "fr", flagImg: "https://flagcdn.com/w40/fr.png" },
        { value: "nl", flagImg: "https://flagcdn.com/w40/nl.png" },
        { value: "en", flagImg: "https://flagcdn.com/w40/gb.png" }
    ];

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

    const DEFAULT_CENTER = useMemo(() => getBoundsCenter(churches), [churches]);
    const ALL_COUNTRIES = useMemo(() => [...new Set(churches.map((c) => c.country))].sort(), [churches]);

    // Close dropdown on outside click
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
        const url = new URL(window.location.href);
        url.searchParams.set("church", church.id);
        window.history.replaceState({}, "", url.toString());
    }, []);

    const deselectChurch = useCallback(() => {
        setSelectedChurch(null);
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

    if (!API_KEY) {
        return <div className="text-white p-8">Cheia API Google Maps nu este configurată.</div>;
    }

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
        // Sort country keys
        const sorted = {};
        Object.keys(groups)
            .sort()
            .forEach((key) => {
                sorted[key] = groups[key];
            });
        return sorted;
    }, [filteredChurches]);

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

    const activeFilterLabel = activeCountryFilter
        ? `${COUNTRY_FLAGS[activeCountryFilter] || "🌍"} ${activeCountryFilter}`
        : "All countries";

    return (
        <div className={`churchMapLayout ${mobileShowMap ? "mapFocused" : ""}`}>
            {/* Sidebar */}
            <aside className="churchMapSidebar">
                <div className="churchMapSidebarHeader">
                    <Link href="/" className="churchMapBackToHomeBtn" title={t("backToHome")}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="19" y1="12" x2="5" y2="12"></line>
                            <polyline points="12 19 5 12 12 5"></polyline>
                        </svg>
                    </Link>

                    <div className="churchMapLangSelector">
                        {LANG_OPTIONS.map((opt) => (
                            <button
                                key={opt.value}
                                className={`churchMapLangBtn ${lang === opt.value ? "active" : ""}`}
                                onClick={() => setLang(opt.value)}
                            >
                                <img src={opt.flagImg} alt={opt.value} />
                            </button>
                        ))}
                    </div>

                    <h1 className="churchMapTitle">{t("title")}</h1>
                    <p className="churchMapSubtitle">{t("subtitle")}</p>
                    <div className="churchMapMeta">
                        <span className="churchCount">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                            </svg>
                            {churches.length} {t("associatedChurches")}
                        </span>
                    </div>

                    {/* Country Filter Dropdown */}
                    <div className="countryFilterDropdown" ref={filterRef}>
                        <button
                            className={`countryFilterBtn ${activeCountryFilter ? "hasFilter" : ""}`}
                            onClick={() => setFilterOpen(!filterOpen)}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                            </svg>
                            <span>{activeFilterLabel}</span>
                            <svg className={`chevron ${filterOpen ? "open" : ""}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                                >
                                    🌍 {t("allCountries")}
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
                                        {COUNTRY_FLAGS[country] || "🌍"} {country}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

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
                </div>

                <div className="churchList">
                    {Object.entries(groupedChurches).map(([country, churches]) => (
                        <div key={country} className="churchCountryGroup">
                            <h2 className="churchCountryHeader">
                                <span className="countryFlag">{COUNTRY_FLAGS[country] || "🌍"}</span>
                                {country}
                                <span className="countryCount">{churches.length}</span>
                            </h2>
                            {churches.map((church, idx) => {
                                const isSelected = selectedChurch?.id === church.id;
                                const dist = distanceMap[church.id];
                                return (
                                    <button
                                        key={idx}
                                        className={`churchListItem ${isSelected ? "active" : ""}`}
                                        onClick={() => {
                                            selectChurch(church);
                                            setMobileShowMap(true);
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
                            <button className="resetSearchBtn" onClick={() => { setSearchQuery(""); setActiveCountryFilter(""); }}>
                                {t("resetSearch")}
                            </button>
                        </div>
                    )}
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
                <APIProvider apiKey={API_KEY}>
                    <Map
                        defaultCenter={DEFAULT_CENTER}
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
                                <h2 className="churchDetailsTitle">{selectedChurch.name}{selectedChurch.city ? ` - ${selectedChurch.city}` : ''}</h2>
                                <p className="churchDetailsAddress">{selectedChurch.street} {selectedChurch.number}</p>


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
                                        className={`churchShareBtn ${copied ? "copied" : ""}`}
                                        onClick={() => handleShare(selectedChurch)}
                                    >
                                        {copied ? (
                                            <>
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <polyline points="20 6 9 17 4 12"></polyline>
                                                </svg>
                                                {t("copied")}
                                            </>
                                        ) : (
                                            <>
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <circle cx="18" cy="5" r="3"></circle>
                                                    <circle cx="6" cy="12" r="3"></circle>
                                                    <circle cx="18" cy="19" r="3"></circle>
                                                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                                                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                                                </svg>
                                                {t("share")}
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </APIProvider>
            </div>
        </div>
    );
}
