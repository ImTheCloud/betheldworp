import { NextResponse } from "next/server";
import { notify } from "../../../lib/notify";

// Rappel mensuel, déclenché par une tâche planifiée Vercel.
//
// Plus rien ne s'efface tout seul : les règles TTL de Firestore ont été
// retirées, la suppression se fait à la main depuis l'onglet Statistiques.
// Ce rappel existe pour que personne n'oublie d'y passer — sans lui, des
// données dépasseraient les 25 mois annoncés dans la politique de
// confidentialité.
//
// Mensuel et non annuel : le panneau signale les documents 30 jours avant leur
// échéance, donc un passage par mois suffit à tenir la durée promise.
//
// Aucune lecture de Firestore ici : les règles réservent ces collections à un
// admin connecté, et une tâche planifiée n'a pas de session. Le rappel ne peut
// donc pas dire s'il y a réellement quelque chose à supprimer — c'est le
// panneau de l'admin qui le sait.

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

    const notified = await notify({
        title: "Statistiques : à vérifier",
        message:
            "Passe dans l'onglet Statistiques de l'admin et descends en bas de page. "
            + "S'il y a des données arrivées au bout des 25 mois, un bouton te le dira. "
            + "Sinon il n'y a rien à faire : betheldworp.be/admin",
        priority: "default",
        tags: "hourglass,bar_chart",
    });

    return NextResponse.json({ ok: true, notified });
}
