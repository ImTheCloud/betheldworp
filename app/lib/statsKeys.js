// Forme canonique des clés de compteurs.
//
// Partagé entre le compteur, qui écrit ces clés, et la page Statistiques, qui
// les relit. Les deux DOIVENT produire exactement la même chaîne, sinon
// « Brussels » et « brussels » compteraient séparément et les totaux
// divergeraient sans que rien ne le signale.
//
// Les clés servent aussi de noms de champs Firestore : d'où le remplacement des
// points et des barres obliques, qui ont un sens particulier dans un chemin de
// champ.

const s = (v) => String(v ?? "");

export function sanitizeKey(v) {
    return (
        s(v)
            .trim()
            .toLowerCase()
            .replace(/\./g, "_")
            .replace(/\//g, "_")
            .replace(/\s+/g, "_")
            .replace(/__+/g, "_")
            .slice(0, 80) || "unknown"
    );
}

// La ville seule ne suffit pas : il existe un Springfield dans plusieurs pays.
// Le pays est donc préfixé, et l'affichage sait défaire ce couple.
export function makeCityKey(country, city) {
    return `${sanitizeKey(country)}__${sanitizeKey(city)}`;
}

export function normalizeLang(v) {
    const base = s(v).toLowerCase().split("-")[0] || "unknown";
    return (base || "unknown").slice(0, 16);
}

export function normalizeDevice(v) {
    const x = s(v).toLowerCase();
    if (x === "mobile" || x === "desktop") return x;
    return "unknown";
}

export function unsanitizeKey(str) {
    return s(str)
        .split("_")
        .map((x) => (x ? x.charAt(0).toUpperCase() + x.slice(1) : ""))
        .join(" ");
}

export function cityLabelWithCountry(k) {
    const parts = s(k).split("__");
    const pays = parts[0] || "unknown";
    const ville = parts[1] ? parts[1] : parts[0] || "unknown";
    return `${unsanitizeKey(ville)}, ${unsanitizeKey(pays)}`;
}
