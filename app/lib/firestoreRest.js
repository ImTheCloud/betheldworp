// Accès Firestore depuis le serveur, par l'API REST, SERVEUR UNIQUEMENT.
//
// Le site n'a pas de compte de service Google. Deux façons de lire ou
// d'écrire, donc :
//   - sans jeton, pour les collections publiques (events, program_overrides) ;
//   - avec le jeton de l'admin connecté, transmis par la requête : Firestore
//     applique alors les règles comme si l'admin écrivait depuis son
//     navigateur. C'est le même principe que isAdminRequest (adminAuth.js).
//
// Le SDK client « firebase/firestore » marcherait aussi côté serveur, mais il
// garde une connexion et un cache par processus, et ne sait pas changer de
// jeton d'une requête à l'autre. Le REST est sans état : une requête, une
// réponse.

const PROJECT_ID = "betheldworp"; // identique à app/lib/Firebase.js
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// ── Conversion des valeurs REST ⇄ JavaScript ──

export function decodeValue(v) {
    if (!v || typeof v !== "object") return null;
    if ("stringValue" in v) return v.stringValue;
    if ("integerValue" in v) return Number(v.integerValue);
    if ("doubleValue" in v) return Number(v.doubleValue);
    if ("booleanValue" in v) return v.booleanValue;
    if ("timestampValue" in v) return v.timestampValue;
    if ("nullValue" in v) return null;
    if ("mapValue" in v) return decodeFields(v.mapValue.fields || {});
    if ("arrayValue" in v) return (v.arrayValue.values || []).map(decodeValue);
    return null;
}

export function decodeFields(fields) {
    return Object.fromEntries(Object.entries(fields || {}).map(([k, x]) => [k, decodeValue(x)]));
}

export function encodeValue(v) {
    if (v === null || v === undefined) return { nullValue: null };
    if (v instanceof Date) return { timestampValue: v.toISOString() };
    if (Array.isArray(v)) return { arrayValue: { values: v.map(encodeValue) } };
    if (typeof v === "boolean") return { booleanValue: v };
    if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    if (typeof v === "object") return { mapValue: { fields: encodeFields(v) } };
    return { stringValue: String(v) };
}

function encodeFields(obj) {
    return Object.fromEntries(Object.entries(obj).map(([k, x]) => [k, encodeValue(x)]));
}

function headers(token) {
    return token ? { Authorization: `Bearer ${token}` } : {};
}

function docId(name) {
    return String(name || "").split("/").pop();
}

/** Un document, ou null s'il n'existe pas. Lève une erreur pour tout autre échec. */
export async function getDocument(path, token) {
    const res = await fetch(`${BASE}/${path}`, { headers: headers(token), cache: "no-store" });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Firestore GET ${path} failed: ${res.status}`);
    const json = await res.json();
    return { id: docId(json.name), ...decodeFields(json.fields) };
}

/** Tous les documents d'une collection (quelques centaines au plus ici). */
export async function listDocuments(collection, token) {
    const docs = [];
    let pageToken = "";
    for (let i = 0; i < 50; i++) {
        const params = new URLSearchParams({ pageSize: "300" });
        if (pageToken) params.set("pageToken", pageToken);
        const res = await fetch(`${BASE}/${collection}?${params}`, { headers: headers(token), cache: "no-store" });
        if (!res.ok) throw new Error(`Firestore LIST ${collection} failed: ${res.status}`);
        const json = await res.json();
        (json.documents || []).forEach((d) => docs.push({ id: docId(d.name), ...decodeFields(d.fields) }));
        pageToken = json.nextPageToken || "";
        if (!pageToken) break;
    }
    return docs;
}

/**
 * Écrit les champs donnés d'un document, sans toucher aux autres (crée le
 * document s'il n'existe pas). Le jeton de l'admin est obligatoire : les
 * règles refusent toute écriture anonyme sur les collections concernées.
 */
export async function patchDocument(path, data, token) {
    const params = new URLSearchParams();
    Object.keys(data).forEach((k) => params.append("updateMask.fieldPaths", k));
    const res = await fetch(`${BASE}/${path}?${params}`, {
        method: "PATCH",
        headers: { ...headers(token), "content-type": "application/json" },
        body: JSON.stringify({ fields: encodeFields(data) }),
        cache: "no-store",
    });
    if (!res.ok) throw new Error(`Firestore PATCH ${path} failed: ${res.status} ${await res.text()}`);
    const json = await res.json();
    return { id: docId(json.name), ...decodeFields(json.fields) };
}
