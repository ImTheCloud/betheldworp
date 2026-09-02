// Client Brevo, SERVEUR UNIQUEMENT.
// Ne jamais importer ce fichier depuis un composant "use client" : la clé API
// se retrouverait dans le bundle envoyé au navigateur.

const BREVO_API = "https://api.brevo.com/v3";

function getApiKey() {
    const key = process.env.BREVO_API_KEY;
    if (!key) throw new Error("BREVO_API_KEY is not set");
    return key;
}

// Liste "Newsletter Bethel" (#7 dans le compte Brevo).
function getListId() {
    return Number(process.env.BREVO_LIST_ID || 7);
}

async function brevoFetch(path, options = {}) {
    const res = await fetch(`${BREVO_API}${path}`, {
        ...options,
        headers: {
            "api-key": getApiKey(),
            "content-type": "application/json",
            accept: "application/json",
        },
    });

    // Brevo répond 204 sans corps sur les mises à jour réussies.
    const text = await res.text();
    let body = null;
    if (text) {
        try {
            body = JSON.parse(text);
        } catch {
            body = { raw: text };
        }
    }

    return { ok: res.ok, status: res.status, body };
}

// Lit la fiche du contact. Un 404 n'est pas une erreur : il signifie que Brevo
// ne connaît pas encore cette adresse. Sert à distinguer un nouvel abonné d'un
// abonné qui revient après s'être désinscrit depuis un e-mail.
export function getContact(email) {
    return brevoFetch(`/contacts/${encodeURIComponent(email)}`);
}

// Ajoute le contact à la liste, ou le met à jour s'il existe déjà.
export function addContactToList(email) {
    return brevoFetch("/contacts", {
        method: "POST",
        body: JSON.stringify({
            email,
            listIds: [getListId()],
            updateEnabled: true,
        }),
    });
}

// Met le contact en blocklist : Brevo ne lui enverra plus aucune campagne.
export function blocklistContact(email) {
    return brevoFetch(`/contacts/${encodeURIComponent(email)}`, {
        method: "PUT",
        body: JSON.stringify({ emailBlacklisted: true }),
    });
}

// Supprime définitivement le contact de Brevo.
export function deleteContact(email) {
    return brevoFetch(`/contacts/${encodeURIComponent(email)}`, { method: "DELETE" });
}

// Lève la blocklist et remet le contact dans la liste newsletter.
export function resubscribeContact(email) {
    return brevoFetch(`/contacts/${encodeURIComponent(email)}`, {
        method: "PUT",
        body: JSON.stringify({
            emailBlacklisted: false,
            listIds: [getListId()],
        }),
    });
}

// Expéditeur vérifié dans le compte Brevo. Le domaine propre plutôt que
// l'adresse gmail : c'est lui qui porte la réputation d'envoi.
const EXPEDITEUR = { name: "Bethel Dworp", email: "info@betheldworp.be" };

// E-mail de confirmation d'abonnement, en roumain comme la newsletter.
// Envoyé en transactionnel, sans modèle Brevo : le compte n'en a aucun, et un
// modèle serait une pièce de plus à tenir à jour hors du dépôt.
export function sendConfirmationEmail(email, lienConfirmation) {
    const html = `
<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1a1a1a">
  <h1 style="font-size:20px;margin:0 0 16px">Confirmă abonarea</h1>
  <p style="font-size:15px;line-height:1.6;margin:0 0 20px">
    Ai cerut să primești newsletterul bisericii Bethel Dworp. Apasă butonul de mai jos ca să confirmi adresa ta de e-mail.
  </p>
  <p style="margin:0 0 24px">
    <a href="${lienConfirmation}" style="display:inline-block;background:#1a5fb4;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:15px;font-weight:600">
      Confirmă abonarea
    </a>
  </p>
  <p style="font-size:13px;line-height:1.6;color:#666;margin:0 0 8px">
    Linkul este valabil 48 de ore.
  </p>
  <p style="font-size:13px;line-height:1.6;color:#666;margin:0">
    Dacă nu tu ai cerut acest lucru, ignoră acest mesaj. Nu vei primi nimic altceva.
  </p>
</div>`.trim();

    return brevoFetch("/smtp/email", {
        method: "POST",
        body: JSON.stringify({
            sender: EXPEDITEUR,
            to: [{ email }],
            subject: "Confirmă abonarea la newsletter",
            htmlContent: html,
        }),
    });
}
