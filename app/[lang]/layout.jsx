import "./globals.css";
import VisitTracker from "../components/VisitTracker";
import LanguageProvider from "../components/LanguageProvider";
import { Analytics } from "@vercel/analytics/next";

const SITE_TITLE = "Bethel Dworp";

export const metadata = {
    title: SITE_TITLE,
    description: "Biserica Betel Dworp – Comunitate creștină penticostală",
    icons: { icon: "/icon.png" },
};

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