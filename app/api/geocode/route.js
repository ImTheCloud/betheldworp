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
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.status !== "OK") {
            return NextResponse.json({ error: data.error_message || data.status }, { status: 400 });
        }

        const result = data.results[0];
        const { lat, lng } = result.geometry.location;
        const place_id = result.place_id;

        return NextResponse.json({ 
            lat, 
            lng, 
            place_id,
            address_components: result.address_components,
            formatted_address: result.formatted_address
        });
    } catch (err) {
        return NextResponse.json({ error: "Geocoding failed" }, { status: 500 });
    }
}
