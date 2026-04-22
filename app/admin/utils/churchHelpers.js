export const safeStr = (v) => String(v ?? "");

// ─────────────────────────────────────────────────────────────────────────────
// URL & contact sanitizers to avoid saving placeholder/fake links
// ─────────────────────────────────────────────────────────────────────────────

const GENERIC_HOSTS = new Set([
    "wordpress.com", "wix.com", "wixsite.com", "squarespace.com", "weebly.com",
    "godaddy.com", "jimdo.com", "webnode.com", "strikingly.com", "site123.com",
    "medium.com", "blogspot.com", "tumblr.com",
    "duckduckgo.com", "google.com", "bing.com", "yahoo.com", "facebook.com", "facebook.ro", "fb.com", "instagram.com", "youtube.com"
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
    return { name: "", locationTitle: "Biserica penticostală ", street: "", number: "", city: "", country: "Romania", zipCode: "", lat: "", lng: "", phone: "", email: "", website: "", youtube: "", facebook: "", instagram: "", notes: "", isDraft: false, place_id: "", googleMapsUri: "" };
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
        const res = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`);
        const data = await res.json();
        if (data.error) return null;
        return {
            lat: data.lat,
            lng: data.lng,
            place_id: data.place_id
        };
    } catch (e) {
        return null;
    }
}

export function parseAddressComponents(components) {
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

export async function resolveChurchFromTitle(title) {
    if (!title) return null;
    try {
        const res = await fetch(`/api/geocode?address=${encodeURIComponent(title)}`);
        const data = await res.json();
        
        if (data.error || !data.address_components) return null;

        const parsed = parseAddressComponents(data.address_components);
        
        // Check confidence: Geocoding sometimes returns 'establishment' in Types if it's high confidence.
        // If it's only 'locality' or 'political', it's a city-level fallback.
        const isEstablishment = data.types.some(t => ["establishment", "point_of_interest", "church", "place_of_worship"].includes(t));
        const isLowConfidence = !isEstablishment;

        // Try to find a clean name in address components if it's an establishment
        const est = data.address_components.find(c => c.types.includes("establishment"));
        let name = est ? est.long_name : "";

        if (!name || isLowConfidence) {
            name = title.replace(/Biserica penticostal[a\u0103]/gi, "").trim();
            if (name) name = name.charAt(0).toUpperCase() + name.slice(1);
        }

        return {
            ...parsed,
            name: name,
            lat: data.lat,
            lng: data.lng,
            place_id: data.place_id,
            phone: data.phone || "",
            website: data.website || "",
            googleMapsUri: data.googleMapsUri || "",
            locationTitle: title,
            isLowConfidence
        };
    } catch (e) {
        console.error("resolveChurchFromTitle error:", e);
        return null;
    }
}
