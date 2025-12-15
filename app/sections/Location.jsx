import "./Location.css";

export default function Location() {
    const place = "Biserica Penticostală BETHEL Dworp";
    const address = "Alsembergsesteenweg 572, 1653 Beersel";
    const full = `${place}, ${address}`;

    return (
        <section className="location-section">
            <div className="location-content">
                <div className="location-header">
                    <h2 className="location-title">Unde ne găsim?</h2>
                </div>

                <div className="location-card">
                    <div className="location-info-wrapper">
                        <span className="location-label">Locație</span>
                        <h3 className="location-place">{place}</h3>
                        <p className="location-address">{address}</p>
                    </div>

                    <div className="location-mapWrap">
                        <iframe
                            className="location-map"
                            title="BETHEL Dworp - Locație"
                            loading="lazy"
                            allowFullScreen
                            referrerPolicy="no-referrer-when-downgrade"
                            src={`https://www.google.com/maps?q=${encodeURIComponent(full)}&output=embed`}
                        />
                    </div>
                </div>

                <div className="location-verse-highlight">
                    <div className="location-verse-content">
                        <p className="location-verse-text">
                            „Căci unde sunt doi sau trei adunați în Numele Meu, acolo sunt și Eu în mijlocul lor."
                        </p>
                        <p className="location-verse-ref">Matei 18:20</p>
                    </div>
                </div>
            </div>
        </section>
    );
}