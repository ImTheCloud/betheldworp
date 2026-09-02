import { useEffect, useRef } from "react";
import { useMap } from "@vis.gl/react-google-maps";
import { BELGIUM_CENTER, COUNTRY_VIEWS } from "./mapData";
import { cancelMapAnimation, newMapAnimationSignal, smoothFlyTo } from "./mapAnimation";

// Deux composants sans rendu, qui ne servent qu'a piloter la carte depuis
// l'exterieur : l'un suit l'eglise selectionnee, l'autre le filtre par pays.
// Ils doivent vivre a l'interieur du fournisseur Google Maps pour atteindre
// useMap, d'ou cette forme de composant plutot que de simples fonctions.
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

export { MapController, FilterController };
