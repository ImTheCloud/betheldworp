import "./Footer.css";

export default function Footer() {
    return (
        <footer className="footer">
            <div className="footer-inner">
                <img className="footer-logo" src="/logo.png" alt="Bethel" />
                <p className="footer-copy">
                    © {new Date().getFullYear()} Bethel Dworp. Toate drepturile rezervate.
                </p>
            </div>
        </footer>
    );
}