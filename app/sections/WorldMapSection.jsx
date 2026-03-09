"use client";

import "./WorldMapSection.css";
import React, { useMemo } from "react";
import Link from "next/link";
import { useLang } from "../components/LanguageProvider";
import { makeT } from "../lib/i18n";
import tr from "../translations/WorldMapSection.json";

export default function WorldMapSection() {
    const { lang } = useLang();
    const t = useMemo(() => makeT(tr, lang), [lang]);

    return (
        <section className="worldmap-section">
            <div className="worldmap-bg-pattern"></div>
            <div className="worldmap-bg-glow"></div>

            <div className="worldmap-content">
                <div className="worldmap-icon-wrapper">
                    <svg className="worldmap-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="2" y1="12" x2="22" y2="12"></line>
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                    </svg>
                </div>

                <h2 className="worldmap-title">{t("title")}</h2>
                <p className="worldmap-description">{t("description")}</p>

                <Link href="/world-map" className="worldmap-cta">
                    {t("cta")}
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                        <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                </Link>
            </div>
        </section>
    );
}
