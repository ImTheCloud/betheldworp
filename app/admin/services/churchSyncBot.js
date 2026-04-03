/**
 * ChurchSyncBot Service
 * Performs zero-cost church data synchronization using:
 * 1. Google Places Data
 * 2. Official website scraping
 * 3. Web search fallback (for missing fields when no website or scraping fails)
 */

import { fetchGooglePlaceData, isMeaningfullyDifferent, sanitizeSocialLink, sanitizeWebsite, sanitizeEmail, sanitizePhone } from "../utils/churchHelpers";

// ─────────────────────────────────────────────────────────────────────────────
// ORCHESTRATOR
// ─────────────────────────────────────────────────────────────────────────────

export async function syncChurchBot(churchData, onStatus = () => {}, options = {}) {
    const query = churchData.locationTitle || churchData.name;
    const city = churchData.city;
    const country = churchData.country;
    const placeId = churchData.place_id;

    // ── 1. Google Places ─────────────────────────────────────────────────────
    const providedGoogle = options && typeof options === "object" ? options.googleData : null;
    const skipGoogle = !!(options && typeof options === "object" && options.skipGoogle);

    onStatus("Checking Google Places...");
    const googleData = skipGoogle ? null : (providedGoogle || await fetchGooglePlaceData(query, city, country, placeId));
    let enrichedData = cleanContacts(googleData);

    // ── 2. Official website scraping ─────────────────────────────────────────
    const website = enrichedData.website || churchData.website;
    if (website && website !== "#") {
        onStatus(`Analyzing website: ${website.replace(/^https?:\/\//, "")}...`);
        try {
            const scrapedData = await scrapeChurchWebsite(website);
            if (scrapedData) {
                // Google card data has priority. Website scraping only fills missing fields.
                const scrapedClean = cleanContacts(scrapedData);
                const merged = { ...scrapedClean, ...enrichedData }; // existing (Google) wins on conflicts

                // Opening hours: only use scraped hours if Google didn't provide them.
                if ((!enrichedData.openingHours || enrichedData.openingHours.length === 0) && scrapedData.openingHours) {
                    merged.openingHours = scrapedData.openingHours;
                }

                enrichedData = cleanContacts(merged);
            }
        } catch (err) {
            console.error(`SyncBot: Website scraping failed for ${website}:`, err);
        }
    }

    onStatus("Finalizing enrichment...");
    return enrichedData;
}

// Ensure scraped/google data can't inject placeholder/fake contact links
function cleanContacts(data) {
    // fetchGooglePlaceData() can return null; treat non-objects as empty.
    const source = (data && typeof data === "object") ? data : {};
    const cleaned = { ...source };
    if (source.website) cleaned.website = sanitizeWebsite(source.website);
    if (source.facebook) cleaned.facebook = sanitizeSocialLink("facebook", source.facebook);
    if (source.instagram) cleaned.instagram = sanitizeSocialLink("instagram", source.instagram);
    if (source.youtube) cleaned.youtube = sanitizeSocialLink("youtube", source.youtube);
    if (source.email) cleaned.email = sanitizeEmail(source.email);
    if (source.phone) cleaned.phone = sanitizePhone(source.phone);

    // Drop nullified fields
    ["website", "facebook", "instagram", "youtube", "email", "phone"].forEach(k => {
        if (!cleaned[k]) delete cleaned[k];
    });

    return cleaned;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — Official website scraping
// ─────────────────────────────────────────────────────────────────────────────

export async function scrapeChurchWebsite(url) {
    if (!url || url === "#") return null;
    try {
        const response = await fetch(`/api/scrape?url=${encodeURIComponent(url)}`);
        const { html, error } = await response.json();
        if (error) throw new Error(error);
        return extractFromHtml(html);
    } catch (err) {
        console.warn(`Scrape failed for ${url}:`, err);
        return null;
    }
}

function extractFromHtml(html) {
    if (!html) return {};
    const data = {};

    // --- Helper to find the first valid social link ---
    const findValidLink = (regex, blacklist) => {
        const matches = html.matchAll(new RegExp(regex, "gi"));
        for (const match of matches) {
            const fullMatch = match[0].replace(/\/$/, "");
            const pathPart = match[1] || "";
            const path = pathPart.toLowerCase().replace(/\/$/, "");
            
            // 1. MUST have a handle/path
            if (!path) continue;
            
            // 2. MUST NOT be in the blacklist
            if (blacklist.includes(path)) continue;
            
            // 3. Handle MUST be at least 3 chars (filtering out 'a', '12', etc.)
            if (path.length < 3) continue;

            // 4. Special check for YouTube: if it matched "channel" but the regex was loose
            if (fullMatch.endsWith("/channel") || fullMatch.endsWith("/user") || fullMatch.endsWith("/c")) continue;

            return fullMatch;
        }
        return null;
    };

    const fbLink = findValidLink(/https?:\/\/(?:www\.)?facebook\.com\/([a-zA-Z0-9._-]+)/gi, 
        ["people", "groups", "sharer", "login", "r.php", "hashtag", "messages", "profile.php", "pages", "home", "watch", "marketplace", "gaming", "events"]);
    if (fbLink) data.facebook = fbLink;

    const ytLink = findValidLink(/https?:\/\/(?:www\.)?youtube\.com\/(?:user\/|channel\/|c\/|@)?([a-zA-Z0-9._-]+)/gi, 
        ["c", "channel", "user", "results", "watch", "playlist", "live", "shorts", "feed", "about"]);
    if (ytLink) {
        // Ensure YouTube link has full path if it's just a handle
        data.youtube = ytLink.includes("youtube.com/") ? ytLink : `https://www.youtube.com/${ytLink}`;
    }

    const igLink = findValidLink(/https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9._-]+)/gi, 
        ["p", "reel", "explore", "stories", "direct", "accounts", "legal", "about", "explore/locations", "reels"]);
    if (igLink) data.instagram = igLink;

    const emails = html.match(/[a-zA-Z0-9._%+-]+@(?!(?:example|domain|support|yoursite|email|wix|wordpress|squarespace|wixpress|sentry|hubspot|intercom)\.[a-z]{2,})[a-z0-9.-]+\.[a-z]{2,}/gi) || [];
    
    if (emails.length > 0) {
        // Known technical/placeholder emails to strictly ignore
        const garbage = [
            "writer@support.com", "user@example.com", "info@yourdomain.com", 
            "john.doe@gmail.com", "support@wordpress.com", "admin@wix.com",
            "info@wix.com", "support@wix.com", "contact@wix.com",
            "noreply@wordpress.com", "donotreply@wordpress.com",
            "sentry-next.wixpress.com"
        ];
        const cleanEmails = emails.filter(e => {
            const lowE = e.toLowerCase();
            
            // 1. Check against garbage list or containing technical keywords
            if (garbage.includes(lowE)) return false;
            if (lowE.includes("template") || lowE.includes("theme") || lowE.includes("yourdomain") || lowE.includes("yoursite")) return false;

            // 2. Reject long hexadecimal hashes (technical error reporting)
            const [localPart] = lowE.split("@");
            if (localPart.length >= 24 && /^[0-9a-f]+$/.test(localPart)) return false;

            return true;
        });
        
        if (cleanEmails.length > 0) {
            // Priority: if an email contains the church name or "gmail/hotmail", pick it first
            const bestEmail = cleanEmails.find(e => e.toLowerCase().includes("gmail.com") || e.toLowerCase().includes("outlook.")) || cleanEmails[0];
            data.email = bestEmail.toLowerCase();
        }
    }

    const phoneMatch = html.match(/(?:\+40|0040|0)\s?(?:7[0-9]{2}|[23][0-9]{2})[.\s-]?[0-9]{3}[.\s-]?[0-9]{3}/);
    if (phoneMatch) {
        const rawPhone = phoneMatch[0].replace(/\s/g, "");
        // Avoid obviously fake numbers like 0700000000 or 123456789
        const digitsOnly = rawPhone.replace(/\D/g, "");
        const isRepeated = /(.)\1{5,}/.test(digitsOnly); // Same digit 6+ times
        if (!isRepeated && digitsOnly.length >= 9) {
            data.phone = rawPhone;
        }
    }

    const days = [
        { key: "Duminică", variants: ["Duminica", "Sunday", "Duminică"] },
        { key: "Marți", variants: ["Marti", "Tuesday"] },
        { key: "Joi", variants: ["Joi", "Thursday"] },
        { key: "Vineri", variants: ["Vineri", "Friday"] },
    ];
    const openingHours = [];
    days.forEach(({ key, variants }) => {
        const pattern = new RegExp(`(?:${variants.join("|")})[^<]{1,20}(\\d{1,2}(?::|\\.)\\d{2})`, "i");
        const m = html.match(pattern);
        if (m) openingHours.push(`${key}: ${m[1]}`);
    });
    if (openingHours.length > 0) data.openingHours = openingHours;

    return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fuzzy matching & suggestion helpers
// ─────────────────────────────────────────────────────────────────────────────

export function fuzzyMatch(s1, s2) {
    if (!s1 || !s2) return 0;
    s1 = s1.toLowerCase().trim();
    s2 = s2.toLowerCase().trim();
    if (s1 === s2) return 1;

    const longer = s1.length < s2.length ? s2 : s1;
    const shorter = s1.length < s2.length ? s1 : s2;
    const len = longer.length;
    if (len === 0) return 1;

    return (len - editDistance(longer, shorter)) / parseFloat(len);
}

function editDistance(s1, s2) {
    const costs = [];
    for (let i = 0; i <= s1.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= s2.length; j++) {
            if (i === 0) {
                costs[j] = j;
            } else if (j > 0) {
                let newValue = costs[j - 1];
                if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
                    newValue = Math.min(newValue, lastValue, costs[j]) + 1;
                }
                costs[j - 1] = lastValue;
                lastValue = newValue;
            }
        }
        if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
}

export function isBotSuggestionUseful(church, newData) {
    if (!newData) return false;

    const fieldsToCheck = ["name", "phone", "email", "website", "facebook", "instagram", "youtube"];
    for (const f of fieldsToCheck) {
        if (newData[f] && isMeaningfullyDifferent(church[f], newData[f], f)) {
            if (f === "name" && fuzzyMatch(church[f], newData[f]) > 0.9) continue;
            return true;
        }
    }

    if (newData.openingHours?.length > 0) {
        if (JSON.stringify(church.openingHours || []) !== JSON.stringify(newData.openingHours)) return true;
    }

    return false;
}
