// app/page.js
import Header from "./components/Header";
import HeroSection from "./components/HeroSection";
import AboutSection from "./components/AboutSection";
import ProgramSection from "./components/ProgramSection";
import Footer from "./components/Footer";
import ContactWidget from "./components/ContactWidget";

import "./globals.css";

export default function Home() {
    return (
        <>
            <Header />

            <main>
                {/* HERO + ABOUT en stack */}
                <section className="hero-stack">
                    <div className="hero-stack-hero">
                        <HeroSection />
                    </div>

                    <div className="hero-stack-about">
                        <AboutSection />
                    </div>
                </section>

                {/* PROGRAM */}
                <ProgramSection />

                {/* FOOTER */}
                <Footer />

                {/* CONTACT FLOATING */}
                <ContactWidget />
            </main>
        </>
    );
}