import { NextResponse } from "next/server";
import { resubscribeContact } from "../../../lib/brevo";
import { isAdminRequest } from "../../../lib/adminAuth";

const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());

// Appelée quand un abonné est réactivé depuis le panneau admin : lève la
// blocklist Brevo, sans quoi il resterait bloqué malgré son retour en base.
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

    const email = String(payload?.email || "").trim().toLowerCase();
    if (!isValidEmail(email)) {
        return NextResponse.json({ error: "invalid_email" }, { status: 400 });
    }

    try {
        const result = await resubscribeContact(email);
        if (!result.ok) {
            console.error("Brevo resubscribe failed:", result.status, result.body);
            return NextResponse.json({ error: "brevo_failed" }, { status: 502 });
        }
        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error("Brevo resubscribe error:", err);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}
