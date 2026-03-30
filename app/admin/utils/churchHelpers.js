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
    return { name: "", locationTitle: "", street: "", number: "", city: "", country: "Belgium", zipCode: "", lat: "", lng: "", phone: "", email: "", website: "", youtube: "", facebook: "", instagram: "", notes: "", isDraft: false, place_id: "", openingHours: [], photos: [], googleMapsUri: "", rating: null };
}

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
    if (JSON.stringify(item.photos || []) !== JSON.stringify(draft.photos || [])) return true;
    return false;
};

export const uploadPhotosIfNeeded = async (photos, id) => {
    if (!photos || !photos.length) return [];
    
    return await Promise.all(photos.map(async (photo, idx) => {
        if (photo.startsWith("http")) return photo;
        try {
            const res = await fetch(`/api/geocode?type=photo&photo_name=${encodeURIComponent(photo)}`);
            if (!res.ok) throw new Error("Failed to fetch photo from proxy");
            const blob = await res.blob();
            
            const storageRef = ref(storage, `churches/${id}/${Date.now()}_${idx}.jpg`);
            await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });
            return await getDownloadURL(storageRef);
        } catch (e) {
            console.error("Firebase Storage Upload Error:", e);
            return photo; 
        }
    }));
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
        "Zentrum",
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

    const result = {};
    const setIf = (key, val) => {
        if (val !== undefined && val !== null && val !== "") {
            result[key] = val;
        }
    };

    setIf("name", cleanedName);
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
    if (res.photos !== undefined) result.photos = res.photos || [];
    if (res.googleMapsUri !== undefined) result.googleMapsUri = res.googleMapsUri || "";
    if (res.rating !== undefined) result.rating = res.rating || null;

    result._partial = fallbackUsed;
    result._googleError = googleError;

    return result;
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

        if (country && country !== "Belgium") {
            const q = [query, city, country].filter(Boolean).join(", ");
            const data = await performSearch(q);
            results = data.results || [];
            status = data.status;
            googleError = data._googleError;
            fallbackUsed = data._fallback || false;
        }

        if (results.length === 0) {
            console.log("Searching with just query:", query);
            const data = await performSearch(query);
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
