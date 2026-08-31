"use client";

import { useState } from "react";
import { collection, collectionGroup, getDocs, writeBatch } from "firebase/firestore";
import { db } from "../../lib/Firebase";
import { expiresAt } from "../../lib/tracking";

// Outil ponctuel : recalcule la date d'expiration de l'historique de visites.
//
// La durée de conservation se compte depuis la COLLECTE, pas depuis
// aujourd'hui. Dater une visite de décembre 2025 à « aujourd'hui + 25 mois »
// lui donnerait 34 mois de vie — au-delà de ce qui est admis. Chaque document
// est donc daté à partir de son propre jour.
//
// À retirer une fois exécuté.

const BATCH_SIZE = 400; // la limite Firestore est de 500 opérations par lot

// Les clés de jour existent en deux formats selon leur ancienneté :
// « JJ-MM-AAAA » aujourd'hui, « AAAA-MM-JJ » pour les plus anciennes.
function jourVersDate(cle) {
    const s = String(cle || "").trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
    m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (m) return Date.UTC(+m[3], +m[2] - 1, +m[1]);
    return null;
}

// Le jour figure dans le document, ou à défaut dans le chemin de sa
// sous-collection (visits/day_JJ-MM-AAAA/visitors/…).
function jourDuDocument(snap, data) {
    const direct = jourVersDate(data?.day) ?? jourVersDate(data?.firstDay);
    if (direct) return direct;
    const m = String(snap?.ref?.path || "").match(/day_([\d-]+)\//);
    return m ? jourVersDate(m[1]) : null;
}

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
        ligne("Recalcul depuis la date de collecte de chaque visite.");

        try {
            let sansJour = 0;

            for (const cible of CIBLES) {
                const snap = await getDocs(cible.requete());
                ligne(`${cible.nom} : ${snap.size} documents`);

                const docs = snap.docs;
                for (let i = 0; i < docs.length; i += BATCH_SIZE) {
                    const lot = writeBatch(db);
                    docs.slice(i, i + BATCH_SIZE).forEach((d) => {
                        const jour = jourDuDocument(d, d.data() || {});
                        if (!jour) sansJour += 1;
                        // Sans jour exploitable, on part d'aujourd'hui : c'est le
                        // choix prudent, la donnée expirera au plus tard.
                        lot.update(d.ref, { expiresAt: expiresAt(jour ?? Date.now()) });
                    });
                    await lot.commit();
                    ligne(`  ${Math.min(i + BATCH_SIZE, docs.length)} / ${docs.length}`);
                }
            }

            if (sansJour) ligne(`${sansJour} document(s) sans jour lisible, datés depuis aujourd'hui.`);
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
                Maintenance ponctuelle — conservation portée à 25 mois
            </div>
            <p style={{ margin: "0 0 14px", fontSize: 14, color: "#475569", lineHeight: 1.6 }}>
                Recalcule la date de suppression de chaque visite à partir du jour où
                elle a été enregistrée, et non depuis aujourd&apos;hui. À n&apos;exécuter qu&apos;une fois.
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
                {etat === "running" ? "En cours…" : "Lancer le recalcul"}
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
