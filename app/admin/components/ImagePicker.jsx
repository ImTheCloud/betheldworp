"use client";

import React, { useMemo, useState, useEffect } from "react";

/**
 * ImagePicker, Dynamic Responsive Gallery with Unlimited Multi-Image Support.
 * Fetches available images from /api/list-event-images.
 * - Clicking an unselected image selects it.
 * - Clicking a selected image deselects it.
 * - Displays order badges (1, 2, 3...) for selected images.
 */
export default function ImagePicker({ value, values, onChange, max = Infinity }) {
    const [eventImages, setEventImages] = useState([]);
    const [loading, setLoading] = useState(true);

    // Dynamic fetching of images in the /public/images/events/ folder
    useEffect(() => {
        let mounted = true;
        const fetchImages = async () => {
            try {
                const res = await fetch("/api/list-event-images");
                const data = await res.json();
                if (mounted && Array.isArray(data)) {
                    setEventImages(data);
                }
            } catch (err) {
                console.error("Failed to fetch event images:", err);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        fetchImages();
        return () => { mounted = false; };
    }, []);

    // Normalize selected images array
    const selected = useMemo(() => {
        if (Array.isArray(values)) {
            return values.filter(Boolean);
        }
        if (Array.isArray(value)) {
            return value.filter(Boolean);
        }
        if (typeof value === "string" && value.trim()) {
            return [value.trim()];
        }
        return [];
    }, [values, value]);

    const handleSelect = (img) => {
        const fullPath = `/images/events/${img}`;
        const isAlreadySelected = selected.includes(fullPath);

        if (isAlreadySelected) {
            // Deselect clicked image
            const next = selected.filter((p) => p !== fullPath);
            onChange?.(next);
        } else {
            // Select new image (unlimited or bounded by max if specified)
            if (selected.length < max) {
                const next = [...selected, fullPath];
                onChange?.(next);
            } else {
                const next = [...selected.slice(0, max - 1), fullPath];
                onChange?.(next);
            }
        }
    };

    const getSelectedIndex = (img) => {
        const fullPath = `/images/events/${img}`;
        return selected.indexOf(fullPath);
    };

    // Reorder images so selected ones are always at the beginning in selection order
    const sortedImages = useMemo(() => {
        if (selected.length === 0 || eventImages.length === 0) return eventImages;
        
        const selectedFileNames = selected.map((p) => p.split("/").pop()).filter(Boolean);
        const front = selectedFileNames.filter((fn) => eventImages.includes(fn));
        const rest = eventImages.filter((img) => !selectedFileNames.includes(img));
        
        return [...front, ...rest];
    }, [selected, eventImages]);

    if (loading && eventImages.length === 0) {
        return (
            <div style={{ height: "100px", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.5 }}>
                 <div className="adminSkeleton" style={{ width: "100%", height: "80px", borderRadius: "10px" }} />
            </div>
        );
    }

    return (
        <>
        <div className="adminImageHint">
            <b>Orientation:</b> Please use <b>horizontal</b> (landscape) images. Avoid <b>vertical</b> (portrait) format.
        </div>

        <div 
            className="adminImageRibbon"
            style={{ 
                display: "flex", 
                gap: "12px", 
                width: "100%",
                overflowX: "auto", 
                padding: "10px 4px",
                WebkitOverflowScrolling: "touch",
                alignItems: "center",
                scrollSnapType: "x mandatory",
                scrollbarWidth: "none", /* Firefox */
                msOverflowStyle: "none",  /* IE/Edge */
            }}
        >
            <style jsx>{`
                .adminImageRibbon::-webkit-scrollbar {
                    display: none; /* Chrome/Safari/Webkit */
                }
                .adminImageItem {
                    width: 84px;
                    height: 84px;
                }
                @media (max-width: 600px) {
                    .adminImageItem {
                        width: calc((100% - 24px) / 2.8); /* Show ~2.8 images */
                        aspect-ratio: 1 / 1;
                        height: auto;
                    }
                }
            `}</style>
            
            {sortedImages.map((img) => {
                const selIdx = getSelectedIndex(img);
                const isSelected = selIdx !== -1;

                return (
                    <button
                        key={img}
                        type="button"
                        className="adminImageItem"
                        onClick={() => handleSelect(img)}
                        style={{
                            padding: 0,
                            border: isSelected ? "3px solid #2563eb" : "1px solid rgba(0,0,0,0.1)",
                            borderRadius: "12px",
                            overflow: "hidden",
                            flexShrink: 0,
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                            backgroundColor: "#fff",
                            position: "relative",
                            outline: "none",
                            scrollSnapAlign: "start",
                            boxShadow: isSelected ? "0 4px 14px rgba(37, 99, 235, 0.25)" : "0 2px 4px rgba(0,0,0,0.05)"
                        }}
                        title={isSelected ? `${img} (Selected #${selIdx + 1} - Click to deselect)` : `${img} (Click to select)`}
                    >
                        <img 
                            src={`/images/events/${img}`} 
                            alt={img} 
                            style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                        />
                        {isSelected && (
                            <div style={{ 
                                position: "absolute", 
                                inset: 0,
                                backgroundColor: "rgba(37, 99, 235, 0.15)",
                                display: "flex", 
                                alignItems: "flex-start", 
                                justifyContent: "flex-end",
                                padding: "6px"
                            }}>
                                <div style={{
                                    backgroundColor: "#2563eb",
                                    color: "#fff",
                                    borderRadius: "50%",
                                    width: "22px",
                                    height: "22px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "12px",
                                    fontWeight: "700",
                                    boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
                                    border: "2px solid #ffffff"
                                }}>
                                    {selIdx + 1}
                                </div>
                            </div>
                        )}
                    </button>
                );
            })}

            {sortedImages.length === 0 && !loading && (
                <div style={{ padding: "20px", color: "#666", fontSize: "12px" }}>
                    No images found in /images/events/
                </div>
            )}
        </div>
        </>
    );
}
