import { getAuth } from "firebase/auth";

export const safeStr = (v) => String(v ?? "");

// Les routes API réservées à l'admin exigent le jeton Firebase de la session.
// Sans lui, le serveur répond 401, c'est ce qui empêche un visiteur d'utiliser
// notre quota Google Places.
export async function adminAuthHeaders() {
    const user = getAuth().currentUser;
    if (!user) return {};
    try {
        return { authorization: `Bearer ${await user.getIdToken()}` };
    } catch (e) {
        console.error("Could not get admin token:", e);
        return {};
    }
}

export const COUNTRY_OPTIONS = [
    "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan",
    "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi",
    "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo (Congo-Brazzaville)", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czech Republic",
    "Democratic Republic of the Congo", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia",
    "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana",
    "Haiti", "Holy See", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Ivory Coast",
    "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg",
    "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar",
    "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway",
    "Oman", "Pakistan", "Palau", "Palestine State", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal",
    "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria",
    "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu",
    "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Vanuatu", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"
].sort();

export function emptyChurch() {
    return { name: "", locationTitle: "Biserica penticostală ", street: "", number: "", city: "", country: "Romania", zipCode: "", lat: "", lng: "", phone: "", email: "", website: "", youtube: "", facebook: "", instagram: "", notes: "", isDraft: false, place_id: "", googleMapsUri: "" };
}

export const normalizeText = (text) => {
    return (text || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
};

export const isMeaningfullyDifferent = (a, b) => {
    const normA = String(a ?? "").trim().toLowerCase();
    const normB = String(b ?? "").trim().toLowerCase();
    return normA !== normB;
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
    return false;
};




export async function geocodeAddress(church) {
    const address = [
        `Biserica penticostală ${church.name || ""}`.trim(),
        (`${church.street || ""} ${church.number || ""}`.trim()),
        church.city || "",
        church.country || ""
    ].filter(Boolean).join(", ");

    if (!address) return null;

    try {
        const res = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`, {
            headers: await adminAuthHeaders(),
        });
        const data = await res.json();
        if (data.error) return null;
        return {
            lat: data.lat,
            lng: data.lng,
            place_id: data.place_id
        };
    } catch {
        return null;
    }
}

function parseAddressComponents(components) {
    if (!components) return {};
    const map = {};
    components.forEach(c => {
        c.types.forEach(t => { 
            // Store all types, but don't overwrite if already there (prioritizes first appearance)
            if (!map[t]) map[t] = c.long_name; 
        });
    });

    return {
        // 'route' is the standard street name. 'street_address' or 'intersection' are fallbacks.
        street: map.route || map.street_address || map.intersection || map.premise || "",
        number: map.street_number || "",
        // More descriptive fallbacks for city/locality
        city: map.locality || map.sublocality_level_1 || map.neighborhood || map.postal_town || map.administrative_area_level_3 || map.administrative_area_level_2 || "",
        zipCode: map.postal_code || "",
        country: map.country || ""
    };
}

export async function resolveChurchFromTitle(title, context = {}) {
    if (!title) return null;
    try {
        // Build a more specific query by appending country context for disambiguation
        // e.g. "Biserica penticostală Elim Parma" + ", Romania" → finds Parma Romania, not Parma Italy
        let query = title;
        if (context.country) query += `, ${context.country}`;

        const res = await fetch(`/api/geocode?address=${encodeURIComponent(query)}`, {
            headers: await adminAuthHeaders(),
        });
        const data = await res.json();
        
        if (data.error || !data.address_components) return null;

        const parsed = parseAddressComponents(data.address_components);
        
        // Check confidence: Geocoding sometimes returns 'establishment' in Types if it's high confidence.
        // If it's only 'locality' or 'political', it's a city-level fallback.
        const isEstablishment = data.types.some(t => ["establishment", "point_of_interest", "church", "place_of_worship"].includes(t));
        const isLowConfidence = !isEstablishment;

        // Le nom vient des composants d'adresse. L'API Places, qui renvoyait
        // aussi le nom de l'établissement, son téléphone et son site, n'est plus
        // utilisée : Google a retiré sa version « legacy » et le projet ne l'a
        // jamais activée, la branche échouait donc silencieusement.
        const est = data.address_components.find(c => c.types.includes("establishment"));
        let name = est ? est.long_name : "";

        if (!name || isLowConfidence) {
            // Strip "Biserica penticostală" prefix and also strip the city name from the end
            name = title.replace(/Biserica penticostal[a\u0103]/gi, "").trim();
            // Remove trailing city name if present (e.g. "Elim Parma" → "Elim" when city is "Parma")
            const city = parsed.city || context.city || "";
            if (city && name.toLowerCase().endsWith(city.toLowerCase())) {
                name = name.slice(0, -city.length).trim();
            }
            if (name) name = name.charAt(0).toUpperCase() + name.slice(1);
        }

        return {
            ...parsed,
            name: name,
            lat: data.lat,
            lng: data.lng,
            place_id: data.place_id,
            locationTitle: title,
            isLowConfidence
        };
    } catch (e) {
        console.error("resolveChurchFromTitle error:", e);
        return null;
    }
}
