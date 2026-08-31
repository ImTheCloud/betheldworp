import { NextResponse } from "next/server";
import { addContactToList } from "../../../lib/brevo";

const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());

// Appelée après l'inscription depuis le site : réplique le contact dans Brevo
// pour que la liste d'envoi reste alignée sur Firestore.
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
        const result = await addContactToList(email);
        if (!result.ok) {
            console.error("Brevo subscribe failed:", result.status, result.body);
            return NextResponse.json({ error: "brevo_failed" }, { status: 502 });
        }
        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error("Brevo subscribe error:", err);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}
