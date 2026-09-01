import "../[lang]/globals.css";

export const metadata = {
    title: "Bethel Admin",
    robots: { index: false, follow: false },
    // Mêmes icônes que le site public : sans apple, iOS remplace le logo par
    // une pastille avec l'initiale quand on ajoute /admin à l'écran d'accueil.
    //
    // Pas de manifest ici, et c'est délibéré : son start_url vaut "/", donc iOS
    // proposait d'enregistrer la page d'accueil au lieu de l'admin. Le manifeste
    // est désormais un fichier statique de public/, déclaré uniquement par la
    // mise en page publique. Il était auparavant engendré par app/manifest.js,
    // une convention de fichier que Next injecte dans TOUTES les pages : le
    // laisser hors du metadata de ce fichier ne suffisait pas à s'en défaire.
    icons: {
        icon: "/icon.png",
        apple: "/apple-icon.png",
    },
};

export default function AdminLayout({ children }) {
    return (
        <html lang="en">
            <head>
                {/* Aucune police externe : le site s'affiche en system-ui, la police
                    native de l'appareil. La feuille Google Fonts chargée ici pendant
                    des mois ne servait à rien — aucun CSS ne demandait Inter — et
                    envoyait l'adresse IP de chaque visiteur à Google à chaque page. */}
            </head>
            <body>
                {children}
            </body>
        </html>
    );
}


