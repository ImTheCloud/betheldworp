import { NextResponse } from "next/server";
import { isAdminRequest } from "../../lib/adminAuth";

// Clé distincte de celle du navigateur, et c'est nécessaire : Google refuse
// une clé restreinte par référent pour l'API Geocoding, alors que la carte
// côté navigateur exige justement cette restriction. Une seule clé ne peut pas
// faire les deux.
//
// Celle-ci ne porte pas le préfixe NEXT_PUBLIC : elle ne quitte jamais le
// serveur, et cette route exige déjà un jeton admin.
const API_KEY = process.env.GOOGLE_GEOCODING_API_KEY;

export async function GET(request) {
    // Chaque appel est facturé par Google : la route ne sert qu'au panneau
    // admin et ne doit répondre qu'à lui.
    if (!(await isAdminRequest(request))) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");

    if (!address) {
        return NextResponse.json({ error: "Address is required" }, { status: 400 });
    }

    if (!API_KEY) {
        return NextResponse.json({ error: "GOOGLE_GEOCODING_API_KEY not configured" }, { status: 500 });
    }

    try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.status !== "OK" || !data.results?.length) {
            return NextResponse.json({ error: data.status || "Not found" }, { status: 404 });
        }

        const result = data.results[0];
        const { lat, lng } = result.geometry.location;

        return NextResponse.json({
            lat,
            lng,
            place_id: result.place_id,
            types: result.types || [],
            address_components: result.address_components,
            formatted_address: result.formatted_address,
        });
    } catch (err) {
        console.error("Geocoding error:", err);
        return NextResponse.json({ error: "Search failed" }, { status: 500 });
    }
}
