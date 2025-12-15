import Header from "./components/Header";
import Hero from "./sections/Hero";
import About from "./sections/About";
import Program from "./sections/WeeklyProgram";
import Location from "./sections/Location";
import Footer from "./components/Footer";
import ContactWidget from "./components/ContactWidget";
import Events from "./sections/EventsCalendar";
import Gallery from "./sections/Gallery";
import Donations from "./sections/Donations";
import NextProgramToast from "./components/NextProgramToast";

import "./globals.css";

export default function Home() {
    return (
        <>
            <Header />

            <main>
                <section id="acasa" className="hero-stack">
                    <div className="hero-stack-hero">
                        <Hero />
                    </div>

                    <div id="despre-noi" className="hero-stack-about">
                        <About />
                    </div>
                </section>

                <section id="program">
                    <Program />
                </section>

                <section id="evenimente">
                    <Events />
                </section>

                <section id="galerie">
                    <Gallery />
                </section>

                <section id="donatii">
                    <Donations />
                </section>

                <section id="locatie">
                    <Location />
                </section>

                <Footer />
                <ContactWidget />
                <NextProgramToast />
            </main>
        </>
    );
}