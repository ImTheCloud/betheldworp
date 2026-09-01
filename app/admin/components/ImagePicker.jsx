"use client";

import React, { useMemo, useState, useEffect } from "react";

/**
 * ImagePicker, Dynamic Responsive Gallery.
 * Fetches available images from /api/list-event-images.
 * Clicking a selected image deselects it.
 */
export default function ImagePicker({ value, onChange }) {
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

    const handleSelect = (img) => {
        const newPath = `/images/events/${img}`;
        if (value === newPath) {
            onChange(""); // Deselect
        } else {
            onChange(newPath); // Select
        }
    };

    const isSelected = (img) => value === `/images/events/${img}`;

    // Reorder images so the selected one is always at the beginning
    const sortedImages = useMemo(() => {
        if (!value || eventImages.length === 0) return eventImages;
        
        const currentName = value.split("/").pop();
        const found = eventImages.find(img => img === currentName);
        
        if (!found) return eventImages; 

        const rest = eventImages.filter(img => img !== currentName);
        return [found, ...rest];
    }, [value, eventImages]);

    if (loading && eventImages.length === 0) {
        return (
            <div style={{ height: "100px", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.5 }}>
                 <div className="adminSkeleton" style={{ width: "100%", height: "80px", borderRadius: "10px" }} />
            </div>
        );
    }

    return (
        <>
        {/* Les mêmes images servent à deux endroits très différents : une case
            de calendrier, carrée sur téléphone, et la grande image d'un
            événement ouvert, large de 980 px au plus. Les deux recadrent en
            « cover », d'où le conseil de garder le sujet au centre et un peu
            vers le haut. */}
        <div className="adminImageHint">
            <b>Format conseillé : 1600 × 900 px, horizontal (16:9).</b>
            {" "}Sur téléphone, la case du calendrier est carrée et rogne les côtés :
            garde le sujet au centre, légèrement vers le haut. Le poids du fichier
            n&apos;a pas d&apos;importance, le site le réduit tout seul.
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
                    width: 80px;
                    height: 80px;
                }
                @media (max-width: 600px) {
                    .adminImageItem {
                        width: calc((100% - 24px) / 2.8); /* Show ~2.8 images */
                        aspect-ratio: 1 / 1;
                        height: auto;
                    }
                }
            `}</style>
            
            {sortedImages.map((img) => (
                <button
                    key={img}
                    type="button"
                    className="adminImageItem"
                    onClick={() => handleSelect(img)}
                    style={{
                        padding: 0,
                        border: isSelected(img) ? "4px solid #2563eb" : "1px solid rgba(0,0,0,0.1)",
                        borderRadius: "12px",
                        overflow: "hidden",
                        flexShrink: 0,
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        backgroundColor: "#fff",
                        position: "relative",
                        outline: "none",
                        scrollSnapAlign: "start",
                        boxShadow: isSelected(img) ? "0 4px 12px rgba(37, 99, 235, 0.2)" : "0 2px 4px rgba(0,0,0,0.05)"
                    }}
                    title={img}
                >
                    <img 
                        src={`/images/events/${img}`} 
                        alt={img} 
                        style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                    />
                    {isSelected(img) && (
                        <div style={{ 
                            position: "absolute", 
                            inset: 0,
                            backgroundColor: "rgba(37, 99, 235, 0.15)",
                            display: "flex", 
                            alignItems: "center", 
                            justifyContent: "center" 
                        }}>
                            <div style={{
                                backgroundColor: "#2563eb",
                                borderRadius: "50%",
                                width: "24px",
                                height: "24px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                boxShadow: "0 2px 6px rgba(0,0,0,0.3)"
                            }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"><path d="M20 6L9 17l-5-5" /></svg>
                            </div>
                        </div>
                    )}
                </button>
            ))}

            {sortedImages.length === 0 && !loading && (
                <div style={{ padding: "20px", color: "#666", fontSize: "12px" }}>
                    No images found in /images/events/
                </div>
            )}
        </div>
    </>
    );
}
