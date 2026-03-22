"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef, Suspense } from "react";
import { APIProvider, Map, AdvancedMarker, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { useSearchParams } from "next/navigation";
import { collection, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, increment } from "firebase/firestore";
import { db } from "../lib/Firebase";
import { trackWorldMapVisit } from "@/app/lib/Tracker";
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

const COUNTRY_VIEWS = {
    Belgium: { center: { lat: 50.5039, lng: 4.4699 }, zoom: 8 },
    Romania: { center: { lat: 45.9432, lng: 24.9668 }, zoom: 7 },
    France: { center: { lat: 46.2276, lng: 2.2137 }, zoom: 6 },
    Germany: { center: { lat: 51.1657, lng: 10.4515 }, zoom: 6 },
    Netherlands: { center: { lat: 52.1326, lng: 5.2913 }, zoom: 7 },
    Italy: { center: { lat: 41.8719, lng: 12.5674 }, zoom: 6 },
    Spain: { center: { lat: 40.4637, lng: -3.7492 }, zoom: 6 },
    "United Kingdom": { center: { lat: 55.3781, lng: -3.4360 }, zoom: 6 },
    USA: { center: { lat: 37.0902, lng: -95.7129 }, zoom: 4 },
    Austria: { center: { lat: 47.5162, lng: 14.5501 }, zoom: 7 },
    Switzerland: { center: { lat: 46.8182, lng: 8.2275 }, zoom: 8 },
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

const ChurchInfoLinks = ({ church, t }) => {
    if (!church) return null;

    return (
        <div className="churchDetailsInfoList">
            <div className={`churchDetailsInfoItem ${!church.phone ? "not-provided" : ""}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <rect width="24" height="24" rx="5" fill="#10B981" />
                    <g transform="translate(4.5, 4.5) scale(0.625)" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </g>
                </svg>
                {church.phone ? (
                    <a href={`tel:${church.phone}`}>{church.phone}</a>
                ) : (
                    <span>{t("phone")} {t("notSpecified")}</span>
                )}
            </div>

            <div className={`churchDetailsInfoItem ${!church.email ? "not-provided" : ""}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <rect width="24" height="24" rx="5" fill="#3B82F6" />
                    <g transform="translate(4.5, 4.5) scale(0.625)" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                    </g>
                </svg>
                {church.email ? (
                    <a href={`mailto:${church.email}`}>{church.email}</a>
                ) : (
                    <span>{t("email")} {t("notSpecified")}</span>
                )}
            </div>

            <div className={`churchDetailsInfoItem ${!church.website ? "not-provided" : ""}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <rect width="24" height="24" rx="5" fill="#8B5CF6" />
                    <g transform="translate(4.5, 4.5) scale(0.625)" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="2" y1="12" x2="22" y2="12" />
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </g>
                </svg>
                {church.website ? (
                    <a href={church.website} target="_blank" rel="noopener noreferrer">
                        {church.website.replace(/^https?:\/\//, '')}
                    </a>
                ) : (
                    <span>{t("website")} {t("notSpecified")}</span>
                )}
            </div>

            <div className={`churchDetailsInfoItem youtubeItem ${!church.youtube ? "not-provided" : ""}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#FF0000">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
                {church.youtube ? (
                    <a href={church.youtube} target="_blank" rel="noopener noreferrer">
                        YouTube
                    </a>
                ) : (
                    <span>YouTube {t("notSpecified")}</span>
                )}
            </div>

            <div className={`churchDetailsInfoItem facebookItem ${!church.facebook ? "not-provided" : ""}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
                {church.facebook ? (
                    <a href={church.facebook} target="_blank" rel="noopener noreferrer">
                        Facebook
                    </a>
                ) : (
                    <span>Facebook {t("notSpecified")}</span>
                )}
            </div>

            <div className={`churchDetailsInfoItem instagramItem ${!church.instagram ? "not-provided" : ""}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <defs>
                        <linearGradient id="shared-ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#f09433" />
                            <stop offset="25%" stopColor="#e6683c" />
                            <stop offset="50%" stopColor="#dc2743" />
                            <stop offset="75%" stopColor="#cc2366" />
                            <stop offset="100%" stopColor="#bc1888" />
                        </linearGradient>
                    </defs>
                    <rect width="24" height="24" rx="5" fill="url(#shared-ig-grad)" />
                    <g transform="translate(4.5, 4.5) scale(0.625)" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
                        <rect x="2" y="2" width="20" height="20" rx="5" />
                        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                    </g>
                </svg>
                {church.instagram ? (
                    <a href={church.instagram} target="_blank" rel="noopener noreferrer">
                        Instagram
                    </a>
                ) : (
                    <span>Instagram {t("notSpecified")}</span>
                )}
            </div>
        </div>
    );
};

function MapController({ selectedChurch, requestedLocation, isInitialLoad, recenterTrigger }) {
    const map = useMap();
    const prevChurchRef = useRef(null);

    useEffect(() => {
        if (!map) return;

        let target = null;
        let targetZoom = 12;

        if (selectedChurch) {
            target = { lat: selectedChurch.lat, lng: selectedChurch.lng };
            targetZoom = 11.5; // Adjusted from 10 to be slightly closer
        } else if (requestedLocation && (isInitialLoad || recenterTrigger > 0)) {
            target = { lat: requestedLocation.lat, lng: requestedLocation.lng };
            targetZoom = 12;
        } else if (!requestedLocation && !selectedChurch && isInitialLoad) {
            target = BELGIUM_CENTER;
            targetZoom = 8;
        }

        if (!target) return;

        // Restore default instant jump (no animation)
        map.setCenter(target);
        map.setZoom(targetZoom);
        if (map.setTilt) map.setTilt(0);

        if (selectedChurch) {
            prevChurchRef.current = selectedChurch;
        } else {
            prevChurchRef.current = null;
        }

        return () => { };
    }, [map, selectedChurch, requestedLocation, isInitialLoad, recenterTrigger]);

    return null;
}

function FilterController({ filteredChurches, activeCountryFilter, isMobile }) {
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

        // Use predefined country view if available for better framing
        if (COUNTRY_VIEWS[activeCountryFilter]) {
            const { center, zoom } = COUNTRY_VIEWS[activeCountryFilter];
            map.panTo(center);
            map.setZoom(zoom);
            return;
        }

        if (filteredChurches.length === 0) return;

        if (filteredChurches.length === 1) {
            map.panTo({ lat: filteredChurches[0].lat, lng: filteredChurches[0].lng });
            map.setZoom(10); // Relaxed from 12 to 10
            return;
        }

        // Fit bounds to all filtered churches
        const bounds = new google.maps.LatLngBounds();
        filteredChurches.forEach((c) => bounds.extend({ lat: c.lat, lng: c.lng }));
        
        const padding = isMobile ? 40 : 100;
        map.fitBounds(bounds, { top: padding, right: padding, bottom: padding, left: padding });

        // Cap the zoom after fitting bounds by watching zoom_changed immediately
        const zoomListener = map.addListener("zoom_changed", () => {
            if (map.getZoom() > 10) {
                map.setZoom(10); // Relaxed from 8 to 10 for better country focus
            }
        });

        // Remove listener once map reaches final position
        const idleListener = google.maps.event.addListenerOnce(map, "idle", () => {
            google.maps.event.removeListener(zoomListener);
        });
    }, [map, filteredChurches, activeCountryFilter]);

    return null;
}

const Markers = ({ churches, onMarkerClick, selectedChurchId, hoveredMarkerId, setHoveredMarker }) => {
    const map = useMap();
    const markerLibrary = useMapsLibrary('marker');
    const clusterer = useRef(null);
    const markersRef = useRef({}); // id -> marker instance

    // Initialize/Re-initialize Clusterer whenever map or markerLibrary changes
    useEffect(() => {
        if (!map || !markerLibrary) return;

        // Cleanup previous clusterer if it exists
        if (clusterer.current) {
            clusterer.current.clearMarkers();
            clusterer.current.setMap(null);
            clusterer.current = null;
        }

        // Clear existing markers since they are bound to the old map/library
        Object.values(markersRef.current).forEach(marker => {
            marker.map = null;
        });
        markersRef.current = {};

        // Create new clusterer
        clusterer.current = new MarkerClusterer({
            map,
            renderer: {
                render: ({ count, position }) => {
                    const div = document.createElement('div');
                    div.className = 'customClusterMarker';
                    div.innerHTML = `<span>${count}</span>`;
                    return new markerLibrary.AdvancedMarkerElement({
                        position,
                        content: div,
                        zIndex: 1001
                    });
                }
            },
            onClusterClick: (event, cluster, map) => {
                const bounds = new google.maps.LatLngBounds();
                cluster.markers.forEach(m => bounds.extend(m.position));
                map.fitBounds(bounds);

                // Cap the zoom after fitting bounds by watching zoom_changed immediately
                const zoomListener = map.addListener("zoom_changed", () => {
                    if (map.getZoom() > 10) {
                        map.setZoom(10);
                    }
                });

                // Remove listener once map reaches final position
                const idleListener = google.maps.event.addListenerOnce(map, "idle", () => {
                    google.maps.event.removeListener(zoomListener);
                });
            }
        });

        // Cleanup on unmount or map/library change
        return () => {
            if (clusterer.current) {
                clusterer.current.clearMarkers();
                clusterer.current.setMap(null);
                clusterer.current = null;
            }
        };
    }, [map, markerLibrary]);

    // Helper to update marker visual state
    const updateMarkerContent = (marker, church, isSelected, isHovered) => {
        if (!marker || !marker.content) return;

        const container = marker.content;

        // Ensure base HTML is present
        if (container.children.length === 0) {
            container.innerHTML = `
                <div class="customMarker">
                    <svg width="34" height="34" viewBox="0 0 24 24">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                    </svg>
                </div>
                <div class="markerTooltip"></div>
            `;
        }

        const markerIcon = container.querySelector('.customMarker');
        const tooltip = container.querySelector('.markerTooltip');

        if (markerIcon) {
            markerIcon.className = `customMarker ${isSelected ? 'pulse' : ''}`;
        }

        if (tooltip) {
            tooltip.style.display = (isHovered && !isSelected) ? 'block' : 'none';
            tooltip.textContent = `${church.name}${church.city ? ` - ${church.city}` : ''}`;
        }

        marker.zIndex = isSelected ? 1000 : (isHovered ? 999 : 1);
    };

    // Synchronize markers with churches data
    useEffect(() => {
        if (!map || !clusterer.current || !markerLibrary) return;

        const currentIds = new Set(churches.map(c => c.id));
        const markersToRemove = [];

        // 1. Identify markers to remove (no longer in data)
        Object.keys(markersRef.current).forEach(id => {
            if (!currentIds.has(id)) {
                markersToRemove.push(markersRef.current[id]);
                delete markersRef.current[id];
            }
        });

        if (markersToRemove.length > 0) {
            clusterer.current.removeMarkers(markersToRemove);
            markersToRemove.forEach(m => m.map = null);
        }

        // 2. Add new markers and update appearance of all
        const newMarkers = [];
        churches.forEach(church => {
            const isSelected = selectedChurchId === church.id;
            const isHovered = hoveredMarkerId === church.id;
            let marker = markersRef.current[church.id];

            if (!marker) {
                const container = document.createElement("div");
                container.className = "markerWrapper";

                marker = new markerLibrary.AdvancedMarkerElement({
                    position: { lat: church.lat, lng: church.lng },
                    content: container,
                });

                marker.addListener("click", () => onMarkerClick(church));

                container.addEventListener("mouseenter", () => setHoveredMarker(church.id));
                container.addEventListener("mouseleave", () => setHoveredMarker(null));

                markersRef.current[church.id] = marker;
                newMarkers.push(marker);
            }

            // Always ensure content and visual state is correct
            updateMarkerContent(marker, church, isSelected, isHovered);
        });

        if (newMarkers.length > 0) {
            clusterer.current.addMarkers(newMarkers);
        }

    }, [map, markerLibrary, churches, onMarkerClick, setHoveredMarker, selectedChurchId, hoveredMarkerId]);

    return null;
};

function ChurchMap() {
    const searchParams = useSearchParams();
    
    const [isMobile, setIsMobile] = useState(false);
    const [bottomSheetMode, setBottomSheetMode] = useState("collapsed"); // "hidden" | "collapsed" | "expanded"
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [showOtherCountries, setShowOtherCountries] = useState(false);
    const otherCountriesRef = useRef(null);

    const [churches, setChurches] = useState([]);
    const [churchesLoading, setChurchesLoading] = useState(true);
    const [selectedChurch, setSelectedChurch] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [userLocation, setUserLocation] = useState(null);
    const [recenterTrigger, setRecenterTrigger] = useState(0);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [activeCountryFilter, setActiveCountryFilter] = useState("");
    const [hoveredMarker, setHoveredMarker] = useState(null);
    const [copied, setCopied] = useState(false);
    const [mobileShowMap, setMobileShowMap] = useState(false);
    const [filterOpen, setFilterOpen] = useState(false);
    const filterRef = useRef(null);
    const touchStartY = useRef(null);
    const [isExiting, setIsExiting] = useState(false);
    const [dragHeight, setDragHeight] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const startHeight = useRef(null);
    const sheetRef = useRef(null);

    // Auto-close bottom sheet on mobile when a country is selected
    useEffect(() => {
        if (activeCountryFilter && isMobile) {
            setBottomSheetMode("hidden");
        }
    }, [activeCountryFilter, isMobile, setBottomSheetMode]);


    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth <= 768);
        checkMobile();
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);


    const [showSuggestionModal, setShowSuggestionModal] = useState(false);
    const [suggestionType, setSuggestionType] = useState("new"); // "new" | "edit"
    const [suggestionSuccess, setSuggestionSuccess] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { lang, setLang, supported } = useLang();
    // Lock body scroll on mount to prevent mobile conflict
    useEffect(() => {
        const originalBodyOverflow = document.body.style.overflow;
        const originalHtmlOverflow = document.documentElement.style.overflow;

        document.body.style.overflow = "hidden";
        document.documentElement.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = originalBodyOverflow;
            document.documentElement.style.overflow = originalHtmlOverflow;
        };
    }, []);

    const t = makeT(worldMapTranslations, lang);

    const [formError, setFormError] = useState("");
    const [initialFormValues, setInitialFormValues] = useState(null);

    const langOptions = [
        { value: "ro", short: "RO", flag: "https://flagcdn.com/w40/ro.png" },
        { value: "fr", short: "FR", flag: "https://flagcdn.com/w40/fr.png" },
        { value: "nl", short: "NL", flag: "https://flagcdn.com/w40/nl.png" },
        { value: "en", short: "EN", flag: "https://flagcdn.com/w40/gb.png" }
    ];




    // Close "Autres" country dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(e) {
            if (otherCountriesRef.current && !otherCountriesRef.current.contains(e.target)) {
                setShowOtherCountries(false);
            }
        }
        if (showOtherCountries) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showOtherCountries]);


    const [suggestionForm, setSuggestionForm] = useState({
        name: "",
        city: "",
        zipCode: "",
        street: "",
        number: "",
        phone: "",
        email: "",
        website: "",
        youtube: "",
        facebook: "",
        instagram: "",
        country: "Belgium",
        locationTitle: ""
    });
    const [suggestionStep, setSuggestionStep] = useState(1);
    const [submitterForm, setSubmitterForm] = useState({
        firstName: "",
        lastName: "",
        phone: "",
        email: "",
        notes: ""
    });

    const SUGGESTION_COUNTRIES = Object.keys(COUNTRY_FLAGS).sort();

    const openSuggestionModal = (type = "new", church = null) => {
        setSuggestionType(type);
        let data;
        if (type === "edit" && church) {
            data = {
                name: church.name || "",
                city: church.city || "",
                zipCode: church.zipCode || "",
                street: church.street || "",
                number: church.number || "",
                phone: church.phone || "",
                email: church.email || "",
                website: church.website || "",
                youtube: church.youtube || "",
                facebook: church.facebook || "",
                instagram: church.instagram || "",
                country: church.country || "Belgium",
                locationTitle: church.locationTitle || ""
            };
        } else {
            data = {
                name: "",
                city: "",
                zipCode: "",
                street: "",
                number: "",
                phone: "",
                email: "",
                website: "",
                youtube: "",
                facebook: "",
                instagram: "",
                country: activeCountryFilter || "Belgium",
                locationTitle: ""
            };
        }
        setSuggestionForm(data);
        setInitialFormValues(data);
        setSuggestionStep(1);
        // Try to load submitter info from localStorage
        let savedSubmitter = { firstName: "", lastName: "", phone: "", email: "", notes: "" };
        try {
            const saved = localStorage.getItem("bethel_submitter");
            if (saved) {
                const parsed = JSON.parse(saved);
                savedSubmitter = { 
                    firstName: parsed.firstName || "", 
                    lastName: parsed.lastName || "", 
                    phone: parsed.phone || "", 
                    email: parsed.email || "", 
                    notes: "" 
                };
            }
        } catch (e) {
            console.error("Failed to load saved submitter info:", e);
        }
        
        setSubmitterForm(savedSubmitter);
        setShowSuggestionModal(true);
        setSuggestionSuccess(false);
        setFormError("");
    };

    const hasChanges = useMemo(() => {
        if (!initialFormValues) return false;
        return JSON.stringify(suggestionForm) !== JSON.stringify(initialFormValues);
    }, [suggestionForm, initialFormValues]);

    const validateEmail = (email) => {
        return String(email)
            .toLowerCase()
            .match(
                /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
            );
    };

    const handleSuggestionSubmit = async (e) => {
        if (e) e.preventDefault();

        if (suggestionStep === 1) {
            if (!suggestionForm.name || !suggestionForm.city) {
                setFormError(t("errorNameCityRequired"));
                return;
            }
            if (suggestionType === "edit" && !hasChanges) {
                setFormError(t("errorNoChanges"));
                return;
            }
            if (suggestionForm.email && !validateEmail(suggestionForm.email)) {
                setFormError(t("errorInvalidEmail"));
                return;
            }
            setFormError("");
            setSuggestionStep(2);
            return;
        }

        if (submitterForm.email && !validateEmail(submitterForm.email)) {
            setFormError(t("errorInvalidEmail"));
            return;
        }

        setIsSubmitting(true);
        try {
            await addDoc(collection(db, "church_suggestions"), {
                type: suggestionType,
                originalChurchId: suggestionType === "edit" ? selectedChurch?.id : null,
                originalData: suggestionType === "edit" ? selectedChurch : null,
                status: "pending",
                data: {
                    ...suggestionForm,
                    submitter: submitterForm
                },
                createdAt: serverTimestamp()
            });
            
            // Save submitter info to localStorage for next time (excluding notes)
            try {
                localStorage.setItem("bethel_submitter", JSON.stringify({
                    firstName: submitterForm.firstName,
                    lastName: submitterForm.lastName,
                    phone: submitterForm.phone,
                    email: submitterForm.email
                }));
            } catch (e) {
                console.error("Failed to save submitter info:", e);
            }

            // Send real-time notification via ntfy.sh
            try {
                const topic = "bethel_churches_notifications_f93k2n8";
                const title = suggestionType === "new" ? t("suggestionNotificationNew") : t("suggestionNotificationEdit");
                const message = `${suggestionForm.name} - ${suggestionForm.city} (${getCountryLabel(suggestionForm.country)})`;
                
                // Use query params instead of headers to avoid CORS preflight issues in browsers
                const notifyUrl = `https://ntfy.sh/${topic}?title=${encodeURIComponent(title)}&priority=high&tags=church,pray`;
                
                fetch(notifyUrl, {
                    method: 'POST',
                    body: message
                }).catch(e => console.error("Notification error:", e));
            } catch (notifyErr) {
                console.error("Failed to send notification:", notifyErr);
            }

            setSuggestionSuccess(true);
            setTimeout(() => {
                setShowSuggestionModal(false);
                setSuggestionSuccess(false);
                setSuggestionStep(1);
            }, 3000);
        } catch (err) {
            console.error(err);
            setFormError(t("errorSending"));
        } finally {
            setIsSubmitting(false);
        }
    };



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

    // Track World Map visit landing
    useEffect(() => {
        trackWorldMapVisit("initial");
    }, []);

    // Auto-locate
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    setUserLocation({ lat, lng });
                    trackWorldMapVisit("granted", { lat, lng });
                },
                (err) => {
                    console.warn("Geolocation denied or unavailable.", err);
                    trackWorldMapVisit("denied");
                },
                { timeout: 5000 }
            );
        } else {
            trackWorldMapVisit("denied");
        }
    }, []);

    const handleRecenter = () => {
        if (userLocation) {
            setRecenterTrigger(prev => prev + 1);
        } else {
            // Re-request position if not available
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const lat = position.coords.latitude;
                        const lng = position.coords.longitude;
                        setUserLocation({ lat, lng });
                        setRecenterTrigger(prev => prev + 1);
                    },
                    null,
                    { timeout: 5000 }
                );
            }
        }
    };

    const selectChurch = useCallback((church) => {
        setSelectedChurch(church);
        setIsInitialLoad(false);
        setBottomSheetMode("collapsed"); // Set to collapsed (medium) mode instead of expanded
        const url = new URL(window.location.href);
        url.searchParams.set("church", church.id);
        window.history.replaceState({}, "", url.toString());
    }, []);

    const deselectChurch = useCallback(() => {
        if (isMobile && selectedChurch) {
            setIsExiting(true);
            // Wait for CSS animation (300ms)
            setTimeout(() => {
                setSelectedChurch(null);
                setIsExiting(false);
                setBottomSheetMode("collapsed");
                const url = new URL(window.location.href);
                url.searchParams.delete("church");
                window.history.replaceState({}, "", url.toString());
            }, 250);
        } else {
            setSelectedChurch(null);
            setBottomSheetMode("collapsed");
            const url = new URL(window.location.href);
            url.searchParams.delete("church");
            window.history.replaceState({}, "", url.toString());
        }
    }, [isMobile, selectedChurch]);

    const handleShare = useCallback(async (church) => {
        const url = `${window.location.origin}/romanian-pentecostal-churches-map?church=${church.id}`;
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
        // On mobile, if we're in the list, only drag if we're at the top
        const scrollableContent = e.target.closest('.churchList');
        if (scrollableContent && scrollableContent.scrollTop > 0) {
            return;
        }

        // Removed the button/input guard to allow dragging from everywhere

        touchStartY.current = e.touches[0].clientY;
        if (sheetRef.current) {
            startHeight.current = sheetRef.current.offsetHeight;
        }
        setIsDragging(true);
    };

    const handleTouchMove = (e) => {
        if (!isDragging || !startHeight.current) return;
        const currentY = e.touches[0].clientY;
        const deltaY = currentY - touchStartY.current;

        // Threshold check to avoid accidental micro-drags when wanting to tap
        if (Math.abs(deltaY) < 10) return;

        // If we are definitely dragging, blur any active element (closes keyboard)
        if (document.activeElement instanceof HTMLElement && 
           (e.target.closest('input') || e.target.closest('button'))) {
            document.activeElement.blur();
        }

        // Check for scrollable content conflict
        const scrollableContent = e.target.closest('.churchList');
        if (scrollableContent) {
            const isSwipingDown = deltaY > 0;
            const isSwipingUp = deltaY < 0;
            const atTop = scrollableContent.scrollTop <= 0;

            // If dragging up and sheet is already expanded, let content scroll
            if (isSwipingUp && bottomSheetMode === "expanded") {
                setIsDragging(false);
                return;
            }

            // If dragging down and content is not at top, let content scroll
            if (isSwipingDown && !atTop) {
                setIsDragging(false);
                return;
            }
        }

        // If we reach here, we are dragging the SHEET, so prevent scroll
        if (e.cancelable) e.preventDefault();

        // Calculate new height (dragging up reduces deltaY, so we subtract it)
        let newHeight = startHeight.current - deltaY;

        // Respect limits (min 48px, max height leaving room for header)
        const headerH = 110; // Safe approximation of mobileTopHeader content + padding
        const minH = 48;
        const maxH = window.innerHeight - headerH - 10;

        if (newHeight < minH) {
            newHeight = minH + (newHeight - minH) * 0.2; // Resistance
        } else if (newHeight > maxH) {
            newHeight = maxH + (newHeight - maxH) * 0.2; // Resistance
        }

        setDragHeight(newHeight);
    };

    const handleTouchEnd = (e) => {
        if (!isDragging) return;
        setIsDragging(false);

        if (dragHeight) {
            const vh = window.innerHeight / 100;
            const hInVh = dragHeight / vh;

            // Snap logic based on height
            if (hInVh < 25) {
                setBottomSheetMode("hidden");
            } else if (hInVh < 55) {
                setBottomSheetMode("collapsed");
            } else {
                setBottomSheetMode("expanded");
            }
        }

        setDragHeight(null);
        startHeight.current = null;
    };



    const getCountryLabel = useCallback((country) => {
        if (!country) return "";
        const key = `country_${country}`;
        const translated = t(key);
        // If translation is the same as key, it means it's missing, so fallback to original
        return translated === key ? country : translated;
    }, [t]);

    // Combined Country Data (Counts, Sorting, Pagination)
    const { 
        ALL_COUNTRIES, 
        countryCounts, 
        sortedCountries, 
        topCountries, 
        otherCountries 
    } = useMemo(() => {
        // 1. Get all unique countries
        const all = [...new Set(churches.map((c) => c.country))].sort((a, b) => {
            return getCountryLabel(a).localeCompare(getCountryLabel(b), lang);
        });

        // 2. Calculate counts (independent of selected country, dependent on search)
        let filteredForCounts = [...churches];
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            filteredForCounts = filteredForCounts.filter(
                (c) =>
                    c.name.toLowerCase().includes(q) ||
                    c.city.toLowerCase().includes(q) ||
                    c.country.toLowerCase().includes(q)
            );
        }

        const counts = { all: filteredForCounts.length };
        for (const c of filteredForCounts) {
            counts[c.country] = (counts[c.country] || 0) + 1;
        }

        // 3. Sort by church count for defaults
        const sorted = [...all].sort((a, b) => (counts[b] || 0) - (counts[a] || 0));

        // 4. Dynamic Elevation: If a selected country is in the "others" list, bring it to the front
        const defaultTop = sorted.slice(0, 2);
        const others = sorted.slice(2);

        let finalTop = [...defaultTop];
        let finalOthers = [...others];

        if (activeCountryFilter && others.includes(activeCountryFilter)) {
            finalTop = [...defaultTop, activeCountryFilter];
            finalOthers = others.filter(c => c !== activeCountryFilter);
        }

        return {
            ALL_COUNTRIES: all,
            countryCounts: counts,
            sortedCountries: sorted,
            topCountries: finalTop,
            otherCountries: finalOthers
        };
    }, [churches, getCountryLabel, lang, searchQuery, activeCountryFilter]);


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

    const getGoogleMapsSearchUrl = (church) => {
        const query = church.locationTitle
            ? encodeURIComponent(church.locationTitle)
            : encodeURIComponent(`${church.name} ${church.city}`);
        return `https://www.google.com/maps/search/?api=1&query=${query}`;
    };

    const activeFilterIcon = activeCountryFilter
        ? COUNTRY_FLAGS[activeCountryFilter] || "🌍"
        : "🌍";

    if (!API_KEY) {
        return (
            <div className="churchMapLayout">
                <div className="flex items-center justify-center h-screen bg-slate-900 text-white p-8">
                    <div className="max-w-md text-center">
                        <h2 className="text-2xl font-bold mb-4">Configurație incompletă</h2>
                        <p className="text-slate-400">Cheia API Google Maps nu este configurată sau lipsește din fișierul .env.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`churchMapLayout ${mobileShowMap ? "mapFocused" : ""} ${!isSidebarOpen ? "sidebar-closed" : ""}`}>

            {/* Mobile Top Header (Search, Filters, Settings) */}
            {/* Sidebar */}
            <aside className={`churchMapSidebar ${!isSidebarOpen ? "collapsed" : ""}`}>
                {!isMobile && (
                    <div className="sidebarHeader">
                        {isSidebarOpen ? (
                            <div className="sidebarHeaderOpen">
                                <div className="sidebarBrand">
                                    <img src="/icon.png" alt="Bethel Logo" className="sidebarLogo" />
                                    <span className="sidebarTitle">{t("title")}</span>
                                </div>
                                <button className="sidebarCloseBtn" onClick={() => setIsSidebarOpen(false)}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            </div>
                        ) : (
                            <div className="sidebarHeaderCollapsed">
                                <button className="sidebarHamburgerBtn" onClick={() => setIsSidebarOpen(true)}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="3" y1="12" x2="21" y2="12"></line>
                                        <line x1="3" y1="6" x2="21" y2="6"></line>
                                        <line x1="3" y1="18" x2="21" y2="18"></line>
                                    </svg>
                                </button>
                            </div>
                        )}
                    </div>
                )}
                <div
                    ref={sheetRef}
                    className={`churchMapBottomSheet ${isDragging ? 'is-dragging' : ''}`}
                    data-mode={bottomSheetMode}
                    style={isMobile ? {
                        "--dynamic-height": dragHeight ? `${dragHeight}px` : undefined,
                        transition: isDragging ? 'none' : undefined
                    } : {}}
                    onTouchStart={isMobile ? handleTouchStart : undefined}
                    onTouchMove={isMobile ? handleTouchMove : undefined}
                    onTouchEnd={isMobile ? handleTouchEnd : undefined}
                >

                    <div className="bottomSheetInner">
                        <div
                            className="bottomSheetDragHandleArea"
                            onClick={() => {
                                if (bottomSheetMode === "hidden") setBottomSheetMode("collapsed");
                                else if (bottomSheetMode === "collapsed") setBottomSheetMode("expanded");
                                else setBottomSheetMode("collapsed");
                            }}
                        >
                            <div className="bottomSheetDragHandle"></div>
                        </div>

                        {isMobile && !selectedChurch && (
                            <div className="mobileControlsInSheet">
                                <div className="mobileSearchBox">
                                    <input
                                        type="text"
                                        placeholder={t("searchPlaceholder")}
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onFocus={() => {
                                            setIsSearchFocused(true);
                                            if (isMobile) setBottomSheetMode("expanded");
                                        }}
                                        onBlur={() => {
                                            // Delay to allow clear button click
                                            setTimeout(() => setIsSearchFocused(false), 200);
                                            if (isMobile && !searchQuery.trim()) {
                                                setBottomSheetMode("collapsed");
                                            }
                                        }}
                                    />
                                    {(searchQuery || isSearchFocused) ? (
                                        <button 
                                            className="mobileSearchClear" 
                                            onClick={() => {
                                                setSearchQuery("");
                                                if (document.activeElement instanceof HTMLElement) {
                                                    document.activeElement.blur();
                                                }
                                            }}
                                        >
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                                <line x1="6" y1="6" x2="18" y2="18"></line>
                                            </svg>
                                        </button>
                                    ) : (
                                        <div className="mobileSearchIconWrapper">
                                            <svg className="mobileSearchIcon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="11" cy="11" r="8"></circle>
                                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                            </svg>
                                        </div>
                                    )}
                                </div>

                                <div className="mobileFilterAction" ref={filterRef}>
                                    <button
                                        className={`mobileHeaderFilterBtn ${activeCountryFilter ? "hasFilter" : ""}`}
                                        onClick={() => {
                                            const nextOpen = !filterOpen;
                                            setFilterOpen(nextOpen);
                                            if (nextOpen && bottomSheetMode === "hidden") {
                                                setBottomSheetMode("collapsed");
                                            }
                                        }}
                                    >
                                        <span className="mobileFlagIcon">{activeFilterIcon}</span>
                                        <span className="mobileFilterCount">({activeCountryFilter ? (countryCounts[activeCountryFilter] || 0) : (countryCounts.all || 0)})</span>
                                        <svg className={`mobileFilterChevron ${filterOpen ? "open" : ""}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="6 9 12 15 18 9"></polyline>
                                        </svg>
                                    </button>
                                    {filterOpen && (
                                        <div className="countryFilterMenu mobileVersion">
                                            <button
                                                className={`countryFilterOption ${!activeCountryFilter ? "active" : ""}`}
                                                onClick={() => {
                                                    setActiveCountryFilter("");
                                                    setFilterOpen(false);
                                                }}
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
                        )}

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
                                    {isMobile && (selectedChurch || isExiting) ? (
                                        <div className={`mobileChurchDetails ${isExiting ? "exiting" : ""}`}>
                                            <div className="mobileDetailsHeader">
                                                <h2 className="churchDetailsTitle">
                                                    {selectedChurch.name}{selectedChurch.city ? ` - ${selectedChurch.city}` : ''}
                                                </h2>
                                                <div className="mobileDetailsHeaderActions">
                                                    <button className="mobileDetailsBack" onClick={deselectChurch} aria-label="Close">
                                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                            <line x1="18" y1="6" x2="6" y2="18"></line>
                                                            <line x1="6" y1="6" x2="18" y2="18"></line>
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="mobileDetailsBody">
                                                <p className="churchDetailsAddress">
                                                    {`${selectedChurch.street || ""} ${selectedChurch.number || ""}`.trim()}, {selectedChurch.zipCode ? `${selectedChurch.zipCode} ` : ""}{selectedChurch.city}, {getCountryLabel(selectedChurch.country)}
                                                </p>

                                                <ChurchInfoLinks church={selectedChurch} t={t} />

                                            </div>
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
                                                                    <p>{`${church.street || ""} ${church.number || ""}`.trim()}, {church.zipCode ? `${church.zipCode} ` : ""}{church.city}, {getCountryLabel(church.country)}</p>
                                                                </div>
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
                                                </div>
                                            )}
                                        </>
                                    )}
                                </>
                            )}
                        </div>

                        {isMobile && selectedChurch && (
                            <div className="churchSidebarFooter">
                                <div className="mobileFooterActions">
                                    <button className="sidebarSuggestBtn editMode" onClick={() => openSuggestionModal("edit", selectedChurch)}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                            <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                        </svg>
                                        <span className="btnText">{t("editShort")}</span>
                                    </button>
                                    <a
                                        href={getGoogleMapsSearchUrl(selectedChurch)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="sidebarDirectionsBtn"
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
                                        </svg>
                                        <span className="btnText">{t("route")}</span>
                                    </a>
                                </div>
                            </div>
                        )}
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
                {/* Desktop Back Button (Floating on Map) */}

                {/* Map Overlay Title - SR Only for SEO */}
                {!isMobile && (
                    <div className="mapOverlayTitle sr-only">
                        <div className="mapOverlayTitleContent">
                            <h1 className="mapOverlayHeading">{t("subtitle")}</h1>
                        </div>
                    </div>
                )}

                {/* Desktop Floating Search and Country Filter */}
                {!isMobile && (
                    <div className="desktopMapControls">
                        <div className="churchMapSearch floating google-style">
                            <input
                                type="text"
                                placeholder={t("searchPlaceholder")}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onFocus={() => setIsSearchFocused(true)}
                                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                            />
                            <div className="searchActions">
                                {(searchQuery || isSearchFocused) ? (
                                    <button 
                                        className="searchClearBtn" 
                                        onClick={() => {
                                            setSearchQuery("");
                                            if (document.activeElement instanceof HTMLElement) {
                                                document.activeElement.blur();
                                            }
                                        }}
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="18" y1="6" x2="6" y2="18"></line>
                                            <line x1="6" y1="6" x2="18" y2="18"></line>
                                        </svg>
                                    </button>
                                ) : (
                                    <button className="searchMainBtn">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="11" cy="11" r="8"></circle>
                                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="countryPillContainer">
                            <button
                                className={`countryPill ${!activeCountryFilter ? "active" : ""}`}
                                onClick={() => setActiveCountryFilter("")}
                            >
                                🌍 <span className="pillLabel">{t("allCountries")}</span>
                                <span className="pillCount">{countryCounts.all || 0}</span>
                            </button>
                            {topCountries.map((country) => (
                                <button
                                    key={country}
                                    className={`countryPill ${activeCountryFilter === country ? "active" : ""}`}
                                    onClick={() => {
                                        if (activeCountryFilter === country) {
                                            setActiveCountryFilter("");
                                        } else {
                                            setActiveCountryFilter(country);
                                        }
                                    }}
                                >
                                    {COUNTRY_FLAGS[country] || "🌍"} <span className="pillLabel">{getCountryLabel(country)}</span>
                                    {countryCounts[country] > 0 && <span className="pillCount">{countryCounts[country]}</span>}
                                </button>
                            ))}
                            {otherCountries.length > 0 && (
                                <div className="otherCountriesWrapper" ref={otherCountriesRef}>
                                    <button 
                                        className={`countryPill otherBtn ${showOtherCountries ? "active" : ""} ${otherCountries.includes(activeCountryFilter) ? "selected" : ""}`}
                                        onClick={() => setShowOtherCountries(!showOtherCountries)}
                                    >
                                        <span className="pillLabel">{t("othersFilter") || "Autres (+)"}</span>
                                        {otherCountries.includes(activeCountryFilter) && (
                                            <span className="pillCount">{countryCounts[activeCountryFilter]}</span>
                                        )}
                                    </button>
                                    {showOtherCountries && (
                                        <div className="otherCountriesDropdown">
                                            {otherCountries.map((country) => (
                                                <button
                                                    key={country}
                                                    className={`dropdownItem ${activeCountryFilter === country ? "active" : ""}`}
                                                    onClick={() => {
                                                        setActiveCountryFilter(country);
                                                        setShowOtherCountries(false);
                                                    }}
                                                >
                                                    <span className="dropdownFlag">{COUNTRY_FLAGS[country] || "🌍"}</span>
                                                    <span className="dropdownLabel">{getCountryLabel(country)}</span>
                                                    <span className="dropdownCount">{countryCounts[country] || 0}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}


                <APIProvider apiKey={API_KEY}>
                    <Map
                        defaultCenter={BELGIUM_CENTER}
                        defaultZoom={8}
                        mapId={MAP_ID}
                        disableDefaultUI={true}
                        gestureHandling={"greedy"}
                    >
                        {/* Suggest New Church Button (Top Right) */}
                        <button
                            className="mapSuggestBtn"
                            onClick={() => openSuggestionModal("new")}
                            aria-label={t("suggestChurchLabel")}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                            <span>{t("newChurch")}</span>
                        </button>
                        <Markers
                            churches={filteredChurches}
                            onMarkerClick={selectChurch}
                            selectedChurchId={selectedChurch?.id}
                            setHoveredMarker={setHoveredMarker}
                            t={t}
                        />

                        {userLocation && (
                            <AdvancedMarker position={userLocation} zIndex={1001} title={t("youAreHere")}>
                                <div className="userLocationDot"></div>
                            </AdvancedMarker>
                        )}

                        <MapController
                            selectedChurch={selectedChurch}
                            requestedLocation={userLocation}
                            isInitialLoad={isInitialLoad}
                            recenterTrigger={recenterTrigger}
                        />
                        <FilterController
                            filteredChurches={filteredChurches}
                            activeCountryFilter={activeCountryFilter}
                            isMobile={isMobile}
                        />
                    </Map>

                    {/* Church Details Card (Desktop Only) */}
                    {selectedChurch && !isMobile && (
                        <div className="churchDetailsCard">
                            <div className="churchDetailsHeader">
                                <h2 className="churchDetailsTitle">
                                    {selectedChurch.name}{selectedChurch.city ? ` - ${selectedChurch.city}` : ''}
                                </h2>
                                <div className="churchDetailsHeaderActions">
                                    <button className="churchDetailsClose" onClick={deselectChurch} aria-label="Close">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="18" y1="6" x2="6" y2="18"></line>
                                            <line x1="6" y1="6" x2="18" y2="18"></line>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            <div className="churchDetailsContent">
                                <p className="churchDetailsAddress">
                                    {`${selectedChurch.street || ""} ${selectedChurch.number || ""}`.trim()}, {selectedChurch.zipCode ? `${selectedChurch.zipCode} ` : ""}{selectedChurch.city}, {getCountryLabel(selectedChurch.country)}
                                </p>
                                <ChurchInfoLinks church={selectedChurch} t={t} />

                                <div className="churchDetailsActions">
                                    <button
                                        className="sidebarSuggestBtn editMode"
                                        onClick={() => openSuggestionModal("edit", selectedChurch)}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                            <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                        </svg>
                                        <span className="btnText">{t("editShort")}</span>
                                    </button>
                                    <a
                                        href={getGoogleMapsSearchUrl(selectedChurch)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="sidebarDirectionsBtn"
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
                                        </svg>
                                        <span className="btnText">{t("route")}</span>
                                    </a>
                                </div>

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
                                    {/* Visual Stepper */}
                                    <div className="suggestionStepper">
                                        <div className={`stepItem ${suggestionStep >= 1 ? 'active' : ''} ${suggestionStep > 1 ? 'completed' : ''}`}>
                                            <div className="stepCircle">{suggestionStep > 1 ? '✓' : '1'}</div>
                                            <span>{t("churchInfo")}</span>
                                        </div>
                                        <div className="stepLine"></div>
                                        <div className={`stepItem ${suggestionStep >= 2 ? 'active' : ''}`}>
                                            <div className="stepCircle">2</div>
                                            <span>{t("yourInfo")}</span>
                                        </div>
                                    </div>

                                    {suggestionStep === 1 ? (
                                        <div className="suggestionStep1">
                                            <div className="suggestionFormRow">
                                                <div className="suggestionFormGroup">
                                                    <label>{t("name")} *</label>
                                                    <input
                                                        type="text"
                                                        required
                                                        placeholder={t("churchNamePlaceholder")}
                                                        value={suggestionForm.name}
                                                        onChange={(e) => setSuggestionForm({ ...suggestionForm, name: e.target.value })}
                                                    />
                                                </div>
                                                <div className="suggestionFormGroup">
                                                    <label>{t("city")} *</label>
                                                    <input
                                                        type="text"
                                                        required
                                                        value={suggestionForm.city}
                                                        onChange={(e) => setSuggestionForm({ ...suggestionForm, city: e.target.value })}
                                                    />
                                                </div>
                                            </div>

                                            <div className="suggestionFormRow">
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
                                                <div className="suggestionFormGroup">
                                                    <label>{t("postalCode")}</label>
                                                    <input
                                                        type="text"
                                                        value={suggestionForm.zipCode}
                                                        onChange={(e) => setSuggestionForm({ ...suggestionForm, zipCode: e.target.value })}
                                                    />
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
                                                        onChange={(e) => setSuggestionForm({ ...suggestionForm, phone: e.target.value.replace(/[^\d+\s\-\(\)]/g, "") })}
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
                                                        placeholder="instagram.com/..."
                                                        value={suggestionForm.instagram}
                                                        onChange={(e) => setSuggestionForm({ ...suggestionForm, instagram: e.target.value })}
                                                    />
                                                </div>
                                                <div className="suggestionFormGroup">
                                                    <label>{t("facebook")}</label>
                                                    <input
                                                        type="url"
                                                        placeholder="facebook.com/..."
                                                        value={suggestionForm.facebook}
                                                        onChange={(e) => setSuggestionForm({ ...suggestionForm, facebook: e.target.value })}
                                                    />
                                                </div>
                                            </div>

                                        </div>
                                    ) : (
                                        <div className="suggestionStep2">
                                            <div className="step2Header">
                                                <h4>{t("submitterTitle")}</h4>
                                            </div>

                                            <div className="suggestionFormRow">
                                                <div className="suggestionFormGroup">
                                                    <label>{t("lastName")}</label>
                                                    <input
                                                        type="text"
                                                        value={submitterForm.lastName}
                                                        onChange={(e) => setSubmitterForm({ ...submitterForm, lastName: e.target.value })}
                                                    />
                                                </div>
                                                <div className="suggestionFormGroup">
                                                    <label>{t("firstName")}</label>
                                                    <input
                                                        type="text"
                                                        value={submitterForm.firstName}
                                                        onChange={(e) => setSubmitterForm({ ...submitterForm, firstName: e.target.value })}
                                                    />
                                                </div>
                                            </div>

                                            <div className="suggestionFormRow">
                                                <div className="suggestionFormGroup">
                                                    <label>{t("phone")}</label>
                                                    <input
                                                        type="tel"
                                                        value={submitterForm.phone}
                                                        onChange={(e) => setSubmitterForm({ ...submitterForm, phone: e.target.value.replace(/[^\d+\s\-\(\)]/g, "") })}
                                                    />
                                                </div>
                                                <div className="suggestionFormGroup">
                                                    <label>{t("email")}</label>
                                                    <input
                                                        type="email"
                                                        value={submitterForm.email}
                                                        onChange={(e) => setSubmitterForm({ ...submitterForm, email: e.target.value })}
                                                    />
                                                </div>
                                            </div>

                                            <div className="suggestionFormRow">
                                                <div className="suggestionFormGroup" style={{ flex: 1 }}>
                                                    <label>{t("notes")}</label>
                                                    <textarea
                                                        value={submitterForm.notes}
                                                        placeholder={t("notesPlaceholder")}
                                                        onChange={(e) => setSubmitterForm({ ...submitterForm, notes: e.target.value })}
                                                        rows={3}
                                                        className="compactTextarea"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="suggestionFormActions">
                                    {suggestionStep === 1 ? (
                                        <button
                                            type="submit"
                                            className="suggestionSubmitBtn"
                                            disabled={isSubmitting || (suggestionType === "edit" && !hasChanges)}
                                        >
                                            {isSubmitting ? "..." : t("nextStep")}
                                        </button>
                                    ) : (
                                        <div className="step2Actions">
                                            <button
                                                type="button"
                                                className="suggestionSkipBtn"
                                                onClick={() => setSuggestionStep(1)}
                                            >
                                                {t("back")}
                                            </button>
                                            <button
                                                type="submit"
                                                className="suggestionSubmitBtn"
                                                disabled={isSubmitting}
                                            >
                                                {isSubmitting ? "..." : t("skipAndSend")}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function ChurchMapWithParams() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ChurchMap />
        </Suspense>
    );
}
