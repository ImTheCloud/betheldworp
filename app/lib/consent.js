// Consentement au suivi de visite.
//
// Le site dépose un identifiant de visiteur dans le navigateur et enregistre
// pays, ville, appareil et langue. C'est un traitement de données personnelles :
// il ne doit démarrer qu'après un choix explicite du visiteur.
//
// Le choix est conservé dans le navigateur, jamais transmis.

export const CONSENT_KEY = "bethel_consent";
export const CONSENT_EVENT = "bethel:consent";

export const GRANTED = "granted";
export const DENIED = "denied";

// null = le visiteur n'a pas encore choisi, la bannière doit s'afficher.
export function readConsent() {
    if (typeof window === "undefined") return null;
    try {
        const v = window.localStorage.getItem(CONSENT_KEY);
        return v === GRANTED || v === DENIED ? v : null;
    } catch {
        // Navigation privée ou stockage bloqué : on considère qu'il n'y a pas
        // de consentement, donc pas de suivi.
        return null;
    }
}

export function hasConsent() {
    return readConsent() === GRANTED;
}

export function writeConsent(value) {
    try {
        window.localStorage.setItem(CONSENT_KEY, value);
    } catch {
        // Sans stockage, la bannière réapparaîtra : c'est le comportement sûr.
    }
    // Prévient les composants déjà montés, sans recharger la page.
    try {
        window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }));
    } catch { }
}
