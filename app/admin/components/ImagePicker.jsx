"use client";

import { useEffect, useState } from "react";

export default function ImagePicker({ value, onChange }) {
    const [images, setImages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showPicker, setShowPicker] = useState(false);

    useEffect(() => {
        fetch("/api/events-images")
            .then((res) => res.json())
            .then((data) => {
                if (data.images) setImages(data.images);
                setLoading(false);
            })
            .catch((err) => {
                console.error("Error fetching images:", err);
                setLoading(false);
            });
    }, []);

    const selectedFilename = value?.split("/").pop();

    const handleSelect = (filename) => {
        onChange(`/images/events/${filename}`);
        setShowPicker(false);
    };

    return (
        <div className="image-picker-container" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input
                    className="adminInput"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="/images/events/example.jpg"
                    style={{ flex: 1 }}
                />
                <button
                    type="button"
                    className="adminBtn adminBtn--new"
                    onClick={() => setShowPicker(!showPicker)}
                    style={{ whiteSpace: "nowrap" }}
                >
                    {showPicker ? "Close Gallery" : "Browse Images"}
                </button>
            </div>

            {showPicker && (
                <div
                    className="adminCard"
                    style={{
                        marginTop: "8px",
                        padding: "16px",
                        maxHeight: "400px",
                        overflowY: "auto",
                        background: "#fff",
                        zIndex: 10
                    }}
                >
                    {loading ? (
                        <div className="adminSkeleton" style={{ height: "100px" }} />
                    ) : images.length === 0 ? (
                        <div className="adminEmpty">No images found in /images/events/</div>
                    ) : (
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                            gap: "12px"
                        }}>
                            {images.map((img) => (
                                <div
                                    key={img}
                                    onClick={() => handleSelect(img)}
                                    style={{
                                        cursor: "pointer",
                                        borderRadius: "8px",
                                        overflow: "hidden",
                                        border: selectedFilename === img ? "3px solid #0a2a43" : "1px solid rgba(10, 42, 67, 0.1)",
                                        transition: "all 0.15s ease",
                                        position: "relative",
                                        aspectRatio: "1/1",
                                        background: "#f3f4f6"
                                    }}
                                    title={img}
                                >
                                    <img
                                        src={`/images/events/${img}`}
                                        alt={img}
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "cover",
                                            display: "block"
                                        }}
                                    />
                                    <div style={{
                                        position: "absolute",
                                        bottom: 0,
                                        left: 0,
                                        right: 0,
                                        background: "rgba(0,0,0,0.5)",
                                        color: "#fff",
                                        fontSize: "10px",
                                        padding: "4px",
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        textAlign: "center"
                                    }}>
                                        {img}
                                    </div>
                                    {selectedFilename === img && (
                                        <div style={{
                                            position: "absolute",
                                            top: "4px",
                                            right: "4px",
                                            background: "#0a2a43",
                                            color: "#fff",
                                            borderRadius: "50%",
                                            width: "20px",
                                            height: "20px",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontSize: "12px",
                                            fontWeight: "bold"
                                        }}>
                                            ✓
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
