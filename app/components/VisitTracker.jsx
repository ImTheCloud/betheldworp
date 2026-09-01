"use client";

import { useEffect } from "react";
import { doc, setDoc, increment } from "firebase/firestore";
import { db } from "../lib/Firebase";
import { isOptedOut } from "../lib/tracking";
import { brusselsDayKey, deviceTypeSafe, getBrowserLanguageSafe, getGeoSafe, safeStorageGet, safeStorageSet } from "../lib/Tracker";
import { sanitizeKey, makeCityKey, normalizeLang, normalizeDevice } from "../lib/statsKeys";

// Incrémente les compteurs du jour. Rien d'autre n'est écrit : pas
// d'identifiant, pas d'heure, pas de coordonnées — seulement des nombres.
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

    safeStorageSet(dejaCompte, "1");
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
