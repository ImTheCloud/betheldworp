import React, { Suspense } from "react";
import ChurchMap from "./ChurchMap";

export const metadata = {
    title: "Harta Bisericilor Penticostale Române din lume | Bethel Dworp",
    description: "Explorează harta interactivă a bisericilor penticostale române din lume. Găsește adrese, contacte și detalii despre comunitățile creștine românești din întreaga lume.",
    robots: { index: true, follow: true },
};

export default function WorldMapPage() {
    return (
        <main className="w-full h-full bg-black font-sans">
            <Suspense fallback={<div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>Chargement de la carte...</div>}>
                <ChurchMap />
            </Suspense>
        </main>
    );
}
