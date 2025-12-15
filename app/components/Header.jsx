"use client";

import { useEffect, useState } from "react";
import "./Header.css";

const SECTION_IDS = [
    "acasa",
    "despre-noi",
    "program",
    "evenimente",
    "galerie",
    "locatie",
    "donatii",
];

export default function Header() {
    const [scrolled, setScrolled] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [activeId, setActiveId] = useState("acasa");

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

        const y =
            element.getBoundingClientRect().top + window.scrollY - headerHeight - 12;

        window.scrollTo({ top: y, behavior: "smooth" });
    };

    const openContact = () => {
        setMenuOpen(false);
        window.dispatchEvent(new Event("bethel:open-contact"));
    };

    const headerClass = `header ${scrolled ? "header-scrolled" : "header-top"}`;
    const burgerClass = `burger ${menuOpen ? "is-open" : ""} ${
        scrolled ? "burger-scrolled" : "burger-top"
    }`;

    const isActive = (id) => (activeId === id ? "is-active" : "");

    return (
        <>
            <header className={headerClass}>
                <div
                    className="brand"
                    onClick={() => scrollToSection("acasa")}
                    role="button"
                    tabIndex={0}
                >
                    <img src="/logo.png" alt="Bethel Dworp logo" className="logo-img" />
                    <div className="logo-text">Bethel Dworp</div>
                </div>

                <nav className="nav">
                    <button className={isActive("acasa")} type="button" onClick={() => scrollToSection("acasa")}>Acasă</button>
                    <button className={isActive("despre-noi")} type="button" onClick={() => scrollToSection("despre-noi")}>Cine suntem</button>
                    <button className={isActive("program")} type="button" onClick={() => scrollToSection("program")}>Program</button>
                    <button className={isActive("evenimente")} type="button" onClick={() => scrollToSection("evenimente")}>Evenimente</button>
                    <button className={isActive("galerie")} type="button" onClick={() => scrollToSection("galerie")}>Galerie</button>
                    <button className={isActive("locatie")} type="button" onClick={() => scrollToSection("locatie")}>Locație</button>
                    <button className={isActive("donatii")} type="button" onClick={() => scrollToSection("donatii")}>Donații</button>
                    <button type="button" onClick={openContact}>Contact</button>
                </nav>

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
                        <button
                            type="button"
                            className="mnav-close"
                            onClick={() => setMenuOpen(false)}
                            aria-label="Închide meniul"
                        >
                            ×
                        </button>
                    </div>

                    <div className="mnav-links">
                        <button className={isActive("acasa")} type="button" onClick={() => scrollToSection("acasa")}>Acasă</button>
                        <button className={isActive("despre-noi")} type="button" onClick={() => scrollToSection("despre-noi")}>Cine suntem</button>
                        <button className={isActive("program")} type="button" onClick={() => scrollToSection("program")}>Program</button>
                        <button className={isActive("evenimente")} type="button" onClick={() => scrollToSection("evenimente")}>Evenimente</button>
                        <button className={isActive("galerie")} type="button" onClick={() => scrollToSection("galerie")}>Galerie</button>
                        <button className={isActive("locatie")} type="button" onClick={() => scrollToSection("locatie")}>Locație</button>
                        <button className={isActive("donatii")} type="button" onClick={() => scrollToSection("donatii")}>Donații</button>
                        <button type="button" onClick={openContact}>Contact</button>
                    </div>
                </div>
            </div>
        </>
    );
}