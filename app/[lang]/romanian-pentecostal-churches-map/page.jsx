"use client";

import React, { Suspense } from "react";
import ChurchMap from "./ChurchMap";
import LanguageSwitcher from "../../components/LanguageSwitcher";

export default function WorldMapPage() {
    return (
        <main className="w-full h-full bg-black font-sans relative">
            <div style={{
                position: 'fixed',
                top: '12px',
                right: '12px',
                zIndex: 10000,
                pointerEvents: 'auto'
            }}>
                <LanguageSwitcher />
            </div>
            
            <Suspense fallback={<div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>Chargement...</div>}>
                <ChurchMap />
            </Suspense>
        </main>
    );
}
