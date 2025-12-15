import Header from "./components/Header";
import Hero from "./sections/Hero";
import About from "./sections/About";
import Program from "./sections/Program";
import Location from "./sections/Location";
import Footer from "./components/Footer";
import ContactWidget from "./components/ContactWidget";
import Events from "./sections/EventsCalendar";
import Gallery from "./sections/Gallery";
import Donations from "./sections/Donations";

import "./globals.css";


export default function Home() {
    return (
        <>
            <Header />

            <main>
                <section className="hero-stack">
                    <div className="hero-stack-hero">
                        <Hero />
                    </div>

                    <div className="hero-stack-about">
                        <About />
                    </div>
                </section>

                <Program />
                <Events />
                <Gallery />


                <Location />
                <Donations />

                <Footer />

                <ContactWidget />
            </main>
        </>
    );
}