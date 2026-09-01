// Mesure d'audience : ce qu'on compte, et ce qu'on ne garde surtout pas.
//
// Le site n'enregistre que des compteurs journaliers : un document par jour,
// contenant des nombres. Aucune ligne par visite, aucun identifiant de
// visiteur, aucune coordonnée. Il est donc impossible de savoir qui est venu,
// ni de relier deux visites entre elles, même pour nous.
//
// C'est ce qui rend ces données anonymes plutôt que personnelles, et c'est le
// même principe que Vercel Analytics : pas de consentement à demander, pas de
// durée de conservation à tenir, rien à supprimer un jour.
//
// Le seul repère laissé dans le navigateur est un drapeau « déjà compté
// aujourd'hui ». Ce n'est pas un identifiant : il ne distingue pas les
// visiteurs entre eux, il empêche seulement de compter deux fois la même
// personne dans la journée.

const OPT_OUT_KEY = "bethel_no_track";

// Clés posées par le compteur, effacées lorsque le visiteur s'oppose.
const TRACKING_KEYS = ["bethel_geo_last_ok", "bethel_map_geo_asked"];

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
            .filter((k) => k.startsWith("bethel_visit_") || k.startsWith("bethel_map_visit_"))
            .forEach((k) => window.localStorage.removeItem(k));
    } catch { }
}

export function optIn() {
    try {
        window.localStorage.removeItem(OPT_OUT_KEY);
    } catch { }
}
