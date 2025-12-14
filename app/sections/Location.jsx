// app/sections/Location.jsx
import "./Location.css";

export default function Location() {
    const place = "Biserica Penticostala BETHEL Dworp";
    const address = "Alsembergsesteenweg 572, 1653 Beersel";
    const full = `${place}, ${address}`;

    return (
        <section id="locatie" className="location-section">
            <div className="location-content">
                <h2 className="location-title">Locație</h2>

                <div className="location-card">
                    <div className="location-left">
                        <p className="location-place">{place}</p>
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

                <div className="location-highlight">
                    <p className="location-highlight-text">
                        „Căci unde sunt doi sau trei adunați în Numele Meu, acolo sunt și Eu
                        în mijlocul lor.”
                    </p>
                    <p className="location-highlight-sub">(Matei 18:20)</p>
                </div>
            </div>
        </section>
    );
}