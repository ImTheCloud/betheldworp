import { NextResponse } from "next/server";

// Force Node runtime so we can reach external search providers
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_RESULTS = 8;

const sanitizeUrl = (url = "") => {
    if (!url) return "";
    try {
        // DuckDuckGo & Google sometimes wrap URLs (e.g., /url?q=real)
        const parsed = new URL(url, "https://dummy.test");
        if (parsed.pathname === "/url" && parsed.searchParams.get("q")) {
            return parsed.searchParams.get("q");
        }
        if (parsed.pathname.startsWith("/l/") && parsed.searchParams.get("uddg")) {
            return decodeURIComponent(parsed.searchParams.get("uddg"));
        }
    } catch (_) {
        // Non-parsable URL, just return original
    }
    return url;
};

const normalize = (items = []) => {
    const excludedDomains = /google\.|bing\.|yahoo\.|duckduckgo\.com|duck\.com|ecosia\.org|yandex\.|baidu\.|ask\.com|aol\.com/i;
    return items
        .map(({ url, link, title = "", snippet = "" }) => ({
            url: sanitizeUrl(url || link),
            title,
            snippet,
        }))
        .filter((r) => r.url && !excludedDomains.test(r.url));
};

async function searchWithSerpApi(query, hl, gl, key) {
    const res = await fetch(
        `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&hl=${hl}&gl=${gl}&num=${MAX_RESULTS}`,
        { headers: { Accept: "application/json" } }
    );
    if (!res.ok) throw new Error(`SerpAPI error ${res.status}`);
    const json = await res.json();
    return normalize(json.organic_results)?.slice(0, MAX_RESULTS) || [];
}

async function searchWithSerper(query, hl, gl, key) {
    const res = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-API-KEY": key,
        },
        body: JSON.stringify({ q: query, gl, hl, num: MAX_RESULTS }),
    });
    if (!res.ok) throw new Error(`Serper error ${res.status}`);
    const json = await res.json();
    return normalize(json.organic)?.slice(0, MAX_RESULTS) || [];
}

async function searchWithCse(query, hl, gl, key, cx) {
    const res = await fetch(
        `https://www.googleapis.com/customsearch/v1?key=${key}&cx=${cx}&q=${encodeURIComponent(query)}&hl=${hl}&gl=${gl}`
    );
    if (!res.ok) throw new Error(`Google CSE error ${res.status}`);
    const json = await res.json();
    return normalize(json.items)?.slice(0, MAX_RESULTS) || [];
}

// Free fallback using DuckDuckGo Lite (no API key, HTML parsing)
async function searchWithDuckDuckGo(query) {
    const res = await fetch(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`, {
        headers: {
            "User-Agent": "Mozilla/5.0 (compatible; BethelSyncBot/1.0)",
        },
    });
    if (!res.ok) throw new Error(`DuckDuckGo error ${res.status}`);
    const html = await res.text();

    // Very small regex-based parser; keeps us dependency-free
    const results = [];
    const anchorRegex = /<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gi;
    let match;
    while ((match = anchorRegex.exec(html)) && results.length < MAX_RESULTS) {
        const rawUrl = match[1];
        // Skip internal anchors and mailto
        if (rawUrl.startsWith("#") || rawUrl.startsWith("mailto:")) continue;
        const clean = sanitizeUrl(rawUrl);
        if (!clean || clean.startsWith("/y.js")) continue;
        const title = match[2].replace(/<[^>]+>/g, "");
        results.push({ url: clean, title, snippet: "" });
    }
    return results;
}

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");
    const hl = searchParams.get("hl") || "en";
    const gl = searchParams.get("gl") || "ro"; // Romanian focus as default

    if (!query) {
        return NextResponse.json({ error: "Missing query parameter 'q'" }, { status: 400 });
    }

    const serpApiKey = process.env.SERPAPI_KEY || process.env.SERP_API_KEY || process.env.SERPAPI_API_KEY;
    const serperKey = process.env.SERPER_API_KEY;
    const cseKey = process.env.GOOGLE_CSE_KEY;
    const cseCx = process.env.GOOGLE_CSE_ID || process.env.GOOGLE_CSE_CX;

    const providers = [];
    if (serpApiKey) providers.push({ name: "serpapi", run: () => searchWithSerpApi(query, hl, gl, serpApiKey) });
    if (serperKey) providers.push({ name: "serper", run: () => searchWithSerper(query, hl, gl, serperKey) });
    if (cseKey && cseCx) providers.push({ name: "google-cse", run: () => searchWithCse(query, hl, gl, cseKey, cseCx) });
    providers.push({ name: "duckduckgo", run: () => searchWithDuckDuckGo(query) });

    for (const provider of providers) {
        try {
            const results = await provider.run();
            if (results && results.length > 0) {
                return NextResponse.json({ provider: provider.name, results });
            }
        } catch (error) {
            console.warn(`Search provider ${provider.name} failed:`, error.message);
        }
    }

    return NextResponse.json({ provider: null, results: [] }, { status: 200 });
}

