import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    images: {
        // Next 16 refuse toute qualité non déclarée ici : le prop quality est
        // ignoré et l'URL /_next/image correspondante renvoie une erreur.
        // 90 et non 75 par défaut, parce que les photos sont déjà compressées à
        // 80 : une seconde passe à 75 ramollirait visiblement l'image.
        qualities: [75, 90],
    },
};

export default nextConfig;
