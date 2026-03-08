import { Suspense } from "react";
import ChurchMap from "./ChurchMap";

export const metadata = {
    title: "World Church Map - Bethel Dworp",
    description: "Cartographie de toutes les églises associées.",
    robots: { index: false, follow: false },
};

export default function WorldMapPage() {
    return (
        <main className="w-full h-screen bg-black overflow-hidden relative font-sans">
            <Suspense fallback={<div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>Chargement de la carte...</div>}>
                <ChurchMap />
            </Suspense>
        </main>
    );
}
