"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useLang } from "../components/LanguageProvider";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { makeT } from "../lib/i18n";
import tr from "../translations/Bible.json";

export default function BibleReaderHeader() {
    const { lang } = useLang();
    const t = useMemo(() => makeT(tr, lang), [lang]);

    return (
        <header className="bible-reader-header">
            <div className="bible-reader-header-inner">
                <Link href="/" className="bible-reader-logo">
                    <img src="/icon.png" alt="Bethel Dworp Logo" className="bible-reader-logo-img" />
                    <span className="bible-reader-logo-text">Bethel Dworp</span>
                </Link>

                <div className="bible-reader-header-right">
                    <LanguageSwitcher className="bible-reader-lang" />
                    <Link href="/" className="bible-reader-back-btn">
                        {t("back") || "Back to site"}
                    </Link>
                </div>
            </div>
        </header>
    );
}
