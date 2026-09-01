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
export function getListId() {
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
