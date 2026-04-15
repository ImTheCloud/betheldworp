"use client";

import "./WorldMapSection.css";
import React, { useMemo, useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useLang } from "../components/LanguageProvider";
import { makeT } from "../lib/i18n";
import tr from "../translations/WorldMapSection.json";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../lib/Firebase";

/* ── Lazy-load Three.js globe (no SSR) ── */
const Globe3D = dynamic(() => import("../components/Globe3D"), { ssr: false });

/* ─────────────────────────────────────────
   CountUp — animated number on scroll
───────────────────────────────────────── */
const CountUp = ({ end, duration = 2 }) => {
    const [count, setCount] = useState(0);
    const [isVisible, setIsVisible] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
            { threshold: 0.1 }
        );
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!isVisible) return;
        let startTime = null;
        const ms = duration * 1000;
        const animate = (now) => {
            if (!startTime) startTime = now;
            const progress = Math.min((now - startTime) / ms, 1);
            const ease = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(ease * end));
            if (progress < 1) requestAnimationFrame(animate);
            else setCount(end);
        };
        requestAnimationFrame(animate);
    }, [isVisible, end, duration]);

    return <span ref={ref}>{count}</span>;
};

/* ─────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────── */
export default function WorldMapSection() {
    const { lang } = useLang();
    const t = useMemo(() => makeT(tr, lang), [lang]);

    const [stats, setStats] = useState({ churches: 0, countries: 0 });
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, "churches"), (snapshot) => {
            const data = snapshot.docs.map((doc) => doc.data());
            const uniqueCountries = new Set(data.map((c) => c.country).filter(Boolean));
            setStats({ churches: data.length, countries: uniqueCountries.size });
            setIsLoaded(true);
        });
        return () => unsubscribe();
    }, []);

    return (
        <section className="worldmap-section">

            <div className="worldmap-container">

                {/* ── Content ── */}
                <div className="worldmap-content">

                    {/* Tag */}


                    {/* Title */}
                    <h2 className="worldmap-title">
                        {t("title")}
                        <em className="worldmap-title-em">{t("titleEm")}</em>
                    </h2>

                    {/* Description */}
                    <p className="worldmap-description">{t("description")}</p>

                    {/* 3D Globe — inline on mobile, repositioned on desktop */}
                    <div className="worldmap-globe-wrap">
                        <Globe3D className="worldmap-globe-3d" />
                    </div>

                    {/* Stats */}
                    <div className="worldmap-stats-row">
                        <div className="worldmap-stat">
                            <span className="worldmap-stat-num">
                                {isLoaded ? <CountUp end={stats.churches} duration={2.0} /> : 0}
                            </span>
                            <span className="worldmap-stat-label">{t("statChurches")}</span>
                        </div>

                        <div className="worldmap-stat-divider" />

                        <div className="worldmap-stat">
                            <span className="worldmap-stat-num">
                                {isLoaded ? <CountUp end={stats.countries} duration={1.5} /> : 0}
                            </span>
                            <span className="worldmap-stat-label">{t("statCountries")}</span>
                        </div>
                    </div>

                    {/* CTA */}
                    <Link
                        href={`/${lang}/romanian-pentecostal-churches-map`}
                        className="worldmap-cta"
                    >
                        {t("cta")}
                        <span className="worldmap-cta-arrow" aria-hidden="true">
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                <path d="M2 5h6M5 2l3 3-3 3" stroke="#0a1a2e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </span>
                    </Link>

                </div>

            </div>
        </section>
    );
}