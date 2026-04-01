/**
 * ChurchSyncBot Service
 * Performs zero-cost church data synchronization using:
 * 1. Google Places Data
 * 2. Official website scraping
 */

import { fetchGooglePlaceData, isMeaningfullyDifferent } from "../utils/churchHelpers";

// ─────────────────────────────────────────────────────────────────────────────
// ORCHESTRATOR
// ─────────────────────────────────────────────────────────────────────────────

export async function syncChurchBot(churchData) {
    const query = churchData.locationTitle || churchData.name;
    const city = churchData.city;
    const country = churchData.country;
    const placeId = churchData.place_id;

    // ── 1. Google Places ─────────────────────────────────────────────────────
    const googleData = await fetchGooglePlaceData(query, city, country, placeId);
    let enrichedData = { ...googleData };

    // ── 2. Official website scraping ─────────────────────────────────────────
    const website = enrichedData.website || churchData.website;
    if (website && website !== "#") {
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

    const fbMatch = html.match(/https?:\/\/(?:www\.)?facebook\.com\/[a-zA-Z0-9._-]+/i);
    if (fbMatch) data.facebook = fbMatch[0].replace(/\/$/, "");

    const ytMatch = html.match(/https?:\/\/(?:www\.)?youtube\.com\/(?:user|channel|c|@)[a-zA-Z0-9._-]+/i);
    if (ytMatch) data.youtube = ytMatch[0];

    const igMatch = html.match(/https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9._-]+/i);
    if (igMatch) data.instagram = igMatch[0].replace(/\/$/, "");

    const emailMatch = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) data.email = emailMatch[0];

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
