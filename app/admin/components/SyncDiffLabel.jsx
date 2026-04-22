"use client";

import React from "react";
import { IconSync } from "./ChurchIcons";

export const SyncDiffLabel = ({ field, syncedFields, onRestore, showPreview }) => {
    if (!syncedFields || !syncedFields[field]) return null;
    const { old } = syncedFields[field];
    
    return (
        <div className="adminSyncDiffWrapper">
            <span className="adminSyncDiffLabelText" title="Old value">
                {old || "(empty)"}
            </span>
            <div className="adminSyncDiffActions">
                {showPreview && old && <PreviewLinkButton url={old} />}
                <button 
                    type="button" 
                    className="adminSyncRestoreBtn" 
                    title="Restore old value"
                    onClick={(e) => { 
                        e.preventDefault(); 
                        if (onRestore) onRestore(field, old || ""); 
                    }}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                    </svg>
                </button>
            </div>
        </div>
    );
};





export const PreviewLinkButton = ({ url }) => {
    if (!url) return null;
    
    // Normalize URL
    let formattedUrl = url.trim();
    if (formattedUrl && !formattedUrl.startsWith("http")) {
        formattedUrl = `https://${formattedUrl}`;
    }

    return (
        <a 
            href={formattedUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="adminLinkPreviewBtn"
            title="Open Link"
            onClick={(e) => e.stopPropagation()}
        >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
        </a>
    );
};

export const GoogleSearchButton = ({ query }) => {
    if (!query) return null;
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

    return (
        <a 
            href={url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="adminLinkSearchBtn"
            title="Search on Google"
            onClick={(e) => e.stopPropagation()}
        >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
        </a>
    );
};

export const PlaceSearchButton = ({ onClick, loading, title = "Find Place ID" }) => {
    return (
        <button 
            type="button"
            className={`adminLinkSearchBtn ${loading ? "is-spinning" : ""}`}
            title={title}
            disabled={loading}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (onClick) onClick(); }}
            style={{ border: "none", background: "transparent", padding: 0 }}
        >
            {loading ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
            ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
            )}
        </button>
    );
};

