import { languageAlternates } from "../layout";

const SITE_URL = "https://www.betheldworp.be";
const PATH = "/romanian-pentecostal-churches-map";

const TITLES = {
    ro: "Harta Bisericilor Penticostale Române din lume",
    fr: "Carte des Églises Pentecôtistes Roumaines",
    nl: "Wereldkaart Roemeense Pinksterkerken",
    en: "Romanian Pentecostal Churches Worldwide Map",
};

// La description était en anglais pour les quatre langues. C'est le texte que
// Google affiche sous le lien : il doit être dans la langue de la page.
const DESCRIPTIONS = {
    ro: "Hartă interactivă a bisericilor penticostale române din întreaga lume: adrese, programe și contacte, cu posibilitatea de a propune o biserică nouă.",
    fr: "Carte interactive des églises pentecôtistes roumaines dans le monde : adresses, horaires et contacts, avec la possibilité de proposer une nouvelle église.",
    nl: "Interactieve kaart van Roemeense pinksterkerken wereldwijd: adressen, diensttijden en contactgegevens, met de mogelijkheid een nieuwe kerk voor te stellen.",
    en: "Interactive map of Romanian Pentecostal churches worldwide: addresses, service times and contacts, with the option to suggest a new church.",
};

export async function generateMetadata({ params }) {
    const { lang } = await params;
    const l = TITLES[lang] ? lang : "ro";

    return {
        title: `${TITLES[l]} | Bethel Dworp`,
        description: DESCRIPTIONS[l],
        // Sans ce bloc, la page hériterait de l'adresse canonique de l'accueil
        // et se déclarerait donc comme une copie de la page d'accueil.
        alternates: {
            canonical: `${SITE_URL}/${l}${PATH}`,
            languages: languageAlternates(PATH),
        },
        openGraph: {
            type: "website",
            title: `${TITLES[l]} | Bethel Dworp`,
            description: DESCRIPTIONS[l],
            url: `${SITE_URL}/${l}${PATH}`,
            locale: l,
        },
    };
}

export default function WorldMapLayout({ children }) {
    return <>{children}</>;
}
