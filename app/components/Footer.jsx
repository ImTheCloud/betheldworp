"use client";

import "./Footer.css";
import { useMemo } from "react";
import { useLang } from "./LanguageProvider";
import { makeT } from "../lib/i18n";
import tr from "../translations/Footer.json";

export default function Footer() {
    const { lang } = useLang();
    const t = useMemo(() => makeT(tr, lang), [lang]);

    const phoneDisplay = "+32 488 29 70 15";
    const phoneHref = "+32488297015";

    const devEmail = "claudiu.dev@outlook.com";
    const mailSubject = "Bethel Dworp";

    return (
        <footer className="footer" id="bethel-footer">
            <div className="footer-inner">
                <div className="footer-brand">
                    <img className="footer-logo" src="/icon.png" alt={t("logo_alt")} />
                    <div className="footer-title">Bethel Dworp</div>
                </div>

                <div className="footer-text">
                    <p className="footer-copy">
                        © {new Date().getFullYear()} Bethel Dworp. {t("rights")}
                    </p>

                    <div className="footer-contacts" aria-label={t("contact_aria")}>
                        <a
                            className="footer-phone"
                            href={`tel:${phoneHref}`}
                            aria-label={t("call_aria").replace("{phone}", phoneDisplay)}
                        >
                            <span className="footer-label">{t("responsible")}:</span>
                            <span className="footer-value">{phoneDisplay}</span>
                        </a>

                        <a
                            className="footer-mail"
                            href={`mailto:${devEmail}?subject=${encodeURIComponent(mailSubject)}`}
                            aria-label={t("email_dev_aria")}
                        >
                            <span className="footer-label">{t("developer")}:</span>
                            <span className="footer-value">{devEmail}</span>
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
}