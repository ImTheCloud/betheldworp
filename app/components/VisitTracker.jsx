"use client";

import { useEffect } from "react";
import { doc, setDoc, increment } from "firebase/firestore";
import { db } from "../lib/Firebase";
import { isOptedOut } from "../lib/tracking";
import { brusselsDayKey, brusselsWeekKey, deviceTypeSafe, getBrowserLanguageSafe, getGeoSafe, safeStorageGet, safeStorageSet } from "../lib/Tracker";
import { sanitizeKey, makeCityKey, normalizeLang, normalizeDevice } from "../lib/statsKeys";

// Incrémente les compteurs du jour. Rien d'autre n'est écrit : pas
// d'identifiant, pas d'heure, pas de coordonnées, seulement des nombres.
//
// Les noms de pays et de villes viennent de notre propre serveur, jamais du
// navigateur : ils sont donc déjà bornés et normalisés.
async function compterVisite() {
    const jour = brusselsDayKey();

    // Un seul comptage par navigateur et par jour. Ce drapeau n'identifie
    // personne : il dit « déjà compté », pas « qui ».
    const dejaCompte = `bethel_visit_${jour}`;
    if (safeStorageGet(dejaCompte) === "1") return;

    const geo = await getGeoSafe();

    // setDoc en fusion plutôt que updateDoc : le premier visiteur de la journée
    // crée le document, les suivants l'incrémentent, sans cas particulier.
    await setDoc(
        doc(db, "stats_daily", jour),
        {
            day: jour,
            visits: increment(1),
            countries: { [sanitizeKey(geo.country)]: increment(1) },
            cities: { [makeCityKey(geo.country, geo.city)]: increment(1) },
            devices: { [normalizeDevice(deviceTypeSafe())]: increment(1) },
            languages: { [normalizeLang(getBrowserLanguageSafe())]: increment(1) },
        },
        { merge: true }
    );

    // Le drapeau est posé dès que le compteur du jour est passé : si les
    // compteurs publics échouaient ensuite, la visite ne serait pas comptée
    // deux fois à la page suivante.
    safeStorageSet(dejaCompte, "1");

    // Compteurs publics affichés dans le pied de page. Ils vivent à part de
    // stats_daily parce qu'ils sont lisibles par tous : ils ne portent qu'un
    // nombre, jamais une répartition par pays ou par ville.
    // Cinq paliers, chacun dans son document : depuis toujours, l'annee en
    // cours, le mois en cours, la semaine en cours, le jour. Additionner les jours a l'affichage
    // aurait oblige a lire toute la collection sur chaque page ; quatre
    // documents d'un nombre se lisent en quatre acces constants.
    //
    // Le premier visiteur d'une annee ou d'un mois cree le document
    // correspondant, sans traitement particulier : increment sur un document
    // absent le cree a 1.
    try {
        const paliers = ["total", jour.slice(0, 4), jour.slice(0, 7), brusselsWeekKey(jour), jour];
        await Promise.all(
            paliers.map((id) =>
                setDoc(doc(db, "stats_public", id), { visits: increment(1) }, { merge: true })
            )
        );
    } catch (e) {
        console.error("Compteurs publics indisponibles :", e);
    }
}

export default function VisitTracker() {
    useEffect(() => {
        let annule = false;

        (async () => {
            // Le visiteur peut refuser la mesure depuis la page de
            // confidentialité : son choix est vérifié à chaque visite.
            if (annule || isOptedOut()) return;
            try {
                await compterVisite();
            } catch (e) {
                // Un compteur qui échoue ne doit jamais gêner la lecture du site.
                console.error("Comptage de visite impossible :", e);
            }
        })();

        return () => {
            annule = true;
        };
    }, []);

    return null;
}
