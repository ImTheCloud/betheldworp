import "./Hero.css";

export default function Hero() {
    return (
        <section id="acasa" className="hero">
            <video
                className="video-background"
                src="/videos/hero-bethel.mp4"
                poster="/image/hero-bethel.jpg"
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
            />

            <div className="hero-content">
                <h1 className="hero-title">Vă așteptăm la Bethel</h1>
                <h2 className="hero-subtitle">În casa lui Dumnezeu</h2>

                <div className="hero-verseCard">
                    <div className="hero-verseBadge">Versetul lunii</div>

                    <p className="hero-verseText">
                        Ioan 14:8 — „Doamne”, i-a zis Filip, „arată-ne pe Tatăl şi ne este de ajuns!”
                    </p>

                    <p className="hero-verseHint">
                        Verset pentru meditația bisericii în această lună.
                    </p>
                </div>
            </div>
        </section>
    );
}