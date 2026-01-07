"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./Header.css";
import { useLang } from "./LanguageProvider";
import { makeT } from "../lib/i18n";
import tr from "../translations/Header.json";

const SECTION_IDS = ["acasa", "despre-noi", "program", "evenimente", "galerie", "donatii", "locatie"];

function LanguageSwitcher({ className = "", t, lang, setLang, options }) {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef(null);

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
                {/* MODIFICATION ICI : Utilisation d'une image au lieu du texte emoji */}
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
                                {/* MODIFICATION ICI : Utilisation d'une image */}
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

export default function Header() {
    const { lang, setLang } = useLang();
    const t = useMemo(() => makeT(tr, lang), [lang]);

    const [scrolled, setScrolled] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [activeId, setActiveId] = useState("acasa");

    const activeIdRef = useRef("acasa");

    const NAV_ITEMS = useMemo(
        () => [
            { id: "acasa", labelKey: "nav_home", type: "section" },
            { id: "despre-noi", labelKey: "nav_about", type: "section" },
            { id: "program", labelKey: "nav_program", type: "section" },
            { id: "evenimente", labelKey: "nav_events", type: "section" },
            { id: "galerie", labelKey: "nav_gallery", type: "section" },
            { id: "donatii", labelKey: "nav_donations", type: "section" },
            { id: "locatie", labelKey: "nav_location", type: "section" },
            { id: "contact", labelKey: "nav_contact", type: "contact" }
        ],
        []
    );

    // MODIFICATION ICI : Remplacement des emojis par des liens CDN vers les drapeaux
    const LANG_OPTIONS = useMemo(
        () => [
            { value: "ro", label: t("lang_ro"), short: "RO", flagImg: "https://flagcdn.com/w40/ro.png" },
            { value: "fr", label: t("lang_fr"), short: "FR", flagImg: "https://flagcdn.com/w40/fr.png" },
            { value: "nl", label: t("lang_nl"), short: "NL", flagImg: "https://flagcdn.com/w40/nl.png" },
            { value: "en", label: t("lang_en"), short: "EN", flagImg: "https://flagcdn.com/w40/gb.png" }
        ],
        [t]
    );

    useEffect(() => {
        activeIdRef.current = activeId;
    }, [activeId]);

    useEffect(() => {
        const onScroll = () => {
            setScrolled(window.scrollY > 40);
            if (window.scrollY < 60 && activeIdRef.current !== "acasa") setActiveId("acasa");
        };

        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    useEffect(() => {
        window.dispatchEvent(new CustomEvent("bethel:menu", { detail: { open: menuOpen } }));
    }, [menuOpen]);

    useEffect(() => {
        if (!menuOpen) return;

        const onKeyDown = (e) => {
            if (e.key === "Escape") setMenuOpen(false);
        };

        const onResize = () => {
            if (window.innerWidth > 768) setMenuOpen(false);
        };

        document.addEventListener("keydown", onKeyDown);
        window.addEventListener("resize", onResize);
        document.body.style.overflow = "hidden";

        return () => {
            document.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("resize", onResize);
            document.body.style.overflow = "";
        };
    }, [menuOpen]);

    useEffect(() => {
        const header = document.querySelector(".header");
        const headerHeight = header?.offsetHeight ?? 82;

        const sections = SECTION_IDS.map((id) => document.getElementById(id)).filter(Boolean);
        if (!sections.length) return;

        const io = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter((e) => e.isIntersecting)
                    .sort((a, b) => (b.intersectionRatio || 0) - (a.intersectionRatio || 0));

                if (!visible.length) return;

                const id = visible[0].target.id;
                if (id && id !== activeIdRef.current && window.scrollY >= 60) {
                    setActiveId(id);
                }
            },
            {
                root: null,
                rootMargin: `-${headerHeight + 24}px 0px -55% 0px`,
                threshold: [0.08, 0.15, 0.25, 0.35, 0.5, 0.65]
            }
        );

        sections.forEach((s) => io.observe(s));
        return () => io.disconnect();
    }, []);

    const scrollToSection = (id) => {
        setMenuOpen(false);
        setActiveId(id);

        if (id === "acasa") {
            window.scrollTo({ top: 0, behavior: "smooth" });
            return;
        }

        const element = document.getElementById(id);
        if (!element) return;

        const header = document.querySelector(".header");
        const headerHeight = header?.offsetHeight ?? 82;

        const y = element.getBoundingClientRect().top + window.scrollY - headerHeight - 12;
        window.scrollTo({ top: y, behavior: "smooth" });
    };

    const openContact = () => {
        setMenuOpen(false);
        window.dispatchEvent(new Event("bethel:open-contact"));
    };

    const onNavClick = (item) => {
        if (item.type === "contact") openContact();
        else scrollToSection(item.id);
    };

    const headerClass = `header ${scrolled ? "header-scrolled" : "header-top"}`;
    const burgerClass = `burger ${menuOpen ? "is-open" : ""} ${scrolled ? "burger-scrolled" : "burger-top"}`;
    const isActive = (id) => (activeId === id ? "is-active" : "");

    const renderNavButtons = () =>
        NAV_ITEMS.map((item) => (
            <button
                key={item.id}
                type="button"
                className={`navLink ${item.type === "section" ? isActive(item.id) : ""}`.trim()}
                onClick={() => onNavClick(item)}
            >
                {t(item.labelKey)}
            </button>
        ));

    return (
        <>
            <header className={headerClass}>
                <div className="brand" onClick={() => scrollToSection("acasa")} role="button" tabIndex={0}>
                    <img src="/icon.png" alt={t("brand_alt")} className="logo-img" />
                    <div className="logo-text">Bethel Dworp</div>
                </div>

                <nav className="nav">{renderNavButtons()}</nav>

                <div className="headerRight">
                    <LanguageSwitcher className="lang--top" t={t} lang={lang} setLang={setLang} options={LANG_OPTIONS} />
                    <button
                        type="button"
                        className={burgerClass}
                        onClick={() => setMenuOpen((v) => !v)}
                        aria-label={t("burger_open")}
                        aria-expanded={menuOpen}
                    >
                        <span />
                        <span />
                        <span />
                    </button>
                </div>
            </header>

            <div
                className={`mnav-overlay ${menuOpen ? "is-open" : ""}`}
                onClick={() => setMenuOpen(false)}
                aria-hidden={!menuOpen}
            >
                <div className="mnav-panel" onClick={(e) => e.stopPropagation()}>
                    <div className="mnav-top">
                        <div className="mnav-title">{t("menu_title")}</div>
                        <button
                            type="button"
                            className="mnav-close"
                            onClick={() => setMenuOpen(false)}
                            aria-label={t("menu_close")}
                        >
                            ×
                        </button>
                    </div>

                    <div className="mnav-links">{renderNavButtons()}</div>
                </div>
            </div>
        </>
    );
}