import "./globals.css";
import VisitTracker from "../components/VisitTracker";
import LanguageProvider from "../components/LanguageProvider";
import { Analytics } from "@vercel/analytics/next";

const SITE_TITLE = "Bethel Dworp";
const SITE_URL = "https://www.betheldworp.be";
const LANGS = ["ro", "fr", "nl", "en"];

// La description était en roumain pour les quatre langues : c'est elle que Google
// affiche sous le lien, un visiteur francophone lisait donc du roumain.
const DESCRIPTIONS = {
    ro: "Biserica Penticostală Betel din Dworp (Beersel, Belgia) – programul serviciilor, evenimente și harta bisericilor penticostale române din lume.",
    fr: "Église pentecôtiste Bethel à Dworp (Beersel, Belgique) – horaires des cultes, événements et carte des églises pentecôtistes roumaines dans le monde.",
    nl: "Pinksterkerk Bethel in Dworp (Beersel, België) – dienstentijden, activiteiten en de wereldkaart van Roemeense pinksterkerken.",
    en: "Bethel Pentecostal Church in Dworp (Beersel, Belgium) – service times, events and a world map of Romanian Pentecostal churches.",
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

    return {
        metadataBase: new URL(SITE_URL),
        title: SITE_TITLE,
        description: DESCRIPTIONS[l],
        icons: { icon: "/icon.png" },
        alternates: {
            canonical: `${SITE_URL}/${l}`,
            languages: languageAlternates(),
        },
        openGraph: {
            type: "website",
            siteName: SITE_TITLE,
            title: SITE_TITLE,
            description: DESCRIPTIONS[l],
            url: `${SITE_URL}/${l}`,
            locale: l,
            images: [{ url: "/images/og.jpg", width: 1200, height: 630, alt: SITE_TITLE }],
        },
        twitter: {
            card: "summary_large_image",
            title: SITE_TITLE,
            description: DESCRIPTIONS[l],
            images: ["/images/og.jpg"],
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
                    l'emportait — écrasant les titres traduits de chaque page. */}
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap" rel="stylesheet" />
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