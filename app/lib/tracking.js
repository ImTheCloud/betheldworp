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
const TRACKING_KEYS = ["bethel_vid", "bethel_vid_at", "bethel_geo_last_ok", "bethel_map_geo_asked"];

// Deux durées distinctes, et il ne faut pas les confondre.
//
// L'IDENTIFIANT ne peut pas dépasser 13 mois : c'est lui qui rendrait un
// visiteur traçable dans le temps, et c'est là que porte la protection.
export const ID_RETENTION_DAYS = 396;

// Les DONNÉES qui en découlent peuvent aller jusqu'à 25 mois. Les garder plus
// longtemps que l'identifiant n'affaiblit rien : passé 13 mois, plus aucun
// visiteur n'est rattachable aux anciennes lignes, son identifiant a changé.
export const DATA_RETENTION_DAYS = 760;

const DAY_MS = 24 * 60 * 60 * 1000;

// Vrai si l'identifiant a dépassé sa durée de vie et doit être remplacé.
export function isExpired(createdAtMs) {
    if (!createdAtMs) return true;
    return Date.now() - createdAtMs > ID_RETENTION_DAYS * DAY_MS;
}

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

// Date au-delà de laquelle le document ne doit plus être conservé.
//
// Firestore ne l'exploite plus : les règles TTL ont été retirées, la suppression
// se fait à la main depuis l'onglet Statistiques de l'admin. Ce champ reste le
// critère que ce bouton applique, et la seule trace de l'échéance de chaque
// document — le supprimer rendrait le ménage impossible.
// Date de suppression d'un document. Comptée depuis la collecte, pas depuis
// aujourd'hui : `from` permet de dater correctement un document ancien.
export function expiresAt(from = Date.now()) {
    return new Date(from + DATA_RETENTION_DAYS * DAY_MS);
}
