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
    const [isMobile, setIsMobile] = useState(null);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth <= 768);
        checkMobile();
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);

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

                {/* ── Header ── */}
                <div className="worldmap-header">
                    <h2 className="worldmap-title">
                        {t("title")} {t("titleEm")}
                    </h2>
                </div>

                {/* ── Dark banner with globe + content ── */}
                <div className="worldmap-banner">
                    <div className="worldmap-banner-layout">

                        {/* Left: text content */}
                        <div className="worldmap-body">
                            <span className="worldmap-label">{t("tag")}</span>

                            <h3 className="worldmap-banner-title">{t("bannerTitle")}</h3>

                            <p className="worldmap-description">{t("description")}</p>

                            {/* Stats */}
                            <div className="worldmap-stats-row">
                                <div className="worldmap-stat">
                                    <span className="worldmap-stat-num">
                                        {isLoaded ? <CountUp end={stats.churches} duration={2.0} /> : 0}
                                    </span>
                                    <span className="worldmap-stat-label">{t("statChurches")}</span>
                                </div>
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
                                target={isMobile === false ? "_blank" : undefined}
                                rel={isMobile === false ? "noopener noreferrer" : undefined}
                            >
                                {t("cta")}
                                <span className="worldmap-cta-arrow" aria-hidden="true">
                                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                        <path d="M2 5h6M5 2l3 3-3 3" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </span>
                            </Link>
                        </div>

                        {/* Right: free-floating globe */}
                        <div className="worldmap-globe-wrap">
                            <Globe3D className="worldmap-globe-3d" />
                        </div>

                    </div>
                </div>

                {/* ── Verse ── */}
                <div className="worldmap-verse">
                    <p className="worldmap-verse-text">{t("verse_text")}</p>
                    <p className="worldmap-verse-ref">{t("verse_ref")}</p>
                </div>

            </div>
        </section>
    );
}