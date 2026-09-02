import { Suspense } from "react";
import Header from "../components/Header";
import NextProgramBar from "../components/NextProgramBar";
import SectionBoundary from "../components/SectionBoundary";
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

// Chaque bloc est enveloppé dans SectionBoundary : une exception ne peut plus
// emporter que sa propre section, là où elle remplaçait auparavant la page
// entière par la frontière d'erreur.
export default function Home() {
    return (
        <>
            <SectionBoundary nom="Barre du prochain programme">
                <NextProgramBar />
            </SectionBoundary>

            <SectionBoundary nom="En-tête">
                <Header />
            </SectionBoundary>

            <main>
                <section id="acasa">
                    <SectionBoundary nom="Accueil">
                        <Hero />
                    </SectionBoundary>
                </section>

                <section id="program">
                    <SectionBoundary nom="Programme hebdomadaire">
                        <Program />
                    </SectionBoundary>
                </section>

                {/* Le calendrier lit les paramètres de l'URL pour ouvrir un
                    événement précis. Isolé ici, il est seul à être rendu côté
                    navigateur : sans cette limite, c'est toute la page d'accueil
                    qui le serait, et le HTML servi arriverait vide. */}
                <section id="evenimente">
                    <SectionBoundary nom="Calendrier des événements">
                        <Suspense fallback={null}>
                            <Events />
                        </Suspense>
                    </SectionBoundary>
                </section>

                <SectionBoundary nom="Newsletter">
                    <NewsletterSection />
                </SectionBoundary>

                <section id="despre-noi">
                    <SectionBoundary nom="À propos">
                        <About />
                    </SectionBoundary>
                </section>


                <section id="galerie">
                    <SectionBoundary nom="Galerie">
                        <Gallery />
                    </SectionBoundary>
                </section>

                <section id="donatii">
                    <SectionBoundary nom="Dons">
                        <Donations />
                    </SectionBoundary>
                </section>

                <section id="locatie">
                    <SectionBoundary nom="Localisation">
                        <Location />
                    </SectionBoundary>
                </section>

                <section id="harta-mondiala">
                    <SectionBoundary nom="Carte mondiale">
                        <WorldMapSection />
                    </SectionBoundary>
                </section>


                <SectionBoundary nom="Pied de page">
                    <Footer />
                </SectionBoundary>

                <SectionBoundary nom="Widget de contact">
                    <ContactWidget />
                </SectionBoundary>
            </main>
        </>
    );
}
