export const DEFAULT_LANG = "ro";

const LOCALE_MAP = {
    ro: "ro-RO",
    fr: "fr-BE",
    nl: "nl-BE",
    en: "en-GB",
};

export function getLocale(lang) {
    return LOCALE_MAP[lang] || LOCALE_MAP[DEFAULT_LANG];
}

export function makeT(dict, lang) {
    return (key) => dict?.[lang]?.[key] ?? dict?.[DEFAULT_LANG]?.[key] ?? key;
}