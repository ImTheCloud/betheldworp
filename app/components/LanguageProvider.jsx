"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

const LangContext = createContext(null);

const SUPPORTED = ["ro", "fr", "nl", "en"];
const COOKIE = "bethel_lang";

function normalizeLang(code) {
    const v = String(code || "").toLowerCase();
    const base = v.split("-")[0];
    return SUPPORTED.includes(base) ? base : null;
}

function writeCookieLang(value) {
    if (typeof document === "undefined") return;
    const v = normalizeLang(value) || "ro";
    const maxAge = 60 * 60 * 24 * 365;
    document.cookie = `${COOKIE}=${encodeURIComponent(v)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

export default function LanguageProvider({ children, initialLang = "ro" }) {
    const [lang, setLangState] = useState(() => normalizeLang(initialLang) || "ro");

    const setLang = (next) => {
        const normalized = normalizeLang(next) || "ro";
        setLangState(normalized);
        writeCookieLang(normalized);
    };

    useEffect(() => {
        if (typeof document !== "undefined") document.documentElement.lang = lang;
    }, [lang]);

    const value = useMemo(() => ({ lang, setLang, supported: SUPPORTED }), [lang]);

    return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
    const ctx = useContext(LangContext);
    if (!ctx) throw new Error("useLang must be used within <LanguageProvider />");
    return ctx;
}