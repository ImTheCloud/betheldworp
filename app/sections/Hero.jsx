"use client";

import "./Hero.css";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/Firebase";

const FALLBACK_VERSE = {
    reference: "Ioan 14:8",
    text: "„Doamne”, i-a zis Filip, „arată-ne pe Tatăl și ne este de ajuns!”",
};

export default function Hero() {
    const [verse, setVerse] = useState(FALLBACK_VERSE);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const ref = doc(db, "monthly_verse", "current");

        const unsub = onSnapshot(
            ref,
            (snap) => {
                const data = snap.data() || {};

                const next = {
                    reference: String(data.reference || FALLBACK_VERSE.reference),
                    text: String(data.text || FALLBACK_VERSE.text),
                };

                setVerse(next);
                setLoading(false);
                setError("");
            },
            (err) => {
                console.error(err);
                setLoading(false);
                setError("Nu am putut încărca versetul lunii.");
            }
        );

        return () => unsub();
    }, []);

    return (
        <section className="hero">
            <img
                className="hero-bgImg"
                src="/images/drone.jpg"
                alt=""
                aria-hidden="true"
                loading="eager"
                decoding="async"
                fetchPriority="high"
            />

            <div className="hero-content">
                <h1 className="hero-title">Vă așteptăm la Bethel</h1>
                <h2 className="hero-subtitle">În casa lui Dumnezeu</h2>

                <div className="hero-verse" aria-live="polite">
                    <div className="hero-verseLabel">
                        Versetul lunii : {verse.reference}
                        {loading ? " (se încarcă...)" : ""}
                    </div>
                    <p className="hero-verseText">{verse.text}</p>
                    {error ? <div className="ec-inlineError">{error}</div> : null}
                </div>
            </div>
        </section>
    );
}