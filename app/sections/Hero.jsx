"use client";

import "./Hero.css";

export default function Hero() {
    return (
        <section id="acasa" className="hero">
            <div className="hero-content">
                <h1 className="hero-title">Vă așteptăm la Bethel</h1>
                <h2 className="hero-subtitle">În casa lui Dumnezeu</h2>

                <div className="hero-verse">
                    <div className="hero-verseLabel">Versetul lunii : Ioan 14:8</div>
                    <p className="hero-verseText">
                        „Doamne”, i-a zis Filip, „arată-ne pe Tatăl și ne este de ajuns!”
                    </p>
                </div>
            </div>
        </section>
    );
}