"use client";

// Bloc « Ai vrut să scrii …@gmail.com? » affiché sous un champ d'inscription
// quand l'adresse ressemble à une faute de frappe. Partagé par la section
// Newsletter (fond clair) et le pied de page (fond sombre).

import "./EmailSuggestion.css";
import { useLang } from "./LanguageProvider";
import { makeT } from "../lib/i18n";
import tr from "../translations/EmailCheck.json";

export function useEmailCheckText() {
    const { lang } = useLang();
    return makeT(tr, lang);
}

export default function EmailSuggestion({ suggestion, onAccept, onReject, disabled, tone = "light" }) {
    const t = useEmailCheckText();
    if (!suggestion) return null;

    const at = suggestion.lastIndexOf("@");
    const local = suggestion.slice(0, at + 1);
    const domain = suggestion.slice(at + 1);

    return (
        <div className={`email-suggest email-suggest--${tone}`} role="alert">
            <p className="email-suggest-text">
                {t("did_you_mean")}{" "}
                <span className="email-suggest-address">
                    {local}<strong>{domain}</strong>
                </span>
                ?
            </p>
            <div className="email-suggest-actions">
                <button type="button" className="email-suggest-yes" onClick={onAccept} disabled={disabled}>
                    {t("yes_fix")}
                </button>
                <button type="button" className="email-suggest-no" onClick={onReject} disabled={disabled}>
                    {t("no_keep")}
                </button>
            </div>
        </div>
    );
}
