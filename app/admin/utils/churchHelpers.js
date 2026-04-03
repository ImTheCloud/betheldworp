// Shared utilities and constants for church admin sections

import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../../lib/Firebase";

export const safeStr = (v) => String(v ?? "");

// ─────────────────────────────────────────────────────────────────────────────
// URL & contact sanitizers to avoid saving placeholder/fake links
// ─────────────────────────────────────────────────────────────────────────────

const GENERIC_HOSTS = new Set([
    "wordpress.com", "wix.com", "wixsite.com", "squarespace.com", "weebly.com",
    "godaddy.com", "jimdo.com", "webnode.com", "strikingly.com", "site123.com",
    "medium.com", "blogspot.com", "tumblr.com"
]);

const PLACEHOLDER_TOKENS = ["example", "yourdomain", "yoursite", "sample", "template", "localhost", "placeholder"];

const buildUrlInfo = (url) => {
    if (!url) return null;
    let candidate = String(url).trim();
    if (!candidate) return null;
    candidate = candidate.replace(/[,"'`]+$/, ""); // drop trailing punctuation from copy/paste
    if (!/^https?:\/\//i.test(candidate)) candidate = `https://${candidate}`;

    try {
        const u = new URL(candidate);
        const host = u.hostname.replace(/^www\./, "").toLowerCase();
        const normalizedPath = u.pathname.replace(/\/+$/, "").replace(/\/{2,}/g, "/") || "";
        return {
            host,
            path: normalizedPath,
            url: `${u.protocol}//${host}${normalizedPath}${u.search || ""}`
        };
    } catch {
        return null;
    }
};

export const sanitizeWebsite = (url) => {
    const info = buildUrlInfo(url);
    if (!info) return null;
    if (GENERIC_HOSTS.has(info.host) && !info.path) return null; // pure platform homepage
    if (PLACEHOLDER_TOKENS.some(t => info.url.toLowerCase().includes(t))) return null;
    return info.url;
};

export const sanitizeSocialLink = (platform, url) => {
    const info = buildUrlInfo(url);
    if (!info) return null;

    const hostMatches = (expected) => expected.some(h => info.host === h || info.host.endsWith(`.${h}`));
    const path = info.path.replace(/^\//, "");
    if (!path) return null;

    switch (platform) {
        case "youtube": {
            if (!hostMatches(["youtube.com", "youtu.be"])) return null;
            if (info.host === "youtu.be") return null; // video short links are not channel IDs

            // Normalize common channel/profile URL variants to their root.
            // Examples:
            // - /channel/<id>/videos -> /channel/<id>
            // - /@handle/videos -> /@handle
            // - /c/<name>/about -> /c/<name>
            const segments = path.split("/").filter(Boolean);
            const first = segments[0] || "";
            const second = segments[1] || "";
            const third = segments[2] || "";

            if (first.startsWith("@")) {
                if (/^@[A-Za-z0-9._-]{3,}$/.test(first)) return `https://youtube.com/${first}`;
                return null;
            }

            if (first === "channel") {
                if (/^[A-Za-z0-9_-]{8,}$/.test(second)) return `https://youtube.com/channel/${second}`;
                return null;
            }

            if (first === "c") {
                if (/^[A-Za-z0-9._-]{3,}$/.test(second)) return `https://youtube.com/c/${second}`;
                return null;
            }

            if (first === "user") {
                if (/^[A-Za-z0-9._-]{3,}$/.test(second)) return `https://youtube.com/user/${second}`;
                return null;
            }

            // Some results return bare handle-like paths without a prefix (rare). Reject those to reduce false positives.
            return null;
        }
        case "facebook": {
            if (!hostMatches(["facebook.com", "fb.com"])) return null;
            const segments = path.split("/").filter(Boolean);
            if (segments.length === 0) return null;

            const first = segments[0].toLowerCase();
            const disallowed = ["sharer.php", "share.php", "login.php", "home", "watch", "marketplace", "events", "profile.php"];
            if (disallowed.includes(first)) return null;

            if (first === "groups") {
                if (segments[1] && segments[1].length >= 5) {
                    return `https://www.facebook.com/groups/${segments[1]}`;
                }
                return null;
            }

            if (first === "pages" && segments[2]) {
                return `https://www.facebook.com/pages/${segments[1]}/${segments[2]}`;
            }

            if (first.length < 3) return null;
            return `https://www.facebook.com/${segments.join("/")}`;
        }
        case "instagram": {
            if (!hostMatches(["instagram.com"])) return null;
            const segments = path.split("/").filter(Boolean);
            if (segments.length === 0) return null;
            const first = segments[0].toLowerCase();
            const disallowed = ["p", "reel", "reels", "explore", "stories", "direct", "accounts", "about", "legal"];
            if (disallowed.includes(first)) return null;
            if (first.length < 3) return null;
            return `https://www.instagram.com/${segments[0]}`;
        }
        default:
            return null;
    }
};

export const sanitizeEmail = (email) => {
    if (!email) return null;
    const normalized = String(email).trim().toLowerCase();
    
    // 1. Basic format validation
    if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalized)) return null;
    
    // 2. Filter out placeholder tokens
    if (PLACEHOLDER_TOKENS.some(t => normalized.includes(t))) return null;
    
    // 3. Filter out obviously technical/hashed addresses (e.g. 605a7baede844d278b89dc95ae0a9123@...)
    const [localPart] = normalized.split("@");
    if (localPart && localPart.length >= 24 && /^[0-9a-f]{16,}$/.test(localPart)) return null;

    // 4. Block technical/infrastructure domains that don't provide contact emails for churches
    const blockedDomains = [
        "wix.com", "wordpress.com", "example.com", "email.com", 
        "wixpress.com", "sentry.io", "sentry-next.wixpress.com",
        "wp.com", "automattic.com", "squarespace.com", "intercom.io", "drift.com"
    ];
    if (blockedDomains.some(d => normalized.endsWith(`@${d}`))) return null;

    return normalized;
};

export const sanitizePhone = (phone) => {
    if (!phone) return null;
    const raw = String(phone).trim();
    const digits = raw.replace(/\D/g, "");
    if (digits.length < 8) return null;

    const uniqueDigits = new Set(digits.split(""));
    if (uniqueDigits.size <= 2) return null; // 00000000, 11111111, 12121212 etc.

    return raw;
};

export const COUNTRY_OPTIONS = [
    "Austria", "Belgium", "Bulgaria", "Croatia", "Cyprus", "Czech Republic",
    "Denmark", "Estonia", "Finland", "France", "Germany", "Greece", "Hungary",
    "Ireland", "Italy", "Latvia", "Lithuania", "Luxembourg", "Malta", "Moldova",
    "Netherlands", "Norway", "Poland", "Portugal", "Romania", "Slovakia", "Slovenia",
    "Spain", "Sweden", "Switzerland", "Ukraine", "United Kingdom", "United States", "Canada", "Australia"
].sort();

export const FIELDS = [
    { key: "locationTitle", label: "Location Title (Directions)", type: "text" },
    { key: "name", label: "Name", type: "text", required: true },
    { key: "city", label: "City / Locality", type: "text", required: true },
    { key: "country", label: "Country", type: "select", options: COUNTRY_OPTIONS },
    { key: "zipCode", label: "Postal Code", type: "text" },
    { key: "street", label: "Street", type: "text" },
    { key: "number", label: "Number", type: "text" },
    { key: "phone", label: "Phone", type: "text" },
    { key: "email", label: "Email", type: "text" },
    { key: "website", label: "Website", type: "text" },
    { key: "youtube", label: "YouTube", type: "text" },
    { key: "instagram", label: "Instagram", type: "text" },
    { key: "facebook", label: "Facebook", type: "text" },
];

export function emptyChurch() {
    return { name: "", locationTitle: "", street: "", number: "", city: "", country: "Romania", zipCode: "", lat: "", lng: "", phone: "", email: "", website: "", youtube: "", facebook: "", instagram: "", notes: "", isDraft: false, place_id: "", openingHours: [], googleMapsUri: "", rating: null };
}

export const PENTECOSTAL_NAMES = [
    // Classical Romanian / Biblic
    "Bethel", "Betel", "Betania", "Bethania", "Bethany", "Elim", "Emanuel", "Emmanuel", "Speranta", "Speranța", 
    "Filadelfia", "Philadelphia", "Maranata", "Maranatha", "Golgota", "Sion", "Harul", "Efes", 
    "Poarta Cerului", "Izvorul", "Agape", "Ghetsimani", "Carmel", "Gloria", 
    "Muntele Sionului", "Vestea Buna", "Vestea Bună", "Salem", "Lumina", 
    "Rugul Aprins", "Emaus", "Eben-Ezer", "Mangaietorul", "Mângâietorul", 
    "Piatra Unghiulara", "Piatra Unghiulară", "Stanca Mantuirii", "Stânca Mântuirii", 
    "Muntele Maslinilor", "Muntele Măslinilor", "Izvorul Vietii", "Izvorul Vieții", 
    "Alfa si Omega", "Alfa și Omega", "Lumina Lumii", "Logos", "Saron", "Siloam",
    "Pacea", "Izbavirea", "Horeb", "Buna Vestire", "Biruinta", "Biruința",
    "Casa Painii", "Casa Pâinii", "Canaan", "Muntele Moria", "Salvarea",
    "Sfantul Ilie", "Porumbita", "Pridvorul", "Calea, Adevarul si Viata", "Tabor",
    "Betesda", "Peniel", "Hebron", "Nazaret", "Nazareth", "Calvarul", "Ierusalim", 
    "Bereea", "Mahanaim", "Gosen", "Metanoia", "Harvest", "Via", "Shalom", 
    "Antiohia", "Apa Vie", "Viata Noua", "Viață Nouă", "Hermon", "Lidia", 
    "Prima", "Romana", "Română", "Apostolica", "Apostolică", "Crestina", "Creștină",
    // Biblic Towns & Regions
    "Sardes", "Smirna", "Pergam", "Tiatira", "Laodicea", "Patmos", "Colose", "Emaus",
    "Ierihon", "Galilee", "Iordan", "Sarepta", "Sidon", "Damasc", "Antioch",
    // Spiritual concepts (often used as names)
    "Bucuria", "Dragostea", "Credinta", "Credința", "Nadejdea", "Nădejdea", "Lumina", "Aura",
    "Roua", "Muntele Sion", "Poarta Cerului", "Izvorul", "Stanca", "Stânca",
    // English variants (very common in UK/USA)
    "Victory", "Living Water", "New Life", "Grace", "Hope", "Faith", "Cornerstone", "Solid Rock",
    "Good News", "Mount Zion", "Fountain of Life", "Morning Star", "Holy Trinity"
];

export const shuffleArray = (array) => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};


export const normalizeText = (text) => {
    return (text || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
};

export const matchChurchSearch = (c, q) => {
    if (!q) return true;
    const normalizedQuery = normalizeText(q);
    const fields = [c.name, c.city];
    return fields.some(val => normalizeText(val).includes(normalizedQuery));
};

export const hasDraftChanges = (item, draft) => {
    if (!item || !draft) return false;
    const fields = ["name", "locationTitle", "street", "number", "city", "country", "zipCode", "phone", "email", "website", "youtube", "facebook", "instagram", "lat", "lng", "place_id"];
    for (const f of fields) {
        if (String(item[f] || "") !== String(draft[f] || "")) return true;
    }
    if (JSON.stringify(item.openingHours || []) !== JSON.stringify(draft.openingHours || [])) return true;
    return false;
};



export const geocodeAddress = async (street, number, city, zipCode, country, locationTitle = "") => {
    if (locationTitle) {
        try {
            const placeQuery = [locationTitle, city, country].filter(Boolean).join(", ");
            const res = await fetch(`/api/geocode?type=places&query=${encodeURIComponent(placeQuery)}`);
            const data = await res.json();
            if (data.results && data.results.length > 0) {
                const loc = data.results[0].geometry?.location;
                return { 
                    lat: loc?.lat ?? null, 
                    lng: loc?.lng ?? null 
                };
            }
        } catch (e) {
            console.error("Places Proxy Search failed:", e);
        }
    }

    const addressQuery = [`${street || ""} ${number || ""}`.trim(), zipCode, city, country].map(s => (s || "").trim()).filter(Boolean).join(", ");
    if (!addressQuery) return null;

    try {
        const res = await fetch(`/api/geocode?type=geocode&address=${encodeURIComponent(addressQuery)}`);
        const data = await res.json();
        if (data.results && data.results.length > 0) {
            const loc = data.results[0].geometry.location;
            return { lat: loc.lat, lng: loc.lng };
        }
    } catch (e) {
        console.error("Geocoding Proxy failed:", e);
    }
    return null;
};

export const processGoogleData = (res, components, originalQuery = "", placeId = "", searchCity = "", searchCountry = "", fallbackUsed = false, googleError = null) => {
    const getComp = (types) => {
        const comp = components.find(c => c.types && types.some(t => c.types.includes(t)));
        return comp ? comp.long_name : null;
    };

    const cityName = getComp(["locality", "postal_town"]);
    let countryName = getComp(["country"]);
    if (countryName) {
        const matched = COUNTRY_OPTIONS.find(c => c.toLowerCase() === countryName.toLowerCase());
        if (matched) countryName = matched;
    }

    let rawName = res.name || originalQuery || "";
    const noise = [
        // Romanian
        "Biserica", "Penticostala", "Penticostală", "Penticostal",
        "Crestina", "Creștină", "Crestin", "Creștin",
        "Romana", "Română", "Românească", "Românesc",
        "Evanghelică", "Evanghelica", "Evanghelic",
        "Comunitatea", "Adunarea",
        // English
        "Church", "Pentecostal", "Christian", "Romanian",
        "Evangelical", "Evangelic", "Community", "Assembly",
        "Center", "Centre", "of", "the", "at",
        // French
        "Église", "Eglise", "Pentecôtiste", "Chrétienne", "Chrétien",
        "Roumaine", "Roumain", "Évangélique", "Evangelique",
        "Communauté", "Assemblée", "Centre", "de", "la", "le", "l", "du", "des",
        // Dutch
        "Kerk", "Gemeente", "Roemeens", "Roemeense",
        "Evangelisch", "Evangelische", "Christelijk", "Christelijke",
        "Pinkster", "Centrum", "Gemeenschap", "van", "de", "het", "der",
        // German
        "Kirche", "Gemeinde", "Rumänisch", "Rumänische",
        "Evangelische", "Christliche", "Pfingst", "Pfingstliche",
        "Zentrum", "Verein", "e.V.", "eV", "e V", "V", "von", "der", "die", "das", "in",
        // Italian
        "Chiesa", "Cristiana", "Cristiano", "Romena", "Romeno",
        "Evangelica", "Evangelico", "Comunità", "Centro", "di", "la", "il", "del",
        // Spanish
        "Iglesia", "Cristiana", "Cristiano", "Rumana", "Rumano",
        "Evangélica", "Comunidad", "Asamblea", "de", "la", "el", "en",
        // Portuguese
        "Igreja", "Cristã", "Romena", "Comunidade", "de", "a", "o",
        // Scandinavian (SE/NO/DK)
        "Kyrka", "Kirke", "Rumänska", "Rumensk", "Rumænsk",
        "Evangelisk", "Kristen", "Kristne", "Församling",
        // Hungarian
        "Templom", "Egyház", "Pünkösdi", "Keresztény",
        "Román", "Evangéliumi", "Közösség",
        // Denominational & Generic descriptors
        "Apostolica", "Apostolică", "Apostolic", "Apostolique", "Apostolico", "Apostolice",
        "Crestina", "Creștină", "Christian", "Cristiano", "Chrétienne", "Christelijk",
        "din", "de", "la", "du", "des", "van", "von", "der", "het", "of", "the", "at", "in", "and", "und", "et", "si", "și"
    ];
    
    // Add all country names to noise (e.g., to strip "Australia" from "Betania Australia")
    COUNTRY_OPTIONS.forEach(c => noise.push(c));
    
    if (cityName) noise.push(cityName);
    if (searchCity) noise.push(searchCity);
    if (searchCountry) noise.push(searchCountry);
    
    const normalize = (s) => s ? s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";
    const noiseNormalized = new Set(noise.map(normalize));
    
    const words = rawName.split(/[\s,.;:„"\"()\-–—\/|]+/);
    let cleanedName = words
        .filter(w => w && !noiseNormalized.has(normalize(w)))
        .join(" ")
        .trim();

    if (cleanedName.length < 2) cleanedName = rawName;
    
    // Deduplicate similar words (Elim vs Elime)
    const cleanedWords = cleanedName.split(" ");
    if (cleanedWords.length > 1) {
        const finalWords = [];
        cleanedWords.forEach(w => {
            const lowW = w.toLowerCase();
            const isDuplicate = finalWords.some(fw => {
                const lowFw = fw.toLowerCase();
                // If words are very similar or one is a prefix of the other (min 3 chars)
                if (lowFw.startsWith(lowW) || lowW.startsWith(lowFw)) {
                    if (Math.abs(lowW.length - lowFw.length) <= 2 && lowW.length >= 3) return true;
                }
                return false;
            });
            if (!isDuplicate) finalWords.push(w);
        });
        cleanedName = finalWords.join(" ");
    }
    
    // Final check: if cleanedName is in ALL CAPS but has multiple words, titlecase it
    if (cleanedName === cleanedName.toUpperCase() && cleanedName.includes(" ")) {
        cleanedName = cleanedName.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
    }

    const result = {};
    const isGenericBranding = (url, platform) => {
        if (!url) return false;
        const lowUrl = url.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
        
        // List of generic platform domains that should not be saved as a church's unique link
        const genericDomains = [
            "wordpress.com", "wix.com", "wixsite.com", "squarespace.com", 
            "weebly.com", "godaddy.com", "jimdo.com", "webnode.com", 
            "strikingly.com", "site123.com", "medium.com"
        ];

        // If the URL is EXACTLY one of these domains (no subdomain, no path), it's branding
        if (genericDomains.includes(lowUrl)) return true;

        // Platform specific generic paths
        if (platform === "facebook" && ["facebook.com", "fb.com", "facebook.com/pages", "facebook.com/groups"].includes(lowUrl)) return true;
        if (platform === "youtube" && ["youtube.com", "youtube.com/channel", "youtube.com/user", "youtube.com/c"].includes(lowUrl)) return true;
        if (platform === "instagram" && ["instagram.com", "instagram.com/p", "instagram.com/reels"].includes(lowUrl)) return true;

        return false;
    };

    const setIfValid = (key, val) => {
        if (val !== undefined && val !== null && val !== "") {
            if (["website", "facebook", "instagram", "youtube"].includes(key)) {
                if (isGenericBranding(val, key)) return;
            }
            result[key] = val;
        }
    };

    setIfValid("name", cleanedName);
    setIfValid("locationTitle", rawName);

    setIfValid("street", getComp(["route"]));
    setIfValid("number", getComp(["street_number"]));
    setIfValid("city", cityName);
    setIfValid("zipCode", getComp(["postal_code"]));
    setIfValid("country", countryName);
    setIfValid("phone", res.international_phone_number || res.formatted_phone_number);
    setIfValid("email", res.email);
    setIfValid("website", res.website);
    setIfValid("lat", res.geometry?.location?.lat);
    setIfValid("lng", res.geometry?.location?.lng);
    setIfValid("place_id", res.place_id || placeId);
    setIfValid("facebook", res.facebook);
    setIfValid("instagram", res.instagram);
    setIfValid("youtube", res.youtube);
    
    if (res.openingHours !== undefined) result.openingHours = res.openingHours || [];
    if (res.googleMapsUri !== undefined) result.googleMapsUri = res.googleMapsUri || "";
    if (res.rating !== undefined) result.rating = res.rating || null;

    result._partial = fallbackUsed;
    result._googleError = googleError;

    return result;
};

/**
 * Smart comparison to determine if a suggested value is actually an update
 * or just a reformatting of existing data.
 */
export const isMeaningfullyDifferent = (oldVal, newVal, field) => {
    const sOld = String(oldVal || "").trim();
    const sNew = String(newVal || "").trim();

    if (!sNew) return false; // Google returned nothing, not a change
    if (!sOld && sNew) return true; // New data where none existed before

    const normalize = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

    if (field === "name") {
        const nOld = normalize(sOld);
        const nNew = normalize(sNew);
        
        // 1. If identical after normalization
        if (nOld === nNew) return false;
        
        return true;
    }

    if (field === "phone") {
        // Compare only digits
        const dOld = sOld.replace(/\D/g, "");
        const dNew = sNew.replace(/\D/g, "");
        return dOld !== dNew;
    }

    if (field === "website" || field === "facebook" || field === "instagram" || field === "youtube") {
        // Normalize URLs (remove protocol, www, trailing slash)
        const normUrl = (url) => url.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
        return normUrl(sOld) !== normUrl(sNew);
    }

    // Default: simple trimmed comparison
    return sOld !== sNew;
};

// In-memory cache (per browser session) to reduce repeated Google Places calls.
const GOOGLE_PLACE_CACHE_TTL_MS = 60 * 60 * 1000; // 1h
const googlePlaceCache = new Map(); // key -> { t: number, v: any }

const cacheGet = (key) => {
    const entry = googlePlaceCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.t > GOOGLE_PLACE_CACHE_TTL_MS) {
        googlePlaceCache.delete(key);
        return null;
    }
    return entry.v;
};

const cacheSet = (key, value) => {
    if (!key) return;
    if (value === undefined || value === null) return;
    googlePlaceCache.set(key, { t: Date.now(), v: value });
};


export const fetchGooglePlaceData = async (query, city = "", country = "", placeId = "") => {
    if (placeId) {
        const cached = cacheGet(`place:${placeId}`);
        if (cached) return cached;

        console.log("Syncing via Place ID (Priority):", placeId);
        try {
            const detailsRes = await fetch(`/api/geocode?type=details&place_id=${placeId}`);
            const detailsData = await detailsRes.json();
            
            if (detailsData.result) {
                const processed = processGoogleData(detailsData.result, detailsData.result.address_components || [], query, placeId, city, country);
                cacheSet(`place:${placeId}`, processed);
                return processed;
            }
        } catch (e) {
            console.error("Fetch by Place ID failed, will try search as fallback:", e);
        }
    }

    if (!query) return null;
    console.log("Searching Google for:", query, city, country);
    
    try {
        let results = [];
        let status = "ZERO_RESULTS";
        let fallbackUsed = false;
        let googleError = null;

        const performSearch = async (q) => {
            const res = await fetch(`/api/geocode?type=places&query=${encodeURIComponent(q)}`);
            return await res.json();
        };

        const q = [query, city, country].filter(Boolean).join(", ");
        if (!q) return null;

        const cachedQuery = cacheGet(`q:${q}`);
        if (cachedQuery) return cachedQuery;

        const data = await performSearch(q);
        results = data.results || [];
        status = data.status;
        googleError = data._googleError;
        fallbackUsed = data._fallback || false;

        
        if (results.length === 0) {
            console.warn("No results found for query:", query);
            return null;
        }

        const firstResult = results[0];

        if (fallbackUsed) {
            console.log("Using Geocoding/fallback data directly");
            const processed = processGoogleData(firstResult, firstResult.address_components || [], query, "", city, country, fallbackUsed, googleError);
            if (processed?.place_id) cacheSet(`place:${processed.place_id}`, processed);
            cacheSet(`q:${q}`, processed);
            return processed;
        }
        
        console.log("Found results, fetching details for:", firstResult.name);
        const detailsRes = await fetch(`/api/geocode?type=details&place_id=${firstResult.place_id || firstResult.id}`);
        const detailsData = await detailsRes.json();
        
        if (!detailsData.result) return null;
        const processed = processGoogleData(detailsData.result, detailsData.result.address_components || [], query, "", city, country, fallbackUsed, googleError);
        if (processed?.place_id) cacheSet(`place:${processed.place_id}`, processed);
        cacheSet(`q:${q}`, processed);
        return processed;

    } catch (e) {
        console.error("Fetch Google Place Data failed:", e);
        return null;
    }
};
