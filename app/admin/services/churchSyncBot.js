/**
 * ChurchSyncBot Service
 * Performs zero-cost church data synchronization using:
 * 1. Google Places Data
 * 2. Official website scraping
 * 3. Web search fallback (for missing fields when no website or scraping fails)
 */

import { fetchGooglePlaceData, isMeaningfullyDifferent } from "../utils/churchHelpers";

// ─────────────────────────────────────────────────────────────────────────────
// ORCHESTRATOR
// ─────────────────────────────────────────────────────────────────────────────

export async function syncChurchBot(churchData, onStatus = () => {}) {
    const query = churchData.locationTitle || churchData.name;
    const city = churchData.city;
    const country = churchData.country;
    const placeId = churchData.place_id;

    // ── 1. Google Places ─────────────────────────────────────────────────────
    onStatus("Checking Google Places...");
    const googleData = await fetchGooglePlaceData(query, city, country, placeId);
    let enrichedData = { ...googleData };

    // ── 2. Official website scraping ─────────────────────────────────────────
    const website = enrichedData.website || churchData.website;
    if (website && website !== "#") {
        onStatus(`Analyzing website: ${website.replace(/^https?:\/\//, "")}...`);
        try {
            const scrapedData = await scrapeChurchWebsite(website);
            if (scrapedData) {
                enrichedData = { ...enrichedData, ...scrapedData };
                if ((!enrichedData.openingHours || enrichedData.openingHours.length === 0) && scrapedData.openingHours) {
                    enrichedData.openingHours = scrapedData.openingHours;
                }
            }
        } catch (err) {
            console.error(`SyncBot: Website scraping failed for ${website}:`, err);
        }
    }

    onStatus("Finalizing enrichment...");
    return enrichedData;
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
            const path = match[1].toLowerCase();
            if (!blacklist.includes(path)) {
                return match[0].replace(/\/$/, "");
            }
        }
        return null;
    };

    const fbLink = findValidLink(/https?:\/\/(?:www\.)?facebook\.com\/([a-zA-Z0-9._-]+)/gi, 
        ["people", "groups", "sharer", "login", "r.php", "hashtag", "messages", "profile.php"]);
    if (fbLink) data.facebook = fbLink;

    const ytLink = findValidLink(/https?:\/\/(?:www\.)?youtube\.com\/(?:user|channel|c|@)?([a-zA-Z0-9._-]+)/gi, 
        ["c", "channel", "user", "results", "watch", "playlist", "live"]);
    if (ytLink) {
        // Ensure YouTube link has full path if it's just a handle
        data.youtube = ytLink.includes("youtube.com/") ? ytLink : `https://www.youtube.com/${ytLink}`;
    }

    const igLink = findValidLink(/https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9._-]+)/gi, 
        ["p", "reel", "explore", "stories", "direct", "accounts"]);
    if (igLink) data.instagram = igLink;

    const emails = html.match(/[a-zA-Z0-9._%+-]+@(?!(?:example|domain|support|yoursite|email)\.[a-z]{2,})[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi) || [];
    
    if (emails.length > 0) {
        // Known placeholders to strictly ignore
        const garbage = ["writer@support.com", "user@example.com", "info@yourdomain.com", "john.doe@gmail.com", "support@wordpress.com"];
        const cleanEmails = emails.filter(e => !garbage.includes(e.toLowerCase()) && !e.toLowerCase().includes("template") && !e.toLowerCase().includes("theme"));
        
        if (cleanEmails.length > 0) {
            // Priority: if an email contains the church name or "gmail/hotmail", pick it first
            const bestEmail = cleanEmails.find(e => e.toLowerCase().includes("gmail.com") || e.toLowerCase().includes("outlook.")) || cleanEmails[0];
            data.email = bestEmail.toLowerCase();
        }
    }

    const phoneMatch = html.match(/(?:\+40|0040|0)\s?(?:7[0-9]{2}|[23][0-9]{2})[.\s-]?[0-9]{3}[.\s-]?[0-9]{3}/);
    if (phoneMatch) data.phone = phoneMatch[0].replace(/\s/g, "");

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

