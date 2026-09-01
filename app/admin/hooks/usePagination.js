import { useState, useMemo } from "react";

/**
 * Pagination d'une liste de l'admin.
 *
 * @param {Array} items - la liste complète à paginer
 * @param {number} pageSize - nombre d'éléments par page (10 par défaut)
 */
export function usePagination(items = [], pageSize = 10) {
    const [pageDemandee, setPageDemandee] = useState(0);

    const totalItems = items.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    // La page est ramenée dans les bornes pendant le rendu, et non par un effet
    // qui appelait setPage après coup.
    //
    // L'ancienne version redessinait deux fois chaque liste de l'admin dès que le
    // nombre d'éléments changeait : un premier rendu sur une page hors bornes —
    // donc vide — puis un second une fois la page corrigée. Supprimer un élément
    // sur la dernière page faisait ainsi clignoter la liste.
    const page = Math.min(Math.max(0, pageDemandee), totalPages - 1);

    const paginatedItems = useMemo(() => {
        const start = page * pageSize;
        return items.slice(start, start + pageSize);
    }, [items, page, pageSize]);

    const nextPage = () => setPageDemandee(Math.min(totalPages - 1, page + 1));
    const prevPage = () => setPageDemandee(Math.max(0, page - 1));
    const resetPage = () => setPageDemandee(0);

    // Rang du premier et du dernier élément affichés, pour le libellé
    // « 1-10 sur 34 ». Sur une liste vide, il n'y a pas de premier élément.
    const firstItemIndex = totalItems === 0 ? 0 : page * pageSize + 1;
    const lastItemIndex = Math.min((page + 1) * pageSize, totalItems);

    return {
        page,
        setPage: setPageDemandee,
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
