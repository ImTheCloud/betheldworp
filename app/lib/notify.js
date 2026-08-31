// Notifications push via ntfy — SERVEUR UNIQUEMENT.
//
// Le nom du canal est une adresse secrète : quiconque le connaît peut lire
// toutes les notifications. Ne jamais importer ce fichier depuis un composant
// "use client", le canal se retrouverait dans le bundle du navigateur.

const NTFY = "https://ntfy.sh";

// Le contenu peut venir d'un formulaire public : une seule ligne, longueur bornée.
export function clean(value, max = 80) {
    return String(value ?? "")
        .replace(/[\r\n]+/g, " ")
        .trim()
        .slice(0, max);
}

export async function notify({ title, message, priority = "default", tags = "" }) {
    const topic = process.env.NTFY_TOPIC;
    if (!topic) {
        console.error("NTFY_TOPIC is not set");
        return false;
    }

    // Titre et tags passent par l'URL plutôt que par des en-têtes : les titres
    // sont en roumain, et fetch() refuse tout octet non-ASCII dans un en-tête.
    const params = new URLSearchParams({ title, priority });
    if (tags) params.set("tags", tags);

    try {
        const res = await fetch(`${NTFY}/${encodeURIComponent(topic)}?${params}`, {
            method: "POST",
            body: message,
        });
        if (!res.ok) {
            console.error("ntfy failed:", res.status, await res.text());
            return false;
        }
        return true;
    } catch (err) {
        console.error("ntfy error:", err);
        return false;
    }
}
