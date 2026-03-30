import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'places', 'details', 'geocode', or 'photo'
    const query = searchParams.get('query');
    const address = searchParams.get('address');
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
        return NextResponse.json({ error: "Missing API Key" }, { status: 500 });
    }

    async function extractSocialLinks(url) {
        if (!url) return {};

        const fetchWithTimeout = async (targetUrl, timeout = 8000) => {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);
                const res = await fetch(targetUrl, { 
                    signal: controller.signal, 
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } 
                });
                clearTimeout(timeoutId);
                if (!res.ok) return null;
                return await res.text();
            } catch (e) {
                return null;
            }
        };

        const decodeCfEmail = (encodedString) => {
            try {
                let email = "", r = parseInt(encodedString.substr(0, 2), 16), n, i;
                for (n = 2; encodedString.length - n; n += 2) {
                    i = parseInt(encodedString.substr(n, 2), 16) ^ r;
                    email += String.fromCharCode(i);
                }
                return email;
            } catch (e) { return null; }
        };

        const extractFromText = (text, currentLinks = {}) => {
            const links = { ...currentLinks };

            // Facebook (Better plugin handling)
            if (!links.facebook) {
                const fbMatches = [...text.matchAll(/(https?:\/\/(?:[a-z0-9-]+\.)?(?:facebook\.com|fb\.com)\/[^"'\s<>]+)/ig)].map(m => m[1]);
                if (fbMatches.length > 0) {
                    // Filter out tr, sharer, and find the best one
                    const mainLinks = fbMatches.filter(u => !u.includes('/tr?') && !u.includes('/sharer.php'));
                    if (mainLinks.length > 0) {
                        let selected = mainLinks[0];
                        // If it's a plugin link, extract the real URL from the 'href' parameter
                        if (selected.includes('/plugins/')) {
                            const params = new URLSearchParams(selected.split('?')[1]);
                            if (params.has('href')) selected = params.get('href');
                        }
                        links.facebook = selected.split('&')[0].split('?')[0].replace(/[.,;]$/, '');
                        if (links.facebook.endsWith('/')) links.facebook = links.facebook.slice(0, -1);
                    }
                }
            }
            
            // Instagram
            if (!links.instagram) {
                const instaMatch = text.match(/(https?:\/\/(?:[a-z0-9-]+\.)?instagram\.com\/(?!explore\/tags)(?:[^"'\s<>]+))/i);
                if (instaMatch) {
                    links.instagram = instaMatch[1].split('?')[0].replace(/[.,;]$/, '');
                    if (links.instagram.endsWith('/')) links.instagram = links.instagram.slice(0, -1);
                }
            }
            
            // YouTube (Priority to channels)
            if (!links.youtube) {
                const ytMatches = [...text.matchAll(/(https?:\/\/(?:[a-z0-9-]+\.)?(?:youtube\.com|youtu\.be)\/(?!embed)(?:[^"'\s<>]+))/ig)].map(m => m[1]);
                if (ytMatches.length > 0) {
                    const channelMatch = ytMatches.find(u => u.includes('/channel/') || u.includes('/c/') || u.includes('/user/') || u.includes('/@') || u.toLowerCase().includes('uc'));
                    links.youtube = (channelMatch || ytMatches[0]).split('&')[0].split('?')[0].replace(/[.,;]$/, '');
                    if (links.youtube.endsWith('/')) links.youtube = links.youtube.slice(0, -1);
                }
            }
            
            // --- REFINED EMAIL EXTRACTION ---
            const allEmails = [];
            
            // 1. Regular Regex (Broader)
            const regexMatches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
            allEmails.push(...regexMatches);

            // 2. mailto: links
            const mailtoMatches = [...text.matchAll(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/ig)].map(m => m[1]);
            allEmails.push(...mailtoMatches);

            // 3. Cloudflare protection
            const cfMatches = [...text.matchAll(/data-cfemail=["']([^"']+)["']/ig)].map(m => decodeCfEmail(m[1])).filter(Boolean);
            allEmails.push(...cfMatches);

            const filteredEmails = [...new Set(allEmails)].filter(m => !/\.(png|jpg|jpeg|webp|gif|svg|js|css|pdf|ico)$/i.test(m));
            
            if (filteredEmails.length > 0 && !links.email) {
                const contactEmail = filteredEmails.find(e => e.toLowerCase().startsWith('contact@'));
                links.email = contactEmail || filteredEmails[0];
            }

            // --- REFINED PHONE EXTRACTION ---
            const broadPhonePattern = /(?:\+?40|0)\s*[237][\s./-]?\d{2}[\s./-]?\d{3}[\s./-]?\d{3,4}/g;
            let allPhones = text.match(broadPhonePattern) || [];
            const telMatches = [...text.matchAll(/href=["']tel:([^"']+)["']/ig)].map(m => m[1].trim());
            allPhones = [...new Set([...allPhones, ...telMatches])];

            if (allPhones.length > 0 && !links.phone) {
                const mobilePhone = allPhones.find(p => {
                    const digits = p.replace(/\D/g, '');
                    return digits.startsWith('07') || digits.startsWith('407');
                });
                links.phone = (mobilePhone || allPhones[0]).trim();
            }

            return links;
        };

        try {
            let homeText = await fetchWithTimeout(url);
            if (!homeText) return {};

            let results = extractFromText(homeText);

            // If email or phone missing, try finding a contact page
            if (!results.email || !results.phone) {
                const contactLinkMatch = homeText.match(/href=["']([^"']*(?:contact|contat|despre|about|info)[^"']*)["']/i);
                if (contactLinkMatch) {
                    let contactUrl = contactLinkMatch[1];
                    if (contactUrl.startsWith('/')) {
                        const root = new URL(url);
                        contactUrl = `${root.origin}${contactUrl}`;
                    } else if (!contactUrl.startsWith('http')) {
                        const root = new URL(url);
                        contactUrl = `${root.origin}/${contactUrl}`;
                    }
                    
                    const contactText = await fetchWithTimeout(contactUrl, 4000);
                    if (contactText) {
                        results = extractFromText(contactText, results);
                    }
                }
            }
            
            return results;
        } catch (e) {
            console.warn("Enhanced scrape failed for", url, e);
            return {};
        }
    }

    try {
        let data = {};
        if (type === 'places') {
            const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': apiKey,
                    'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.addressComponents,places.location,places.internationalPhoneNumber,places.websiteUri,places.regularOpeningHours,places.photos,places.googleMapsUri,places.rating'
                },
                body: JSON.stringify({ textQuery: query })
            });

            if (!response.ok) {
                const errorBody = await response.json();
                if (response.status === 403) {
                    console.log("Places API disabled, falling back to Geocoding...");
                    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`;
                    const geoRes = await fetch(geocodeUrl);
                    data = await geoRes.json();
                    data._fallback = true;
                    data._googleError = errorBody.error?.message;
                    return NextResponse.json(data);
                }
                return NextResponse.json({ error: "Google API error", details: errorBody.error?.message }, { status: response.status });
            }

            const result = await response.json();
            data = {
                results: (result.places || []).map(p => ({
                    place_id: p.id,
                    name: p.displayName?.text,
                    formatted_address: p.formattedAddress,
                    address_components: (p.addressComponents || []).map(c => ({
                        long_name: c.longText,
                        short_name: c.shortText,
                        types: c.types
                    })),
                    geometry: { 
                        location: {
                            lat: p.location?.latitude,
                            lng: p.location?.longitude
                        }
                    },
                    international_phone_number: p.internationalPhoneNumber,
                    website: p.websiteUri,
                    openingHours: p.regularOpeningHours?.weekdayDescriptions || [],
                    photos: (p.photos || []).slice(0, 5).map(photo => photo.name),
                    googleMapsUri: p.googleMapsUri,
                    rating: p.rating
                })),
                status: result.places?.length > 0 ? "OK" : "ZERO_RESULTS"
            };
        } else if (type === 'details') {
            const placeId = searchParams.get('place_id');
            const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': apiKey,
                    'X-Goog-FieldMask': 'id,displayName,formattedAddress,addressComponents,internationalPhoneNumber,websiteUri,location,regularOpeningHours,photos,googleMapsUri,rating'
                }
            });

            if (!response.ok) {
                const errorBody = await response.json();
                return NextResponse.json({ error: "Google API error", details: errorBody.error?.message }, { status: response.status });
            }

            const p = await response.json();
            
            // Scrape social links from website if available
            const socialLinks = await extractSocialLinks(p.websiteUri);

            data = {
                result: {
                    place_id: p.id,
                    name: p.displayName?.text,
                    formatted_address: p.formattedAddress,
                    address_components: (p.addressComponents || []).map(c => ({
                        long_name: c.longText,
                        short_name: c.shortText,
                        types: c.types
                    })),
                    international_phone_number: p.internationalPhoneNumber || socialLinks.phone,
                    email: socialLinks.email,
                    website: p.websiteUri,
                    openingHours: p.regularOpeningHours?.weekdayDescriptions || [],
                    photos: (p.photos || []).slice(0, 10).map(photo => photo.name),
                    googleMapsUri: p.googleMapsUri,
                    rating: p.rating,
                    facebook: socialLinks.facebook,
                    instagram: socialLinks.instagram,
                    youtube: socialLinks.youtube,
                    geometry: { 
                        location: {
                            lat: p.location?.latitude,
                            lng: p.location?.longitude
                        }
                    }
                },
                status: p.id ? "OK" : "NOT_FOUND"
            };
        } else if (type === 'photo') {
            const photoName = searchParams.get('photo_name'); // e.g., 'places/PLACE_ID/photos/PHOTO_ID'
            if (!photoName) return NextResponse.json({ error: "Missing photo_name" }, { status: 400 });

            // We use the media endpoint which returns the image itself
            const photoUrl = `https://places.googleapis.com/v1/${photoName}/media?key=${apiKey}&maxWidthPx=800`;
            
            // Redirect to the Google image URL
            return NextResponse.redirect(photoUrl);

        } else {
            const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
            const res = await fetch(geocodeUrl);
            data = await res.json();
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error("Geocoding/Places Proxy Error:", error);
        return NextResponse.json({ error: "Internal Server Error", message: error.message }, { status: 500 });
    }
}
