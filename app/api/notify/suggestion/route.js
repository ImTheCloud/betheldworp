import { NextResponse } from "next/server";
import { notify, clean } from "../../../lib/notify";

// Notification d'une nouvelle suggestion d'église.
// L'appel passe par le serveur pour que le nom du canal ntfy reste secret.
//
// ─── OUVERTE À TOUS, ET C'EST UN CHOIX ────────────────────────────────────
//
// N'importe qui peut appeler cette route et déclencher une notification. Le
// 02/09/2026, après que la route ait été supprimée puis remise, cette
// ouverture est actée : bientôt un an sans le moindre abus, et la conséquence
// maximale est une notification ntfy indésirable, sans aucun accès aux
// données. Ne pas reproposer de la fermer.
//
// Précision utile si la question revient : le blocage n'est pas l'absence
// d'identité serveur. lib/adminAuth.js montre qu'on sait faire valider un
// jeton par Firestore sans compte de service. Le vrai obstacle est que le
// visiteur qui propose une église n'est connecté à rien, donc n'a aucun jeton
// à présenter. Vérifier que la suggestion existe vraiment demanderait de lui
// en donner un, c'est-à-dire l'authentification anonyme Firebase.
//
// Deux garde-fous restent en place, un plafond par adresse IP et un plafond
// global. Ils vivent dans la mémoire de l'instance serverless, qui n'est pas
// partagée entre instances : ils freinent un script isolé, pas une attaque
// répartie. C'est une atténuation assumée, pas une fermeture.

const FENETRE_IP_MS = 10 * 60 * 1000;   // 10 minutes
const MAX_PAR_IP = 3;

const FENETRE_GLOBALE_MS = 60 * 60 * 1000;  // 1 heure
const MAX_GLOBAL = 20;

const parIp = new Map();
let global = { debut: 0, compte: 0 };

function adresseAppelant(request) {
    const xff = request.headers.get("x-forwarded-for") || "";
    return xff.split(",")[0].trim() || request.headers.get("x-real-ip") || "inconnue";
}

// Écarte les adresses dont la fenêtre est expirée, pour que la table ne
// grossisse pas indéfiniment sur une instance qui reste chaude longtemps.
function purger(maintenant) {
    for (const [ip, entree] of parIp) {
        if (maintenant - entree.debut > FENETRE_IP_MS) parIp.delete(ip);
    }
}

function plafondAtteint(request) {
    const maintenant = Date.now();

    if (maintenant - global.debut > FENETRE_GLOBALE_MS) {
        global = { debut: maintenant, compte: 0 };
    }
    if (global.compte >= MAX_GLOBAL) return true;

    purger(maintenant);

    const ip = adresseAppelant(request);
    const entree = parIp.get(ip);

    if (!entree || maintenant - entree.debut > FENETRE_IP_MS) {
        parIp.set(ip, { debut: maintenant, compte: 1 });
        global.compte++;
        return false;
    }

    if (entree.compte >= MAX_PAR_IP) return true;

    entree.compte++;
    global.compte++;
    return false;
}

export async function POST(request) {
    let payload;
    try {
        payload = await request.json();
    } catch {
        return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    const name = clean(payload?.name);
    const city = clean(payload?.city, 60);
    const country = clean(payload?.country, 60);

    if (!name) {
        return NextResponse.json({ error: "missing_name" }, { status: 400 });
    }

    // Plafond dépassé : on renonce à notifier, sans le dire à l'appelant.
    // La suggestion elle-même est déjà enregistrée, et un visiteur légitime
    // n'a pas à voir une erreur pour un abus commis par quelqu'un d'autre.
    if (plafondAtteint(request)) {
        console.warn("notify/suggestion : plafond atteint, notification abandonnée");
        return NextResponse.json({ ok: true, notified: false });
    }

    // Priorité normale et non plus « haute » : une notification qui traverse
    // le mode « ne pas déranger » ne doit pas être déclenchable par un inconnu.
    const notified = await notify({
        title: payload?.type === "edit" ? "Sugestie de modificare" : "Biserică nouă propusă",
        message: [name, city, country && `(${country})`].filter(Boolean).join(" "),
        priority: "default",
        tags: "church,pray",
    });

    // La suggestion est déjà enregistrée : une notification perdue ne doit pas
    // remonter au visiteur comme une erreur.
    return NextResponse.json({ ok: true, notified });
}
