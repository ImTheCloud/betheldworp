"use client";

import { useSyncExternalStore } from "react";
import { useLang } from "./LanguageProvider";
import { makeT } from "../lib/i18n";
import { readConsent, writeConsent, CONSENT_EVENT, GRANTED, DENIED } from "../lib/consent";
import tr from "../translations/Consent.json";
import "./ConsentBanner.css";

function subscribe(onChange) {
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_EVENT, onChange);
}

// Le serveur ne connaît pas le choix du visiteur : il renvoie une valeur non
// nulle pour que la bannière ne soit pas rendue côté serveur, puis le client
// affiche la vraie situation après hydratation.
const serverSnapshot = () => "unknown";

export default function ConsentBanner() {
    const { lang } = useLang();
    const t = makeT(tr, lang);

    const consent = useSyncExternalStore(subscribe, readConsent, serverSnapshot);

    // null = le visiteur n'a pas encore choisi. Toute autre valeur : on se tait.
    if (consent !== null) return null;

    return (
        <div className="consent" role="dialog" aria-live="polite" aria-label={t("more")}>
            <div className="consent-card">
                <p className="consent-text">
                    {t("text")}{" "}
                    <a className="consent-link" href={`/${lang}/privacy`}>
                        {t("more")}
                    </a>
                </p>
                <div className="consent-actions">
                    <button
                        type="button"
                        className="consent-btn consent-btn--refuse"
                        onClick={() => writeConsent(DENIED)}
                    >
                        {t("refuse")}
                    </button>
                    <button
                        type="button"
                        className="consent-btn consent-btn--accept"
                        onClick={() => writeConsent(GRANTED)}
                    >
                        {t("accept")}
                    </button>
                </div>
            </div>
        </div>
    );
}
