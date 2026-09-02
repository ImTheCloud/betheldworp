// Donnees fixes de la carte des eglises.
//
// Extrait de ChurchMap.jsx, qui melangeait ces tables a la logique et aux
// composants sur 2599 lignes. Rien ici ne depend de React ni de Google Maps :
// ce sont des constantes, lisibles et modifiables sans ouvrir le composant.

export const MAP_ID = "5b50d76db2afedb8ba67cff4";

// Coordonnees proches de Bruxelles et Halle : la vue par defaut a l'ouverture.
export const BELGIUM_CENTER = { lat: 50.77198, lng: 4.30396 };

export const MAP_SELECTED_CHURCH_STORAGE_KEY = "bethel_worldmap_selected_church";

// Une proposition contient le prénom, le nom, le téléphone et l'e-mail de la
// personne qui l'envoie. Ces coordonnées ne servent qu'à vérifier l'église
// proposée : passé un an, elles n'ont plus d'objet.
//
// ATTENTION, cette date ne supprime rien aujourd'hui. Firestore n'efface un
// document daté que si une règle TTL a été créée sur la collection, depuis la
// console Firebase, et elle ne l'a PAS été pour church_suggestions (choix
// assumé du 31/08/2026). Les propositions se suppriment donc à la main, avec
// le bouton Delete de l'onglet Suggestions.
//
// Le champ est écrit quand même : le jour où la règle TTL sera activée, tout
// ce qui aura été enregistré depuis s'effacera sans autre intervention. Si
// cette durée change, la politique de confidentialité doit suivre, elle
// n'annonce actuellement aucun délai pour les propositions.
export const SUGGESTION_RETENTION_DAYS = 365;

// Code ISO a deux lettres par pays, pour retrouver le drapeau dans
// /public/images/flags.
export const COUNTRY_CODES = {
    Afghanistan: "af", Albania: "al", Algeria: "dz", Andorra: "ad", Angola: "ao", "Antigua and Barbuda": "ag", Argentina: "ar", Armenia: "am", Australia: "au", Austria: "at", Azerbaijan: "az",
    Bahamas: "bs", Bahrain: "bh", Bangladesh: "bd", Barbados: "bb", Belarus: "by", Belgium: "be", Belize: "bz", Benin: "bj", Bhutan: "bt", Bolivia: "bo", "Bosnia and Herzegovina": "ba", Botswana: "bw", Brazil: "br", Brunei: "bn", Bulgaria: "bg", "Burkina Faso": "bf", Burundi: "bi",
    "Cabo Verde": "cv", Cambodia: "kh", Cameroon: "cm", Canada: "ca", "Central African Republic": "cf", Chad: "td", Chile: "cl", China: "cn", Colombia: "co", Comoros: "km", "Congo (Congo-Brazzaville)": "cg", "Costa Rica": "cr", Croatia: "hr", Cuba: "cu", Cyprus: "cy", "Czech Republic": "cz",
    "Democratic Republic of the Congo": "cd", Denmark: "dk", Djibouti: "dj", Dominica: "dm", "Dominican Republic": "do", Ecuador: "ec", Egypt: "eg", "El Salvador": "sv", "Equatorial Guinea": "gq", Eritrea: "er", Estonia: "ee", Eswatini: "sz", Ethiopia: "et",
    Fiji: "fj", Finland: "fi", France: "fr", Gabon: "ga", Gambia: "gm", Georgia: "ge", Germany: "de", Ghana: "gh", Greece: "gr", Grenada: "gd", Guatemala: "gt", Guinea: "gn", "Guinea-Bissau": "gw", Guyana: "gy",
    Haiti: "ht", "Holy See": "va", Honduras: "hn", Hungary: "hu", Iceland: "is", India: "in", Indonesia: "id", Iran: "ir", Iraq: "iq", Ireland: "ie", Israel: "il", Italy: "it", "Ivory Coast": "ci",
    Jamaica: "jm", Japan: "jp", Jordan: "jo", Kazakhstan: "kz", Kenya: "ke", Kiribati: "ki", Kuwait: "kw", Kyrgyzstan: "kg", Laos: "la", Latvia: "lv", Lebanon: "lb", Lesotho: "ls", Liberia: "lr", Libya: "ly", Liechtenstein: "li", Lithuania: "lt", Luxembourg: "lu",
    Madagascar: "mg", Malawi: "mw", Malaysia: "my", Maldives: "mv", Mali: "ml", Malta: "mt", "Marshall Islands": "mh", Mauritania: "mr", Mauritius: "mu", Mexico: "mx", Micronesia: "fm", Moldova: "md", Monaco: "mc", Mongolia: "mn", Montenegro: "me", Morocco: "ma", Mozambique: "mz", Myanmar: "mm",
    Namibia: "na", Nauru: "nr", Nepal: "np", Netherlands: "nl", "New Zealand": "nz", Nicaragua: "ni", Niger: "ne", Nigeria: "ng", "North Korea": "kp", "North Macedonia": "mk", Norway: "no",
    Oman: "om", Pakistan: "pk", Palau: "pw", "Palestine State": "ps", Panama: "pa", "Papua New Guinea": "pg", Paraguay: "py", Peru: "pe", Philippines: "ph", Poland: "pl", Portugal: "pt",
    Qatar: "qa", Romania: "ro", Russia: "ru", Rwanda: "rw", "Saint Kitts and Nevis": "kn", "Saint Lucia": "lc", "Saint Vincent and the Grenadines": "vc", Samoa: "ws", "San Marino": "sm", "Sao Tome and Principe": "st", "Saudi Arabia": "sa", Senegal: "sn", Serbia: "rs", Seychelles: "sc", "Sierra Leone": "sl", Singapore: "sg", Slovakia: "sk", Slovenia: "si", "Solomon Islands": "sb", Somalia: "so", "South Africa": "za", "South Korea": "kr", "South Sudan": "ss", Spain: "es", "Sri Lanka": "lk", Sudan: "sd", Suriname: "sr", Sweden: "se", Switzerland: "ch", Syria: "sy",
    Taiwan: "tw", Tajikistan: "tj", Tanzania: "tz", Thailand: "th", "Timor-Leste": "tl", Togo: "tg", Tonga: "to", "Trinidad and Tobago": "tt", Tunisia: "tn", Turkey: "tr", Turkmenistan: "tm", Tuvalu: "tv",
    Uganda: "ug", Ukraine: "ua", "United Arab Emirates": "ae", "United Kingdom": "gb", "United States": "us", Uruguay: "uy", Uzbekistan: "uz", Vanuatu: "vu", Venezuela: "ve", Vietnam: "vn", Yemen: "ye", Zambia: "zm", Zimbabwe: "zw",
    USA: "us" // Legacy support
};

// Cadrage par pays : centre et niveau de zoom quand on filtre sur l'un d'eux.
export const COUNTRY_VIEWS = {
    Belgium: { center: { lat: 50.5039, lng: 4.4699 }, zoom: 8 },
    Romania: { center: { lat: 45.9432, lng: 24.9668 }, zoom: 7 },
    France: { center: { lat: 46.2276, lng: 2.2137 }, zoom: 6 },
    Germany: { center: { lat: 51.1657, lng: 10.4515 }, zoom: 6 },
    Netherlands: { center: { lat: 52.1326, lng: 5.2913 }, zoom: 7 },
    Italy: { center: { lat: 41.8719, lng: 12.5674 }, zoom: 6 },
    Spain: { center: { lat: 40.4637, lng: -3.7492 }, zoom: 6 },
    "United Kingdom": { center: { lat: 55.3781, lng: -3.4360 }, zoom: 6 },
    USA: { center: { lat: 37.0902, lng: -95.7129 }, zoom: 4 },
    Austria: { center: { lat: 47.5162, lng: 14.5501 }, zoom: 7 },
    Switzerland: { center: { lat: 46.8182, lng: 8.2275 }, zoom: 8 },
};
