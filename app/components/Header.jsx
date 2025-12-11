// app/components/Header.jsx
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
        const element = document.getElementById(id);
        if (!element) return;
        element.scrollIntoView({ behavior: "smooth" });
    };

    return (
        <header className={`header ${scrolled ? "header-scrolled" : "header-top"}`}>
            <div className="brand">
                <img src="/logo.png" alt="Bethel Dworp logo" className="logo-img" />
                <div className="logo-text">Bethel Dworp</div>
            </div>

            <nav className="nav">
                <button onClick={() => scrollToSection("acasa")}>Acasă</button>
                <button onClick={() => scrollToSection("despre-noi")}>Cine suntem</button>
                <button onClick={() => scrollToSection("program")}>Program</button>
                <button onClick={() => scrollToSection("contact")}>Contact</button>
            </nav>
        </header>
    );
}