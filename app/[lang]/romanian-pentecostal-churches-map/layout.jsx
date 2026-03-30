export async function generateMetadata({ params }) {
    const { lang } = await params;
    const isRo = lang === 'ro';
    const isFr = lang === 'fr';
    const isNl = lang === 'nl';
    
    let title = "Harta Bisericilor Penticostale Române din lume";
    if (isFr) title = "Carte des Églises Pentecôtistes Roumaines";
    if (isNl) title = "Wereldkaart Roemeense Pinksterkerken";
    if (lang === 'en') title = "Romanian Pentecostal Churches Worldwide Map";

    return {
        title: title + " | Bethel Dworp",
        description: "Interactive map of Romanian Pentecostal churches worldwide.",
    };
}

export default function WorldMapLayout({ children }) {
    return <>{children}</>;
}
