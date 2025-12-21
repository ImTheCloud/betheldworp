"use client";

import "./About.css";
import { useMemo } from "react";
import { useLang } from "../components/LanguageProvider";
import { makeT } from "../lib/i18n";
import tr from "../translations/About.json";

export default function About() {
    const { lang } = useLang();
    const t = useMemo(() => makeT(tr, lang), [lang]);

    return (
        <section id="despre-noi" className="about-section">
            <div className="about-content">
                <div className="about-header">
                    <h2 className="about-title">{t("title")}</h2>
                </div>

                <div className="about-text-block">
                    <div className="about-paragraphs">
                        <p className="about-paragraph">{t("p1")}</p>
                        <p className="about-paragraph">{t("p2")}</p>
                        <p className="about-paragraph">{t("p3")}</p>
                        <p className="about-paragraph">{t("p4")}</p>
                    </div>
                </div>

                <div className="about-verse-highlight">
                    <div className="about-verse-content">
                        <p className="about-verse-text">{t("verse_text")}</p>
                        <p className="about-verse-ref">{t("verse_ref")}</p>
                    </div>
                </div>
            </div>
        </section>
    );
}