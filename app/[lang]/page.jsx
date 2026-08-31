import { Suspense } from "react";
import Header from "../components/Header";
import NextProgramBar from "../components/NextProgramBar";
import Hero from "../sections/Hero";
import About from "../sections/About";
import Program from "../sections/WeeklyProgram";
import Location from "../sections/Location";
import Footer from "../components/Footer";
import ContactWidget from "../components/ContactWidget";
import Events from "../sections/EventsCalendar";
import Gallery from "../sections/Gallery";
import Donations from "../sections/Donations";
import WorldMapSection from "../sections/WorldMapSection";
import NewsletterSection from "../sections/NewsletterSection";

export default function Home() {
    return (
        <>
            <NextProgramBar />
            <Header />

            <main>
                <section id="acasa">
                    <Hero />
                </section>

                <section id="program">
                    <Program />
                </section>

                {/* Le calendrier lit les paramètres de l'URL pour ouvrir un
                    événement précis. Isolé ici, il est seul à être rendu côté
                    navigateur : sans cette limite, c'est toute la page d'accueil
                    qui le serait, et le HTML servi arriverait vide. */}
                <section id="evenimente">
                    <Suspense fallback={null}>
                        <Events />
                    </Suspense>
                </section>

                <NewsletterSection />

                <section id="despre-noi">
                    <About />
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


                <Footer />
                <ContactWidget />
            </main>
        </>
    );
}
