// Mesure d'audience : droit d'opposition et durée de conservation.
//
// Le suivi démarre sans demander de consentement, ce qui n'est permis que si la
// mesure reste strictement limitée à notre propre audience : aucune
// transmission à un tiers, aucun suivi sur d'autres sites, aucun croisement
// avec d'autres traitements, information du visiteur, possibilité de refuser,
// et conservation bornée.
//
// Ce fichier porte les deux dernières conditions ; les autres sont assurées par
// la conception du suivi lui-même (identifiant local au domaine, géolocalisation
// résolue sur notre serveur, données stockées dans notre seule base).

const OPT_OUT_KEY = "bethel_no_track";

// Clés déposées par le suivi, effacées lorsque le visiteur s'oppose : garder
// son identifiant alors qu'il refuse d'être compté n'aurait aucun sens.
const TRACKING_KEYS = ["bethel_vid", "bethel_geo_last_ok", "bethel_map_geo_asked"];

// 13 mois, la durée maximale admise pour un identifiant de mesure d'audience.
const RETENTION_DAYS = 396;

export function isOptedOut() {
    if (typeof window === "undefined") return false;
    try {
        return window.localStorage.getItem(OPT_OUT_KEY) === "1";
    } catch {
        return false;
    }
}

export function optOut() {
    try {
        window.localStorage.setItem(OPT_OUT_KEY, "1");
        TRACKING_KEYS.forEach((k) => window.localStorage.removeItem(k));
        Object.keys(window.localStorage)
            .filter((k) => k.startsWith("bethel_visit_"))
            .forEach((k) => window.localStorage.removeItem(k));
    } catch { }
}

export function optIn() {
    try {
        window.localStorage.removeItem(OPT_OUT_KEY);
    } catch { }
}

// Date au-delà de laquelle Firestore supprime automatiquement le document,
// via la règle TTL configurée sur chaque collection de suivi.
export function expiresAt() {
    return new Date(Date.now() + RETENTION_DAYS * 24 * 60 * 60 * 1000);
}
