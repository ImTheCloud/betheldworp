import { NextResponse } from "next/server";
import { getAdminContext } from "../../../../lib/adminAuth";
import { buildNewsletter } from "../../../../lib/newsletter/build";
import { sendWeek } from "../../../../lib/newsletter/sending";
import { notify } from "../../../../lib/notify";

export const maxDuration = 60;

// Envoie la newsletter de la semaine à tous les abonnés qui ne l'ont pas
// encore reçue. Appelée uniquement par le bouton de l'admin, après
// confirmation : rien n'est jamais envoyé automatiquement aux abonnés.
export async function POST(request) {
    const admin = await getAdminContext(request);
    if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const payload = await request.json().catch(() => ({}));
    if (payload?.confirm !== true) return NextResponse.json({ error: "not_confirmed" }, { status: 400 });

    try {
        const built = await buildNewsletter(payload);
        if (built.error) return NextResponse.json({ error: built.error }, { status: 400 });

        const result = await sendWeek({
            weekKey: built.weekKey,
            token: admin.token,
            rendered: built.rendered,
            expectedCount: payload?.expectedCount,
            adminEmail: admin.email,
        });

        if (!result.ok) {
            const status = { sending_disabled: 403, count_changed: 409, already_sending: 409, nobody_to_send: 409 }[result.error] || 502;
            return NextResponse.json(result, { status });
        }

        await notify({
            title: "Newsletter trimis",
            message: `${built.week.range}: trimis la ${result.count} ${result.count === 1 ? "abonat" : "abonați"} (trimiterea #${result.number}).`,
            tags: "email,white_check_mark",
        });
        return NextResponse.json(result);
    } catch (err) {
        console.error("weekly send failed:", err);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}
