import "./Footer.css";

export default function Footer() {
    const phoneDisplay = "+32 488 29 70 15";
    const phoneHref = "+32488297015";

    return (
        <footer className="footer" id="bethel-footer">
            <div className="footer-inner">
                <img className="footer-logo" src="/icon.png" alt="Bethel" />

                <div className="footer-text">
                    <p className="footer-copy">
                        © {new Date().getFullYear()} Bethel Dworp. Toate drepturile rezervate.
                    </p>

                    <a className="footer-phone" href={`tel:${phoneHref}`} aria-label={`Sună la ${phoneDisplay}`}>
                        {phoneDisplay}
                    </a>
                </div>
            </div>
        </footer>
    );
}