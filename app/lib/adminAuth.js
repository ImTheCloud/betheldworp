// Vérifie qu'un appel d'API provient bien d'un administrateur connecté.
//
// La vérification cryptographique est déléguée à Firestore : on lit
// admins/{uid} en présentant le jeton de l'appelant. La règle
//
//     allow read: if request.auth != null && request.auth.uid == uid
//
// ne passe que si Firestore a validé la signature du jeton ET que l'uid qu'il
// contient correspond au chemin demandé. Un jeton forgé, expiré, ou l'uid de
// quelqu'un d'autre sont donc rejetés par Firestore, pas par nous.
//
// C'est ce qui permet de se passer d'un compte de service Google.

const PROJECT_ID = "betheldworp"; // identique à app/lib/Firebase.js

// Lit l'uid revendiqué par le jeton, sans le vérifier : il ne sert qu'à
// construire le chemin. C'est Firestore qui tranche ensuite.
function claimedUid(token) {
    try {
        const [, payload] = token.split(".");
        if (!payload) return null;
        const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
        const data = JSON.parse(json);
        return data?.user_id || data?.sub || null;
    } catch {
        return null;
    }
}

export async function isAdminRequest(request) {
    const header = request.headers.get("authorization") || "";
    if (!header.startsWith("Bearer ")) return false;

    const token = header.slice(7).trim();
    if (!token) return false;

    const uid = claimedUid(token);
    if (!uid) return false;

    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}`
        + `/databases/(default)/documents/admins/${encodeURIComponent(uid)}`;

    try {
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        // 200 = jeton valide et document admin existant.
        // 401/403 = jeton invalide. 404 = utilisateur connecté mais pas admin.
        return res.ok;
    } catch (err) {
        console.error("admin check failed:", err);
        return false;
    }
}
