// Fiche d'installation du site, lue quand on l'ajoute à un écran d'accueil.
// Android s'en sert pour l'icône, le nom et les couleurs ; iOS ne lit que
// name et display, son icône vient de la balise apple-touch-icon.

export default function manifest() {
    return {
        name: "Bethel Dworp",
        short_name: "Bethel",
        description: "Biserica Penticostală Betel din Dworp (Beersel, Belgia)",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#0a2a43",
        icons: [
            { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
            // « maskable » autorise Android à recadrer dans un cercle ou un
            // arrondi sans rogner la flamme, grâce à la marge blanche.
            { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
    };
}
