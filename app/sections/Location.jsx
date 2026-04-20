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
    const placeId = tr[lang]?.google_place_id || "ChIJWdWyrJPPw0cRL74a9ysasVE";
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    // Use official Embed API if key is available, fallback to search query embed
    const mapSrc = apiKey
        ? `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=place_id:${placeId}`
        : `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;

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
                            src={mapSrc}
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