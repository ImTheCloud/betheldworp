import { useState, useMemo, useEffect } from "react";

/**
 * Custom hook to manage pagination for a list of items.
 *
 * @param {Array} items - The full list of items to paginate.
 * @param {number} pageSize - Number of items per page (default: 10).
 * @returns {object} - { page, setPage, totalPages, paginatedItems, nextPage, prevPage, resetPage, firstItemIndex, lastItemIndex, totalItems }
 */
export function usePagination(items = [], pageSize = 10) {
    const [page, setPage] = useState(0);

    const totalItems = items.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    // Ensure current page is valid when items change
    useEffect(() => {
        if (page >= totalPages) {
            setPage(Math.max(0, totalPages - 1));
        }
    }, [totalItems, totalPages, page]);

    const paginatedItems = useMemo(() => {
        const start = page * pageSize;
        return items.slice(start, start + pageSize);
    }, [items, page, pageSize]);

    const nextPage = () => setPage((p) => Math.min(totalPages - 1, p + 1));
    const prevPage = () => setPage((p) => Math.max(0, p - 1));
    const resetPage = () => setPage(0);

    const firstItemIndex = page * pageSize + 1;
    const lastItemIndex = Math.min((page + 1) * pageSize, totalItems);

    return {
        page,
        setPage,
        totalPages,
        paginatedItems,
        nextPage,
        prevPage,
        resetPage,
        firstItemIndex,
        lastItemIndex,
        totalItems,
    };
}
