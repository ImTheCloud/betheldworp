import { NextResponse } from "next/server";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../../lib/Firebase";
import { addContactToList, getContact, resubscribeContact } from "../../../lib/brevo";
import { notify } from "../../../lib/notify";
import { verifierJeton } from "../../../lib/newsletterToken";

// Deuxième étape de l'abonnement : le lien reçu par e-mail. C'est ici, et
// nulle part ailleurs, qu'une adresse entre dans Firestore et dans la liste
// Brevo. Le jeton porte sa propre preuve d'authenticité, donc cette route est
// publique sans être ouverte : sans e-mail reçu, pas de jeton valide.

const BASE_URL = "https://www.betheldworp.be";

function page(titre, message, lien = true) {
    return `<!doctype html>
<html lang="ro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${titre}</title>
<style>
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
         background:#f5f5f4; color:#1a1a1a; font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
  .carte { max-width:420px; margin:24px; padding:32px 28px; background:#fff; border-radius:16px;
           box-shadow:0 2px 20px rgba(0,0,0,.07); text-align:center; }
  h1 { font-size:20px; margin:0 0 12px; }
  p { font-size:15px; line-height:1.6; color:#444; margin:0 0 20px; }
  a { display:inline-block; background:#1a5fb4; color:#fff; text-decoration:none;
      padding:11px 20px; border-radius:8px; font-size:15px; font-weight:600; }
</style>
</head>
<body>
  <div class="carte">
    <h1>${titre}</h1>
    <p>${message}</p>
    ${lien ? `<a href="${BASE_URL}/ro">Înapoi la site</a>` : ""}
  </div>
</body>
</html>`;
}

function reponseHtml(html, status = 200) {
    return new NextResponse(html, {
        status,
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    });
}

export async function GET(request) {
    const jeton = new URL(request.url).searchParams.get("t");
    const donnees = verifierJeton(jeton);

    if (!donnees) {
        return reponseHtml(page(
            "Link invalid",
            "Acest link nu mai este valabil. Linkurile expiră după 48 de ore. Poți cere unul nou de pe site.",
        ), 400);
    }

    const { email, source } = donnees;

    try {
        const ref = doc(db, "newsletter", email);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
            await setDoc(ref, {
                email,
                subscribedAt: serverTimestamp(),
                source: source || "website",
            });
        } else {
            // Retour d'une personne qui s'était désabonnée : les règles ne
            // laissent modifier que cet indicateur, et c'est le seul utile.
            await setDoc(ref, { unsubscribed: false, updatedAt: new Date() }, { merge: true });
        }

        const fiche = await getContact(email);
        const bloque = fiche.ok && fiche.body?.emailBlacklisted === true;

        const resultat = bloque ? await resubscribeContact(email) : await addContactToList(email);
        if (!resultat.ok) {
            console.error("Brevo confirm failed:", resultat.status, resultat.body);
            return reponseHtml(page(
                "A apărut o eroare",
                "Nu am putut finaliza abonarea. Încearcă din nou mai târziu.",
            ), 502);
        }

        // Notification sans l'adresse, comme avant. Elle ne part plus qu'après
        // une confirmation réelle : un inconnu ne peut plus la déclencher.
        const origine = source === "footer" ? "formularul din footer" : "secțiunea Newsletter";
        await notify({
            title: bloque ? "Abonat revenit" : "Abonat nou",
            message: bloque
                ? `Cineva s-a reabonat (${origine}).`
                : `Un nou abonat confirmat (${origine}).`,
            tags: "email,tada",
        });

        return reponseHtml(page(
            "Abonare confirmată",
            "Mulțumim! Vei primi newsletterul bisericii Bethel Dworp.",
        ));
    } catch (err) {
        console.error("Newsletter confirm error:", err);
        return reponseHtml(page(
            "A apărut o eroare",
            "Nu am putut finaliza abonarea. Încearcă din nou mai târziu.",
        ), 500);
    }
}
