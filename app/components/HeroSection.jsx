// app/components/HeroSection.jsx
import "./HeroSection.css";

export default function HeroSection() {
    return (
        <section id="acasa" className="hero">
            <video
                className="video-background"
                src="/videos/hero-bethel.mp4"
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
            />

            <div className="hero-content">
                <h1 className="hero-title">
                    Vă așteptăm la Bethel
                </h1>

                <h2 className="hero-subtitle">
                    În casa lui Dumnezeu
                </h2>

                <p className="hero-verse">
                    Ioan 14:8 — „Doamne”, i-a zis Filip, „arată-ne pe Tatăl şi ne este de ajuns!”
                </p>
            </div>
        </section>
    );
}