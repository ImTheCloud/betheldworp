"use client";

import { useMemo } from "react";
import Link from "next/link";
import "./BibleSection.css";
import { useLang } from "../components/LanguageProvider";
import { makeT } from "../lib/i18n";
import tr from "../translations/BibleSection.json";

export default function BibleSection() {
    const { lang } = useLang();
    const t = useMemo(() => makeT(tr, lang), [lang]);

    return (
        <section id="biblia" className="bible-section">
            <div className="bible-content">
                <div className="bible-header">
                    <h2 className="bible-title">{t("title")}</h2>
                    <p className="bible-subtitle">{t("subtitle")}</p>
                </div>

                <div className="bible-desc-card">
                    <p className="bible-desc-text">{t("description")}</p>
                    <Link href="/bible" className="bible-cta">
                        {t("cta")}
                        <span className="bible-cta-arrow">→</span>
                    </Link>
                </div>

            </div>
        </section>
    );
}
