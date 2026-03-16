"use client";

import "./WorldMapSection.css";
import React, { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useLang } from "../components/LanguageProvider";
import { makeT } from "../lib/i18n";
import tr from "../translations/WorldMapSection.json";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../lib/Firebase";

// Sub-component for incrementing animation
const CountUp = ({ end, duration = 2 }) => {
    const [count, setCount] = useState(0);
    const [isVisible, setIsVisible] = useState(false);
    const elementRef = React.useRef(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                }
            },
            { threshold: 0.1 }
        );

        if (elementRef.current) {
            observer.observe(elementRef.current);
        }

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!isVisible) return;
        
        let startTime = null;
        const durationMs = duration * 1000;
        
        const animate = (currentTime) => {
            if (!startTime) startTime = currentTime;
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / durationMs, 1);
            
            // Ease out cubic function: smoother finish, less stall at the end
            const easeOutCubic = 1 - Math.pow(1 - progress, 3);
            
            setCount(Math.floor(easeOutCubic * end));
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                setCount(end);
            }
        };
        requestAnimationFrame(animate);
    }, [isVisible, end, duration]);

    return <span ref={elementRef}>{count}</span>;
};

export default function WorldMapSection() {
    const { lang } = useLang();
    const t = useMemo(() => makeT(tr, lang), [lang]);

    const [stats, setStats] = useState({ churches: 0, countries: 0 });
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        // Fetch real-time stats from Firestore
        const unsubscribe = onSnapshot(collection(db, "churches"), (snapshot) => {
            const churchesData = snapshot.docs.map(doc => doc.data());

            const uniqueCountries = new Set(churchesData.map(c => c.country).filter(Boolean));

            setStats({
                churches: churchesData.length,
                countries: uniqueCountries.size
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
                    <div className="worldmap-impact-pill">
                        <div className="impact-pill-item">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                                <polyline points="9 22 9 12 15 12 15 22"></polyline>
                            </svg>
                            <span className="impact-pill-value">
                                {isLoaded ? <CountUp end={stats.churches} duration={2.0} /> : 0}
                            </span>
                            <span className="impact-pill-label">{t("statChurches") || "Biserici"}</span>
                        </div>
                        <div className="impact-pill-divider"></div>
                        <div className="impact-pill-item">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="2" y1="12" x2="22" y2="12"></line>
                                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                            </svg>
                            <span className="impact-pill-value">
                                {isLoaded ? <CountUp end={stats.countries} duration={1.5} /> : 0}
                            </span>
                            <span className="impact-pill-label">{t("statCountries") || "Țări"}</span>
                        </div>
                    </div>
                    <h2 className="worldmap-title">{t("title")}</h2>
                    <p className="worldmap-description">{t("description")}</p>

                    <Link href="/romanian-pentecostal-churches-map" className="worldmap-cta">
                        {t("cta")}
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                            <polyline points="12 5 19 12 12 19"></polyline>
                        </svg>
                    </Link>


                </div>
            </div>
        </section>
    );
}
