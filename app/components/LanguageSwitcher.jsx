"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLang } from "./LanguageProvider";
import { makeT } from "../lib/i18n";
import tr from "../translations/LanguageSwitcher.json";
import "./LanguageSwitcher.css";

export default function LanguageSwitcher({ className = "" }) {
    const { lang, setLang } = useLang();
    const t = useMemo(() => makeT(tr, lang), [lang]);

    const [open, setOpen] = useState(false);
    const wrapRef = useRef(null);

    const options = useMemo(
        () => [
            { value: "ro", label: t("lang_ro"), short: "RO", flagImg: "/images/flags/ro.png" },
            { value: "fr", label: t("lang_fr"), short: "FR", flagImg: "/images/flags/fr.png" },
            { value: "nl", label: t("lang_nl"), short: "NL", flagImg: "/images/flags/nl.png" },
            { value: "en", label: t("lang_en"), short: "EN", flagImg: "/images/flags/gb.png" }
        ],
        [t]
    );

    const current = useMemo(() => options.find((x) => x.value === lang) || options[0], [options, lang]);

    const close = useCallback(() => setOpen(false), []);
    const toggle = useCallback(() => setOpen((v) => !v), []);

    useEffect(() => {
        if (!open) return;

        const onDown = (e) => {
            const el = wrapRef.current;
            if (!el) return;
            if (!el.contains(e.target)) close();
        };

        const onKey = (e) => {
            if (e.key === "Escape") close();
        };

        document.addEventListener("pointerdown", onDown);
        window.addEventListener("keydown", onKey);

        return () => {
            document.removeEventListener("pointerdown", onDown);
            window.removeEventListener("keydown", onKey);
        };
    }, [open, close]);

    const pick = (value) => {
        setLang(value);
        close();
    };

    return (
        <div ref={wrapRef} className={`lang ${className}`.trim()}>
            <button
                type="button"
                className={`langBtn ${open ? "is-open" : ""}`}
                onClick={toggle}
                aria-label={t("lang_aria")}
                aria-haspopup="menu"
                aria-expanded={open}
            >
                <span className="langBtnFlag" aria-hidden="true">
                    <img src={current.flagImg} alt={current.short} />
                </span>
                <span className="langBtnCode" aria-hidden="true">
                    {current.short}
                </span>
                <span className="langBtnChev" aria-hidden="true">
                    <svg className="langBtnChevIcon" viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                        <path d="M7 10l5 5 5-5" />
                    </svg>
                </span>
            </button>

            {open ? (
                <div className="langMenu" role="menu" aria-label={t("lang_aria")}>
                    {options.map((o) => {
                        const active = o.value === lang;
                        return (
                            <button
                                key={o.value}
                                type="button"
                                role="menuitemradio"
                                aria-checked={active}
                                className={`langItem ${active ? "is-active" : ""}`}
                                onClick={() => pick(o.value)}
                            >
                                <span className="langItemFlag" aria-hidden="true">
                                    <img src={o.flagImg} alt={o.short} />
                                </span>
                                <span className="langItemMain">
                                    <span className="langItemName">{o.label}</span>
                                    <span className="langItemCode">{o.short}</span>
                                </span>
                                <span className="langItemTick" aria-hidden="true">
                                    {active ? "✓" : ""}
                                </span>
                            </button>
                        );
                    })}
                </div>
            ) : null}
        </div>
    );
}
