import "./globals.css";
import VisitTracker from "../components/VisitTracker";
import LanguageProvider from "../components/LanguageProvider";
import { Analytics } from "@vercel/analytics/next";

const SITE_TITLE = "Bethel Dworp";
const SITE_URL = "https://www.betheldworp.be";
const LANGS = ["ro", "fr", "nl", "en"];

const TITLES = {
    ro: "Bethel Dworp — Biserica Penticostală",
    fr: "Bethel Dworp — Église Pentecôtiste",
    nl: "Bethel Dworp — Pinksterkerk",
    en: "Bethel Dworp — Pentecostal Church",
};

const DESCRIPTIONS = {
    ro: "Biserica Penticostală Bethel din Dworp (Beersel, Belgia). O comunitate a credinței, rugăciunii și închinării. Descoperă programul serviciilor divine, evenimentele și harta bisericilor penticostale române.",
    fr: "Église pentecôtiste Bethel à Dworp (Beersel, Belgique). Une communauté de foi, de prière et de louange. Découvrez les horaires des cultes, les événements et la carte des églises.",
    nl: "Pinksterkerk Bethel in Dworp (Beersel, België). Een gemeenschap van geloof, gebed en aanbidding. Bekijk onze dienstentijden, activiteiten en de wereldkaart van pinksterkerken.",
    en: "Bethel Pentecostal Church in Dworp (Beersel, Belgium). A community of faith, prayer, and worship. Explore our service times, events, and world map of Pentecostal churches.",
};

// Pré-génère les quatre langues au build plutôt qu'à chaque visite.
export function generateStaticParams() {
    return LANGS.map((lang) => ({ lang }));
}

// Indique à Google que les quatre versions sont la même page en langues
// différentes, et non du contenu dupliqué. Sans ces balises il en choisissait
// une au hasard et ignorait les autres.
export function languageAlternates(path = "") {
    const languages = Object.fromEntries(LANGS.map((l) => [l, `${SITE_URL}/${l}${path}`]));
    return { ...languages, "x-default": `${SITE_URL}/ro${path}` };
}

export async function generateMetadata({ params }) {
    const { lang } = await params;
    const l = LANGS.includes(lang) ? lang : "ro";
    const pageTitle = TITLES[l] || TITLES.ro;
    const pageDesc = DESCRIPTIONS[l] || DESCRIPTIONS.ro;

    return {
        metadataBase: new URL(SITE_URL),
        title: pageTitle,
        description: pageDesc,
        // apple est indispensable : sans balise apple-touch-icon, iOS ne prend
        // pas le favicon pour l'écran d'accueil, il fabrique une pastille avec
        // l'initiale du site, d'où le « B » à la place du logo. iOS exige aussi
        // une image carrée, alors que icon.png fait 372x445.
        icons: {
            icon: "/icon.png",
            apple: "/apple-icon.png",
        },
        manifest: "/manifest.webmanifest",
        alternates: {
            canonical: `${SITE_URL}/${l}`,
            languages: languageAlternates(),
        },
        openGraph: {
            type: "website",
            siteName: SITE_TITLE,
            title: TITLES.ro,
            description: DESCRIPTIONS.ro,
            url: `${SITE_URL}/${l}`,
            locale: "ro_RO",
            images: [{ url: "/images/og-v7.jpg", width: 1200, height: 630, alt: TITLES.ro }],
        },
        twitter: {
            card: "summary_large_image",
            title: TITLES.ro,
            description: DESCRIPTIONS.ro,
            images: ["/images/og-v7.jpg"],
        },
    };
}

// Ni maximumScale ni userScalable : bloquer le zoom empêche d'agrandir le texte
// à deux doigts, ce qui met le site en échec sur le critère WCAG 1.4.4 et gêne
// d'abord les visiteurs qui en ont le plus besoin.
export const viewport = {
    width: "device-width",
    initialScale: 1,
    interactiveWidget: "resizes-content",
    viewportFit: "cover",
};

// La langue est déjà choisie en amont : `middleware.js` lit le cookie puis
// l'en-tête Accept-Language et redirige vers /ro, /fr, /nl ou /en. Ce fichier
// n'a plus qu'à lire le segment d'URL qui en résulte.

export default async function RootLayout({ children, params }) {
    const { lang } = await params;
    

    return (
        <html lang={lang} suppressHydrationWarning>
            <head>
                {/* Pas de <title> écrit à la main : Next en pose déjà un depuis
                    `metadata`, et celui-ci, placé plus haut dans le <head>,
                    l'emportait, écrasant les titres traduits de chaque page. */}
                {/* Aucune police externe : le site s'affiche en system-ui, la police
                    native de l'appareil. La feuille Google Fonts chargée ici pendant
                    des mois ne servait à rien, aucun CSS ne demandait Inter, et
                    envoyait l'adresse IP de chaque visiteur à Google à chaque page. */}
            </head>
            <body>
                <LanguageProvider initialLang={lang}>
                    <VisitTracker />
                    {children}

                    <Analytics />

                </LanguageProvider>
            </body>
        </html>
    );
}