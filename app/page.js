import Header from "./components/Header";
import HeroSection from "./components/HeroSection";
import AboutSection from "./components/AboutSection";
import ProgramSection from "./components/ProgramSection";
import ContactSection from "./components/ContactSection";
import Footer from "./components/Footer";

import "./globals.css";

export default function Home() {
    return (
        <>
            <Header />
            <main>
                <section className="hero-stack">
                    <div className="hero-stack-hero">
                        <HeroSection />
                    </div>

                    <div className="hero-stack-about">
                        <AboutSection />
                    </div>
                </section>

                <ProgramSection />
                <ContactSection />
                <Footer />
            </main>
        </>
    );
}