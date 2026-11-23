// Qui reçoit la newsletter d'une semaine, et l'envoi lui-même. SERVEUR UNIQUEMENT.
//
// Règles :
//   1. Firestore (collection newsletter) dit qui est abonné. Un contact présent
//      dans Brevo mais désabonné ou absent du site ne reçoit rien.
//   2. Brevo dit qui est joignable. Une adresse en blocklist (désinscription
//      par le lien « Dezabonare », plainte pour spam) ne reçoit rien, même si
//      le site la croit active : on ne débloque jamais quelqu'un en envoyant.
//   3. Personne ne reçoit deux fois la même semaine. Chaque envoi crée dans
//      Brevo une liste « Newsletter 2026-W48 #1 » qui contient exactement ses
//      destinataires, et la campagne part vers cette liste. L'union des listes
//      d'une semaine est donc, à l'adresse près, l'ensemble de ceux qui l'ont
//      reçue. Un ajout tardif crée « #2 » avec seulement les nouveaux.
//
// Ces listes sont la mémoire des envois : ne pas les supprimer dans Brevo
// tant que la semaine n'est pas passée.

import { listDocuments, patchDocument, getDocument } from "../firestoreRest";
import {
    addContactToList, addEmailsToList, createCampaign, createList, deleteCampaign, deleteList, ensureFolder,
    getContact, getListId, isBlockedForNewsletter, listAllLists, listContactsOfList, listEmailsOfList,
    getCampaign, sendCampaignNow, sendCampaignTest, sendTransactional,
} from "../brevo";
import { isValidEmail, normalizeEmail } from "../validation";

export const SENT_FOLDER = "Newsletter trimis";

const listPrefix = (weekKey) => `Newsletter ${weekKey} #`;

/**
 * Les envois ne partent que de la production (ou si NEWSLETTER_ALLOW_SEND=true).
 * En local, rien ne peut atteindre un abonné, même par erreur.
 */
export function sendingAllowed() {
    return process.env.VERCEL_ENV === "production" || process.env.NEWSLETTER_ALLOW_SEND === "true";
}

/** Les listes d'envoi d'une semaine, avec leurs adresses. */
export async function getWeekSends(weekKey) {
    const prefix = listPrefix(weekKey);
    const all = await listAllLists();
    const lists = all
        .filter((l) => String(l.name || "").startsWith(prefix))
        .sort((a, b) => a.id - b.id);
    const sends = [];
    const received = new Set();
    for (const l of lists) {
        const emails = await listEmailsOfList(l.id);
        emails.forEach((e) => received.add(e));
        sends.push({ listId: l.id, name: l.name, number: Number(String(l.name).slice(prefix.length)) || 0, count: emails.length });
    }
    return { sends, received, allLists: all };
}

/** Abonnés actifs selon le site. Exige le jeton d'un admin (lister est réservé à l'admin). */
async function siteActiveEmails(token) {
    const docs = await listDocuments("newsletter", token);
    return [...new Set(
        docs.filter((d) => d.unsubscribed !== true)
            .map((d) => normalizeEmail(d.email || d.id))
            .filter(isValidEmail)
    )];
}

/**
 * Qui recevrait la newsletter de la semaine si on l'envoyait maintenant.
 * Ne modifie rien.
 */
export async function computeRecipients(weekKey, token) {
    const [active, listed, week] = await Promise.all([
        siteActiveEmails(token),
        listContactsOfList(),
        getWeekSends(weekKey),
    ]);
    if (!listed.ok) throw new Error(`Brevo list read failed: ${listed.status}`);

    const inList = new Map(listed.contacts.map((c) => [normalizeEmail(c.email), c]));
    const recipients = [];
    const blocked = [];
    const missingInBrevo = [];
    const alreadyReceived = [];

    for (const email of active) {
        if (week.received.has(email)) {
            alreadyReceived.push(email);
            continue;
        }
        const contact = inList.get(email);
        if (contact) {
            if (isBlockedForNewsletter(contact)) blocked.push(email);
            else recipients.push(email);
            continue;
        }
        // Absent de la liste #7 : il peut exister ailleurs dans Brevo, bloqué.
        const fiche = await getContact(email);
        if (fiche.ok && isBlockedForNewsletter(fiche.body)) {
            blocked.push(email);
            continue;
        }
        missingInBrevo.push(email);
        recipients.push(email);
    }

    const activeSet = new Set(active);
    const onlyInBrevo = [...inList.entries()]
        .filter(([e, c]) => !activeSet.has(e) && !isBlockedForNewsletter(c))
        .map(([e]) => e);

    return {
        recipients,
        blocked,
        missingInBrevo,
        alreadyReceived,
        onlyInBrevo,
        siteActive: active.length,
        sends: week.sends,
    };
}

// ── Mémoire côté site : newsletter_issues/{weekKey} ──

export async function readIssue(weekKey, token) {
    try {
        return await getDocument(`newsletter_issues/${weekKey}`, token);
    } catch (err) {
        console.error("newsletter_issues read failed:", err);
        return null;
    }
}

/**
 * Où en est vraiment un envoi chez Brevo. sendNow ne fait que confier la
 * campagne : Brevo l'a gardée « en cours » 13 minutes le 23 nov 2026.
 *   "sending"  pas fini          "done"  terminé
 *   "stopped"  suspendu, annulé  null    inconnu (Brevo muet, envoi sans trace)
 */
async function deliveryOf(entry) {
    if (!entry?.campaignId) return null;
    const campaign = await getCampaign(entry.campaignId).catch(() => null);
    if (!campaign?.status) return null;
    const status = String(campaign.status).toLowerCase().replace(/[^a-z]/g, "");
    const state = ["sent", "archive"].includes(status)
        ? "done"
        : ["queued", "inprocess", "inreview"].includes(status) ? "sending" : "stopped";
    // Par liste : le total global compte aussi les e-mails de test.
    const stats = (campaign.statistics?.campaignStats || []).find((s) => s.listId === entry.listId) || campaign.statistics?.globalStats || {};
    return {
        state,
        delivered: Number(stats.delivered) || 0,
        bounced: (Number(stats.softBounces) || 0) + (Number(stats.hardBounces) || 0),
    };
}

/** Les envois d'une semaine, avec leur état chez Brevo. */
export async function withDelivery(sends, history) {
    return Promise.all(sends.map(async (s) => ({
        ...s,
        delivery: await deliveryOf(history.find((h) => h.listId === s.listId)),
    })));
}

async function recordSend(weekKey, token, entry) {
    try {
        const prev = await readIssue(weekKey, token);
        const history = Array.isArray(prev?.history) ? prev.history : [];
        await patchDocument(`newsletter_issues/${weekKey}`, {
            weekKey,
            history: [...history, entry],
            lastSentAt: new Date(),
        }, token);
    } catch (err) {
        // L'envoi est fait et Brevo en garde la trace (la liste d'envoi) :
        // l'historique du site n'est qu'un confort.
        console.error("newsletter_issues write failed:", err);
    }
}

/**
 * Envoie la newsletter de la semaine à tous ceux qui ne l'ont pas encore reçue.
 * @param expectedCount nombre affiché à l'admin dans la confirmation : si la
 *                      réalité diffère, rien ne part et l'admin revoit le chiffre.
 */
export async function sendWeek({ weekKey, token, rendered, expectedCount, adminEmail }) {
    if (!sendingAllowed()) {
        return { ok: false, error: "sending_disabled" };
    }

    const plan = await computeRecipients(weekKey, token);
    if (!plan.recipients.length) return { ok: false, error: "nobody_to_send" };
    if (Number(expectedCount) !== plan.recipients.length) {
        return { ok: false, error: "count_changed", count: plan.recipients.length };
    }

    // Les abonnés du site absents de Brevo y sont d'abord ajoutés (liste #7),
    // comme le ferait le bouton « Sync Brevo ».
    for (const email of plan.missingInBrevo) {
        const res = await addContactToList(email);
        if (!res.ok) console.error("Brevo add before send failed:", email, res.status, res.body);
    }

    const number = (plan.sends.reduce((m, s) => Math.max(m, s.number), 0) || 0) + 1;
    const name = `${listPrefix(weekKey)}${number}`;
    const folderId = await ensureFolder(SENT_FOLDER);
    const listId = await createList(name, folderId);

    let campaignId = null;
    try {
        const { failures } = await addEmailsToList(listId, plan.recipients);
        const failed = new Set(failures.map((e) => String(e).toLowerCase()));
        const sentTo = plan.recipients.filter((e) => !failed.has(e));

        // Deux envois lancés en même temps (double appui, deux téléphones)
        // créeraient deux listes du même nom : seule la plus ancienne part.
        const twins = (await listAllLists()).filter((l) => l.name === name && l.id !== listId);
        if (twins.some((l) => l.id < listId)) {
            await deleteList(listId);
            return { ok: false, error: "already_sending" };
        }

        campaignId = await createCampaign({
            name: `Programul săptămânii ${weekKey} #${number}`,
            subject: rendered.subject,
            previewText: rendered.preheader,
            htmlContent: rendered.html,
            listIds: [listId],
        });

        const sent = await sendCampaignNow(campaignId);
        if (!sent.ok) throw new Error(`Brevo sendNow failed: ${sent.status} ${JSON.stringify(sent.body)}`);

        await recordSend(weekKey, token, {
            number,
            at: new Date(),
            listId,
            campaignId,
            count: sentTo.length,
            subject: rendered.subject,
            contentHash: rendered.contentHash,
            by: adminEmail || "",
        });

        return { ok: true, number, listId, campaignId, count: sentTo.length, failed: [...failed] };
    } catch (err) {
        // Rien n'est parti : la liste ne doit pas faire croire le contraire.
        console.error("weekly send failed:", err);
        if (campaignId) await deleteCampaign(campaignId).catch(() => { });
        await deleteList(listId).catch(() => { });
        return { ok: false, error: "brevo_failed", detail: String(err.message || err).slice(0, 300) };
    }
}

/**
 * Envoie un exemplaire de test à une seule adresse, avec l'objet préfixé [TEST].
 * Passe par une campagne brouillon sans destinataires, supprimée juste après.
 */
export async function sendTest({ rendered, to }) {
    if (!sendingAllowed()) return { ok: false, error: "sending_disabled" };
    const subject = `[TEST] ${rendered.subject}`;
    let campaignId = null;
    try {
        campaignId = await createCampaign({
            name: `TEST ${new Date().toISOString().slice(0, 16)}`,
            subject,
            previewText: rendered.preheader,
            htmlContent: rendered.html,
        });
        const res = await sendCampaignTest(campaignId, [to]);
        if (res.ok) return { ok: true, via: "campaign" };
        console.error("Brevo sendTest refused, falling back to transactional:", res.status, res.body);
    } catch (err) {
        console.error("Brevo test campaign failed:", err);
    } finally {
        if (campaignId) await deleteCampaign(campaignId).catch(() => { });
    }

    // Repli : un e-mail transactionnel. Le lien « Dezabonare » n'y est pas actif.
    const html = rendered.html.replace(/\{\{\s*unsubscribe\s*\}\}/g, "https://www.betheldworp.be/");
    const res = await sendTransactional({ to, subject, htmlContent: html });
    if (res.ok) return { ok: true, via: "transactional" };
    return { ok: false, error: "brevo_failed", detail: `${res.status} ${JSON.stringify(res.body).slice(0, 200)}` };
}

export { getListId };
