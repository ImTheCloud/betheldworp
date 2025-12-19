"use client";

import "./Hero.css";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/Firebase";

export default function Hero() {
    const [verse, setVerse] = useState({ reference: "", text: "" });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const ref = doc(db, "monthly_verse", "current");

        const unsub = onSnapshot(
            ref,
            (snap) => {
                const data = snap.data() || {};

                const reference = String(data.reference ?? "").trim();
                const text = String(data.text ?? "").trim();

                setVerse({ reference, text });
                setLoading(false);

                if (!reference && !text) {
                    setError("Nu există verset setat pentru luna curentă.");
                } else {
                    setError("");
                }
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
                <h1 className="hero-title">Vă așteptăm la biserica Bethel </h1>
                <h2 className="hero-subtitle">În casa lui Dumnezeu</h2>

                <div className="hero-verse" aria-live="polite">
                    <div className="hero-verseLabel">
                        Versetul lunii{verse.reference ? ` : ${verse.reference}` : ""}
                        {loading ? " (se încarcă...)" : ""}
                    </div>
                    {verse.text ? <p className="hero-verseText">{verse.text}</p> : null}
                    {error ? <div className="ec-inlineError">{error}</div> : null}
                </div>
            </div>
        </section>
    );
}