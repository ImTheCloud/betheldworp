"use client";

// Ligne discrète « Ai vrut să scrii ion@gmail.com? » sous un champ
// d'inscription, quand l'adresse ressemble à une faute de frappe. Un appui sur
// l'adresse corrige le champ ; l'ignorer ne bloque rien. Partagée par la
// section Newsletter (fond clair) et le pied de page (fond sombre).

import "./EmailSuggestion.css";
import { useLang } from "./LanguageProvider";
import { makeT } from "../lib/i18n";
import tr from "../translations/EmailCheck.json";

export function useEmailCheckText() {
    const { lang } = useLang();
    return makeT(tr, lang);
}

export default function EmailSuggestion({ suggestion, onApply, tone = "light" }) {
    const t = useEmailCheckText();
    if (!suggestion) return null;

    const at = suggestion.lastIndexOf("@");
    const local = suggestion.slice(0, at + 1);
    const domain = suggestion.slice(at + 1);

    return (
        <p className={`email-hint email-hint--${tone}`} aria-live="polite">
            {t("did_you_mean")}{" "}
            <button type="button" className="email-hint-fix" onClick={onApply} aria-label={suggestion}>
                {local}<strong>{domain}</strong>
            </button>
            ?
        </p>
    );
}
