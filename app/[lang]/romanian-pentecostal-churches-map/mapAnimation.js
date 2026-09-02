// Deplacements animes de la carte.
//
// Google Maps sait sauter d'un point a un autre, pas s'y rendre. Ces fonctions
// interpolent centre et zoom image par image, avec un dezoom intermediaire
// quand la distance est grande, pour que le visiteur garde ses reperes.
//
// Une seule animation a la fois : un AbortController partage annule la
// precedente des qu'une nouvelle commence, sans quoi deux clics rapproches
// feraient tirer la carte dans deux directions.
//
// Extrait de ChurchMap.jsx, ou ces 150 lignes voisinaient avec les composants.

import { haversineDistance } from "./mapHelpers";

// Global AbortController for map animations, shared across all navigation sources
let _mapAnimationAbort = null;

export function cancelMapAnimation() {
    if (_mapAnimationAbort) {
        _mapAnimationAbort.abort();
        _mapAnimationAbort = null;
    }
}

export function newMapAnimationSignal() {
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

            // Ease-in-out Sine, smooth velocity curve (peak 1.57× avg)
            const eased = -(Math.cos(Math.PI * progress) - 1) / 2;

            const lat = start.lat + (end.lat - start.lat) * eased;
            const lng = start.lng + (end.lng - start.lng) * eased;
            const zoom = fromZoom + (toZoom - fromZoom) * eased;

            // Atomic update, prevents GM internal batching issues
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
 *       Phase 1, Zoom out to an overview level (20% of total duration)
 *       Phase 2, Pan across the map at overview zoom (50% of total duration)
 *       Phase 3, Zoom in to target (30% of total duration)
 */
export function smoothFlyTo(map, target, targetZoom, options = {}) {
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
            const zoomDelta = Math.min(Math.ceil(distance / 200), 5); // 1 à 5 levels out
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
