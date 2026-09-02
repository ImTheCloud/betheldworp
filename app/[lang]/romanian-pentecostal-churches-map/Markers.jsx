import { useEffect, useRef } from "react";
import { useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { newMapAnimationSignal, smoothFlyTo } from "./mapAnimation";

// Les epingles de la carte et leur regroupement en grappes.
//
// Les marqueurs sont crees en imperatif plutot qu'en JSX : le regroupeur de
// Google veut des objets AdvancedMarkerElement, pas des elements React, et
// recreer plusieurs centaines d'epingles a chaque rendu couterait cher.
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

export default Markers;
