import { NextResponse } from "next/server";
import { notify } from "../../../lib/notify";
import { DATA_RETENTION_DAYS } from "../../../lib/tracking";

// Rappel annuel, déclenché par une tâche planifiée Vercel début décembre.
//
// Les statistiques de visite s'effacent toutes seules au bout de 25 mois. Ce
// rappel prévient avant que les plus anciennes ne partent, pour laisser le
// temps de les consulter ou de les noter si elles ont un intérêt.
//
// Aucune lecture de Firestore ici : les règles réservent ces collections à un
// admin connecté, et une tâche planifiée n'a pas de session.

export const dynamic = "force-dynamic";

function estAutorise(request) {
    const attendu = process.env.CRON_SECRET;
    if (!attendu) return false;
    return request.headers.get("authorization") === `Bearer ${attendu}`;
}

export async function GET(request) {
    if (!estAutorise(request)) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // Les données qui vont disparaître sont celles collectées il y a 25 mois.
    const limite = new Date(Date.now() - DATA_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const mois = limite.toLocaleDateString("fr-BE", { month: "long", year: "numeric" });

    const notified = await notify({
        title: "Statistiques : bientôt supprimées",
        message:
            `Les visites de ${mois} et avant vont s'effacer dans les prochaines semaines `
            + `(conservation limitée à 25 mois). Passe par l'admin si tu veux les regarder `
            + `une dernière fois : betheldworp.be/admin`,
        priority: "default",
        tags: "hourglass,bar_chart",
    });

    return NextResponse.json({ ok: true, notified, oldestKept: limite.toISOString().slice(0, 10) });
}
