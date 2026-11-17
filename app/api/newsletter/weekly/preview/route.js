import { NextResponse } from "next/server";
import { isAdminRequest } from "../../../../lib/adminAuth";
import { buildNewsletter, collectWarnings } from "../../../../lib/newsletter/build";

// Aperçu de la newsletter d'une semaine, généré à partir des données du site.
// Ne contacte pas Brevo.
export async function POST(request) {
    if (!(await isAdminRequest(request))) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const payload = await request.json().catch(() => ({}));
    try {
        const built = await buildNewsletter(payload);
        if (built.error) return NextResponse.json({ error: built.error }, { status: 400 });
        const { weekKey, week, rendered } = built;
        return NextResponse.json({
            ok: true,
            weekKey,
            range: week.range,
            year: week.year,
            html: rendered.html,
            subject: rendered.subject,
            preheader: rendered.preheader,
            headlineKey: rendered.headlineKey,
            headlineOptions: rendered.headlineOptions,
            contentHash: rendered.contentHash,
            changes: week.changes.length,
            warnings: await collectWarnings(week, rendered),
        });
    } catch (err) {
        console.error("weekly preview failed:", err);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}
