"use client";

import React from "react";

/**
 * Renders standard pagination controls for admin.
 *
 * @param {number} page - Current page index (0-based)
 * @param {number} totalPages - Total number of pages
 * @param {function} onNext - Callback for next page
 * @param {function} onPrev - Callback for previous page
 * @param {function} onPageSet - (Optional) Callback to set specific page
 */
export default function PaginationControls({ page, totalPages, onNext, onPrev }) {
    if (totalPages <= 1) return null;

    const safePage = Math.min(page, totalPages - 1);

    return (
        <div className="adminPagination">
            <button
                type="button"
                className="adminSmallBtn"
                onClick={onPrev}
                disabled={safePage === 0}
                aria-label="Previous page"
            >
                ◂
            </button>
            <span className="adminPaginationInfo">
                {safePage + 1} / {totalPages}
            </span>
            <button
                type="button"
                className="adminSmallBtn"
                onClick={onNext}
                disabled={safePage >= totalPages - 1}
                aria-label="Next page"
            >
                ▸
            </button>
        </div>
    );
}
