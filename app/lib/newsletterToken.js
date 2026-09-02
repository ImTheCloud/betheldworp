import crypto from "crypto";

// Jeton de confirmation d'abonnement, SERVEUR UNIQUEMENT.
//
// Le jeton n'est stocké nulle part, et c'est volontaire. Firestore ne peut pas
// le garder : les règles laissent n'importe qui créer un document dans
// `newsletter`, donc un attaquant écrirait son propre jeton et se confirmerait
// tout seul. Ici le jeton se vérifie par sa signature : sans le secret du
// serveur, il est impossible d'en fabriquer un valide.
//
// La seule chose qu'un attaquant ne peut pas faire, c'est recevoir l'e-mail.
// C'est là-dessus que repose toute la confirmation.

const DUREE_MS = 48 * 60 * 60 * 1000; // 48 heures

function getSecret() {
    const secret = process.env.NEWSLETTER_TOKEN_SECRET;
    if (!secret) throw new Error("NEWSLETTER_TOKEN_SECRET is not set");
    return secret;
}

function base64url(buf) {
    return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(str) {
    return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function signe(charge) {
    return base64url(crypto.createHmac("sha256", getSecret()).update(charge).digest());
}

export function creerJeton(email, source) {
    const charge = base64url(JSON.stringify({
        e: email,
        s: source || "",
        x: Date.now() + DUREE_MS,
    }));
    return `${charge}.${signe(charge)}`;
}

// Renvoie { email, source } si le jeton est authentique et encore valide,
// sinon null. Aucune information sur la raison du refus n'est exposée.
export function verifierJeton(jeton) {
    if (typeof jeton !== "string" || !jeton.includes(".")) return null;

    const [charge, signature] = jeton.split(".");
    if (!charge || !signature) return null;

    const attendue = signe(charge);

    // Comparaison à temps constant : une comparaison classique s'arrête au
    // premier caractère différent, et la durée trahirait la bonne signature.
    const a = Buffer.from(signature);
    const b = Buffer.from(attendue);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

    let data;
    try {
        data = JSON.parse(fromBase64url(charge).toString("utf8"));
    } catch {
        return null;
    }

    if (!data?.e || typeof data.x !== "number" || Date.now() > data.x) return null;

    return { email: String(data.e), source: String(data.s || "") };
}
