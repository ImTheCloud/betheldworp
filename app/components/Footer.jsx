"use client";

import "./Footer.css";
import { useMemo, useState } from "react";
import { useLang } from "./LanguageProvider";
import { makeT } from "../lib/i18n";
import tr from "../translations/Footer.json";
import { collection, serverTimestamp, setDoc, doc } from "firebase/firestore";
import { db } from "../lib/Firebase";

export default function Footer() {
    const { lang } = useLang();
    const t = useMemo(() => makeT(tr, lang), [lang]);

    const [email, setEmail] = useState("");
    const [sending, setSending] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");
    const [successText, setSuccessText] = useState("");

    const validateEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

    const onSubscribe = async (e) => {
        e.preventDefault();
        setError("");

        const em = email.trim().toLowerCase();
        if (!validateEmail(em)) {
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

            // Send real-time notification
            try {
                const topic = "bethel_churches_notifications_f93k2n8";
                const notifyUrl = `https://ntfy.sh/${topic}?title=${encodeURIComponent("Abonare Nouă Footer")}&priority=default&tags=email,tada`;
                fetch(notifyUrl, {
                    method: "POST",
                    body: `Nou abonat (Footer): ${em}`,
                }).catch((e) => console.error("Notification error:", e));
            } catch (notifyErr) {
                console.error("Failed to send notification:", notifyErr);
            }

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
                            className="footer-contact-item"
                            href="mailto:info@betheldworp.be"
                            aria-label="Email info@betheldworp.be"
                        >
                            <span className="footer-label">{t("email")}:</span>
                            <span className="footer-value">info@betheldworp.be</span>
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

                <div className="footer-bottom">
                    <p className="footer-copy">
                        © {new Date().getFullYear()} Bethel Dworp. {t("rights")}
                    </p>
                    <a
                        className="footer-contact-item footer-contact-item--dev"
                        href={`mailto:${devEmail}?subject=${encodeURIComponent(mailSubject)}`}
                        aria-label={t("email_dev_aria")}
                    >
                        <span className="footer-label">{t("developer")}:</span>
                        <span className="footer-value">{devEmail}</span>
                    </a>
                </div>
            </div>
        </footer>
    );
}