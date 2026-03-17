"use client";

import React from "react";

function IconSearch(props) {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
            <path d="M21 21l-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function IconX(props) {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

/**
 * A shared search component for the Admin panel.
 * It includes a search icon and a clear (X) button that appears when typing.
 */
export default function AdminSearch({ value, onChange, placeholder = "Search...", className = "" }) {
    return (
        <div className={`adminSearchWrapper ${className}`}>
            <input
                type="text"
                className="adminSearchInput"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
            {value ? (
                <button
                    type="button"
                    className="adminSearchClear"
                    onClick={() => onChange("")}
                    aria-label="Clear search"
                >
                    <IconX />
                </button>
            ) : (
                <IconSearch className="adminSearchIcon" />
            )}
        </div>
    );
}
