// Garde-fous contre les adresses mal tapées à l'inscription à la newsletter.
// Presque tout le monde s'inscrit depuis un téléphone : « gmial.com »,
// « gmail.con » ou « yaho.com » passent la validation de forme mais la
// personne ne recevrait jamais rien, sans le savoir.

// Domaines réellement utilisés par les abonnés et leurs proches (Belgique,
// Roumanie, France). Une faute de frappe proche de l'un d'eux est proposée
// comme correction ; une adresse déjà exacte n'est jamais touchée.
const COMMON_DOMAINS = [
    "gmail.com", "yahoo.com", "yahoo.fr", "yahoo.ro", "hotmail.com", "hotmail.fr",
    "hotmail.be", "outlook.com", "outlook.fr", "outlook.be", "live.com", "live.be",
    "live.fr", "icloud.com", "me.com", "msn.com", "gmx.com", "gmx.net",
    "skynet.be", "telenet.be", "proximus.be", "voo.be", "orange.fr", "free.fr",
];

// Fautes fréquentes sur le seul nom du fournisseur, quelle que soit la fin.
const PROVIDER_ALIASES = {
    gmail: "gmail.com", gmai: "gmail.com", gmial: "gmail.com", gamil: "gmail.com",
    gnail: "gmail.com", gmal: "gmail.com", gmeil: "gmail.com", gmil: "gmail.com",
    yahoo: "yahoo.com", yaho: "yahoo.com", yahooo: "yahoo.com", yhaoo: "yahoo.com",
    hotmail: "hotmail.com", hotmal: "hotmail.com", hotmial: "hotmail.com", hotmai: "hotmail.com",
    outlook: "outlook.com", outlok: "outlook.com", outllok: "outlook.com", otlook: "outlook.com",
    icloud: "icloud.com", iclod: "icloud.com", icoud: "icloud.com", icluod: "icloud.com",
};

// Fins de domaine qui sont presque toujours un « .com » raté.
const BROKEN_TLDS = new Set([
    "", "con", "cm", "co", "comm", "coom", "cpm", "xom", "vom", "ocm", "cim", "cok", "om", "c", "cmo", "comn",
]);

function distance(a, b) {
    const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
        let diag = prev[0];
        prev[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const keep = prev[j];
            prev[j] = Math.min(
                prev[j] + 1,
                prev[j - 1] + 1,
                diag + (a[i - 1] === b[j - 1] ? 0 : 1)
            );
            diag = keep;
        }
    }
    return prev[b.length];
}

// Renvoie l'adresse corrigée si le domaine ressemble à une faute de frappe
// d'un fournisseur courant, sinon null.
export function suggestEmail(value) {
    const email = String(value ?? "").trim().toLowerCase();
    const at = email.lastIndexOf("@");
    if (at < 1) return null;

    const local = email.slice(0, at);
    const raw = email.slice(at + 1);
    // Virgule au lieu du point, point final en trop : « gmail,com », « gmail.com. ».
    const domain = raw.replace(/,/g, ".").replace(/\.+$/, "");
    if (!domain) return null;
    if (COMMON_DOMAINS.includes(domain)) return domain === raw ? null : `${local}@${domain}`;

    // « gmail », « gmail.con », « gmail.co », « gmial.com » : on regarde
    // d'abord le nom du fournisseur seul.
    const dot = domain.indexOf(".");
    const provider = dot === -1 ? domain : domain.slice(0, dot);
    const rest = dot === -1 ? "" : domain.slice(dot + 1);
    const alias = PROVIDER_ALIASES[provider];
    if (alias) {
        const canonical = alias.split(".")[0];
        if (provider === canonical) {
            // Fournisseur bien écrit : seule une fin manifestement cassée est
            // corrigée. yahoo.de ou hotmail.it sont de vraies adresses.
            return BROKEN_TLDS.has(rest) ? `${local}@${alias}` : null;
        }
        // Fournisseur mal écrit : on garde la fin si elle forme un domaine connu
        // (gmial.fr → gmail.fr n'existe pas, hotmial.fr → hotmail.fr existe).
        const sameEnding = `${canonical}.${rest}`;
        return `${local}@${COMMON_DOMAINS.includes(sameEnding) ? sameEnding : alias}`;
    }

    let best = null;
    let bestScore = Infinity;
    for (const candidate of COMMON_DOMAINS) {
        // Même fournisseur, autre pays (gmx.de, live.nl) : vraie adresse.
        if (candidate.split(".")[0] === provider) continue;
        const score = distance(domain, candidate);
        if (score < bestScore) {
            best = candidate;
            bestScore = score;
        }
    }
    // Deux fautes au plus, et jamais sur un domaine trop court pour en juger.
    if (best && bestScore > 0 && bestScore <= 2 && domain.length >= 5) {
        return `${local}@${best}`;
    }
    return null;
}

// Demande au serveur si le domaine de l'adresse peut recevoir des e-mails.
// En cas de doute (réseau, serveur), on laisse passer : mieux vaut un abonné
// de trop qu'un abonné refusé à tort.
export async function domainAcceptsMail(email) {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const res = await fetch("/api/newsletter/check", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email }),
            signal: controller.signal,
        });
        clearTimeout(timer);
        if (!res.ok) return true;
        const data = await res.json();
        return data?.deliverable !== false;
    } catch {
        return true;
    }
}
