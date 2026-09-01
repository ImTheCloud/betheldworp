"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef, Suspense } from "react";
import { APIProvider, Map, AdvancedMarker, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { useSearchParams } from "next/navigation";
import { collection, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/Firebase";
import { isValidEmail } from "../../lib/validation";
import { trackWorldMapVisit } from "@/app/lib/Tracker";
import { useLang } from "../../components/LanguageProvider";
import { makeT } from "../../lib/i18n";
import worldMapTranslations from "../../translations/WorldMap.json";
import SearchableSelect from "../../components/SearchableSelect";
import "./WorldMap.css";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const MAP_ID = "5b50d76db2afedb8ba67cff4";
const BELGIUM_CENTER = { lat: 50.77198, lng: 4.30396 }; // Coordinates roughly near Brussels/Halle
const MAP_SELECTED_CHURCH_STORAGE_KEY = "bethel_worldmap_selected_church";

// Une proposition contient le prénom, le nom, le téléphone et l'e-mail de la
// personne qui l'envoie. Ces coordonnées ne servent qu'à vérifier l'église
// proposée : passé un an, elles n'ont plus d'objet.
//
// ATTENTION — cette date ne supprime rien aujourd'hui. Firestore n'efface un
// document daté que si une règle TTL a été créée sur la collection, depuis la
// console Firebase, et elle ne l'a PAS été pour church_suggestions (choix
// assumé du 31/08/2026). Les propositions se suppriment donc à la main, avec
// le bouton Delete de l'onglet Suggestions.
//
// Le champ est écrit quand même : le jour où la règle TTL sera activée, tout
// ce qui aura été enregistré depuis s'effacera sans autre intervention. Si
// cette durée change, la politique de confidentialité doit suivre — elle
// n'annonce actuellement aucun délai pour les propositions.
const SUGGESTION_RETENTION_DAYS = 365;

const COUNTRY_CODES = {
    Afghanistan: "af", Albania: "al", Algeria: "dz", Andorra: "ad", Angola: "ao", "Antigua and Barbuda": "ag", Argentina: "ar", Armenia: "am", Australia: "au", Austria: "at", Azerbaijan: "az",
    Bahamas: "bs", Bahrain: "bh", Bangladesh: "bd", Barbados: "bb", Belarus: "by", Belgium: "be", Belize: "bz", Benin: "bj", Bhutan: "bt", Bolivia: "bo", "Bosnia and Herzegovina": "ba", Botswana: "bw", Brazil: "br", Brunei: "bn", Bulgaria: "bg", "Burkina Faso": "bf", Burundi: "bi",
    "Cabo Verde": "cv", Cambodia: "kh", Cameroon: "cm", Canada: "ca", "Central African Republic": "cf", Chad: "td", Chile: "cl", China: "cn", Colombia: "co", Comoros: "km", "Congo (Congo-Brazzaville)": "cg", "Costa Rica": "cr", Croatia: "hr", Cuba: "cu", Cyprus: "cy", "Czech Republic": "cz",
    "Democratic Republic of the Congo": "cd", Denmark: "dk", Djibouti: "dj", Dominica: "dm", "Dominican Republic": "do", Ecuador: "ec", Egypt: "eg", "El Salvador": "sv", "Equatorial Guinea": "gq", Eritrea: "er", Estonia: "ee", Eswatini: "sz", Ethiopia: "et",
    Fiji: "fj", Finland: "fi", France: "fr", Gabon: "ga", Gambia: "gm", Georgia: "ge", Germany: "de", Ghana: "gh", Greece: "gr", Grenada: "gd", Guatemala: "gt", Guinea: "gn", "Guinea-Bissau": "gw", Guyana: "gy",
    Haiti: "ht", "Holy See": "va", Honduras: "hn", Hungary: "hu", Iceland: "is", India: "in", Indonesia: "id", Iran: "ir", Iraq: "iq", Ireland: "ie", Israel: "il", Italy: "it", "Ivory Coast": "ci",
    Jamaica: "jm", Japan: "jp", Jordan: "jo", Kazakhstan: "kz", Kenya: "ke", Kiribati: "ki", Kuwait: "kw", Kyrgyzstan: "kg", Laos: "la", Latvia: "lv", Lebanon: "lb", Lesotho: "ls", Liberia: "lr", Libya: "ly", Liechtenstein: "li", Lithuania: "lt", Luxembourg: "lu",
    Madagascar: "mg", Malawi: "mw", Malaysia: "my", Maldives: "mv", Mali: "ml", Malta: "mt", "Marshall Islands": "mh", Mauritania: "mr", Mauritius: "mu", Mexico: "mx", Micronesia: "fm", Moldova: "md", Monaco: "mc", Mongolia: "mn", Montenegro: "me", Morocco: "ma", Mozambique: "mz", Myanmar: "mm",
    Namibia: "na", Nauru: "nr", Nepal: "np", Netherlands: "nl", "New Zealand": "nz", Nicaragua: "ni", Niger: "ne", Nigeria: "ng", "North Korea": "kp", "North Macedonia": "mk", Norway: "no",
    Oman: "om", Pakistan: "pk", Palau: "pw", "Palestine State": "ps", Panama: "pa", "Papua New Guinea": "pg", Paraguay: "py", Peru: "pe", Philippines: "ph", Poland: "pl", Portugal: "pt",
    Qatar: "qa", Romania: "ro", Russia: "ru", Rwanda: "rw", "Saint Kitts and Nevis": "kn", "Saint Lucia": "lc", "Saint Vincent and the Grenadines": "vc", Samoa: "ws", "San Marino": "sm", "Sao Tome and Principe": "st", "Saudi Arabia": "sa", Senegal: "sn", Serbia: "rs", Seychelles: "sc", "Sierra Leone": "sl", Singapore: "sg", Slovakia: "sk", Slovenia: "si", "Solomon Islands": "sb", Somalia: "so", "South Africa": "za", "South Korea": "kr", "South Sudan": "ss", Spain: "es", "Sri Lanka": "lk", Sudan: "sd", Suriname: "sr", Sweden: "se", Switzerland: "ch", Syria: "sy",
    Taiwan: "tw", Tajikistan: "tj", Tanzania: "tz", Thailand: "th", "Timor-Leste": "tl", Togo: "tg", Tonga: "to", "Trinidad and Tobago": "tt", Tunisia: "tn", Turkey: "tr", Turkmenistan: "tm", Tuvalu: "tv",
    Uganda: "ug", Ukraine: "ua", "United Arab Emirates": "ae", "United Kingdom": "gb", "United States": "us", Uruguay: "uy", Uzbekistan: "uz", Vanuatu: "vu", Venezuela: "ve", Vietnam: "vn", Yemen: "ye", Zambia: "zm", Zimbabwe: "zw",
    USA: "us" // Legacy support
};

/**
 * Ensures a link is treated as an external URL by prepending https:// if no protocol is present.
 */
const ensureExternalLink = (url) => {
    if (!url) return "";
    const trimmed = String(url).trim();
    if (!trimmed) return "";
    if (/^(https?:\/\/|mailto:|tel:)/i.test(trimmed)) {
        return trimmed;
    }
    return `https://${trimmed}`;
};

/**
 * Normalizes text for search by removing accents and converting to lowercase.
 */
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
const formatCasing = (s) => {
    if (!s) return "";
    const str = String(s).trim();
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

const FlagImage = React.memo(({ country, className = "" }) => {
    const code = COUNTRY_CODES[country];
    if (!code) return (
        <span 
            className={className} 
            style={{ 
                width: '18px', 
                height: '18px', 
                display: 'inline-flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                fontSize: '1rem',
                lineHeight: 1
            }}
        >
            🌍
        </span>
    );
    return (
        <img 
            src={`/images/flags/${code}.png`}
            // Un pays ajouté sans drapeau local ne doit pas laisser d'image cassée.
            onError={(e) => { e.currentTarget.style.display = "none"; }}
            alt={country} 
            className={`flag-img ${className}`}
            style={{ 
                width: '18px', 
                height: 'auto', 
                display: 'inline-block', 
                verticalAlign: 'middle', 
                borderRadius: '2px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
            }}
        />
    );
});
FlagImage.displayName = "FlagImage";

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

// ─── Smooth Animation Utilities ────────────────────────────────────────────

// Global AbortController for map animations — shared across all navigation sources
let _mapAnimationAbort = null;

function cancelMapAnimation() {
    if (_mapAnimationAbort) {
        _mapAnimationAbort.abort();
        _mapAnimationAbort = null;
    }
}

function newMapAnimationSignal() {
    cancelMapAnimation();
    _mapAnimationAbort = new AbortController();
    return _mapAnimationAbort.signal;
}

/**
 * Normalize any center value to a plain {lat, lng} object.
 * Handles google.maps.LatLng (methods), plain objects, or mixed.
 */
function toLatLng(center) {
    return {
        lat: (typeof center.lat === 'function') ? center.lat() : center.lat,
        lng: (typeof center.lng === 'function') ? center.lng() : center.lng,
    };
}

/**
 * Smoothly animate the map center and zoom level using requestAnimationFrame.
 * Uses map.moveCamera() for atomic center+zoom updates per frame, preventing
 * Google Maps from batching or overriding separate setCenter/setZoom calls.
 */
function animateMap(map, fromCenter, toCenter, fromZoom, toZoom, durationMs, abortSignal) {
    return new Promise((resolve) => {
        if (abortSignal?.aborted) { resolve(); return; }

        const start = toLatLng(fromCenter);
        const end = toLatLng(toCenter);

        if (isNaN(start.lat) || isNaN(end.lat) || isNaN(start.lng) || isNaN(end.lng)) {
            map.moveCamera({ center: end, zoom: toZoom });
            resolve();
            return;
        }

        // Ensure minimum duration so animation is always perceptible
        const duration = Math.max(durationMs, 300);
        const startTime = performance.now();

        function step(now) {
            if (abortSignal?.aborted) { resolve(); return; }
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease-in-out Sine — smooth velocity curve (peak 1.57× avg)
            const eased = -(Math.cos(Math.PI * progress) - 1) / 2;

            const lat = start.lat + (end.lat - start.lat) * eased;
            const lng = start.lng + (end.lng - start.lng) * eased;
            const zoom = fromZoom + (toZoom - fromZoom) * eased;

            // Atomic update — prevents GM internal batching issues
            map.moveCamera({ center: { lat, lng }, zoom });

            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                map.moveCamera({ center: end, zoom: toZoom });
                resolve();
            }
        }
        requestAnimationFrame(step);
    });
}

/**
 * Smoothly fly the map to a target position with a Mapbox-style arc effect.
 *
 * Strategy based on distance:
 *   - Short (< 50 km) or noZoomOut: direct pan+zoom in one phase.
 *   - Long (≥ 50 km): 3-phase arc animation:
 *       Phase 1 — Zoom out to an overview level (20% of total duration)
 *       Phase 2 — Pan across the map at overview zoom (50% of total duration)
 *       Phase 3 — Zoom in to target (30% of total duration)
 */
function smoothFlyTo(map, target, targetZoom, options = {}) {
    const { abortSignal, instant } = options;

    // Instant jump (e.g. initial page load)
    if (instant) {
        map.moveCamera({ center: target, zoom: targetZoom });
        return Promise.resolve();
    }

    return new Promise((resolve) => {
        if (abortSignal?.aborted) { resolve(); return; }

        const currentCenter = map.getCenter();
        if (!currentCenter) {
            map.moveCamera({ center: target, zoom: targetZoom });
            resolve();
            return;
        }

        const currentZoom = map.getZoom() || 4;
        const targetLat = (typeof target.lat === 'function') ? target.lat() : target.lat;
        const targetLng = (typeof target.lng === 'function') ? target.lng() : target.lng;
        const targetCoords = { lat: targetLat, lng: targetLng };

        const distance = haversineDistance(
            currentCenter.lat(), currentCenter.lng(),
            targetLat, targetLng
        );

        // Dynamic total duration: 800ms base + 1.5ms/km, clamped [800, 3500]
        const totalDuration = Math.max(800, Math.min(800 + distance * 1.5, 3500));

        if (options.noZoomOut || distance < 50) {
            // ── Short distance or explicit no-zoom-out: direct fly ──
            animateMap(map, currentCenter, targetCoords, currentZoom, targetZoom, totalDuration, abortSignal)
                .then(resolve);
        } else {
            // ── Long distance: 3-phase arc animation ──
            // Calculate overview zoom: go low enough to see both endpoints
            // The further the distance, the lower we zoom out
            const zoomDelta = Math.min(Math.ceil(distance / 200), 5); // 1–5 levels out
            const midZoom = Math.max(Math.min(currentZoom, targetZoom) - zoomDelta, 3);

            // Phase durations
            const phase1 = totalDuration * 0.20; // zoom out
            const phase2 = totalDuration * 0.50; // pan
            const phase3 = totalDuration * 0.30; // zoom in

            const startCoords = toLatLng(currentCenter);

            // Phase 1: Zoom out (stay at current center)
            animateMap(map, startCoords, startCoords, currentZoom, midZoom, phase1, abortSignal)
                .then(() => {
                    if (abortSignal?.aborted) { resolve(); return; }
                    // Phase 2: Pan to target at overview zoom
                    const midCenter = toLatLng(map.getCenter());
                    return animateMap(map, midCenter, targetCoords, midZoom, midZoom, phase2, abortSignal);
                })
                .then(() => {
                    if (abortSignal?.aborted) { resolve(); return; }
                    // Phase 3: Zoom in to final level
                    return animateMap(map, targetCoords, targetCoords, midZoom, targetZoom, phase3, abortSignal);
                })
                .then(resolve);
        }
    });
}

// ─── End Smooth Animation Utilities ────────────────────────────────────────

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
                    <a href={ensureExternalLink(church.website)} target="_blank" rel="noopener noreferrer">
                        {t("website")}
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
                    <a href={ensureExternalLink(church.youtube)} target="_blank" rel="noopener noreferrer">
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
                    <a href={ensureExternalLink(church.facebook)} target="_blank" rel="noopener noreferrer">
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
                    <a href={ensureExternalLink(church.instagram)} target="_blank" rel="noopener noreferrer">
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
    const hasAnimatedRef = useRef(false);
    const prevTriggerRef = useRef(recenterTrigger);
    const pendingRecenterRef = useRef(false);

    useEffect(() => {
        if (!map) return;

        // Detect if recenter was explicitly triggered via button click
        const triggerChanged = recenterTrigger > prevTriggerRef.current;
        prevTriggerRef.current = recenterTrigger;

        if (triggerChanged) {
            pendingRecenterRef.current = true;
        }

        let target = null;
        let targetZoom = 12;
        let shouldAnimate = false;

        // Priority 1: Explicit manual recenter (button click or pending location for a previous click)
        if (pendingRecenterRef.current && requestedLocation) {
            target = { lat: requestedLocation.lat, lng: requestedLocation.lng };
            targetZoom = 13;
            shouldAnimate = true;
            pendingRecenterRef.current = false; // Successfully handled
        } 
        // Priority 2: A church is selected
        else if (selectedChurch) {
            target = { lat: selectedChurch.lat, lng: selectedChurch.lng };
            targetZoom = 14;
            shouldAnimate = hasAnimatedRef.current;
            pendingRecenterRef.current = false; // Selecting a church cancels a pending recenter
        } 
        // Priority 3: Initial auto-recenter or passive location updates
        else if (requestedLocation && (isInitialLoad || recenterTrigger > 0)) {
            target = { lat: requestedLocation.lat, lng: requestedLocation.lng };
            targetZoom = 13;
            shouldAnimate = hasAnimatedRef.current;
        } 
        // Priority 4: Default view
        else if (!requestedLocation && !selectedChurch && isInitialLoad) {
            target = BELGIUM_CENTER;
            targetZoom = 7;
        }

        if (target) {
            if (map.setTilt) map.setTilt(0);

            if (shouldAnimate) {
                const signal = newMapAnimationSignal();
                smoothFlyTo(map, target, targetZoom, { abortSignal: signal });
            } else {
                map.moveCamera({ center: target, zoom: targetZoom });
            }
            hasAnimatedRef.current = true;
        }

        return () => { };
    }, [map, selectedChurch, requestedLocation, isInitialLoad, recenterTrigger]);

    return null;
}

function FilterController({ filteredChurches, activeCountryFilter, isMobile, filterRecenterTrigger, recenterTrigger }) {
    const map = useMap();
    const prevFilterRef = useRef("");
    const prevRecenterTriggerRef = useRef(recenterTrigger);
    const initialRunRef = useRef(true);

    useEffect(() => {
        if (!map) return;
        
        const filterChanged = prevFilterRef.current !== activeCountryFilter;
        prevFilterRef.current = activeCountryFilter;

        // Detect if recenter was explicitly triggered via button click
        const recenterTriggered = recenterTrigger > prevRecenterTriggerRef.current;
        prevRecenterTriggerRef.current = recenterTrigger;

        // If a manual recenter (to user location) was just triggered, 
        // we skip the filter-based camera update to avoid conflicting animations.
        if (recenterTriggered) {
            initialRunRef.current = false;
            return;
        }

        // Cancel any in-flight church animation when switching filters
        cancelMapAnimation();

        if (!activeCountryFilter) {
            // Reset to wide view of Europe ONLY if the user explicitly changed the filter
            // or clicked the filter button. Avoid overriding userLocation on initial background load.
            if (filterChanged || filterRecenterTrigger > 0 || (initialRunRef.current && filterRecenterTrigger === 0 && !window.location.search.includes('church='))) {
                if (!initialRunRef.current) {
                    map.panTo({ lat: 48.0, lng: 15.0 });
                    map.setZoom(4);
                }
            }
            initialRunRef.current = false;
            return;
        }
        
        initialRunRef.current = false;

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
            map.setZoom(10);
            return;
        }

        // Fit bounds to all filtered churches
        const bounds = new google.maps.LatLngBounds();
        filteredChurches.forEach((c) => bounds.extend({ lat: c.lat, lng: c.lng }));
        
        const padding = isMobile ? 40 : 100;
        map.fitBounds(bounds, { top: padding, right: padding, bottom: padding, left: padding });

        // Cap the zoom after fitting bounds
        const zoomListener = map.addListener("zoom_changed", () => {
            if (map.getZoom() > 10) {
                map.setZoom(10);
            }
        });

        // Remove listener once map reaches final position
        google.maps.event.addListenerOnce(map, "idle", () => {
            google.maps.event.removeListener(zoomListener);
        });
    }, [map, filteredChurches, activeCountryFilter, filterRecenterTrigger]);

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
                // Instead of unpredictable fitBounds, we directly zoom in by 3 to break the cluster
                const signal = newMapAnimationSignal();
                const currentZoom = map.getZoom() || 4;
                const targetZoom = Math.min(currentZoom + 3, 16);
                
                smoothFlyTo(map, cluster.position, targetZoom, { abortSignal: signal, noZoomOut: true });
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
            tooltip.textContent = `${church.name}${church.city ? ` ${church.city}` : ''}`;
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
            if (marker.position.lat !== church.lat || marker.position.lng !== church.lng) {
                marker.position = { lat: church.lat, lng: church.lng };
            }
            updateMarkerContent(marker, church, isSelected, isHovered);
        });

        if (newMarkers.length > 0) {
            clusterer.current.addMarkers(newMarkers);
        }

    }, [map, markerLibrary, churches, onMarkerClick, setHoveredMarker, selectedChurchId, hoveredMarkerId]);

    return null;
};

const ChurchListItem = React.memo(({ church, isSelected, selectChurch, isMobile, bottomSheetMode, setBottomSheetMode, userLocation, distanceMap, getCountryLabel, formatDistance, idx }) => (
    <button
        key={idx}
        className={`churchListItem ${isSelected ? "active" : ""}`}
        onClick={() => {
            selectChurch(church);
            if (isMobile && bottomSheetMode === "expanded") {
                setBottomSheetMode("collapsed");
            }
        }}
    >
        <div className="churchListItemIcon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
            </svg>
        </div>
        <div className="churchListItemContent">
            <div className="churchListItemMain">
                <h3>{formatCasing(church.name)}{church.city ? ` ${formatCasing(church.city)}` : ''}</h3>
                {userLocation && distanceMap[church.id] && (
                    <span className="churchDistanceBadge">
                        {formatDistance(distanceMap[church.id])}
                    </span>
                )}
            </div>
            <p>{[(`${formatCasing(church.street) || ""} ${church.number || ""}`.trim()), (`${church.zipCode ? `${church.zipCode} ` : ""}${formatCasing(church.city) || ""}`.trim()), formatCasing(getCountryLabel(church.country))].filter(Boolean).join(", ")}</p>
        </div>
    </button>
));
ChurchListItem.displayName = "ChurchListItem";

const ChurchList = React.memo(({ 
    groupedChurches, 
    selectedChurch, 
    isExiting, 
    isMobile, 
    selectChurch, 
    bottomSheetMode, 
    setBottomSheetMode, 
    userLocation, 
    distanceMap, 
    getCountryLabel, 
    formatDistance, 
    t, 
    filteredChurches 
}) => {
    if (isMobile && (selectedChurch || isExiting)) {
        return (
            <div className={`mobileChurchDetails ${isExiting ? "exiting" : ""}`}>
                <div className="mobileDetailsBody">
                    <ChurchInfoLinks church={selectedChurch} t={t} />
                </div>
            </div>
        );
    }

    return (
        <>
            {Object.entries(groupedChurches).map(([country, items]) => (
                <div key={country} className="churchCountryGroup">
                    <h2 className="churchCountryHeader">
                        <FlagImage country={country} className="countryFlag" />
                        {formatCasing(t(`country_${country}`) === `country_${country}` ? country : t(`country_${country}`))}
                        <span className="countryCount">{items.length}</span>
                    </h2>
                    {items.map((church, idx) => (
                        <ChurchListItem 
                            key={church.id || idx}
                            church={church}
                            isSelected={selectedChurch?.id === church.id}
                            selectChurch={selectChurch}
                            isMobile={isMobile}
                            bottomSheetMode={bottomSheetMode}
                            setBottomSheetMode={setBottomSheetMode}
                            userLocation={userLocation}
                            distanceMap={distanceMap}
                            getCountryLabel={getCountryLabel}
                            formatDistance={formatDistance}
                            idx={idx}
                        />
                    ))}
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
    );
});
ChurchList.displayName = "ChurchList";

function ChurchMap() {
    const searchParams = useSearchParams();
    
    const [isMobile, setIsMobile] = useState(null);

    // ─── Suggestion Form Persistence (CONSOLIDATED AT TOP) ─────────────────
    const SUGGESTION_DRAFT_KEY = "bethel_suggestion_draft";
    const getInitialSuggestionState = () => {
        if (typeof window === 'undefined') return null;
        try {
            const saved = localStorage.getItem(SUGGESTION_DRAFT_KEY);
            return saved ? JSON.parse(saved) : null;
        } catch (e) {
            console.error("Failed to parse suggestion draft:", e);
            return null;
        }
    };
    const initialDraft = getInitialSuggestionState();

    const [showSuggestionModal, setShowSuggestionModal] = useState(!!initialDraft?.showSuggestionModal);
    const [duplicateChurchModal, setDuplicateChurchModal] = useState({ isOpen: false, church: null });
    const [suggestionType, setSuggestionType] = useState(initialDraft?.suggestionType || "new");
    const [suggestionForm, setSuggestionForm] = useState(initialDraft?.suggestionForm || {
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
    const [suggestionStep, setSuggestionStep] = useState(initialDraft?.suggestionStep || 1);
    const [submitterForm, setSubmitterForm] = useState(initialDraft?.submitterForm || {
        firstName: "",
        lastName: "",
        phone: "",
        email: "",
        notes: ""
    });
    const [pendingEditChurchId, setPendingEditChurchId] = useState(initialDraft?.selectedChurchId || null);
    const [suggestionSuccess, setSuggestionSuccess] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState("");
    const [initialFormValues, setInitialFormValues] = useState(null);

    const isRestored = useRef(false);
    useEffect(() => {
        isRestored.current = true;
    }, []);
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
    const [, setHoveredMarker] = useState(null);
    const [mobileShowMap, setMobileShowMap] = useState(false);
    const [filterOpen, setFilterOpen] = useState(false);
    const [filterRecenterTrigger, setFilterRecenterTrigger] = useState(0);
    const filterRef = useRef(null);
    const sheetRef = useRef(null);
    const startHeight = useRef(0);
    const touchStartY = useRef(0);
    const isHeaderTouch = useRef(false);
    const isFilterMenuTouch = useRef(false);
    const [isExiting, setIsExiting] = useState(false);
    const [dragHeight, setDragHeight] = useState(null);
    const lastDragHeightRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const touchStartTime = useRef(0);
    const mobileStickyHeaderRef = useRef(null);
    const footerRef = useRef(null);
    const manualRecenterPendingRef = useRef(false);

    // Auto-close bottom sheet on mobile when a country is selected (or when re-clicking "All")
    useEffect(() => {
        if (isMobile && (activeCountryFilter || filterRecenterTrigger > 0)) {
            setBottomSheetMode("hidden");
        }
    }, [activeCountryFilter, filterRecenterTrigger, isMobile, setBottomSheetMode]);


    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth <= 768);
        checkMobile();
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);




    const { lang } = useLang();
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





    // Close filters and "Autres" dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(e) {
            // Handle "Autres" dropdown (Desktop)
            if (otherCountriesRef.current && !otherCountriesRef.current.contains(e.target)) {
                setShowOtherCountries(false);
            }
            // Handle Mobile Filter
            if (filterRef.current && !filterRef.current.contains(e.target)) {
                setFilterOpen(false);
            }
        }
        
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("touchstart", handleClickOutside); // More responsive on mobile
        
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("touchstart", handleClickOutside);
        };
    }, []);


    // ─── Recovery & Auto-Save Effects ─────────────────────────────────────────
    // RECOVERY: If we loaded a draft that was an "edit", re-select the church once churches are loaded
    useEffect(() => {
        if (pendingEditChurchId && churches?.length > 0 && !selectedChurch) {
            const church = churches.find(c => c.id === pendingEditChurchId);
            if (church) {
                setSelectedChurch(church);
                setPendingEditChurchId(null);
            }
        }
    }, [churches, pendingEditChurchId, selectedChurch]);

    // AUTO-SAVE: Persistent draft across language changes
    useEffect(() => {
        if (!isRestored.current) return;

        const draft = {
            suggestionForm,
            submitterForm,
            suggestionStep,
            suggestionType,
            showSuggestionModal,
            selectedChurchId: suggestionType === "edit" ? selectedChurch?.id : null
        };
        localStorage.setItem(SUGGESTION_DRAFT_KEY, JSON.stringify(draft));
    }, [suggestionForm, submitterForm, suggestionStep, suggestionType, showSuggestionModal, selectedChurch]);

    const clearSuggestionDraft = () => {
        localStorage.removeItem(SUGGESTION_DRAFT_KEY);
        setPendingEditChurchId(null);
    };

    const SUGGESTION_COUNTRIES = Object.keys(COUNTRY_CODES).sort();

    const findDuplicateChurch = useCallback((name, city) => {
        const normalizedName = normalizeText(String(name || "").trim());
        const normalizedCity = normalizeText(String(city || "").trim());
        if (!normalizedName || !normalizedCity) return null;

        return churches.find((church) => (
            normalizeText(String(church.name || "").trim()) === normalizedName &&
            normalizeText(String(church.city || "").trim()) === normalizedCity
        )) || null;
    }, [churches]);

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
                country: church.country || "Romania",
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
                country: activeCountryFilter || "Romania",
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

    const handleDuplicateChurchRedirect = () => {
        const duplicateChurch = duplicateChurchModal.church;
        if (!duplicateChurch) return;

        setDuplicateChurchModal({ isOpen: false, church: null });
        setShowSuggestionModal(false);
        setFormError("");
        setSuggestionStep(1);
        selectChurch(duplicateChurch);
        setTimeout(() => {
            openSuggestionModal("edit", duplicateChurch);
        }, 0);
    };

    const handleSuggestionSubmit = async (e) => {
        if (e) e.preventDefault();

        if (suggestionStep === 1) {
            if (!suggestionForm.name || !suggestionForm.city) {
                setFormError(t("errorNameCityRequired"));
                return;
            }
            if (suggestionType === "new") {
                const duplicateChurch = findDuplicateChurch(suggestionForm.name, suggestionForm.city);
                if (duplicateChurch) {
                    setFormError("");
                    setDuplicateChurchModal({ isOpen: true, church: duplicateChurch });
                    return;
                }
            }
            if (suggestionType === "edit" && !hasChanges) {
                setFormError(t("errorNoChanges"));
                return;
            }
            if (suggestionForm.email && !isValidEmail(suggestionForm.email)) {
                setFormError(t("errorInvalidEmail"));
                return;
            }
            setFormError("");
            setSuggestionStep(2);
            return;
        }

        if (submitterForm.email && !isValidEmail(submitterForm.email)) {
            setFormError(t("errorInvalidEmail"));
            return;
        }

        setIsSubmitting(true);
        try {
            await addDoc(collection(db, "church_suggestions"), {
                type: suggestionType,
                originalChurchId: suggestionType === "edit" ? selectedChurch?.id : null,
                status: "pending",
                data: {
                    ...suggestionForm,
                    submitter: submitterForm
                },
                createdAt: serverTimestamp(),
                expiresAt: new Date(Date.now() + SUGGESTION_RETENTION_DAYS * 24 * 60 * 60 * 1000)
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

            // Notification côté serveur : le nom du canal ntfy ne doit pas
            // se retrouver dans le code envoyé au navigateur.
            fetch("/api/notify/suggestion", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    type: suggestionType,
                    name: suggestionForm.name,
                    city: suggestionForm.city,
                    country: getCountryLabel(suggestionForm.country),
                }),
            }).catch((e) => console.error("Notification error:", e));

            setSuggestionSuccess(true);
            clearSuggestionDraft();
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
                const published = list.filter(c => !c.isDraft);
                setChurches(published);
                setChurchesLoading(false);
            },
            (err) => {
                console.error("Failed to load churches:", err);
                setChurchesLoading(false);
            }
        );
        return () => unsub();
    }, []);


    // Auto-select church from URL param
    useEffect(() => {
        if (churchesLoading || churches.length === 0) return;
        const churchSlug = searchParams.get("church") || sessionStorage.getItem(MAP_SELECTED_CHURCH_STORAGE_KEY);
        if (churchSlug) {
            const found = churches.find((c) => c.id === churchSlug);
            if (found) {
                setSelectedChurch(found);
                setIsInitialLoad(false);
                sessionStorage.setItem(MAP_SELECTED_CHURCH_STORAGE_KEY, found.id);
            }
        }
    }, [searchParams, churches, churchesLoading]);

    // Track World Map visit landing
    useEffect(() => {
        trackWorldMapVisit("initial");
    }, []);

    const fetchUserLocation = useCallback((isManual = false) => {
        if (!navigator.geolocation) {
            manualRecenterPendingRef.current = false;
            trackWorldMapVisit("denied");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                localStorage.setItem("bethel_map_geo_asked", "true");
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                setUserLocation({ lat, lng });
                // Seul le fait d'avoir autorisé est compté, jamais la position.
                trackWorldMapVisit("granted");
                if (isManual || manualRecenterPendingRef.current) {
                    setIsInitialLoad(false);
                    setRecenterTrigger(prev => prev + 1);
                }
                manualRecenterPendingRef.current = false;
            },
            (err) => {
                localStorage.setItem("bethel_map_geo_asked", "true");
                console.warn("Geolocation denied or unavailable.", err);
                manualRecenterPendingRef.current = false;
                trackWorldMapVisit("denied");
            },
            { timeout: 5000 }
        );
    }, []);

    // Auto-locate on load or permission change
    useEffect(() => {
        const hasAskedGeo = localStorage.getItem("bethel_map_geo_asked");

        if (navigator.permissions && navigator.permissions.query) {
            navigator.permissions.query({ name: 'geolocation' })
                .then((result) => {
                    if (result.state === 'granted') {
                        fetchUserLocation();
                    } else if (result.state === 'prompt' && !hasAskedGeo) {
                        fetchUserLocation();
                    }
                    
                    result.onchange = () => {
                        if (result.state === 'granted') fetchUserLocation();
                    };
                })
                .catch(() => {
                    if (!hasAskedGeo) fetchUserLocation();
                });
        } else {
            if (!hasAskedGeo) fetchUserLocation();
        }
    }, [fetchUserLocation]);

    const handleRecenter = () => {
        // 1. Reset search and country filters immediately
        setSearchQuery("");
        setActiveCountryFilter("");
        
        // 2. Deselect any active church
        if (selectedChurch) {
            deselectChurch();
        }

        // 3. For mobile, ensure the interface is cleaned (bottom sheet pushed all the way down)
        if (isMobile) {
            setBottomSheetMode("hidden");
            // Since deselectChurch has its own internal timing that resets to "collapsed",
            // we add a tiny safety timeout to ensure "hidden" wins on recenter.
            setTimeout(() => setBottomSheetMode("hidden"), 300);
        }

        // 4. Trigger map movement to user location
        if (userLocation) {
            manualRecenterPendingRef.current = false;
            setRecenterTrigger(prev => prev + 1);
        } else {
            manualRecenterPendingRef.current = true;
            // Re-request position if not available — this forces a browser prompt
            // if it was previously dismissed or not yet decided.
            fetchUserLocation(true);
        }
    };




    const selectChurch = useCallback((church) => {
        setSelectedChurch(church);
        setIsInitialLoad(false);
        setBottomSheetMode("collapsed"); // Set to collapsed (medium) mode instead of expanded
        sessionStorage.setItem(MAP_SELECTED_CHURCH_STORAGE_KEY, church.id);
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
                sessionStorage.removeItem(MAP_SELECTED_CHURCH_STORAGE_KEY);
                const url = new URL(window.location.href);
                url.searchParams.delete("church");
                window.history.replaceState({}, "", url.toString());
            }, 250);
        } else {
            setSelectedChurch(null);
            setBottomSheetMode("collapsed");
            sessionStorage.removeItem(MAP_SELECTED_CHURCH_STORAGE_KEY);
            const url = new URL(window.location.href);
            url.searchParams.delete("church");
            window.history.replaceState({}, "", url.toString());
        }
    }, [isMobile, selectedChurch]);

    const handleMapInteraction = useCallback(() => {
        if (isMobile) {
            setBottomSheetMode("hidden");
        }
        // Always close filters when interacting with the map
        setFilterOpen(false);
        setShowOtherCountries(false);
    }, [isMobile, setBottomSheetMode]);

    const handleTouchStart = (e) => {
        const target = e.target;
        const isHeader = !!(
            target.closest('.bottomSheetDragHandleArea') || 
            target.closest('.mobileControlsInSheet') || 
            target.closest('.mobileDetailsHeader') ||
            target.closest('.churchSidebarFooter')
        ) && !target.closest('.countryFilterMenu');
        
        isHeaderTouch.current = isHeader;
        isFilterMenuTouch.current = !!target.closest('.countryFilterMenu');
        touchStartY.current = e.touches[0].clientY;
        touchStartTime.current = Date.now();
        if (sheetRef.current) {
            startHeight.current = sheetRef.current.offsetHeight;
        }
    };

    const handleTouchMove = (e) => {
        if (!startHeight.current) return;
        const currentY = e.touches[0].clientY;
        const deltaY = currentY - touchStartY.current;

        // Isolate country filter menu from sheet dragging
        if (isFilterMenuTouch.current) return;

        // Threshold check to avoid accidental micro-drags when wanting to tap
        if (Math.abs(deltaY) < 5) return;

        // Determine if we should drag the sheet or allow content scrolling
        let shouldIntercept = isHeaderTouch.current;
        
        if (!shouldIntercept) {
            const scrollContainer = e.target.closest('.churchList');
            const isAtTop = !scrollContainer || scrollContainer.scrollTop <= 0;
            
            if (selectedChurch) {
                // Church Details View: Broad dragging (from any content) enabled for convenience
                if (deltaY > 0 && isAtTop) shouldIntercept = true;
                else if (deltaY < 0 && bottomSheetMode !== "expanded") shouldIntercept = true;
            } else {
                // 1. If collapsed or hidden, any swipe anywhere should move the sheet (since scrolling is disabled)
                if (bottomSheetMode === "collapsed" || bottomSheetMode === "hidden") {
                    shouldIntercept = true;
                }
                // 2. If expanded, swipe DOWN only drags the sheet if at the TOP of the list
                //    (Otherwise, we let the list scroll naturally)
                else if (bottomSheetMode === "expanded" && deltaY > 0 && isAtTop) {
                    shouldIntercept = true;
                    // SEAMLESS HANDOVER: Reset coordinates to avoid jumping when switching from scroll to sheet drag
                    touchStartY.current = e.touches[0].clientY;
                    startHeight.current = sheetRef.current.offsetHeight;
                }
            }
        }

        if (!shouldIntercept) return;

        // Visual feedback and CSS classes only when we actually start dragging the sheet
        if (!isDragging) setIsDragging(true);

        // If we reach here, we are dragging the SHEET, so prevent scroll and blur inputs
        if (e.cancelable) e.preventDefault();

        if (document.activeElement instanceof HTMLElement && 
           (e.target.closest('input') || e.target.closest('button'))) {
            document.activeElement.blur();
        }

        // Calculate new height
        let rawNewHeight = startHeight.current - deltaY;
        let newHeight = rawNewHeight;

        // Respect limits
        const headerH = 110;
        const minH = 100; // Final minimalist height (100px)
        const maxH = window.innerHeight - headerH - 10;

        if (newHeight > maxH) {
            // Seamless handover: if we are in the list view and sheet is at max, 
            // the remaining drag distance goes to the list's scroll position.
            const scrollContainer = e.target.closest('.churchList');
            if (scrollContainer && !selectedChurch) {
                const overflow = rawNewHeight - maxH;
                scrollContainer.scrollTop = overflow;
                newHeight = maxH;
            } else {
                newHeight = maxH + (newHeight - maxH) * 0.2; // Resistance
            }
        } else if (newHeight < minH) {
            newHeight = minH + (newHeight - minH) * 0.2; // Resistance
        }

        // PERFORMANCE FIX: Update DOM directly to avoid React re-render during drag
        if (sheetRef.current) {
            sheetRef.current.style.setProperty('--dynamic-height', `${newHeight}px`);
        }
        lastDragHeightRef.current = newHeight;
    };

    const handleTouchEnd = (e) => {
        if (isFilterMenuTouch.current) {
            isFilterMenuTouch.current = false;
        }
        if (!isDragging) {
            startHeight.current = null;
            return;
        }
        setIsDragging(false);

        if (lastDragHeightRef.current) {
            const vh = window.innerHeight / 100;
            const hInVh = lastDragHeightRef.current / vh;
            
            const duration = Math.max(Date.now() - touchStartTime.current, 1);
            const deltaY = e.changedTouches[0].clientY - touchStartY.current;
            const velocity = deltaY / duration; // px/ms. Negative = up, Positive = down.
            const flickThreshold = 0.5;

            // Velocity-based snapping (Flicks)
            if (velocity < -flickThreshold) {
                // Flick UP: Go to next level
                if (bottomSheetMode === "hidden") setBottomSheetMode("collapsed");
                else if (bottomSheetMode === "collapsed") setBottomSheetMode("expanded");
                else setBottomSheetMode("expanded");
            } else if (velocity > flickThreshold) {
                // Flick DOWN: Go to previous level
                if (bottomSheetMode === "expanded") setBottomSheetMode("collapsed");
                else if (bottomSheetMode === "collapsed") setBottomSheetMode("hidden");
                else setBottomSheetMode("hidden");
            } else {
                // Normal distance-based snapping (Slow drag)
                if (hInVh < 25) {
                    setBottomSheetMode("hidden");
                } else if (hInVh < 55) {
                    setBottomSheetMode("collapsed");
                } else {
                    setBottomSheetMode("expanded");
                }
            }
        }

        if (sheetRef.current) {
            sheetRef.current.style.removeProperty('--dynamic-height');
        }

        setDragHeight(null);
        lastDragHeightRef.current = null;
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
    const { ALL_COUNTRIES, countryCounts } = useMemo(() => {
        // 1. Get all unique countries
        const all = [...new Set(churches.map((c) => c.country))].sort((a, b) => {
            return getCountryLabel(a).localeCompare(getCountryLabel(b), lang);
        });

        // 2. Calculate counts (independent of selected country, dependent on search)
        let filteredForCounts = [...churches];
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            filteredForCounts = filteredForCounts.filter(c => matchChurchSearch(c, q));
        }

        const counts = { all: filteredForCounts.length };
        for (const c of filteredForCounts) {
            counts[c.country] = (counts[c.country] || 0) + 1;
        }

        // 3. Sort by church count (primary) then alphabetical (secondary)
        const sorted = [...all].sort((a, b) => {
            const countDiff = (counts[b] || 0) - (counts[a] || 0);
            if (countDiff !== 0) return countDiff;
            return getCountryLabel(a).localeCompare(getCountryLabel(b), lang);
        });

        // 4. Update ALL_COUNTRIES to follow this new sorting
        const finalAll = [...sorted];

        // 5. Dynamic Elevation: If a selected country is in the \"others\" list, bring it to the front
        const defaultTop = sorted.slice(0, 2);
        const others = sorted.slice(2);

        let finalTop = [...defaultTop];
        let finalOthers = [...others];

        if (activeCountryFilter && others.includes(activeCountryFilter)) {
            finalTop = [...defaultTop, activeCountryFilter];
            finalOthers = others.filter(c => c !== activeCountryFilter);
        }

        return {
            ALL_COUNTRIES: finalAll,
            countryCounts: counts,
            sortedCountries: sorted,
            topCountries: finalTop,
            otherCountries: finalOthers
        };
    }, [churches, getCountryLabel, lang, searchQuery, activeCountryFilter]);


    // Distance map
    const distanceMap = useMemo(() => {
        if (!userLocation) return {};
        const map = {};
        for (const c of churches) {
            map[c.id] = haversineDistance(userLocation.lat, userLocation.lng, c.lat, c.lng);
        }
        return map;
    }, [userLocation, churches]);


    // Filter + sort alphabetically by name
    const filteredChurches = useMemo(() => {
        let result = [...churches];
        if (activeCountryFilter) {
            result = result.filter((c) => c.country === activeCountryFilter);
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(c => matchChurchSearch(c, q));
        }

        // Sort by distance if user location is available, otherwise alphabetical
        if (userLocation) {
            result.sort((a, b) => {
                const distA = distanceMap[a.id] ?? Infinity;
                const distB = distanceMap[b.id] ?? Infinity;
                return distA - distB;
            });
        } else {
            result.sort((a, b) => a.name.localeCompare(b.name));
        }
        
        return result;
    }, [searchQuery, activeCountryFilter, churches, userLocation, distanceMap]);

    // Group by country only, sorted alphabetically
    const groupedChurches = useMemo(() => {
        const groups = {};
        for (const church of filteredChurches) {
            if (!groups[church.country]) {
                groups[church.country] = [];
            }
            groups[church.country].push(church);
        }
        
        // Helper to get min distance for a country group
        const getMinDist = (items) => {
            if (!userLocation) return Infinity;
            return Math.min(...items.map(it => distanceMap[it.id] ?? Infinity));
        };

        // Sort country keys
        const sorted = {};
        Object.keys(groups)
            .sort((a, b) => {
                // If searching and location available, sort countries by proximity
                if (searchQuery.trim() && userLocation) {
                    const distA = getMinDist(groups[a]);
                    const distB = getMinDist(groups[b]);
                    if (distA !== distB) return distA - distB;
                }
                
                // Otherwise sort by church count (primary), then translated name (secondary)
                const countDiff = groups[b].length - groups[a].length;
                if (countDiff !== 0) return countDiff;
                return getCountryLabel(a).localeCompare(getCountryLabel(b), lang);
            })
            .forEach((key) => {
                sorted[key] = groups[key];
            });
        return sorted;
    }, [filteredChurches, getCountryLabel, lang, userLocation, distanceMap, searchQuery]);

    // Dynamic height calculation for hidden/minimal mode
    useEffect(() => {
        if (!isMobile || isDragging) return;

        const measureAndSetHeight = () => {
            if (bottomSheetMode === "hidden") {
                const headerH = mobileStickyHeaderRef.current?.offsetHeight || 0;
                const footerH = footerRef.current?.offsetHeight || 0;
                
                if (headerH > 0) {
                    // Combine header and footer for a perfect fit
                    let totalH = headerH + footerH;
                    
                    // Ensure a consistent height (around 140px) even for the list view handle
                    if (!selectedChurch) {
                        totalH = Math.max(totalH, 140);
                    }
                    
                    setDragHeight(totalH);
                    lastDragHeightRef.current = totalH;
                }
            } else if (bottomSheetMode === "collapsed") {
                // Collapsed (medium) mode is normally 40vh, handled by CSS 
                // but we clear dragHeight to let CSS take over if NOT dragging
                setDragHeight(null);
                lastDragHeightRef.current = null;
            } else if (bottomSheetMode === "expanded") {
                setDragHeight(null);
                lastDragHeightRef.current = null;
            }
        };

        // Small delay to ensure content is rendered
        const timer = setTimeout(measureAndSetHeight, 50);
        return () => clearTimeout(timer);
    }, [isMobile, bottomSheetMode, selectedChurch, isDragging, churches.length, filteredChurches.length, groupedChurches]);




    const getGoogleMapsSearchUrl = (church) => {
        // 1. If we have a direct Google Maps URI from the API, use it (most stable)
        if (church.googleMapsUri) {
            return church.googleMapsUri;
        }

        // 2. If we have a place_id, use the official Universal URL for Place IDs (100% accurate)
        if (church.place_id) {
            // query is required even with place_id, use church name as descriptive fallback
            const queryName = encodeURIComponent(church.name || "Church");
            return `https://www.google.com/maps/search/?api=1&query=${queryName}&query_place_id=${church.place_id}`;
        }

        // 3. Otherwise fallback to text search using address or location title
        const directionQuery = church.locationTitleDirection || church.locationTitle;
        
        const query = directionQuery
            ? encodeURIComponent(directionQuery)
            : encodeURIComponent([
                (`${church.street || ""} ${church.number || ""}`.trim()),
                church.city || "",
                church.zipCode || "",
                getCountryLabel(church.country)
            ].filter(Boolean).join(", "));
            
        return `https://www.google.com/maps/search/?api=1&query=${query}`;
    };

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

    if (isMobile === null || churchesLoading) {
        return (
            <div className="churchMapLayout loading">
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
            </div>
        );
    }

    return (
        <div 
            className={`churchMapLayout ${mobileShowMap ? "mapFocused" : ""} ${!isSidebarOpen ? "sidebar-closed" : ""}`}
            style={isMobile ? { 
                "--dynamic-height": dragHeight ? `${dragHeight}px` : undefined 
            } : {}}
        >
            {/* 1. Top Floating Header (Unified Search & Filters) - Now at the Root to avoid z-index conflicts */}
            <div className={`mapFloatingHeader ${isMobile ? "mobileHeader" : ""}`}>
                {isMobile ? (
                    <div className="mobileUnifiedHeader">
                        <button
                            className="unifiedReturnBtn"
                            onClick={() => window.location.href = "/#harta-mondiala"}
                            aria-label={t("backToWebsite")}
                        >
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="19" y1="12" x2="5" y2="12"></line>
                                <polyline points="12 19 5 12 12 5"></polyline>
                            </svg>
                        </button>

                        <div className="unifiedSearchContainer">
                            <input
                                id="mobileSearchInputAnim"
                                type="text"
                                placeholder={t("searchPlaceholder")}
                                value={searchQuery}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setSearchQuery(val);
                                    
                                    if (isMobile) {
                                        // If a church was selected, deselect it immediately to show the list/search results
                                        if (selectedChurch) {
                                            setSelectedChurch(null);
                                            setIsExiting(false);
                                            const url = new URL(window.location.href);
                                            url.searchParams.delete("church");
                                            window.history.replaceState({}, "", url.toString());
                                        }
                                        
                                        // Ensure bottom sheet is expanded to see results
                                        if (bottomSheetMode !== "expanded") {
                                            setBottomSheetMode("expanded");
                                        }
                                    }
                                }}
                                onFocus={() => {
                                    setIsSearchFocused(true);
                                    if (isMobile) {
                                        setBottomSheetMode("expanded");
                                        // If we were looking at a church, deselect to show the list
                                        if (selectedChurch) {
                                            setSelectedChurch(null);
                                            setIsExiting(false);
                                            const url = new URL(window.location.href);
                                            url.searchParams.delete("church");
                                            window.history.replaceState({}, "", url.toString());
                                        }
                                    }
                                }}
                                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                            />
                            <div className="unifiedSearchActionWrapper">
                                {searchQuery ? (
                                    <button 
                                        className="unifiedSearchClear" 
                                        onClick={() => {
                                            setSearchQuery("");
                                            if (isMobile) {
                                                setBottomSheetMode("collapsed");
                                            }
                                        }}
                                        aria-label="Clear search"
                                    >
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="18" y1="6" x2="6" y2="18"></line>
                                            <line x1="6" y1="6" x2="18" y2="18"></line>
                                        </svg>
                                    </button>
                                ) : (
                                    <div className="unifiedSearchIcon">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <circle cx="11" cy="11" r="8"></circle>
                                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                        </svg>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <div className="unifiedFilterAction" ref={filterRef}>
                            <button
                                className={`unifiedFilterToggle ${activeCountryFilter ? "hasFilter" : ""}`}
                                onClick={() => setFilterOpen(!filterOpen)}
                            >
                                <div className="unifiedFilterLabel">
                                    {activeCountryFilter ? (
                                        <FlagImage country={activeCountryFilter} />
                                    ) : (
                                        <span style={{ fontSize: '1.2rem' }}>🌍</span>
                                    )}
                                    <span className="unifiedFilterCount">
                                        {activeCountryFilter ? (countryCounts[activeCountryFilter] || 0) : (countryCounts.all || 0)}
                                    </span>
                                </div>
                                <svg className={`unifiedFilterChevron ${filterOpen ? 'is-open' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                            </button>
                            {filterOpen && (
                                <div className="countryFilterMenu mobileVersion">
                                    <button
                                        className={`dropdownItem ${!activeCountryFilter ? "active" : ""}`}
                                        onClick={() => {
                                            setActiveCountryFilter("");
                                            setFilterRecenterTrigger(prev => prev + 1);
                                            setFilterOpen(false);
                                        }}
                                    >
                                        <span style={{ 
                                            width: '18px', 
                                            height: '18px', 
                                            display: 'inline-flex', 
                                            alignItems: 'center', 
                                            justifyContent: 'center',
                                            fontSize: '1rem',
                                            lineHeight: 1
                                        }}>🌍</span>
                                        <span className="dropdownLabel">{t("allCountries")}</span>
                                        <span className="dropdownCount">{countryCounts.all || 0}</span>
                                    </button>
                                    {ALL_COUNTRIES.filter(c => countryCounts[c] > 0).map((country) => (
                                        <button
                                            key={country}
                                            className={`dropdownItem ${activeCountryFilter === country ? "active" : ""}`}
                                            onClick={() => {
                                                setActiveCountryFilter(country);
                                                setFilterRecenterTrigger(prev => prev + 1);
                                                setFilterOpen(false);
                                            }}
                                        >
                                            <FlagImage country={country} />
                                            <span className="dropdownLabel">{getCountryLabel(country)}</span>
                                            <span className="dropdownCount">{countryCounts[country] || 0}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="mapHeaderLeft">
                            <button
                                className="mapReturnBtn"
                                onClick={() => window.location.href = "/#harta-mondiala"}
                                aria-label={t("backToWebsite")}
                            >
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="19" y1="12" x2="5" y2="12"></line>
                                    <polyline points="12 19 5 12 12 5"></polyline>
                                </svg>
                            </button>
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

                            <div className="countryFilterDropdown" ref={otherCountriesRef}>
                                <button
                                    className={`countryFilterBtn ${activeCountryFilter ? "active" : ""}`}
                                    onClick={() => setShowOtherCountries(!showOtherCountries)}
                                >
                                    <div className="countryFilterMain">
                                        {activeCountryFilter ? (
                                            <>
                                                <FlagImage country={activeCountryFilter} />
                                                <span className="pillLabel">{getCountryLabel(activeCountryFilter)}</span>
                                                <span className="pillCount">{countryCounts[activeCountryFilter] || 0}</span>
                                            </>
                                        ) : (
                                            <>
                                                <span style={{ 
                                                    width: '18px', 
                                                    height: '18px', 
                                                    display: 'inline-flex', 
                                                    alignItems: 'center', 
                                                    justifyContent: 'center',
                                                    fontSize: '1rem',
                                                    lineHeight: 1
                                                }}>🌍</span>
                                                <span className="pillLabel">{t("allCountries")}</span>
                                                <span className="pillCount">{countryCounts.all || 0}</span>
                                            </>
                                        )}
                                    </div>
                                    <svg className={`chevronIcon ${showOtherCountries ? "open" : ""}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="6 9 12 15 18 9"></polyline>
                                    </svg>
                                </button>

                                {showOtherCountries && (
                                    <div className="countryFilterMenu">
                                        <button
                                            className={`dropdownItem ${!activeCountryFilter ? "active" : ""}`}
                                            onClick={() => {
                                                setActiveCountryFilter("");
                                                setFilterRecenterTrigger(prev => prev + 1);
                                                setShowOtherCountries(false);
                                            }}
                                        >
                                            <span style={{ 
                                                width: '18px', 
                                                height: '18px', 
                                                display: 'inline-flex', 
                                                alignItems: 'center', 
                                                justifyContent: 'center',
                                                fontSize: '1rem',
                                                lineHeight: 1
                                            }}>🌍</span>
                                            <span className="dropdownLabel">{t("allCountries")}</span>
                                            <span className="dropdownCount">{countryCounts.all || 0}</span>
                                        </button>
                                        {ALL_COUNTRIES.filter(c => countryCounts[c] > 0).map((country) => (
                                                <button
                                                    key={country}
                                                    className={`dropdownItem ${activeCountryFilter === country ? "active" : ""}`}
                                                    onClick={() => {
                                                        setActiveCountryFilter(country);
                                                        setFilterRecenterTrigger(prev => prev + 1);
                                                        setShowOtherCountries(false);
                                                    }}
                                                >
                                                    <FlagImage country={country} className="dropdownFlag" />
                                                    <span className="dropdownLabel">{getCountryLabel(country)}</span>
                                                    <span className="dropdownCount">{countryCounts[country] || 0}</span>
                                                </button>
                                            ))
                                        }
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* 2. Sidebar & Bottom Sheet */}
            <aside className={`churchMapSidebar ${!isSidebarOpen ? "collapsed" : ""}`}>
                {!isMobile && (
                    <div className="sidebarHeader">
                        {isSidebarOpen ? (
                            <div className="sidebarHeaderOpen">
                                <button className="sidebarHamburgerBtn" onClick={() => setIsSidebarOpen(false)}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="3" y1="12" x2="21" y2="12"></line>
                                        <line x1="3" y1="6" x2="21" y2="6"></line>
                                        <line x1="3" y1="18" x2="21" y2="18"></line>
                                    </svg>
                                </button>
                                <div className="sidebarBrand">
                                    <span className="sidebarTitle">{t("title")}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="sidebarHeaderCollapsed">
                                <button className="sidebarHamburgerBtn" onClick={() => setIsSidebarOpen(true)}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
                        <div className="mobileStickyHeader" ref={mobileStickyHeaderRef}>
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

                            {isMobile && (selectedChurch || isExiting) && (
                                <div className={`mobileChurchDetails ${isExiting ? "exiting" : ""}`}>
                                    <div className="mobileDetailsHeader">
                                        <div className="mobileDetailsTitleRow">
                                            <div className="mobileDetailsTitleArea">
                                                <h2 className="churchDetailsTitle">
                                                    <FlagImage country={selectedChurch.country} className="title-flag" />
                                                    <span>{formatCasing(selectedChurch.name)}{selectedChurch.city ? ` ${formatCasing(selectedChurch.city)}` : ''}</span>
                                                </h2>
                                            </div>
                                            <div className="mobileDetailsHeaderActions">
                                                <button className="mobileDetailsBack" onClick={deselectChurch} aria-label="Close">
                                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                        <p className="churchDetailsAddress">
                                            {[(`${formatCasing(selectedChurch.street) || ""} ${selectedChurch.number || ""}`.trim()), (`${selectedChurch.zipCode ? `${selectedChurch.zipCode} ` : ""}${formatCasing(selectedChurch.city) || ""}`.trim())].filter(Boolean).join(", ")}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="churchList">
                            <ChurchList 
                                groupedChurches={groupedChurches}
                                selectedChurch={selectedChurch}
                                isExiting={isExiting}
                                isMobile={isMobile}
                                selectChurch={selectChurch}
                                bottomSheetMode={bottomSheetMode}
                                setBottomSheetMode={setBottomSheetMode}
                                userLocation={userLocation}
                                distanceMap={distanceMap}
                                getCountryLabel={getCountryLabel}
                                formatDistance={formatDistance}
                                t={t}
                                filteredChurches={filteredChurches}
                            />
                        </div>

                        <div className="churchSidebarFooter" ref={footerRef}>
                            <div className="mobileFooterActions">
                                {(selectedChurch || isExiting) && isMobile ? (
                                    <>
                                        <button className="sidebarSuggestBtn editMode" onClick={() => openSuggestionModal("edit", selectedChurch)}>
                                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                                            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
                                            </svg>
                                            <span className="btnText">{t("route")}</span>
                                        </a>
                                    </>
                                ) : (
                                    <button 
                                        className="sidebarSuggestBtn newMode fullWidth" 
                                        onClick={() => openSuggestionModal("new")}
                                    >
                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="12" y1="5" x2="12" y2="19"></line>
                                            <line x1="5" y1="12" x2="19" y2="12"></line>
                                        </svg>
                                        <span className="btnText">{t("newChurch")}</span>
                                    </button>
                                )}
                            </div>
                        </div>
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

            {/* 3. Map Container */}
            <div className="churchMapContainer">


                <APIProvider apiKey={API_KEY}>
                    <Map
                        defaultCenter={BELGIUM_CENTER}
                        defaultZoom={8}
                        mapId={MAP_ID}
                        disableDefaultUI={true}
                        gestureHandling={"greedy"}
                        onClick={handleMapInteraction}
                        onDragstart={handleMapInteraction}
                        onZoom_changed={handleMapInteraction}
                    >


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
                            filterRecenterTrigger={filterRecenterTrigger}
                            recenterTrigger={recenterTrigger}
                        />

                        {/* Recentering button (follows bottom sheet on mobile) */}
                        <button
                            className="mapRecenterBtn"
                            onClick={handleRecenter}
                            aria-label={t("recenterLabel") || "Centrat pe poziția mea"}
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <circle cx="12" cy="12" r="3"></circle>
                                <line x1="12" y1="1" x2="12" y2="4"></line>
                                <line x1="12" y1="20" x2="12" y2="23"></line>
                                <line x1="1" y1="12" x2="4" y2="12"></line>
                                <line x1="20" y1="12" x2="23" y2="12"></line>
                            </svg>
                        </button>
                    </Map>

                    {/* Church Details Card (Desktop Only) */}
                    {selectedChurch && !isMobile && (
                        <div className="churchDetailsCard">
                            <div className="churchDetailsHeader">
                                <h2 className="churchDetailsTitle">
                                    <FlagImage country={selectedChurch.country} className="title-flag" />
                                    <span>{formatCasing(selectedChurch.name)}{selectedChurch.city ? ` ${formatCasing(selectedChurch.city)}` : ''}</span>
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
                                    {[(`${formatCasing(selectedChurch.street) || ""} ${selectedChurch.number || ""}`.trim()), (`${selectedChurch.zipCode ? `${selectedChurch.zipCode} ` : ""}${formatCasing(selectedChurch.city) || ""}`.trim())].filter(Boolean).join(", ")}
                                </p>
                                <ChurchInfoLinks church={selectedChurch} t={t} />

                                <div className="churchDetailsActions">
                                    <button
                                        className="sidebarSuggestBtn editMode"
                                        onClick={() => openSuggestionModal("edit", selectedChurch)}
                                    >
                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                                        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                                                    <SearchableSelect
                                                        value={suggestionForm.country}
                                                        onChange={(val) => setSuggestionForm({ ...suggestionForm, country: val })}
                                                        options={SUGGESTION_COUNTRIES.map(c => ({ value: c, label: getCountryLabel(c) }))}
                                                        placeholder=""
                                                        inputClassName="suggestionInput" 
                                                    />
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
                                                        type="text"
                                                        placeholder="https://..."
                                                        value={suggestionForm.website}
                                                        onChange={(e) => setSuggestionForm({ ...suggestionForm, website: e.target.value })}
                                                    />
                                                </div>
                                                <div className="suggestionFormGroup">
                                                    <label>{t("youtube")}</label>
                                                    <input
                                                        type="text"
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
                                                        type="text"
                                                        placeholder="instagram.com/..."
                                                        value={suggestionForm.instagram}
                                                        onChange={(e) => setSuggestionForm({ ...suggestionForm, instagram: e.target.value })}
                                                    />
                                                </div>
                                                <div className="suggestionFormGroup">
                                                    <label>{t("facebook")}</label>
                                                    <input
                                                        type="text"
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
                                        <div className="suggestionStep1Actions">
                                            <button
                                                type="button"
                                                className="suggestionCancelBtn"
                                                onClick={() => {
                                                    clearSuggestionDraft();
                                                    setShowSuggestionModal(false);
                                                }}
                                            >
                                                {t("cancel")}
                                            </button>
                                            <button
                                                type="submit"
                                                className="suggestionSubmitBtn"
                                                disabled={isSubmitting || (suggestionType === "edit" && !hasChanges)}
                                            >
                                                {isSubmitting ? "..." : t("nextStep")}
                                            </button>
                                        </div>
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

            {duplicateChurchModal.isOpen && duplicateChurchModal.church && (
                <div className="suggestionModalOverlay">
                    <div className="suggestionInfoModal" role="dialog" aria-modal="true">
                        <div className="suggestionModalHeader">
                            <h3>{t("duplicateChurchTitle")}</h3>
                        </div>
                        <div className="suggestionInfoModalBody">
                            <p>{t("duplicateChurchMessage")}</p>
                            <div className="suggestionDuplicateTarget">
                                <strong>{duplicateChurchModal.church.name}</strong>
                                <span>
                                    {duplicateChurchModal.church.city}
                                    {duplicateChurchModal.church.country ? `, ${getCountryLabel(duplicateChurchModal.church.country)}` : ""}
                                </span>
                            </div>
                        </div>
                        <div className="suggestionInfoModalActions">
                            <button
                                type="button"
                                className="suggestionCancelBtn"
                                onClick={() => setDuplicateChurchModal({ isOpen: false, church: null })}
                            >
                                {t("cancel")}
                            </button>
                            <button
                                type="button"
                                className="suggestionSubmitBtn"
                                onClick={handleDuplicateChurchRedirect}
                            >
                                {t("duplicateChurchAction")}
                            </button>
                        </div>
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
