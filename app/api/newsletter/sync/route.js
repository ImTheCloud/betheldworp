import { NextResponse } from "next/server";
import { isValidEmail, normalizeEmail } from "../../../lib/validation";
import { addContactToList, getContact, isBlockedForNewsletter, listContactsOfList } from "../../../lib/brevo";
import { isAdminRequest } from "../../../lib/adminAuth";

// Filet de sécurité : rattrape les abonnés présents dans Firestore mais absents
// de la liste Brevo.
//
// Cela arrive quand l'appel du site vers Brevo échoue après l'écriture dans
// Firestore (le 10 novembre 2026, Brevo a refusé l'adresse IP des serveurs
// Vercel). La personne voit « Înscriere reușită », elle est bien en base, mais
// ne recevrait jamais la newsletter. Le serveur n'a pas le droit de lister la
// collection Firestore : c'est l'admin connecté qui envoie sa liste d'abonnés
// actifs, et la route ne fait qu'ajouter les manquants.
//
// Une adresse en blocklist chez Brevo n'est JAMAIS débloquée ici : c'est une
// personne qui s'est désinscrite depuis un e-mail. On la signale seulement.
export async function POST(request) {
    if (!(await isAdminRequest(request))) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    let payload;
    try {
        payload = await request.json();
    } catch {
        return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    const emails = [...new Set(
        (Array.isArray(payload?.emails) ? payload.emails : [])
            .map(normalizeEmail)
            .filter(isValidEmail)
    )];

    try {
        const listed = await listContactsOfList();
        if (!listed.ok) {
            console.error("Brevo list read failed:", listed.status, listed.body);
            return NextResponse.json({ error: "brevo_failed", status: listed.status }, { status: 502 });
        }

        const inList = new Map(listed.contacts.map((c) => [normalizeEmail(c.email), c]));
        const wanted = new Set(emails);

        const added = [];
        const blocked = [];
        const failed = [];

        for (const email of emails) {
            const known = inList.get(email);
            if (known && !isBlockedForNewsletter(known)) continue;
            if (known) {
                blocked.push(email);
                continue;
            }

            // Absent de la liste : le contact peut exister ailleurs dans Brevo.
            const fiche = await getContact(email);
            if (fiche.ok && isBlockedForNewsletter(fiche.body)) {
                blocked.push(email);
                continue;
            }

            const result = await addContactToList(email);
            if (result.ok) added.push(email);
            else {
                console.error("Brevo sync add failed:", email, result.status, result.body);
                failed.push(email);
            }
        }

        const onlyInBrevo = [...inList.keys()].filter((e) => !wanted.has(e) && !isBlockedForNewsletter(inList.get(e)));

        return NextResponse.json({
            ok: true,
            siteActive: emails.length,
            brevoInList: inList.size,
            added,
            blocked,
            failed,
            onlyInBrevo,
        });
    } catch (err) {
        console.error("Brevo sync error:", err);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}
