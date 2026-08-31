"use client";

import { useState } from "react";
import { collection, collectionGroup, getDocs, writeBatch } from "firebase/firestore";
import { db } from "../../lib/Firebase";
import { expiresAt } from "../../lib/tracking";

// Outil ponctuel : pose une date d'expiration sur les documents de visite
// écrits avant l'introduction de la conservation limitée à 13 mois.
//
// Firestore ignore les documents dont le champ TTL est absent : sans ce
// rattrapage, tout l'historique antérieur resterait indéfiniment.
//
// À retirer une fois exécuté.

const BATCH_SIZE = 400; // la limite Firestore est de 500 opérations par lot

const CIBLES = [
    { nom: "visits_global", requete: () => collection(db, "visits_global") },
    { nom: "visitors", requete: () => collectionGroup(db, "visitors") },
    { nom: "map_visitors", requete: () => collectionGroup(db, "map_visitors") },
];

export default function BackfillExpiry() {
    const [etat, setEtat] = useState("idle");
    const [journal, setJournal] = useState([]);

    const ligne = (txt) => setJournal((j) => [...j, txt]);

    const lancer = async () => {
        setEtat("running");
        setJournal([]);
        const date = expiresAt();
        ligne(`Date posée : ${date.toLocaleDateString("fr-BE")}`);

        try {
            for (const cible of CIBLES) {
                const snap = await getDocs(cible.requete());
                const aTraiter = snap.docs.filter((d) => !d.data()?.expiresAt);

                ligne(`${cible.nom} : ${snap.size} documents, ${aTraiter.length} sans date`);

                for (let i = 0; i < aTraiter.length; i += BATCH_SIZE) {
                    const lot = writeBatch(db);
                    aTraiter.slice(i, i + BATCH_SIZE).forEach((d) => {
                        lot.update(d.ref, { expiresAt: date });
                    });
                    await lot.commit();
                    ligne(`  ${Math.min(i + BATCH_SIZE, aTraiter.length)} / ${aTraiter.length}`);
                }
            }
            ligne("Terminé.");
            setEtat("done");
        } catch (err) {
            console.error("Backfill error:", err);
            ligne(`Erreur : ${err?.message || err}`);
            setEtat("error");
        }
    };

    return (
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, marginBottom: 24, background: "#fffbeb" }}>
            <div style={{ fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>
                Maintenance ponctuelle — date d&apos;expiration
            </div>
            <p style={{ margin: "0 0 14px", fontSize: 14, color: "#475569", lineHeight: 1.6 }}>
                Pose une date d&apos;expiration sur les visites enregistrées avant aujourd&apos;hui,
                pour qu&apos;elles soient supprimées automatiquement dans 13 mois. Sans
                effet sur les documents qui en ont déjà une. À n&apos;exécuter qu&apos;une fois.
            </p>

            <button
                type="button"
                onClick={lancer}
                disabled={etat === "running"}
                style={{
                    font: "inherit", fontSize: 15, fontWeight: 700, padding: "11px 20px",
                    borderRadius: 9, border: "1px solid #cbd5e1", background: "#ffffff",
                    color: "#0f172a", cursor: etat === "running" ? "wait" : "pointer",
                }}
            >
                {etat === "running" ? "En cours…" : "Lancer le rattrapage"}
            </button>

            {journal.length > 0 && (
                <pre style={{
                    marginTop: 14, padding: 12, background: "#0f172a", color: "#e2e8f0",
                    borderRadius: 8, fontSize: 12.5, lineHeight: 1.7, overflowX: "auto",
                }}>
                    {journal.join("\n")}
                </pre>
            )}
        </div>
    );
}
