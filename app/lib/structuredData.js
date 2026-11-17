// Données structurées schema.org (JSON-LD), SERVEUR UNIQUEMENT.
//
// Elles décrivent l'église en langage machine : nom, adresse, coordonnées GPS,
// horaires, contact, chaîne YouTube, et chaque événement à venir. Google s'en
// sert pour ses fiches et Google Maps ; ChatGPT, Perplexity et Gemini les
// lisent pour répondre à « une église penticostale roumaine près de Bruxelles ».
// Toutes les valeurs viennent du site lui-même (pied de page, programme,
// dons) : ne rien ajouter ici qui ne soit pas vrai et visible sur la page.

const SITE_URL = "https://www.betheldworp.be";
const CHURCH_ID = `${SITE_URL}/#church`;
const ORG_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;

const ADDRESS = {
    "@type": "PostalAddress",
    streetAddress: "Alsembergsesteenweg 572B",
    postalCode: "1653",
    addressLocality: "Beersel",
    addressRegion: "Vlaams-Brabant",
    addressCountry: "BE",
};

const NAMES = {
    ro: "Biserica Penticostală Română Bethel Dworp",
    fr: "Église Pentecôtiste Roumaine Bethel Dworp",
    nl: "Roemeense Pinksterkerk Bethel Dworp",
    en: "Bethel Dworp Romanian Pentecostal Church",
};

const ABOUT = {
    ro: "Biserică penticostală română din Dworp (Beersel), la sud de Bruxelles. Serviciile se țin în limba română. Serviciu divin duminica la 10:00 și la 18:00, seri de rugăciune, tineret, coruri, orchestră și program pentru copii în timpul săptămânii.",
    fr: "Église pentecôtiste roumaine à Dworp (Beersel), au sud de Bruxelles. Les cultes ont lieu en roumain. Culte le dimanche à 10h et à 18h, soirées de prière, jeunesse, chorales, orchestre et programme pour enfants en semaine.",
    nl: "Roemeense pinksterkerk in Dworp (Beersel), ten zuiden van Brussel. De diensten zijn in het Roemeens. Eredienst op zondag om 10u en 18u, gebedsavonden, jongeren, koren, orkest en kinderprogramma tijdens de week.",
    en: "Romanian Pentecostal church in Dworp (Beersel), south of Brussels. Services are held in Romanian. Sunday services at 10:00 and 18:00, with prayer evenings, youth, choirs, orchestra and a children's program during the week.",
};

// Programme hebdomadaire, repris de app/sections/WeeklyProgram.jsx. Juillet et
// août, seuls le vendredi et les deux services du dimanche sont maintenus.
const WEEKLY = [
    ["Monday", "20:00", "21:30"],
    ["Tuesday", "10:00", "14:00"],
    ["Tuesday", "20:00", "21:30"],
    ["Wednesday", "20:00", "21:30"],
    ["Thursday", "20:00", "21:30"],
    ["Friday", "20:00", "21:30"],
    ["Saturday", "11:00", "13:30"],
    ["Sunday", "10:00", "12:00"],
    ["Sunday", "18:00", "20:00"],
];

function churchGraph(lang) {
    const l = NAMES[lang] ? lang : "ro";
    return [
        {
            "@type": "Church",
            "@id": CHURCH_ID,
            name: NAMES[l],
            alternateName: ["Bethel Dworp", "Biserica Bethel Dworp", "Centre Chrétien Roumain Bethel"],
            description: ABOUT[l],
            url: `${SITE_URL}/${l}`,
            image: `${SITE_URL}/images/og-v13.jpg`,
            logo: `${SITE_URL}/icon-512.png`,
            telephone: "+32488297015",
            email: "info@betheldworp.be",
            address: ADDRESS,
            geo: { "@type": "GeoCoordinates", latitude: 50.7295798, longitude: 4.3011069 },
            hasMap: "https://www.google.com/maps/search/?api=1&query=Alsembergsesteenweg+572B,+1653+Beersel&query_place_id=ChIJWdWyrJPPw0cRL74a9ysasVE",
            isAccessibleForFree: true,
            publicAccess: true,
            openingHoursSpecification: WEEKLY.map(([day, opens, closes]) => ({
                "@type": "OpeningHoursSpecification",
                dayOfWeek: `https://schema.org/${day}`,
                opens,
                closes,
            })),
            sameAs: ["https://www.youtube.com/@bisericapenticostalabethel7695"],
        },
        {
            "@type": "Organization",
            "@id": ORG_ID,
            name: "Bethel Dworp",
            legalName: "Centre Chrétien Roumain Bethel ASBL",
            url: SITE_URL,
            logo: `${SITE_URL}/icon-512.png`,
            email: "info@betheldworp.be",
            telephone: "+32488297015",
            address: ADDRESS,
            location: { "@id": CHURCH_ID },
            knowsLanguage: ["ro", "fr", "nl", "en"],
            sameAs: ["https://www.youtube.com/@bisericapenticostalabethel7695"],
        },
        {
            "@type": "WebSite",
            "@id": WEBSITE_ID,
            name: "Bethel Dworp",
            url: SITE_URL,
            inLanguage: ["ro", "fr", "nl", "en"],
            publisher: { "@id": ORG_ID },
        },
    ];
}

// --- Événements ---------------------------------------------------------

// Décalage horaire de Bruxelles pour une date donnée (+01:00 l'hiver,
// +02:00 l'été), pour des horaires exacts toute l'année.
function brusselsOffset(isoDate) {
    const d = new Date(`${isoDate}T12:00:00Z`);
    const name = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Brussels", timeZoneName: "shortOffset" })
        .formatToParts(d)
        .find((p) => p.type === "timeZoneName")?.value || "GMT+1";
    const m = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    if (!m) return "+01:00";
    return `${m[1]}${m[2].padStart(2, "0")}:${m[3] || "00"}`;
}

function todayInBrussels() {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels" }).format(new Date());
}

// Valeur Firestore (format REST) → valeur JavaScript.
function fromFirestore(v) {
    if (!v || typeof v !== "object") return undefined;
    if ("stringValue" in v) return v.stringValue;
    if ("integerValue" in v) return Number(v.integerValue);
    if ("doubleValue" in v) return v.doubleValue;
    if ("booleanValue" in v) return v.booleanValue;
    if ("timestampValue" in v) return v.timestampValue;
    if ("arrayValue" in v) return (v.arrayValue.values || []).map(fromFirestore);
    if ("mapValue" in v) {
        return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, fromFirestore(x)]));
    }
    return undefined;
}

function pick(value, lang) {
    if (!value) return "";
    if (typeof value === "string") return value;
    return value[lang] || value.ro || value.en || value.fr || value.nl || "";
}

function absolute(url) {
    if (!url) return undefined;
    if (/^https?:\/\//.test(url)) return url;
    return `${SITE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

// Lit les événements publics par l'API REST de Firestore (lecture ouverte à
// tous par les règles). Mis en cache une heure : la page d'accueil se
// régénère au plus une fois par heure, pas à chaque visite.
async function loadEvents() {
    const base = "https://firestore.googleapis.com/v1/projects/betheldworp/databases/(default)/documents/events";
    const docs = [];
    let token = "";
    for (let i = 0; i < 10; i++) {
        const url = `${base}?pageSize=300${token ? `&pageToken=${encodeURIComponent(token)}` : ""}`;
        const res = await fetch(url, { next: { revalidate: 3600 } });
        if (!res.ok) throw new Error(`Firestore ${res.status}`);
        const data = await res.json();
        docs.push(...(data.documents || []));
        token = data.nextPageToken || "";
        if (!token) break;
    }
    return docs.map((d) => fromFirestore({ mapValue: { fields: d.fields || {} } }));
}

function eventGraph(events, lang) {
    const today = todayInBrussels();
    const horizon = new Date(Date.now() + 180 * 864e5).toISOString().slice(0, 10);

    return events
        .filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(String(e?.dateEvent || "")))
        .filter((e) => (e.endDate || e.dateEvent) >= today && e.dateEvent <= horizon)
        .sort((a, b) => a.dateEvent.localeCompare(b.dateEvent))
        .slice(0, 30)
        .map((e) => {
            const name = pick(e.title, lang).trim();
            if (!name) return null;

            const [start, end] = String(e.time || "").split("-").map((s) => s.trim());
            const startOk = /^\d{1,2}:\d{2}$/.test(start || "");
            const endOk = /^\d{1,2}:\d{2}$/.test(end || "");
            const endDay = e.endDate && e.endDate > e.dateEvent ? e.endDate : e.dateEvent;
            const hhmm = (t) => t.padStart(5, "0");

            const description = pick(e.description, lang).replace(/\s+/g, " ").trim().slice(0, 300);
            const address = String(e.address || "");
            const elsewhere = address && !/alsemberg/i.test(address);

            return {
                "@type": "Event",
                name,
                startDate: startOk ? `${e.dateEvent}T${hhmm(start)}:00${brusselsOffset(e.dateEvent)}` : e.dateEvent,
                ...(endOk || endDay !== e.dateEvent
                    ? { endDate: endOk ? `${endDay}T${hhmm(end)}:00${brusselsOffset(endDay)}` : endDay }
                    : {}),
                eventStatus: "https://schema.org/EventScheduled",
                eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
                isAccessibleForFree: true,
                inLanguage: "ro",
                ...(description ? { description } : {}),
                ...(e.image ? { image: absolute(e.image) } : {}),
                url: `${SITE_URL}/${lang}#evenimente`,
                location: elsewhere
                    ? { "@type": "Place", name: String(e.place || address), address }
                    : { "@id": CHURCH_ID },
                organizer: { "@id": ORG_ID },
            };
        })
        .filter(Boolean);
}

// Le graphe complet pour une langue. Si Firestore ne répond pas, l'église est
// quand même décrite : seuls les événements manquent.
export async function buildStructuredData(lang) {
    let events = [];
    try {
        events = eventGraph(await loadEvents(), lang);
    } catch (err) {
        console.error("Structured data: events unavailable:", err);
    }
    return { "@context": "https://schema.org", "@graph": [...churchGraph(lang), ...events] };
}

// Échappe « < » : le texte des événements vient de la base, il ne doit
// jamais pouvoir fermer la balise <script>.
export function serializeJsonLd(data) {
    return JSON.stringify(data).replace(/</g, "\\u003c");
}
