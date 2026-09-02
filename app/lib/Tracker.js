import { doc, setDoc, increment } from "firebase/firestore";
import { db } from "./Firebase";
import { isOptedOut } from "./tracking";
import { sanitizeKey, makeCityKey, normalizeLang, normalizeDevice } from "./statsKeys";

// Outils du compteur de visites.
//
// Il n'y a plus d'identifiant de visiteur : le site ne compte que des totaux
// journaliers. Ce fichier ne fabrique donc plus rien qui permette de
// reconnaître quelqu'un d'une visite à l'autre.

export function pad2(n) {
    return String(n).padStart(2, "0");
}

// Le jour au format AAAA-MM-JJ, à l'heure de Bruxelles. Ce format se trie tout
// seul, ce que l'ancien JJ-MM-AAAA ne permettait pas.
export function brusselsDayKey() {
    try {
        const parts = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Europe/Brussels",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).formatToParts(new Date());
        const get = (t) => parts.find((p) => p.type === t)?.value;
        return `${get("year")}-${get("month")}-${get("day")}`;
    } catch {
        const d = new Date();
        return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    }
}

// La semaine ISO au format AAAA-Wnn, deduite du jour deja calcule a l'heure de
// Bruxelles. Meme decoupage que le programme hebdomadaire : la semaine commence
// le lundi, et c'est le jeudi qui decide de l'annee, ce qui evite qu'une semaine
// a cheval sur deux annees soit comptee deux fois.
export function brusselsWeekKey(jour = brusselsDayKey()) {
    const [annee, mois, quantieme] = String(jour).split("-").map(Number);
    const date = new Date(Date.UTC(annee, mois - 1, quantieme));
    const jourSemaine = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - jourSemaine);
    const anneeISO = date.getUTCFullYear();
    const debut = new Date(Date.UTC(anneeISO, 0, 1));
    const numero = Math.ceil(((date - debut) / 86400000 + 1) / 7);
    return `${anneeISO}-W${String(numero).padStart(2, "0")}`;
}

export function deviceTypeSafe() {
    try {
        return (window.innerWidth || 0) <= 768 ? "mobile" : "desktop";
    } catch {
        return "unknown";
    }
}

export function normalizeTrackerLang(code) {
    const base = String(code || "ro").trim().toLowerCase().split("-")[0];
    return base.slice(0, 16) || "ro";
}

export function getBrowserLanguageSafe() {
    try {
        const premier =
            (Array.isArray(navigator.languages) && navigator.languages[0]) ||
            navigator.language ||
            "ro";
        return normalizeTrackerLang(premier);
    } catch {
        return "ro";
    }
}

export function safeStorageGet(key) {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

export function safeStorageSet(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch { }
}

// Pays et ville, résolus sur notre serveur à partir des en-têtes que Vercel
// ajoute depuis son réseau de périphérie. L'adresse IP ne quitte pas
// l'infrastructure et n'est stockée nulle part.
//
// Le résultat est mémorisé pour la session : la géolocalisation d'un visiteur
// ne change pas entre deux pages, autant ne pas redemander.
export async function getGeoSafe(delaiMs = 900) {
    const cache = safeStorageGet("bethel_geo_last_ok");
    let dernier = null;
    try { if (cache) dernier = JSON.parse(cache); } catch { }

    const attente = new Promise((r) => setTimeout(() => r(null), delaiMs));
    const requete = (async () => {
        try {
            const res = await fetch("/api/geoip", { cache: "no-store" });
            if (!res.ok) return null;
            const d = await res.json();
            return {
                country: String(d?.country || "").slice(0, 60) || "Unknown",
                city: String(d?.city || "").slice(0, 60) || "Unknown",
            };
        } catch {
            return null;
        }
    })();

    const geo = await Promise.race([requete, attente]);
    if (geo) {
        safeStorageSet("bethel_geo_last_ok", JSON.stringify(geo));
        return geo;
    }
    return dernier || { country: "Unknown", city: "Unknown" };
}

// Visite de la carte des églises : deux compteurs de plus dans le document du
// jour. geoStatus dit combien de visiteurs ont autorisé la géolocalisation :
// c'est un nombre, jamais une position.
export async function trackWorldMapVisit(geoStatus = "initial") {
    // Verrou placé ici plutôt qu'aux appels de la carte : aucun appel, présent
    // ou futur, ne peut contourner l'opposition du visiteur.
    if (isOptedOut()) return;

    try {
        const jour = brusselsDayKey();
        const dejaCompte = `bethel_map_visit_${jour}`;
        const dejaVu = safeStorageGet(dejaCompte);

        // Un visiteur est compté une fois par jour sur la carte. Mais s'il
        // autorise la géolocalisation après coup, ce changement mérite d'être
        // compté : on met alors à jour le statut sans recompter la visite.
        if (dejaVu === geoStatus) return;

        const geo = await getGeoSafe();
        await setDoc(
            doc(db, "stats_daily", jour),
            {
                day: jour,
                mapVisits: increment(dejaVu ? 0 : 1),
                mapCountries: { [sanitizeKey(geo.country)]: increment(dejaVu ? 0 : 1) },
                mapCities: { [makeCityKey(geo.country, geo.city)]: increment(dejaVu ? 0 : 1) },
                mapDevices: { [normalizeDevice(deviceTypeSafe())]: increment(dejaVu ? 0 : 1) },
                mapLanguages: { [normalizeLang(getBrowserLanguageSafe())]: increment(dejaVu ? 0 : 1) },
                mapGeo: { [sanitizeKey(geoStatus)]: increment(1) },
            },
            { merge: true }
        );

        safeStorageSet(dejaCompte, geoStatus);
    } catch (e) {
        console.error("Comptage de la carte impossible :", e);
    }
}
