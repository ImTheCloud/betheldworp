"use client";

import "./Footer.css";
import { useEffect, useMemo, useState } from "react";
import { useLang } from "./LanguageProvider";
import { makeT } from "../lib/i18n";
import tr from "../translations/Footer.json";
import { collection, serverTimestamp, setDoc, doc, getDoc } from "firebase/firestore";
import { brusselsDayKey, paliersDuJour } from "../lib/Tracker";
import { SIGNAL_VISITE_COMPTEE } from "../lib/tracking";
import { db } from "../lib/Firebase";
import { isValidEmail } from "../lib/validation";



export default function Footer() {
    const { lang } = useLang();
    const t = useMemo(() => makeT(tr, lang), [lang]);

    const [email, setEmail] = useState("");
    const [sending, setSending] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");
    const [successText, setSuccessText] = useState("");

    // Compteurs publics du pied de page : deux documents ne contenant qu'un
    // nombre. Lus une seule fois, sans écouteur temps réel : un total de
    // visites n'a aucun besoin de se mettre à jour sous les yeux du visiteur,
    // et un écouteur de plus sur chaque page coûterait plus qu'il ne sert.
    const [compteurs, setCompteurs] = useState(null);

    // L'annee et le mois en cours completent leur libelle : « anul acesta
    // 2026 », « luna aceasta septembrie », pour que le visiteur n'ait pas a
    // deviner de quelle annee ni de quel mois il s'agit.
    const [libelleAn, libelleMois] = useMemo(() => {
        const [an, mois, quantieme] = brusselsDayKey().split("-").map(Number);
        const nomMois = new Intl.DateTimeFormat(lang, {
            month: "long",
            timeZone: "UTC",
        }).format(new Date(Date.UTC(an, mois - 1, quantieme)));
        return [String(an), nomMois];
    }, [lang]);

    useEffect(() => {
        let vivant = true;

        const lire = async () => {
            try {
                const paliers = paliersDuJour(brusselsDayKey());
                const montres = ["total", "anCourant", "moisCourant", "aujourdhui"];
                const lus = await Promise.all(
                    montres.map((cle) => getDoc(doc(db, "stats_public", paliers[cle])))
                );
                if (!vivant) return;
                setCompteurs(
                    Object.fromEntries(
                        montres.map((cle, i) => [cle, Number(lus[i].data()?.visits) || 0])
                    )
                );
            } catch {
                // Un compteur indisponible laisse simplement le pied de page
                // tel qu'il etait : rien ne s'affiche, rien ne casse.
            }
        };

        lire();
        window.addEventListener(SIGNAL_VISITE_COMPTEE, lire);

        return () => {
            vivant = false;
            window.removeEventListener(SIGNAL_VISITE_COMPTEE, lire);
        };
    }, []);

    const onSubscribe = async (e) => {
        e.preventDefault();
        setError("");

        const em = email.trim().toLowerCase();
        if (!isValidEmail(em)) {
            setError(t("subscribe_error"));
            return;
        }

        setSending(true);
        try {
            const nlRef = collection(db, "newsletter");
            const docRef = doc(nlRef, em);

            const { getDoc } = await import("firebase/firestore");
            const snapshot = await getDoc(docRef);

            if (snapshot.exists()) {
                // L'adresse est connue, mais elle a pu être mise en blocklist chez
                // Brevo par une désinscription faite depuis un e-mail. Redonner son
                // adresse vaut demande de retour : la route lève le blocage, et ne
                // fait rien si le contact est déjà joignable.
                fetch("/api/newsletter/subscribe", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ email: em, source: "footer" }),
                }).catch((e) => console.error("Brevo sync error:", e));

                setSuccessText(t("subscribe_already"));
                setSuccess(true);
                setSending(false);
                return;
            }

            await setDoc(docRef, {
                email: em,
                subscribedAt: serverTimestamp(),
                source: "footer",
            });

            // Réplique le contact dans la liste Brevo. Un échec ici ne doit pas
            // faire échouer l'abonnement : Firestore reste la source de vérité.
            fetch("/api/newsletter/subscribe", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ email: em, source: "footer" }),
            }).catch((e) => console.error("Brevo sync error:", e));

            setSuccessText("");
            setSuccess(true);
            setEmail("");
        } catch (err) {
            console.error("Error subscribing:", err);
            setError(t("subscribe_error"));
        } finally {
            setSending(false);
        }
    };

    const phoneDisplay = "+32 488 29 70 15";
    const phoneHref = "+32488297015";

    const devEmail = "claudiu.dev@outlook.com";
    const mailSubject = "Bethel Dworp";

    return (
        <footer className="footer" id="bethel-footer">
            <div className="footer-inner">
                <div className="footer-main">
                    <div className="footer-info">
                        <div className="footer-brand">
                            <img className="footer-logo" src="/icon.png" alt={t("logo_alt")} />
                            <div className="footer-title">Bethel Dworp</div>
                        </div>

                        <div className="footer-nl">
                            <h4 className="footer-nl-title">{t("newsletter_title")}</h4>
                            <p className="footer-nl-desc">{t("newsletter_desc_short")}</p>

                            {success ? (
                                <div className="footer-nl-success">
                                    {successText || t("subscribe_success")}
                                </div>
                            ) : (
                                <form className="footer-nl-form" onSubmit={onSubscribe}>
                                    <div className="footer-nl-input-group">
                                        <input
                                            className="footer-nl-input"
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder={t("email_placeholder")}
                                            disabled={sending}
                                            required
                                        />
                                        <button className="footer-nl-btn" type="submit" disabled={sending}>
                                            {sending ? (
                                                <div className="footer-nl-spinner" />
                                            ) : (
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <line x1="22" y1="2" x2="11" y2="13" />
                                                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                    {error && <div className="footer-nl-error">{error}</div>}
                                </form>
                            )}
                        </div>

                    </div>

                    <div className="footer-contacts" aria-label={t("contact_aria")}>
                        <a
                            className="footer-contact-item"
                            href={`tel:${phoneHref}`}
                            aria-label={t("call_aria").replace("{phone}", phoneDisplay)}
                        >
                            <span className="footer-label">{t("responsible")}:</span>
                            <span className="footer-value">{phoneDisplay}</span>
                        </a>

                        <a
                            className="footer-contact-item footer-contact-item--mail"
                            href="mailto:info@betheldworp.be"
                            aria-label="Email info@betheldworp.be"
                        >
                            <span className="footer-label">{t("email")}:</span>
                            <div className="footer-mail-row">
                                <svg className="footer-mail-icon" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z" />
                                </svg>
                                <span className="footer-value">info@betheldworp.be</span>
                            </div>
                        </a>

                        <a
                            className="footer-contact-item footer-contact-item--mail"
                            href={`mailto:${devEmail}?subject=${encodeURIComponent(mailSubject)}`}
                            aria-label={t("email_dev_aria")}
                        >
                            <span className="footer-label">{t("developer")}:</span>
                            <div className="footer-mail-row">
                                <svg className="footer-mail-icon" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z" />
                                </svg>
                                <span className="footer-value">{devEmail}</span>
                            </div>
                        </a>

                        <a
                            className="footer-contact-item footer-contact-item--map"
                            href="https://www.google.com/maps/search/?api=1&query=Alsembergsesteenweg+572B,+1653+Beersel&query_place_id=ChIJWdWyrJPPw0cRL74a9ysasVE"
                            target="_blank"
                            rel="noreferrer"
                            aria-label="Google Maps Location"
                        >
                            <span className="footer-label">{t("address")}:</span>
                            <div className="footer-map-row">
                                <svg className="footer-map-icon" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/>
                                </svg>
                                <span className="footer-value">Alsembergsesteenweg 572B, 1653 Beersel</span>
                            </div>
                        </a>

                        <a
                            className="footer-contact-item footer-contact-item--yt"
                            href="https://www.youtube.com/@bisericapenticostalabethel7695"
                            target="_blank"
                            rel="noreferrer"
                            aria-label="YouTube"
                        >
                            <span className="footer-label">YouTube:</span>
                            <div className="footer-yt-row">
                                <svg className="footer-yt-icon" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M23.498 6.186a3.014 3.014 0 0 0-2.12-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.378.505A3.014 3.014 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.014 3.014 0 0 0 2.12 2.136c1.873.505 9.378.505 9.378.505s7.505 0 9.378-.505a3.014 3.014 0 0 0 2.12-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814Z" />
                                    <path fill="#ffffff" d="M9.75 15.5V8.5L16 12l-6.25 3.5Z" />
                                </svg>
                                <span className="footer-value">@bisericapenticostalabethel</span>
                            </div>
                        </a>
                    </div>
                </div>

                {compteurs && compteurs.total > 0 && (
                    <div className="footer-stats">
                        <span className="footer-label">{t("visits_label")}:</span>
                        <div className="footer-stats-row">
                            {[
                                // Chaque compteur dit sa periode : le total depuis
                                // quand il compte, l'annee et le mois lesquels.
                                [t("visits_total"), compteurs.total, t("visits_since")],
                                [t("visits_year"), compteurs.anCourant, libelleAn],
                                [t("visits_month"), compteurs.moisCourant, libelleMois],
                                [t("visits_today"), compteurs.aujourdhui],
                            ].map(([libelle, valeur, depuis]) => (
                                <div className="footer-stat" key={libelle}>
                                    <span className="footer-stat-value">
                                        {valeur.toLocaleString(lang)}
                                    </span>
                                    <span className="footer-stat-label">
                                        {depuis ? `${libelle} ${depuis}` : libelle}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="footer-bottom">
                    <div className="footer-copy">
                        <span>© {new Date().getFullYear()} Bethel Dworp. {t("rights")}</span>
                        <a className="footer-privacy" href={`/${lang}/privacy`}>
                            {t("privacy")}
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
}