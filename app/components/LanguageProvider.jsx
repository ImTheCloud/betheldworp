"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

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
    const router = useRouter();
    const pathname = usePathname();
    const [lang, setLangState] = useState(() => normalizeLang(initialLang) || "ro");

    const setLang = (next) => {
        const normalized = normalizeLang(next) || "ro";
        if (normalized === lang) return;

        writeCookieLang(normalized);

        // Lus directement depuis l'URL du navigateur, et non via useSearchParams :
        // ce hook force la page entière à être rendue côté navigateur, alors qu'on
        // n'a besoin de ces valeurs qu'ici, au moment où l'on clique sur le
        // sélecteur de langue. Le hash était déjà lu de cette façon.
        const search = typeof window !== "undefined" ? window.location.search : "";
        const hash = typeof window !== "undefined" ? window.location.hash : "";
        const suffix = `${search}${hash}`;

        // Update URL: /ro/foo -> /fr/foo
        const segments = pathname.split("/");
        // Check if the first segment is a locale
        if (SUPPORTED.includes(segments[1])) {
            segments[1] = normalized;
            router.push(`${segments.join("/")}${suffix}`, { scroll: false });
        } else {
            // Fallback for non-localized paths if any
            router.push(`/${normalized}${pathname}${suffix}`, { scroll: false });
        }
    };

    useEffect(() => {
        const normalized = normalizeLang(initialLang) || "ro";
        if (normalized !== lang) {
            setLangState(normalized);
        }
    }, [initialLang, lang]);

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
