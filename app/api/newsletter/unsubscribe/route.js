import { NextResponse } from "next/server";
import { isValidEmail, normalizeEmail } from "../../../lib/validation";
import { blocklistContact } from "../../../lib/brevo";
import { isAdminRequest } from "../../../lib/adminAuth";

// Appelée après une désinscription depuis la page du site : répercute le
// blocage dans Brevo, sinon la personne continuerait à recevoir les campagnes.
export async function POST(request) {
    // Plus aucun formulaire public n'appelle cette route : la page de
    // désinscription du site ne contient plus qu'une explication, et le lien
    // des newsletters est géré par Brevo. Seul l'admin l'utilise encore.
    if (!(await isAdminRequest(request))) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

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

    try {
        const result = await blocklistContact(email);

        // 404 = le contact n'existe pas dans Brevo : il n'y a rien à bloquer.
        if (!result.ok && result.status !== 404) {
            console.error("Brevo unsubscribe failed:", result.status, result.body);
            return NextResponse.json({ error: "brevo_failed" }, { status: 502 });
        }
        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error("Brevo unsubscribe error:", err);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}
