"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import "./Header.css";
import { useLang } from "./LanguageProvider";
import LanguageSwitcher from "./LanguageSwitcher";
import { makeT } from "../lib/i18n";
import tr from "../translations/Header.json";



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
            { id: "harta-mondiala", labelKey: "nav_world_map", type: "section" },
            { id: "contact", labelKey: "nav_contact", type: "contact" }
        ],
        []
    );

    useEffect(() => {
        activeIdRef.current = activeId;
    }, [activeId]);

    useEffect(() => {
        const onScroll = () => {
            setScrolled(window.scrollY > 40);
        };

        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    // Scroll Spy & URL Hash Sync
    const isManualScroll = useRef(false);

    useEffect(() => {
        const observerOptions = {
            root: null,
            rootMargin: "-20% 0px -70% 0px", // Focus on the upper-middle part of the screen
            threshold: 0,
        };

        const observerCallback = (entries) => {
            if (isManualScroll.current) return;

            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const id = entry.target.id;
                    setActiveId(id);

                    // Update URL hash without adding to history
                    if (id === "acasa") {
                        window.history.replaceState(null, null, " ");
                    } else {
                        window.history.replaceState(null, null, `#${id}`);
                    }
                }
            });
        };

        const observer = new IntersectionObserver(observerCallback, observerOptions);

        NAV_ITEMS.forEach((item) => {
            if (item.type === "section") {
                const el = document.getElementById(item.id);
                if (el) observer.observe(el);
            }
        });

        // Handle initial hash on load
        const initialHash = window.location.hash.replace("#", "");
        if (initialHash) {
            scrollToSection(initialHash, false, "auto");
        }

        return () => observer.disconnect();
    }, [NAV_ITEMS]);

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

    const scrollToSection = (id, updateHash = true, behavior = "smooth") => {
        setMenuOpen(false);
        setActiveId(id);

        if (updateHash) {
            isManualScroll.current = true;
            if (id === "acasa") {
                window.history.replaceState(null, null, " ");
            } else {
                window.history.replaceState(null, null, `#${id}`);
            }
            // Allow observer to resume after scroll finishes
            const duration = behavior === "smooth" ? 1000 : 50;
            setTimeout(() => {
                isManualScroll.current = false;
            }, duration);
        }

        if (id === "acasa") {
            window.scrollTo({ top: 0, behavior });
            return;
        }

        const element = document.getElementById(id);
        if (!element) return;

        const header = document.querySelector(".header");
        const headerHeight = header?.offsetHeight ?? 82;

        const y = element.getBoundingClientRect().top + window.scrollY - headerHeight - 12;
        window.scrollTo({ top: y, behavior });
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

    const renderNavButtons = () =>
        NAV_ITEMS.map((item) =>
            item.type === "link" ? (
                <Link
                    key={item.id}
                    href={item.href}
                    className="navLink"
                    data-id={item.id}
                >
                    {t(item.labelKey)}
                </Link>
            ) : (
                <button
                    key={item.id}
                    type="button"
                    className={`navLink ${activeId === item.id ? "is-active" : ""}`}
                    onClick={() => onNavClick(item)}
                    data-id={item.id}
                >
                    {t(item.labelKey)}
                </button>
            )
        );

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