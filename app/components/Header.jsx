"use client";

import { useEffect, useMemo, useState } from "react";
import "./Header.css";

const SECTION_IDS = ["acasa", "despre-noi", "program", "evenimente", "galerie", "locatie", "donatii"];

export default function Header() {
    const [scrolled, setScrolled] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [activeId, setActiveId] = useState("acasa");

    const NAV_ITEMS = useMemo(
        () => [
            { id: "acasa", label: "Acasă", type: "section" },
            { id: "despre-noi", label: "Cine suntem", type: "section" },
            { id: "program", label: "Programul săptămânal", type: "section" },
            { id: "evenimente", label: "Evenimente", type: "section" },
            { id: "galerie", label: "Galerie", type: "section" },
            { id: "locatie", label: "Locație", type: "section" },
            { id: "donatii", label: "Donații", type: "section" },
            { id: "contact", label: "Contact", type: "contact" },
        ],
        []
    );

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 40);

            const header = document.querySelector(".header");
            const headerHeight = header?.offsetHeight ?? 90;
            const y = window.scrollY + headerHeight + 40;

            let current = "acasa";
            for (const id of SECTION_IDS) {
                if (id === "acasa") continue;
                const el = document.getElementById(id);
                if (!el) continue;
                if (el.offsetTop <= y) current = id;
            }

            if (window.scrollY < 60) current = "acasa";
            setActiveId(current);
        };

        handleScroll();
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
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
        const headerHeight = header?.offsetHeight ?? 90;

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

    const renderNavButtons = (variant) =>
        NAV_ITEMS.map((item) => (
            <button
                key={item.id}
                type="button"
                className={item.type === "section" ? isActive(item.id) : variant === "mobile" ? "" : ""}
                onClick={() => onNavClick(item)}
            >
                {item.label}
            </button>
        ));

    return (
        <>
            <header className={headerClass}>
                <div className="brand" onClick={() => scrollToSection("acasa")} role="button" tabIndex={0}>
                    <img src="/logo.png" alt="Bethel Dworp logo" className="logo-img" />
                    <div className="logo-text">Bethel Dworp</div>
                </div>

                <nav className="nav">{renderNavButtons("desktop")}</nav>

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

            <div
                className={`mnav-overlay ${menuOpen ? "is-open" : ""}`}
                onClick={() => setMenuOpen(false)}
                aria-hidden={!menuOpen}
            >
                <div className="mnav-panel" onClick={(e) => e.stopPropagation()}>
                    <div className="mnav-top">
                        <div className="mnav-title">Meniu</div>
                        <button type="button" className="mnav-close" onClick={() => setMenuOpen(false)} aria-label="Închide meniul">
                            ×
                        </button>
                    </div>

                    <div className="mnav-links">{renderNavButtons("mobile")}</div>
                </div>
            </div>
        </>
    );
}