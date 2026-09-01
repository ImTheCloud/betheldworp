import "../[lang]/globals.css";

export const metadata = {
    title: "Bethel Admin",
    robots: { index: false, follow: false },
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


