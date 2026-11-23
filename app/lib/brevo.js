// Client Brevo, SERVEUR UNIQUEMENT.
// Ne jamais importer ce fichier depuis un composant "use client" : la clé API
// se retrouverait dans le bundle envoyé au navigateur.

const BREVO_API = "https://api.brevo.com/v3";

function getApiKey() {
    const key = process.env.BREVO_API_KEY;
    if (!key) throw new Error("BREVO_API_KEY is not set");
    return key;
}

// Liste "Newsletter Bethel Dworp" (#7 dans le compte Brevo).
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

// Lit tous les contacts de la liste newsletter, page par page (500 au plus
// par appel côté Brevo).
export async function listContactsOfList() {
    const contacts = [];
    const limit = 500;
    for (let offset = 0; offset < 20000; offset += limit) {
        const res = await brevoFetch(`/contacts/lists/${getListId()}/contacts?limit=${limit}&offset=${offset}`);
        if (!res.ok) return { ok: false, status: res.status, body: res.body, contacts };
        const page = res.body?.contacts || [];
        contacts.push(...page);
        if (page.length < limit) break;
    }
    return { ok: true, contacts };
}

// Vrai si Brevo ne doit plus rien envoyer à ce contact : blocklist générale,
// ou désinscription d'une liste.
//
// Toute désinscription de liste compte, pas seulement celle de la liste #7 :
// les newsletters partent vers une liste d'envoi par semaine (voir
// newsletter/sending.js), et un « Dezabonare » cliqué dans l'une d'elles ne
// doit pas laisser la personne recevoir la suivante. Aujourd'hui Brevo met
// en blocklist générale, mais ce réglage peut changer dans son interface.
export function isBlockedForNewsletter(contact) {
    if (!contact) return false;
    if (contact.emailBlacklisted === true) return true;
    return (contact.listUnsubscribed || []).length > 0;
}

// Vrai si le contact est dans la liste newsletter et joignable.
export function isReachableInNewsletterList(contact) {
    if (!contact || isBlockedForNewsletter(contact)) return false;
    return (contact.listIds || []).map(Number).includes(getListId());
}

export { getListId };

// ── Listes et dossiers (envois de la newsletter hebdomadaire) ──

export async function listFolders() {
    const res = await brevoFetch("/contacts/folders?limit=50&offset=0");
    return res.ok ? res.body?.folders || [] : [];
}

export async function ensureFolder(name) {
    const found = (await listFolders()).find((f) => f.name === name);
    if (found) return found.id;
    const res = await brevoFetch("/contacts/folders", { method: "POST", body: JSON.stringify({ name }) });
    if (!res.ok) throw new Error(`Brevo folder create failed: ${res.status} ${JSON.stringify(res.body)}`);
    return res.body.id;
}

export async function listAllLists() {
    const lists = [];
    for (let offset = 0; offset < 5000; offset += 50) {
        const res = await brevoFetch(`/contacts/lists?limit=50&offset=${offset}&sort=asc`);
        if (!res.ok) throw new Error(`Brevo lists read failed: ${res.status}`);
        const page = res.body?.lists || [];
        lists.push(...page);
        if (page.length < 50) break;
    }
    return lists;
}

export async function listEmailsOfList(listId) {
    const emails = [];
    for (let offset = 0; offset < 20000; offset += 500) {
        const res = await brevoFetch(`/contacts/lists/${listId}/contacts?limit=500&offset=${offset}`);
        if (!res.ok) throw new Error(`Brevo list ${listId} read failed: ${res.status}`);
        const page = res.body?.contacts || [];
        emails.push(...page.map((c) => String(c.email || "").trim().toLowerCase()).filter(Boolean));
        if (page.length < 500) break;
    }
    return emails;
}

export async function createList(name, folderId) {
    const res = await brevoFetch("/contacts/lists", { method: "POST", body: JSON.stringify({ name, folderId }) });
    if (!res.ok) throw new Error(`Brevo list create failed: ${res.status} ${JSON.stringify(res.body)}`);
    return res.body.id;
}

export function deleteList(listId) {
    return brevoFetch(`/contacts/lists/${listId}`, { method: "DELETE" });
}

// Brevo accepte 150 adresses par appel.
export async function addEmailsToList(listId, emails) {
    const failures = [];
    for (let i = 0; i < emails.length; i += 150) {
        const chunk = emails.slice(i, i + 150);
        const res = await brevoFetch(`/contacts/lists/${listId}/contacts/add`, {
            method: "POST",
            body: JSON.stringify({ emails: chunk }),
        });
        if (!res.ok) throw new Error(`Brevo list add failed: ${res.status} ${JSON.stringify(res.body)}`);
        failures.push(...(res.body?.contacts?.failure || []));
    }
    return { failures };
}

// ── Campagnes ──

export const REPLY_TO = "info@betheldworp.be";

// Mêmes réglages que les campagnes faites à la main dans Brevo (expéditeur 2,
// réponse à info@, images hébergées sur le site). Pas d'étiquette (« tag ») :
// le plan gratuit la refuse (405 « not allowed to avail tag option »), ce qui
// faisait échouer toute création de campagne.
export async function createCampaign({ name, subject, previewText, htmlContent, listIds }) {
    const body = {
        name,
        subject,
        previewText,
        htmlContent,
        // Nom écrit en toutes lettres : avec l'identifiant seul, Brevo laisse
        // « [DEFAULT_FROM_NAME] » dans la campagne.
        sender: { name: "Bethel Dworp", email: REPLY_TO },
        replyTo: REPLY_TO,
        inlineImageActivation: false,
    };
    if (listIds?.length) body.recipients = { listIds };
    const res = await brevoFetch("/emailCampaigns", { method: "POST", body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`Brevo campaign create failed: ${res.status} ${JSON.stringify(res.body)}`);
    return res.body.id;
}

export function sendCampaignNow(campaignId) {
    return brevoFetch(`/emailCampaigns/${campaignId}/sendNow`, { method: "POST" });
}

/** Campagne et chiffres d'envoi, sans le HTML ; null si Brevo ne répond pas. */
export async function getCampaign(campaignId) {
    const res = await brevoFetch(`/emailCampaigns/${campaignId}?statistics=globalStats&excludeHtmlContent=true`);
    return res.ok ? res.body : null;
}

export function sendCampaignTest(campaignId, emailTo) {
    return brevoFetch(`/emailCampaigns/${campaignId}/sendTest`, { method: "POST", body: JSON.stringify({ emailTo }) });
}

export function deleteCampaign(campaignId) {
    return brevoFetch(`/emailCampaigns/${campaignId}`, { method: "DELETE" });
}

// Envoi transactionnel d'un seul message : solution de repli pour le test,
// si Brevo refuse le test de campagne vers une adresse.
export function sendTransactional({ to, subject, htmlContent }) {
    return brevoFetch("/smtp/email", {
        method: "POST",
        body: JSON.stringify({
            sender: { name: "Bethel Dworp", email: REPLY_TO },
            replyTo: { email: REPLY_TO },
            to: [{ email: to }],
            subject,
            htmlContent,
        }),
    });
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
