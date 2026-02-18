"use client";

import React from "react";

/**
 * 7 is a good number because:
 * 1 ... 4 5 6 ... 10  (current=5, total=10)
 * 1 2 3 4 5 ... 10    (current=1, total=10)
 * 1 ... 6 7 8 9 10    (current=9, total=10)
 */
export default function PaginationControls({ page, totalPages, onNext, onPrev, onPageSet }) {
    if (totalPages <= 1) return null;

    // page is 0-indexed for logic, but we display 1-indexed
    const current = Math.min(page, totalPages - 1);

    const go = (p) => {
        if (onPageSet) onPageSet(p);
    };

    const renderPageBtn = (p, label = null) => {
        const isCurrent = p === current;
        return (
            <button
                key={p}
                type="button"
                className={`adminPageBtn ${isCurrent ? "is-active" : ""}`}
                onClick={() => go(p)}
                aria-current={isCurrent ? "page" : undefined}
            >
                {label || p + 1}
            </button>
        );
    };

    const renderEllipsis = (key) => (
        <span key={key} className="adminPageEllipsis">
            …
        </span>
    );

    let items = [];

    if (totalPages <= 7) {
        // Show all
        for (let i = 0; i < totalPages; i++) {
            items.push(renderPageBtn(i));
        }
    } else {
        // Complex logic
        const start = 0;
        const end = totalPages - 1;
        const width = 1; // neighbors on each side of current

        let left = Math.max(0, current - width);
        let right = Math.min(totalPages - 1, current + width);

        // Adjust if close to ends
        if (current <= 2) right = Math.max(right, 4); // ensures 1 2 3 4 5 ... 10
        if (current >= totalPages - 3) left = Math.min(left, totalPages - 5);

        // Always show first
        items.push(renderPageBtn(0));

        if (left > 1) items.push(renderEllipsis("el-1"));

        for (let i = Math.max(1, left); i <= Math.min(totalPages - 2, right); i++) {
            items.push(renderPageBtn(i));
        }

        if (right < totalPages - 2) items.push(renderEllipsis("el-2"));

        // Always show last
        items.push(renderPageBtn(totalPages - 1));
    }

    return (
        <div className="adminPagination">
            <button
                type="button"
                className="adminPageNav"
                onClick={onPrev}
                disabled={current === 0}
                aria-label="Previous page"
            >
                Prev
            </button>

            <div className="adminPageList">{items}</div>

            <button
                type="button"
                className="adminPageNav"
                onClick={onNext}
                disabled={current >= totalPages - 1}
                aria-label="Next page"
            >
                Next
            </button>
        </div>
    );
}

