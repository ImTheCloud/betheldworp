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
import WorldMapSection from "./sections/WorldMapSection";
import BibleSection from "./sections/BibleSection";

export default function Home() {
    return (
        <>
            <Header />

            <main>
                <section id="acasa">
                    <Hero />
                </section>

                <section id="despre-noi">
                    <About />
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

                <section id="harta-mondiala">
                    <WorldMapSection />
                </section>

                <section id="biblia">
                    <BibleSection />
                </section>

                <Footer />
                <ContactWidget />
            </main>
        </>
    );
}