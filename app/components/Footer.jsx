import "./Footer.css";

export default function Footer() {
    const phoneDisplay = "+32 488 29 70 15";
    const phoneHref = "+32488297015";

    const devEmail = "claudiu.dev@outlook.com";
    const mailSubject = "Bethel Dworp";

    return (
        <footer className="footer" id="bethel-footer">
            <div className="footer-inner">
                <div className="footer-brand">
                    <img className="footer-logo" src="/icon.png" alt="Bethel" />
                    <div className="footer-title">Bethel Dworp</div>
                </div>

                <div className="footer-text">
                    <p className="footer-copy">
                        © {new Date().getFullYear()} Bethel Dworp. Toate drepturile rezervate.
                    </p>

                    <div className="footer-contacts" aria-label="Contact">
                        <a
                            className="footer-phone"
                            href={`tel:${phoneHref}`}
                            aria-label={`Sună responsabilul bisericii: ${phoneDisplay}`}
                        >
                            <span className="footer-label">Responsabil:</span>
                            <span className="footer-value">{phoneDisplay}</span>
                        </a>

                        <a
                            className="footer-mail"
                            href={`mailto:${devEmail}?subject=${encodeURIComponent(mailSubject)}`}
                            aria-label="Trimite un email dezvoltatorului site-ului"
                        >
                            <span className="footer-label">Developer:</span>
                            <span className="footer-value">{devEmail}</span>
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
