// Shared utilities and constants for church admin sections

import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../../lib/Firebase";

export const safeStr = (v) => String(v ?? "");

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
    return { name: "", locationTitle: "", street: "", number: "", city: "", country: "Belgium", zipCode: "", lat: "", lng: "", phone: "", email: "", website: "", youtube: "", facebook: "", instagram: "", notes: "", isDraft: false, place_id: "", openingHours: [], googleMapsUri: "", rating: null };
}

export const PENTECOSTAL_NAMES = [
    "Bethel", "Betania", "Bethania", "Bethany", "Elim", "Emanuel", "Speranta", "Speranța", 
    "Filadelfia", "Maranata", "Maranatha", "Golgota", "Sion", "Harul", "Efes", 
    "Poarta Cerului", "Izvorul", "Agape", "Ghetsimani", "Carmel", "Gloria", 
    "Muntele Sionului", "Vestea Buna", "Vestea Bună", "Salem", "Lumina", 
    "Rugul Aprins", "Emaus", "Eben-Ezer", "Mangaietorul", "Mângâietorul", 
    "Piatra Unghiulara", "Piatra Unghiulară", "Stanca Mantuirii", "Stânca Mântuirii", 
    "Muntele Maslinilor", "Muntele Măslinilor", "Izvorul Vietii", "Izvorul Vieții", 
    "Alfa si Omega", "Alfa și Omega", "Lumina Lumii", "Logos", "Saron", "Siloam",
    "Pacea", "Izbavirea", "Horeb", "Buna Vestire", "Biruinta", "Biruința",
    "Casa Painii", "Casa Pâinii", "Canaan", "Muntele Moria", "Salvarea",
    "Sfantul Ilie", "Porumbita", "Pridvorul", "Calea, Adevarul si Viata", "Tabor"
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

export const processGoogleData = (res, components, originalQuery = "", placeId = "", fallbackUsed = false, googleError = null) => {
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
        "Center", "Centre",
        // French
        "Église", "Eglise", "Pentecôtiste", "Chrétienne", "Chrétien",
        "Roumaine", "Roumain", "Évangélique", "Evangelique",
        "Communauté", "Assemblée", "Centre",
        // Dutch
        "Kerk", "Gemeente", "Roemeens", "Roemeense",
        "Evangelisch", "Evangelische", "Christelijk", "Christelijke",
        "Pinkster", "Centrum", "Gemeenschap",
        // German
        "Kirche", "Gemeinde", "Rumänisch", "Rumänische",
        "Evangelische", "Christliche", "Pfingst", "Pfingstliche",
        "Zentrum", "Verein", "e.V.", "eV", "e V", "V",
        // Italian
        "Chiesa", "Cristiana", "Cristiano", "Romena", "Romeno",
        "Evangelica", "Evangelico", "Comunità", "Centro",
        // Spanish
        "Iglesia", "Cristiana", "Cristiano", "Rumana", "Rumano",
        "Evangélica", "Comunidad", "Asamblea",
        // Portuguese
        "Igreja", "Cristã", "Romena", "Comunidade",
        // Scandinavian (SE/NO/DK)
        "Kyrka", "Kirke", "Rumänska", "Rumensk", "Rumænsk",
        "Evangelisk", "Kristen", "Kristne", "Församling",
        // Hungarian
        "Templom", "Egyház", "Pünkösdi", "Keresztény",
        "Román", "Evangéliumi", "Közösség",
        // Generic descriptors
        "din", "de", "la", "du", "des", "van", "von", "der", "het"
    ];
    if (cityName) noise.push(cityName);
    
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
    const setIf = (key, val) => {
        if (val !== undefined && val !== null && val !== "") {
            result[key] = val;
        }
    };

    setIf("name", cleanedName);
    setIf("locationTitle", rawName);

    setIf("street", getComp(["route"]));
    setIf("number", getComp(["street_number"]));
    setIf("city", cityName);
    setIf("zipCode", getComp(["postal_code"]));
    setIf("country", countryName);
    setIf("phone", res.international_phone_number);
    setIf("email", res.email);
    setIf("website", res.website);
    setIf("lat", res.geometry?.location?.lat);
    setIf("lng", res.geometry?.location?.lng);
    setIf("place_id", res.place_id || placeId);
    setIf("facebook", res.facebook);
    setIf("instagram", res.instagram);
    setIf("youtube", res.youtube);
    
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
        
        // 2. If one is a complete substring of the other (common for "Elim" vs "Elim Christliche...")
        // AND both share the same starting word
        const firstWordOld = nOld.split(" ")[0];
        const firstWordNew = nNew.split(" ")[0];
        
        if (firstWordOld === firstWordNew) {
           if (nNew.includes(nOld) || nOld.includes(nNew)) return false;
        }

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


export const fetchGooglePlaceData = async (query, city = "", country = "", placeId = "") => {
    if (placeId) {
        console.log("Syncing via Place ID (Priority):", placeId);
        try {
            const detailsRes = await fetch(`/api/geocode?type=details&place_id=${placeId}`);
            const detailsData = await detailsRes.json();
            
            if (detailsData.result) {
                return processGoogleData(detailsData.result, detailsData.result.address_components || [], query, placeId);
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

        if (country) {
            const q = [query, city, country].filter(Boolean).join(", ");
            const data = await performSearch(q);
            results = data.results || [];
            status = data.status;
            googleError = data._googleError;
            fallbackUsed = data._fallback || false;
        }

        
        if (results.length === 0) {
            console.warn("No results found for query:", query);
            return null;
        }

        const firstResult = results[0];

        if (fallbackUsed) {
            console.log("Using Geocoding/fallback data directly");
            return processGoogleData(firstResult, firstResult.address_components || [], query, "", fallbackUsed, googleError);
        }
        
        console.log("Found results, fetching details for:", firstResult.name);
        const detailsRes = await fetch(`/api/geocode?type=details&place_id=${firstResult.place_id || firstResult.id}`);
        const detailsData = await detailsRes.json();
        
        if (!detailsData.result) return null;
        return processGoogleData(detailsData.result, detailsData.result.address_components || [], query, "", fallbackUsed, googleError);

    } catch (e) {
        console.error("Fetch Google Place Data failed:", e);
        return null;
    }
};
