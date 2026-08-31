import { NextResponse } from "next/server";
import { deleteContact } from "../../../lib/brevo";

const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());

// Appelée quand un abonné est supprimé depuis le panneau admin.
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
        const result = await deleteContact(email);

        // 404 = déjà absent de Brevo, le résultat voulu est atteint.
        if (!result.ok && result.status !== 404) {
            console.error("Brevo delete failed:", result.status, result.body);
            return NextResponse.json({ error: "brevo_failed" }, { status: 502 });
        }
        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error("Brevo delete error:", err);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}
