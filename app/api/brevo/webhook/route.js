import { NextResponse } from "next/server";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../../lib/Firebase";

// Événements Brevo qui doivent couper les envois pour une adresse.
const UNSUBSCRIBE_EVENTS = new Set(["unsubscribed", "unsubscribe", "spam", "list_removal"]);

// Brevo ne signe pas ses webhooks : l'URL est protégée par un jeton partagé.
function isAuthorized(request) {
    const expected = process.env.BREVO_WEBHOOK_TOKEN;
    if (!expected) return false;
    return new URL(request.url).searchParams.get("token") === expected;
}

// Reçoit les désinscriptions faites depuis le lien "Dezabonare" d'un email et
// les répercute dans Firestore, pour que l'admin du site reste à jour.
export async function POST(request) {
    if (!isAuthorized(request)) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    let payload;
    try {
        payload = await request.json();
    } catch {
        return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    const event = String(payload?.event || "").toLowerCase();
    if (!UNSUBSCRIBE_EVENTS.has(event)) {
        // Brevo envoie aussi des ouvertures, clics, etc. : on les acquitte sans agir.
        return NextResponse.json({ ok: true, ignored: event });
    }

    const email = String(payload?.email || payload?.contact_email || "").trim().toLowerCase();
    if (!email) {
        return NextResponse.json({ error: "missing_email" }, { status: 400 });
    }

    try {
        const ref = doc(db, "newsletter", email);
        const snap = await getDoc(ref);

        // Contact présent dans Brevo mais jamais passé par le site.
        if (!snap.exists()) {
            return NextResponse.json({ ok: true, unknown: true });
        }

        await setDoc(ref, { unsubscribed: true, updatedAt: new Date() }, { merge: true });
        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error("Brevo webhook error:", err);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}
