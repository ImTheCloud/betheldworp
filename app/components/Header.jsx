"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./Header.css";
import { useLang } from "./LanguageProvider";
import LanguageSwitcher from "./LanguageSwitcher";
import { makeT } from "../lib/i18n";
import tr from "../translations/Header.json";

const SECTION_IDS = ["acasa", "despre-noi", "program", "evenimente", "galerie", "donatii", "locatie", "harta-mondiala"];



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
            { id: "harta-mondiala", labelKey: "nav_world_map", type: "section" },
            { id: "contact", labelKey: "nav_contact", type: "contact" }
        ],
        []
    );

    // MODIFICATION ICI : Remplacement des emojis par des liens CDN vers les drapeaux


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
                    <LanguageSwitcher className="lang--top" />
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