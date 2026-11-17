import { NextResponse } from "next/server";
import { defaultWeekKey } from "../../../lib/newsletter/build";
import { loadWeek } from "../../../lib/newsletter/weekData";
import { renderNewsletter } from "../../../lib/newsletter/render";
import { getWeekSends } from "../../../lib/newsletter/sending";
import { notify } from "../../../lib/notify";

export const maxDuration = 60;

// Préparation du dimanche soir (tâche planifiée Vercel, voir vercel.json).
//
// Génère la newsletter de la semaine qui commence le lendemain et envoie une
// notification au téléphone avec le lien vers l'aperçu de l'admin. N'ENVOIE
// RIEN AUX ABONNÉS : l'envoi reste un appui de l'admin, après relecture.
//
// Plan gratuit Vercel (Hobby) : une exécution par jour au plus, déclenchée à
// un moment quelconque de l'heure prévue. « 0 17 * * 0 » = dimanche entre
// 17:00 et 17:59 UTC, soit 18:00 à 19:00 à Bruxelles en hiver, 19:00 à 20:00
// en été.
export async function GET(request) {
    const secret = process.env.CRON_SECRET;
    if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
        return new Response("Unauthorized", { status: 401 });
    }

    const weekKey = defaultWeekKey();
    const link = `https://www.betheldworp.be/admin?week=${weekKey}#weekly`;

    try {
        const week = await loadWeek(weekKey);
        const rendered = renderNewsletter(week, {});
        const { sends } = await getWeekSends(weekKey);

        if (sends.length) {
            // Déjà envoyée (en avance) : rien à faire, pas de rappel inutile.
            return NextResponse.json({ ok: true, weekKey, alreadySent: true });
        }

        const highlights = week.eventGroups.map((g) => g.title);
        const lines = [
            highlights.length ? `În program: ${highlights.join(", ")}.` : "Săptămână obișnuită, fără evenimente speciale.",
            week.changes.length ? `${week.changes.length} ${week.changes.length === 1 ? "schimbare" : "schimbări"} în program.` : "",
            "Apasă pentru previzualizare și trimitere.",
        ].filter(Boolean);

        await notify({
            title: `Newsletter ${week.range} gata`,
            message: lines.join("\n"),
            tags: "email,calendar",
            click: link,
        });
        return NextResponse.json({ ok: true, weekKey, subject: rendered.subject });
    } catch (err) {
        console.error("newsletter cron failed:", err);
        await notify({
            title: "Newsletter: pregătirea a eșuat",
            message: "Newsletter-ul săptămânii nu a putut fi generat automat. Deschide admin-ul pentru a-l verifica.",
            priority: "high",
            tags: "warning",
            click: link,
        });
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}
