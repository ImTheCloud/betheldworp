"use client";

import React from "react";
import { IconSync } from "./ChurchIcons";

export const SyncDiffLabel = ({ field, syncedFields, onRestore }) => {
    if (!syncedFields || !syncedFields[field]) return null;
    const { old } = syncedFields[field];
    return (
        <span 
            className="adminSyncDiffLabel" 
            title="Cliquez pour annuler ce changement et restaurer l'ancienne valeur"
            onClick={(e) => { e.preventDefault(); if (onRestore) onRestore(field, old || ""); }}
            style={{ cursor: onRestore ? "pointer" : "default", textTransform: "none" }}
        >
            <span className="adminSyncDiffLabelText">{old || "(vide)"}</span>
        </span>
    );
};

export const SyncableIcon = () => (
    <span title="Synchronisable avec Google" style={{ 
        display: "inline-flex", 
        alignItems: "center", 
        justifyContent: "center",
        width: "18px",
        height: "18px",
        marginLeft: "8px",
        borderRadius: "4px",
        background: "transparent",
        color: "#2563eb",
        cursor: "help"
    }}>
        <IconSync style={{ width: 10, height: 10 }} />
    </span>
);

export const GoogleSearchButton = ({ query, label }) => {
    if (!query) return null;
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query + " " + label)}`;
    return (
        <a 
            href={searchUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="adminGoogleSearchBtn"
            title={`Search ${label} on Google`}
            onClick={(e) => e.stopPropagation()}
        >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
        </a>
    );
};

export const PhotoLightbox = ({ url, onClose }) => {
    if (!url) return null;
    return (
        <div className="adminLightbox" onClick={onClose}>
            <img src={url} alt="Enlarged view" className="adminLightboxImage" onClick={(e) => e.stopPropagation()} />
        </div>
    );
};
