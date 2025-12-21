"use client";

import "./Location.css";
import { useMemo } from "react";
import { useLang } from "../components/LanguageProvider";
import { makeT } from "../lib/i18n";
import tr from "../translations/Location.json";

export default function Location() {
    const { lang } = useLang();
    const t = useMemo(() => makeT(tr, lang), [lang]);

    const place = t("place");
    const address = t("address");
    const full = `${place}, ${address}`;

    return (
        <section className="location-section">
            <div className="location-content">
                <div className="location-header">
                    <h2 className="location-title">{t("title")}</h2>
                </div>

                <div className="location-card">
                    <div className="location-info-wrapper">
                        <span className="location-label">{t("label")}</span>
                        <h3 className="location-place">{place}</h3>
                        <p className="location-address">{address}</p>
                    </div>

                    <div className="location-mapWrap">
                        <iframe
                            className="location-map"
                            title={t("map_title")}
                            loading="lazy"
                            allowFullScreen
                            referrerPolicy="no-referrer-when-downgrade"
                            src={`https://www.google.com/maps?q=${encodeURIComponent(full)}&output=embed`}
                        />
                    </div>
                </div>

                <div className="location-verse-highlight">
                    <div className="location-verse-content">
                        <p className="location-verse-text">{t("verse_text")}</p>
                        <p className="location-verse-ref">{t("verse_ref")}</p>
                    </div>
                </div>
            </div>
        </section>
    );
}