"use client";

import { useEffect, useState } from "react";
import "./Header.css";

export default function Header() {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 40);
        handleScroll();
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const scrollToSection = (id) => {
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
        window.dispatchEvent(new Event("bethel:open-contact"));
    };

    return (
        <header className={`header ${scrolled ? "header-scrolled" : "header-top"}`}>
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
                <button type="button" onClick={() => scrollToSection("acasa")}>Acasă</button>
                <button type="button" onClick={() => scrollToSection("despre-noi")}>Cine suntem</button>
                <button type="button" onClick={() => scrollToSection("program")}>Program</button>
                <button type="button" onClick={() => scrollToSection("evenimente")}>Evenimente</button>
                <button type="button" onClick={() => scrollToSection("galerie")}>Galerie</button>
                <button type="button" onClick={() => scrollToSection("locatie")}>Locație</button>
                <button type="button" onClick={() => scrollToSection("donatii")}>Donații</button>

                <button type="button" onClick={openContact}>Contact</button>
            </nav>
        </header>
    );
}