// Validation et normalisation d'adresses email, partagées par le site public,
// le panneau admin et les routes API.
//
// L'expression est volontairement permissive. Les expressions strictes rejettent
// des adresses pourtant valides (apostrophes, extensions récentes, domaines
// longs) : mieux vaut accepter et laisser l'envoi réel faire foi que refuser
// à tort un abonné.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value) {
    return EMAIL.test(String(value ?? "").trim());
}

// Forme canonique d'une adresse : c'est elle qui sert d'identifiant de document
// Firestore et de clé de contact Brevo. Les deux doivent toujours concorder.
export function normalizeEmail(value) {
    return String(value ?? "").trim().toLowerCase();
}
