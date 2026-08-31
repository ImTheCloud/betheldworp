import { NextResponse } from "next/server";

// Géolocalisation approximative du visiteur (pays et ville), déduite des
// en-têtes que Vercel ajoute depuis son réseau de périphérie.
//
// Auparavant le navigateur interrogeait ipapi.co puis ipwho.is : l'adresse IP
// de chaque visiteur partait donc chez deux sociétés tierces, sans consentement
// ni base légale. Ici l'IP ne quitte pas l'infrastructure et aucun appel externe
// n'est effectué.

export const dynamic = "force-dynamic";

// Vercel renvoie un code ISO (« BE »). Les statistiques affichent un nom
// complet et l'historique en contient déjà : on convertit pour rester cohérent.
function countryName(code) {
    if (!code) return "";
    try {
        return new Intl.DisplayNames(["en"], { type: "region" }).of(code) || code;
    } catch {
        return code;
    }
}

export async function GET(request) {
    const headers = request.headers;
    const code = (headers.get("x-vercel-ip-country") || "").trim().toUpperCase();

    // La ville arrive encodée en pourcent (« Sint-Genesius-Rode »).
    const rawCity = (headers.get("x-vercel-ip-city") || "").trim();
    let city = rawCity;
    try {
        city = decodeURIComponent(rawCity);
    } catch {
        // Encodage invalide : on garde la valeur brute plutôt que de tout perdre.
    }

    return NextResponse.json(
        {
            country: countryName(code) || "Unknown",
            city: city || "Unknown",
        },
        { headers: { "cache-control": "no-store" } }
    );
}
