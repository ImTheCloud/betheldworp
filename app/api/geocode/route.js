import { NextResponse } from "next/server";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");

    if (!address) {
        return NextResponse.json({ error: "Address is required" }, { status: 400 });
    }

    if (!API_KEY) {
        return NextResponse.json({ error: "Google Maps API Key not configured" }, { status: 500 });
    }

    try {
        // 1. Try Places API Text Search
        const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(address)}&key=${API_KEY}`;
        const searchRes = await fetch(searchUrl);
        const searchData = await searchRes.json();

        if (searchData.status === "OK" && searchData.results.length > 0) {
            // STRATEGY: Prioritize results that are NOT 'locality' or 'political'
            // We want an 'establishment' or specific types like 'church', 'place_of_worship'
            const ESTABLISHMENT_TYPES = ["establishment", "point_of_interest", "church", "place_of_worship", "school"];
            
            let bestResult = searchData.results.find(r => 
                r.types.some(t => ESTABLISHMENT_TYPES.includes(t))
            );

            // Fallback to first result if no specific establishment found
            if (!bestResult) bestResult = searchData.results[0];

            const place_id = bestResult.place_id;

            // 2. Get full details including website and phone number
            const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=name,formatted_address,geometry,address_components,formatted_phone_number,website,url,types&key=${API_KEY}`;
            const detailsRes = await fetch(detailsUrl);
            const detailsData = await detailsRes.json();

            if (detailsData.status === "OK") {
                const result = detailsData.result;
                const { lat, lng } = result.geometry.location;

                return NextResponse.json({
                    lat,
                    lng,
                    place_id,
                    name: result.name,
                    types: result.types || [],
                    address_components: result.address_components,
                    formatted_address: result.formatted_address,
                    phone: result.formatted_phone_number,
                    website: result.website,
                    googleMapsUri: result.url
                });
            }
        }

        // 3. Fallback to standard Geocoding
        const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEY}`;
        const geoRes = await fetch(geoUrl);
        const geoData = await geoRes.json();

        if (geoData.status === "OK") {
            const result = geoData.results[0];
            const { lat, lng } = result.geometry.location;

            return NextResponse.json({
                lat,
                lng,
                place_id: result.place_id,
                types: result.types || [],
                address_components: result.address_components,
                formatted_address: result.formatted_address
            });
        }

        return NextResponse.json({ error: geoData.status || "Not found" }, { status: 404 });

    } catch (err) {
        console.error("Geocoding/Places error:", err);
        return NextResponse.json({ error: "Search failed" }, { status: 500 });
    }
}
