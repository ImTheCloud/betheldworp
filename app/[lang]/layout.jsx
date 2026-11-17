import "./globals.css";
import VisitTracker from "../components/VisitTracker";
import LanguageProvider from "../components/LanguageProvider";
import { Analytics } from "@vercel/analytics/next";

const SITE_TITLE = "Bethel Dworp";
const SITE_URL = "https://www.betheldworp.be";
const LANGS = ["ro", "fr", "nl", "en"];

// Titres et descriptions pour les moteurs de recherche. Ils reprennent ce que
// les gens tapent vraiment : « biserica penticostala romana Bruxelles »,
// « église roumaine Bruxelles », plutôt que le seul nom du village.
const TITLES = {
    ro: "Biserica Penticostală Română Bethel Dworp – lângă Bruxelles",
    fr: "Église Pentecôtiste Roumaine Bethel Dworp – près de Bruxelles",
    nl: "Roemeense Pinksterkerk Bethel Dworp – bij Brussel",
    en: "Bethel Dworp Romanian Pentecostal Church – near Brussels",
};

const DESCRIPTIONS = {
    ro: "Biserică penticostală română în Dworp (Beersel), la sud de Bruxelles. Serviciu divin duminica la 10:00 și 18:00, programul săptămânal și evenimentele bisericii.",
    fr: "Église pentecôtiste roumaine à Dworp (Beersel), au sud de Bruxelles. Culte le dimanche à 10h et 18h, programme de la semaine et événements de l’église.",
    nl: "Roemeense pinksterkerk in Dworp (Beersel), ten zuiden van Brussel. Eredienst op zondag om 10u en 18u, weekprogramma en activiteiten van de kerk.",
    en: "Romanian Pentecostal church in Dworp (Beersel), south of Brussels. Sunday services at 10:00 and 18:00, weekly program and church events.",
};

// Aperçu de partage (WhatsApp, Facebook) : textes inchangés, en roumain sur
// toutes les langues (choix du 28 septembre 2026), indépendants des titres
// de recherche ci-dessus.
const SHARE_TITLE = "Bethel Dworp Biserica Penticostală";
const SHARE_DESCRIPTION = "Biserica Penticostală Bethel din Dworp. Programul serviciilor divine și evenimente.";

// Pré-génère les quatre langues au build plutôt qu'à chaque visite.
export function generateStaticParams() {
    return LANGS.map((lang) => ({ lang }));
}

// Seules ces quatre langues existent. Sans cette ligne, /favicon.ico,
// /llms.txt ou /nimporte-quoi.txt affichaient la page d'accueil avec un code
// 200 : du contenu dupliqué aux yeux de Google, et des fichiers introuvables
// pour les robots. Elles renvoient désormais une vraie erreur 404.
export const dynamicParams = false;

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
        // Google et Brave exigent un favicon carré : icon.png (372x445) était
        // ignoré, d'où l'ancien logo dans les résultats de recherche. apple est
        // indispensable : sans lui, iOS fabrique une pastille avec l'initiale
        // du site sur l'écran d'accueil. app/favicon.ico couvre l'adresse
        // /favicon.ico que les moteurs lisent en premier.
        icons: {
            icon: { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
            apple: { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
        },
        manifest: "/manifest.webmanifest",
        // Preuve de propriété pour Bing Webmaster Tools (Bing alimente aussi
        // la recherche de ChatGPT et DuckDuckGo). Ne pas supprimer : Bing
        // revérifie régulièrement et retirerait l'accès au site.
        verification: {
            other: { "msvalidate.01": "C2A47FFBDCD59BECD647397218546C48" },
        },
        alternates: {
            canonical: `${SITE_URL}/${l}`,
            languages: languageAlternates(),
        },
        openGraph: {
            type: "website",
            siteName: SITE_TITLE,
            // Voir SHARE_TITLE : les liens circulent surtout dans les groupes
            // WhatsApp de la communauté roumaine.
            title: SHARE_TITLE,
            description: SHARE_DESCRIPTION,
            url: `${SITE_URL}/${l}`,
            locale: "ro_RO",
            images: [{ url: "/images/og-v13.jpg", width: 1200, height: 630, alt: SHARE_TITLE }],
        },
        twitter: {
            card: "summary_large_image",
            title: SHARE_TITLE,
            description: SHARE_DESCRIPTION,
            images: ["/images/og-v13.jpg"],
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