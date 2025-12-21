"use client";

import { useMemo, useState } from "react";
import "./Donations.css";
import { useLang } from "../components/LanguageProvider";
import { makeT } from "../lib/i18n";
import tr from "../translations/Donations.json";

const BENEFICIARY = "CENTRE CHRETIEN ROUMAIN BETHEL ASBL";
const IBAN_RAW = "BE89143108589985";
const IBAN_DISPLAY = "BE89 1431 0858 9985";

export default function Donations() {
    const { lang } = useLang();
    const t = useMemo(() => makeT(tr, lang), [lang]);

    const donationTypes = useMemo(
        () => [
            {
                title: t("type_monthly_title"),
                desc: t("type_monthly_desc"),
                badge: t("badge_regular"),
                badgeType: "regular",
            },
            {
                title: t("type_mission_title"),
                desc: t("type_mission_desc"),
                badge: t("badge_mission"),
                badgeType: "mission",
            },
            {
                title: t("type_help_title"),
                desc: t("type_help_desc"),
                badge: t("badge_help"),
                badgeType: "help",
            },
            {
                title: t("type_family_title"),
                desc: t("type_family_desc"),
                badge: t("badge_support"),
                badgeType: "support",
            },
        ],
        [t]
    );

    const [copied, setCopied] = useState(false);

    const copyIban = async () => {
        try {
            await navigator.clipboard.writeText(IBAN_RAW);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            const textarea = document.createElement("textarea");
            textarea.value = IBAN_RAW;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand("copy");
            document.body.removeChild(textarea);

            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        }
    };

    return (
        <section id="donatii" className="don-section">
            <div className="don-content">
                <div className="don-header">
                    <h2 className="don-title">{t("title")}</h2>
                    <p className="don-intro">{t("intro")}</p>
                </div>

                <div className="don-bank-card">
                    <div className="don-bank-grid">
                        <div className="don-field">
                            <div className="don-field-label">{t("beneficiary")}</div>
                            <div className="don-field-value">{BENEFICIARY}</div>
                        </div>

                        <div className="don-field">
                            <div className="don-field-label">{t("iban")}</div>
                            <div className="don-iban-row">
                                <div className="don-iban-value">{IBAN_DISPLAY}</div>
                                <button type="button" className="don-copy-btn" onClick={copyIban}>
                                    {copied ? t("copied") : t("copy_iban")}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="don-types-section">
                    <div className="don-types-grid">
                        {donationTypes.map((type) => (
                            <article key={type.title} className="don-type-card">
                                <div className={`don-type-badge don-type-badge--${type.badgeType}`}>{type.badge}</div>
                                <div className="don-type-title">{type.title}</div>
                                <div className="don-type-desc">{type.desc}</div>
                            </article>
                        ))}
                    </div>
                </div>

                <div className="don-verse-highlight">
                    <div className="don-verse-content">
                        <p className="don-verse-text">{t("verse_text")}</p>
                        <p className="don-verse-ref">{t("verse_ref")}</p>
                    </div>
                </div>
            </div>
        </section>
    );
}