// app/page.js
import Header from "./components/Header";
import Hero from "./sections/Hero";
import About from "./sections/About";
import Program from "./sections/Program";
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
                        <Hero />
                    </div>

                    <div className="hero-stack-about">
                        <About />
                    </div>
                </section>

                {/* PROGRAM */}
                <Program />

                {/* FOOTER */}
                <Footer />

                {/* CONTACT FLOATING */}
                <ContactWidget />
            </main>
        </>
    );
}