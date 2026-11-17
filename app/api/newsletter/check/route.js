import { NextResponse } from "next/server";
import dns from "node:dns/promises";
import { isValidEmail, normalizeEmail } from "../../../lib/validation";

// Vérifie, avant l'inscription, que le domaine de l'adresse existe et peut
// recevoir du courrier (enregistrement MX, ou à défaut une adresse A/AAAA,
// comme le prévoit la norme SMTP). Attrape « gmail.cm », « yahoo.coom »…
//
// Ne dit rien de la partie avant le @ : seule la boîte elle-même pourrait
// le confirmer. Toute erreur autre que « domaine inexistant » laisse passer.

const NOT_FOUND = new Set(["ENOTFOUND", "ENODATA", "ENONAME", "NXDOMAIN"]);

function withTimeout(promise, ms) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error("timeout"), { code: "ETIMEOUT" })), ms)),
    ]);
}

async function hasRecord(resolve) {
    try {
        const records = await withTimeout(resolve(), 3000);
        return records.length > 0 ? true : false;
    } catch (err) {
        if (NOT_FOUND.has(err?.code)) return false;
        return null; // inconnu : délai dépassé, serveur DNS en panne…
    }
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
        return NextResponse.json({ deliverable: false, reason: "format" });
    }

    const domain = email.slice(email.lastIndexOf("@") + 1);

    const mx = await hasRecord(() => dns.resolveMx(domain));
    if (mx !== false) return NextResponse.json({ deliverable: true });

    const a = await hasRecord(() => dns.resolve4(domain));
    if (a !== false) return NextResponse.json({ deliverable: true });

    const aaaa = await hasRecord(() => dns.resolve6(domain));
    if (aaaa !== false) return NextResponse.json({ deliverable: true });

    return NextResponse.json({ deliverable: false, reason: "domain" });
}
