import Header from "./components/Header";
import HeroSection from "./components/HeroSection";
import AboutSection from "./components/AboutSection";
import ProgramSection from "./components/ProgramSection";

import "./globals.css";

export default function Home() {
    return (
        <>
            <Header />
            <main>
                <section id="acasa" className="hero-stack">
                    <div className="hero-stack-hero">
                        <HeroSection />
                    </div>

                    <div className="hero-stack-about">
                        <AboutSection />
                    </div>
                </section>

                <ProgramSection />

            </main>
        </>
    );
}