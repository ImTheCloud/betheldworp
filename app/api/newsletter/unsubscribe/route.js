import { NextResponse } from "next/server";
import { blocklistContact } from "../../../lib/brevo";

const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());

// Appelée après une désinscription depuis la page du site : répercute le
// blocage dans Brevo, sinon la personne continuerait à recevoir les campagnes.
export async function POST(request) {
    let payload;
    try {
        payload = await request.json();
    } catch {
        return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    const email = String(payload?.email || "").trim().toLowerCase();
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
