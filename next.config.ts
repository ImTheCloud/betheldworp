import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    images: {
        // Next 16 refuse toute qualité non déclarée ici : le prop quality est
        // ignoré et l'URL /_next/image correspondante renvoie une erreur.
        // 90 et non 75 par défaut, parce que les photos sont déjà compressées à
        // 80 : une seconde passe à 75 ramollirait visiblement l'image.
        qualities: [75, 90],
    },

    // En-têtes de sécurité. Vercel n'en pose qu'un, strict-transport-security ;
    // tout le reste doit venir d'ici.
    //
    // Le plus utile est l'interdiction de cadrage. Sans elle, n'importe quel
    // site peut placer betheldworp.be dans une iframe invisible et faire
    // cliquer un visiteur sans qu'il le sache — le formulaire de connexion de
    // /admin étant la cible qui compte.
    //
    // Volontairement PAS de politique de sécurité du contenu complète : le site
    // charge Google Maps, Firebase, EmailJS et Vercel Analytics, et une
    // directive script-src trop étroite casserait la page en silence chez le
    // visiteur. Seule frame-ancestors est posée, elle ne restreint rien d'autre.
    async headers() {
        return [
            {
                source: "/:path*",
                headers: [
                    // Interdit le cadrage. X-Frame-Options pour les anciens
                    // navigateurs, frame-ancestors pour les autres.
                    { key: "X-Frame-Options", value: "SAMEORIGIN" },
                    { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },

                    // Empêche un navigateur de deviner le type d'un fichier et
                    // d'exécuter comme script ce qui est servi comme texte.
                    { key: "X-Content-Type-Options", value: "nosniff" },

                    // L'adresse complète de la page ne part pas vers les sites
                    // tiers, seulement l'origine, et rien du tout en clair.
                    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

                    // Coupe des capacités que le site n'utilise jamais. La
                    // géolocalisation reste autorisée pour nous : la carte des
                    // églises s'en sert pour le bouton « me recentrer ».
                    // Les fonctions réclamées par la vidéo YouTube de la galerie
                    // ne sont pas nommées ici, donc elles gardent leur valeur
                    // par défaut et l'attribut allow de l'iframe continue de
                    // fonctionner.
                    { key: "Permissions-Policy", value: "camera=(), microphone=(), payment=(), usb=(), geolocation=(self)" },
                ],
            },
        ];
    },
};

export default nextConfig;
