// Plan du site, engendré au build.
//
// L'ancien public/sitemap.xml était écrit à la main et ne déclarait qu'une seule
// adresse : la page d'accueil. Ni les quatre langues, ni la carte des églises,
// ni les pages de confidentialité n'y figuraient.
//
// Chaque entrée porte ses équivalents dans les autres langues, pour que Google
// les traite comme une même page traduite et non comme des doublons.

const SITE_URL = "https://www.betheldworp.be";
const LANGS = ["ro", "fr", "nl", "en"];

const PAGES = [
    { path: "", priority: 1, changeFrequency: "weekly" },
    { path: "/romanian-pentecostal-churches-map", priority: 0.8, changeFrequency: "weekly" },
    { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
];

export default function sitemap() {
    const now = new Date();

    return PAGES.flatMap(({ path, priority, changeFrequency }) =>
        LANGS.map((lang) => ({
            url: `${SITE_URL}/${lang}${path}`,
            lastModified: now,
            changeFrequency,
            priority,
            alternates: {
                languages: Object.fromEntries(
                    LANGS.map((l) => [l, `${SITE_URL}/${l}${path}`])
                ),
            },
        }))
    );
}
