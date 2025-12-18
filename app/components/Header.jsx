"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "./Header.css";

const SECTION_IDS = ["acasa", "despre-noi", "program", "evenimente", "galerie", "donatii", "locatie"];

export default function Header() {
    const [scrolled, setScrolled] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [activeId, setActiveId] = useState("acasa");

    const activeIdRef = useRef("acasa");

    const NAV_ITEMS = useMemo(
        () => [
            { id: "acasa", label: "Acasă", type: "section" },
            { id: "despre-noi", label: "Cine suntem", type: "section" },
            { id: "program", label: "Programul săptămânal", type: "section" },
            { id: "evenimente", label: "Evenimente", type: "section" },
            { id: "galerie", label: "Galerie", type: "section" },
            { id: "donatii", label: "Donații", type: "section" },
            { id: "locatie", label: "Unde ne găsim?", type: "section" },
            { id: "contact", label: "Contact", type: "contact" },
        ],
        []
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

    // ✅ Active section detection (reliable)
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
                // on “décale” la zone observée pour tenir compte du header fixe
                rootMargin: `-${headerHeight + 24}px 0px -55% 0px`,
                threshold: [0.08, 0.15, 0.25, 0.35, 0.5, 0.65],
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
                className={item.type === "section" ? isActive(item.id) : ""}
                onClick={() => onNavClick(item)}
            >
                {item.label}
            </button>
        ));

    return (
        <>
            <header className={headerClass}>
                <div className="brand" onClick={() => scrollToSection("acasa")} role="button" tabIndex={0}>
                    <img src="/favicon.ico" alt="Bethel Dworp logo" className="logo-img" />
                    <div className="logo-text">Bethel Dworp</div>
                </div>

                <nav className="nav">{renderNavButtons()}</nav>

                <button
                    type="button"
                    className={burgerClass}
                    onClick={() => setMenuOpen((v) => !v)}
                    aria-label="Deschide meniul"
                    aria-expanded={menuOpen}
                >
                    <span />
                    <span />
                    <span />
                </button>
            </header>

            <div className={`mnav-overlay ${menuOpen ? "is-open" : ""}`} onClick={() => setMenuOpen(false)} aria-hidden={!menuOpen}>
                <div className="mnav-panel" onClick={(e) => e.stopPropagation()}>
                    <div className="mnav-top">
                        <div className="mnav-title">Meniu</div>
                        <button type="button" className="mnav-close" onClick={() => setMenuOpen(false)} aria-label="Închide meniul">
                            ×
                        </button>
                    </div>

                    <div className="mnav-links">{renderNavButtons()}</div>
                </div>
            </div>
        </>
    );
}