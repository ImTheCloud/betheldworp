import { NextResponse } from "next/server";
import { isValidEmail, normalizeEmail } from "../../../lib/validation";
import { addContactToList, getContact, resubscribeContact, sendConfirmationEmail } from "../../../lib/brevo";
import { creerJeton } from "../../../lib/newsletterToken";
import { isAdminRequest } from "../../../lib/adminAuth";

// Première étape de l'abonnement : on envoie un e-mail de confirmation, et
// c'est tout. L'adresse n'entre ni dans Firestore ni dans la liste Brevo tant
// que le lien n'a pas été ouvert.
//
// ─── POURQUOI CE DÉTOUR ───────────────────────────────────────────────────
//
// Avant, le navigateur écrivait le document Firestore puis appelait cette
// route, qui se contentait de vérifier que le document existait avant de
// pousser l'adresse chez Brevo. Ce contrôle ne protégeait de rien : les règles
// laissent n'importe qui créer un document dans `newsletter`, donc il suffisait
// de faire les deux dans l'ordre pour remplir la liste d'envoi d'adresses
// inventées. Les rebonds qui s'ensuivent abîment durablement la réputation
// d'expéditeur, c'est-à-dire exactement ce que le passage à Brevo devait régler.
//
// Maintenant, la seule façon d'entrer dans la liste est de recevoir l'e-mail.
// Le jeton est signé par le serveur et n'est stocké nulle part, donc personne
// ne peut en fabriquer un.
//
// Ce qu'un inconnu peut encore faire : déclencher des envois de confirmation.
// Le compte Brevo est en offre gratuite, plafonnée à 300 envois par jour, donc
// il pourrait consommer le quota et retarder d'un jour l'envoi de la lettre.
// C'est réversible, contrairement à une liste polluée. Le plafond ci-dessous
// freine ce cas, sans le fermer : il vit dans la mémoire de l'instance
// serverless, qui n'est pas partagée entre instances.

const BASE_URL = "https://www.betheldworp.be";

const FENETRE_IP_MS = 15 * 60 * 1000;
const MAX_PAR_IP = 3;

const FENETRE_GLOBALE_MS = 60 * 60 * 1000;
const MAX_GLOBAL = 30;

const parIp = new Map();
let global = { debut: 0, compte: 0 };

function adresseAppelant(request) {
    const xff = request.headers.get("x-forwarded-for") || "";
    return xff.split(",")[0].trim() || request.headers.get("x-real-ip") || "inconnue";
}

function purger(maintenant) {
    for (const [ip, entree] of parIp) {
        if (maintenant - entree.debut > FENETRE_IP_MS) parIp.delete(ip);
    }
}

function plafondAtteint(request) {
    const maintenant = Date.now();

    if (maintenant - global.debut > FENETRE_GLOBALE_MS) {
        global = { debut: maintenant, compte: 0 };
    }
    if (global.compte >= MAX_GLOBAL) return true;

    purger(maintenant);

    const ip = adresseAppelant(request);
    const entree = parIp.get(ip);

    if (!entree || maintenant - entree.debut > FENETRE_IP_MS) {
        parIp.set(ip, { debut: maintenant, compte: 1 });
        global.compte++;
        return false;
    }

    if (entree.compte >= MAX_PAR_IP) return true;

    entree.compte++;
    global.compte++;
    return false;
}

export async function POST(request) {
    let payload;
    try {
        payload = await request.json();
    } catch {
        return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    const email = normalizeEmail(payload?.email);
    if (!isValidEmail(email)) {
        return NextResponse.json({ error: "invalid_email" }, { status: 400 });
    }

    // L'admin ajoute des abonnés à la main depuis son panneau. Il est
    // authentifié, donc rien à confirmer : lui demander de valider par e-mail
    // l'adresse de quelqu'un d'autre n'aurait aucun sens, et casserait le
    // bouton d'ajout. C'est le seul chemin qui entre directement dans la liste.
    if (await isAdminRequest(request)) {
        try {
            const fiche = await getContact(email);
            const bloque = fiche.ok && fiche.body?.emailBlacklisted === true;

            const resultat = bloque ? await resubscribeContact(email) : await addContactToList(email);
            if (!resultat.ok) {
                console.error("Brevo admin subscribe failed:", resultat.status, resultat.body);
                return NextResponse.json({ error: "brevo_failed" }, { status: 502 });
            }
            return NextResponse.json({ ok: true, status: bloque ? "resubscribed" : "created" });
        } catch (err) {
            console.error("Brevo admin subscribe error:", err);
            return NextResponse.json({ error: "server_error" }, { status: 500 });
        }
    }

    try {
        // Déjà présent chez Brevo et joignable : rien à confirmer, et surtout
        // pas d'e-mail de plus pour quelqu'un qui est déjà abonné.
        const fiche = await getContact(email);
        if (fiche.ok && fiche.body?.emailBlacklisted !== true) {
            return NextResponse.json({ ok: true, status: "already" });
        }
    } catch (err) {
        console.error("Brevo lookup error:", err);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }

    // Le plafond ne s'applique qu'ici, une fois qu'un envoi devient possible :
    // consulter une fiche Brevo ne coûte pas de quota d'e-mail.
    //
    // On répond comme si l'envoi avait eu lieu. Dire « plafond atteint »
    // apprendrait à un script quand recommencer, et un visiteur légitime n'a
    // pas à voir une erreur causée par quelqu'un d'autre.
    if (plafondAtteint(request)) {
        console.warn("newsletter/subscribe : plafond atteint, confirmation non envoyee");
        return NextResponse.json({ ok: true, status: "pending" });
    }

    try {
        const jeton = creerJeton(email, String(payload?.source || ""));
        const lien = `${BASE_URL}/api/newsletter/confirm?t=${encodeURIComponent(jeton)}`;

        const envoi = await sendConfirmationEmail(email, lien);
        if (!envoi.ok) {
            console.error("Brevo confirmation send failed:", envoi.status, envoi.body);
            return NextResponse.json({ error: "brevo_failed" }, { status: 502 });
        }

        return NextResponse.json({ ok: true, status: "pending" });
    } catch (err) {
        console.error("Newsletter confirmation error:", err);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}
