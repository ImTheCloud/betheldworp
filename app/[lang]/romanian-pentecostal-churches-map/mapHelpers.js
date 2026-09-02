// Aides de la carte des eglises : normalisation de texte, recherche, distances.
//
// Aucune ne touche a React, a Google Maps ni au reseau. Extraites de
// ChurchMap.jsx pour que leur comportement soit lisible sans traverser le
// composant.

/**
 * Ensures a link is treated as an external URL by prepending https:// if no protocol is present.
 */
export const ensureExternalLink = (url) => {
    if (!url) return "";
    const trimmed = String(url).trim();
    if (!trimmed) return "";
    if (/^(https?:\/\/|mailto:|tel:)/i.test(trimmed)) {
        return trimmed;
    }
    return `https://${trimmed}`;
};

/**
 * Normalizes text for search by removing accents and converting to lowercase.
 */
export const normalizeText = (text) => {
    return (text || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
};

export const matchChurchSearch = (c, q) => {
    if (!q) return true;
    const normalizedQuery = normalizeText(q);
    const fields = [c.name, c.city];
    return fields.some(val => normalizeText(val).includes(normalizedQuery));
};
export const formatCasing = (s) => {
    if (!s) return "";
    const str = String(s).trim();
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

export function haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

export function formatDistance(km) {
    if (km < 1) return `${Math.round(km * 1000)} m`;
    if (km < 10) return `${km.toFixed(1)} km`;
    return `${Math.round(km)} km`;
}
