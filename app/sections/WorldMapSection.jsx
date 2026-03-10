"use client";

import "./WorldMapSection.css";
import React, { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useLang } from "../components/LanguageProvider";
import { makeT } from "../lib/i18n";
import tr from "../translations/WorldMapSection.json";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../lib/Firebase";
import Globe from "../components/Globe";

// Sub-component for incrementing animation
const CountUp = ({ end, duration = 2000 }) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let startTime = null;
        const animate = (currentTime) => {
            if (!startTime) startTime = currentTime;
            const progress = Math.min((currentTime - startTime) / duration, 1);
            setCount(Math.floor(progress * end));
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        requestAnimationFrame(animate);
    }, [end, duration]);

    return <span>{count}</span>;
};

export default function WorldMapSection() {
    const { lang } = useLang();
    const t = useMemo(() => makeT(tr, lang), [lang]);

    const [stats, setStats] = useState({ churches: 0, countries: 0, cities: 0 });
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        // Fetch real-time stats from Firestore
        const unsubscribe = onSnapshot(collection(db, "churches"), (snapshot) => {
            const churchesData = snapshot.docs.map(doc => doc.data());

            const uniqueCountries = new Set(churchesData.map(c => c.country).filter(Boolean));
            const uniqueCities = new Set(churchesData.map(c => c.city).filter(Boolean));

            setStats({
                churches: churchesData.length,
                countries: uniqueCountries.size,
                cities: uniqueCities.size
            });
            setIsLoaded(true);
        });

        return () => unsubscribe();
    }, []);

    return (
        <section className="worldmap-section" id="harta-mondiala">
            <div className="worldmap-bg-pattern"></div>
            <div className="worldmap-bg-glow"></div>

            <div className="worldmap-container">
                <div className="worldmap-content">
                    <div className="worldmap-tag">{t("tag") || "Biserici în lume"}</div>
                    <h2 className="worldmap-title">{t("title")}</h2>
                    <p className="worldmap-description">{t("description")}</p>

                    <Link href="/world-map" className="worldmap-cta">
                        {t("cta")}
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                            <polyline points="12 5 19 12 12 19"></polyline>
                        </svg>
                    </Link>

                    <div className="worldmap-stats">
                        <div className="stat-item">
                            <span className="stat-value">
                                {isLoaded ? <CountUp end={stats.churches} /> : 0}
                            </span>
                            <span className="stat-label">{t("statChurches") || "Churches"}</span>
                        </div>
                        <div className="stat-divider"></div>
                        <div className="stat-item">
                            <span className="stat-value">
                                {isLoaded ? <CountUp end={stats.cities} /> : 0}
                            </span>
                            <span className="stat-label">{t("statCities") || "Cities"}</span>
                        </div>
                        <div className="stat-divider"></div>
                        <div className="stat-item">
                            <span className="stat-value">
                                {isLoaded ? <CountUp end={stats.countries} /> : 0}
                            </span>
                            <span className="stat-label">{t("statCountries") || "Countries"}</span>
                        </div>
                    </div>
                </div>

                <div className="worldmap-visual">
                    <div className="visual-card-3d">
                        <Globe />
                    </div>
                </div>
            </div>
        </section>
    );
}
