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
                    international_phone_number: p.internationalPhoneNumber,
                    website: p.websiteUri,
                    openingHours: p.regularOpeningHours?.weekdayDescriptions || [],
                    photos: (p.photos || []).slice(0, 10).map(photo => photo.name),
                    googleMapsUri: p.googleMapsUri,
                    rating: p.rating,
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
