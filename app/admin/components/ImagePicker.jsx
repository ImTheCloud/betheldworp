"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { storage } from "../../lib/Firebase";
import { ref, uploadBytes, getDownloadURL, listAll, deleteObject } from "firebase/storage";
import ConfirmModal from "./ConfirmModal";

export default function ImagePicker({ value, onChange }) {
    const [images, setImages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [lightboxUrl, setLightboxUrl] = useState(null);
    const [imageToDelete, setImageToDelete] = useState(null);
    const fileInputRef = useRef(null);

    const fetchImages = async () => {
        setLoading(true);
        try {
            const listRef = ref(storage, "events/");
            const res = await listAll(listRef);
            const items = await Promise.all(
                res.items.map(async (item) => {
                    const url = await getDownloadURL(item);
                    return { name: item.name, url };
                })
            );
            // Sort by name (most recent first)
            items.sort((a, b) => b.name.localeCompare(a.name));
            setImages(items);
        } catch (err) {
            console.error("Error fetching images from storage:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchImages();
    }, []);

    const compressImage = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement("canvas");
                    let width = img.width;
                    let height = img.height;
                    const maxSize = 1200;

                    if (width > height) {
                        if (width > maxSize) {
                            height *= maxSize / width;
                            width = maxSize;
                        }
                    } else {
                        if (height > maxSize) {
                            width *= maxSize / height;
                            height = maxSize;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0, width, height);

                    canvas.toBlob(
                        (blob) => {
                            resolve(blob);
                        },
                        "image/jpeg",
                        0.7
                    );
                };
                img.onerror = (err) => reject(err);
            };
            reader.onerror = (err) => reject(err);
        });
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Max 5MB limit check
        if (file.size > 5 * 1024 * 1024) {
            alert("File too large. Please select an image under 5MB.");
            return;
        }

        setUploading(true);
        try {
            // Compress image before upload
            const compressedBlob = await compressImage(file);
            
            const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, "_").split('.')[0] + ".jpg";
            const storageRef = ref(storage, `events/${Date.now()}_${cleanName}`);
            
            await uploadBytes(storageRef, compressedBlob);
            const url = await getDownloadURL(storageRef);
            onChange(url);
            await fetchImages();
        } catch (err) {
            console.error("Upload failed:", err);
            alert("L'upload ou la compression de l'image a échoué.");
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleDelete = async () => {
        if (!imageToDelete) return;

        try {
            const storageRef = ref(storage, `events/${imageToDelete.name}`);
            await deleteObject(storageRef);
            
            // If the deleted image was selected, clear it
            if (value === imageToDelete.url) {
                onChange("");
            }
            
            await fetchImages();
            setImageToDelete(null);
        } catch (err) {
            console.error("Delete failed:", err);
            alert("Erreur lors de la suppression de l'image.");
        }
    };

    const displayImages = useMemo(() => {
        if (!value) return images;
        const selected = images.find(img => img.url === value);
        const others = images.filter(img => img.url !== value);
        return selected ? [selected, ...others] : images;
    }, [images, value]);

    return (
        <div className="image-picker-ribbon" style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%" }}>
            <div style={{ 
                display: "flex", 
                gap: "12px", 
                alignItems: "center",
                background: "#f9fafb",
                padding: "8px",
                borderRadius: "16px",
                border: "1px solid rgba(10, 42, 67, 0.05)",
                overflow: "hidden"
            }}>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    accept="image/*" 
                    style={{ display: "none" }}
                />

                {/* Main Selected Image Slot */}
                <div style={{ flexShrink: 0 }}>
                    <div 
                        style={{ 
                            width: "100px", 
                            height: "100px", 
                            borderRadius: "12px", 
                            overflow: "hidden",
                            position: "relative",
                            background: "#fff",
                            boxShadow: value ? "0 4px 10px rgba(10, 42, 67, 0.1)" : "none",
                            border: value ? "2px solid #0a2a43" : "2px dashed rgba(10, 42, 67, 0.15)",
                            cursor: "pointer",
                            transition: "all 0.2s ease"
                        }}
                        onClick={() => {
                            if (value) {
                                setLightboxUrl(value); // Open lightbox
                            } else {
                                fileInputRef.current?.click();
                            }
                        }}
                    >
                        {value ? (
                            <img 
                                src={value} 
                                alt="Selected" 
                                style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                            />
                        ) : (
                            <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "rgba(10, 42, 67, 0.3)" }}>
                                {uploading ? (
                                    <div className="adminSpinner" style={{ width: "20px", height: "20px" }} />
                                ) : (
                                    <>
                                        <IconPlus size={24} />
                                        <span style={{ fontSize: "9px", marginTop: "4px", fontWeight: "600" }}>Upload</span>
                                    </>
                                )}
                            </div>
                        )}
                        
                        {/* Clear Selection (X) */}
                        {value && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onChange("");
                                }}
                                style={{
                                    position: "absolute",
                                    top: "4px",
                                    right: "4px",
                                    background: "rgba(0,0,0,0.6)",
                                    color: "#fff",
                                    width: "18px",
                                    height: "18px",
                                    borderRadius: "50%",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "12px",
                                    border: "none",
                                    cursor: "pointer",
                                    zIndex: 5
                                }}
                                title="Clear selection"
                            >
                                ×
                            </button>
                        )}
                    </div>
                </div>

                {/* Vertical Divider */}
                <div style={{ width: "1px", height: "60px", background: "rgba(10, 42, 67, 0.05)", flexShrink: 0 }} />

                {/* Ribbon Strip */}
                <style dangerouslySetInnerHTML={{ __html: `
                    .ribbon-container {
                        display: flex;
                        gap: 10px;
                        overflow-x: auto;
                        padding: 4px;
                        flex: 1;
                        scrollbar-width: none;
                        -ms-overflow-style: none;
                    }
                    .ribbon-container::-webkit-scrollbar { display: none; }
                    .ribbon-item {
                        width: 100px;
                        height: 100px;
                        flex-shrink: 0;
                        border-radius: 10px;
                        overflow: hidden;
                        cursor: pointer;
                        background: #fff;
                        border: 2px solid transparent;
                        position: relative;
                        transition: all 0.2s ease;
                    }
                    @media (max-width: 600px) {
                        .ribbon-item {
                            width: calc((100% - 10px) / 2); /* Show 2 items roughly */
                            max-width: 80px;
                        }
                    }
                `}} />
                
                <div className="ribbon-container adminCustomScroll">
                    {loading ? (
                        [1,2,3].map(i => (
                            <div key={i} className="adminSkeleton ribbon-item" />
                        ))
                    ) : (
                        images.filter(img => img.url !== value).map((img) => (
                            <div
                                key={img.url}
                                onClick={(e) => { e.stopPropagation(); onChange(img.url); }}
                                className="ribbon-item"
                                onMouseEnter={(e) => e.currentTarget.style.borderColor = "rgba(10, 42, 67, 0.1)"}
                                onMouseLeave={(e) => e.currentTarget.style.borderColor = "transparent"}
                            >
                                <img
                                    src={img.url}
                                    alt={img.name}
                                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                />
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setImageToDelete(img);
                                    }}
                                    style={{
                                        position: "absolute",
                                        top: "4px",
                                        right: "4px",
                                        background: "#dc2626",
                                        color: "#ffffff",
                                        width: "22px",
                                        height: "22px",
                                        borderRadius: "6px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        border: "none",
                                        cursor: "pointer",
                                        zIndex: 10,
                                        transition: "all 0.2s ease",
                                        boxShadow: "0 2px 6px rgba(0,0,0,0.15)"
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = "scale(1.1)";
                                        e.currentTarget.style.background = "#ef4444";
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = "scale(1)";
                                        e.currentTarget.style.background = "#dc2626";
                                    }}
                                    title="Delete image"
                                >
                                    <IconTrash size={12} />
                                </button>
                            </div>
                        ))
                    )}

                    {/* Add New Button Card (at the end) */}
                    <div 
                        onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                        className="ribbon-item"
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            border: "2px dashed rgba(10, 42, 67, 0.1)",
                            color: "rgba(10, 42, 67, 0.6)"
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = "#0a2a43"}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = "rgba(10, 42, 67, 0.1)"}
                    >
                        {uploading ? (
                            <div className="adminSpinner" style={{ width: "20px", height: "20px" }} />
                        ) : (
                            <>
                                <IconPlus size={24} />
                                <span style={{ fontSize: "9px", marginTop: "4px", fontWeight: "600" }}>Upload</span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Lightbox Overlay */}
            {lightboxUrl && (
                <div 
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0,0,0,0.85)",
                        backdropFilter: "blur(4px)",
                        zIndex: 9999,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "20px",
                        cursor: "zoom-out"
                    }}
                    onClick={() => setLightboxUrl(null)}
                >
                    <div style={{ position: "relative", maxWidth: "90%", maxHeight: "90%" }}>
                        <img 
                            src={lightboxUrl} 
                            alt="Full size" 
                            style={{ 
                                display: "block", 
                                maxWidth: "100%", 
                                maxHeight: "85vh", 
                                borderRadius: "12px",
                                boxShadow: "0 20px 50px rgba(0,0,0,0.5)"
                            }} 
                        />
                        <button
                            onClick={(e) => { e.stopPropagation(); setLightboxUrl(null); }}
                            style={{
                                position: "absolute",
                                top: "-40px",
                                right: "-10px",
                                background: "none",
                                border: "none",
                                color: "#fff",
                                fontSize: "32px",
                                cursor: "pointer",
                                padding: "10px"
                            }}
                        >
                            ×
                        </button>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            <ConfirmModal
                isOpen={!!imageToDelete}
                title="Delete image"
                message="This action is permanent and cannot be undone."
                confirmText="Delete"
                cancelText="Cancel"
                onConfirm={handleDelete}
                onCancel={() => setImageToDelete(null)}
                variant="danger"
            />
        </div>
    );
}

function IconPlus({ size = 20 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
    );
}

function IconTrash({ size = 20 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
    );
}

function IconPhoto({ size = 20 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
        </svg>
    );
}
