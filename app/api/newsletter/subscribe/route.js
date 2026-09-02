import { NextResponse } from "next/server";
import { isValidEmail, normalizeEmail } from "../../../lib/validation";
import { addContactToList, getContact, resubscribeContact } from "../../../lib/brevo";
import { notify } from "../../../lib/notify";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../lib/Firebase";

// Appelée après l'inscription depuis le site : réplique le contact dans Brevo
// pour que la liste d'envoi reste alignée sur Firestore.
//
// La route est volontairement rejouable : les formulaires l'appellent aussi
// quand l'adresse est déjà connue de Firestore. C'est ce qui répare le cas
// suivant, invisible autrement. Quelqu'un se désinscrit depuis le lien d'un
// e-mail : Brevo le met en blocklist, mais Firestore n'en sait rien et le
// garde comme abonné. S'il redonne son adresse plus tard, le site lui répond
// « tu es déjà abonné » alors que Brevo ne lui enverra plus jamais rien.
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

    // La route est publique : les formulaires du site l'appellent après avoir
    // écrit dans Firestore. On exige donc que l'abonné y existe déjà, sinon
    // n'importe qui pourrait remplir la liste Brevo d'adresses inventées et
    // ruiner la réputation d'expéditeur.
    try {
        const snap = await getDoc(doc(db, "newsletter", email));
        if (!snap.exists()) {
            return NextResponse.json({ error: "unknown_subscriber" }, { status: 404 });
        }
    } catch (err) {
        console.error("Firestore lookup failed:", err);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }

    try {
        const fiche = await getContact(email);
        const connu = fiche.ok;
        const bloque = connu && fiche.body?.emailBlacklisted === true;

        // Déjà présent et joignable : la liste est correcte. On ne réécrit rien
        // et on ne notifie pas, sinon un simple renvoi du formulaire annoncerait
        // un abonné qui n'a rien de nouveau.
        if (connu && !bloque) {
            return NextResponse.json({ ok: true, status: "already" });
        }

        const result = bloque
            ? await resubscribeContact(email)
            : await addContactToList(email);

        if (!result.ok) {
            console.error("Brevo subscribe failed:", result.status, result.body);
            return NextResponse.json({ error: "brevo_failed" }, { status: 502 });
        }

        // Notification volontairement sans l'adresse : le signal suffit, et
        // aucune donnée personnelle ne transite par un service tiers.
        // Les ajouts faits depuis l'admin ne notifient pas : c'est déjà toi.
        const source = String(payload?.source || "");
        if (source !== "admin") {
            const origine = source === "footer" ? "formularul din footer" : "secțiunea Newsletter";
            await notify({
                title: bloque ? "Abonat revenit" : "Abonat nou",
                message: bloque
                    ? `Cineva s-a reabonat (${origine}).`
                    : `Un nou abonat (${origine}).`,
                tags: "email,tada",
            });
        }

        return NextResponse.json({ ok: true, status: bloque ? "resubscribed" : "created" });
    } catch (err) {
        console.error("Brevo subscribe error:", err);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}
