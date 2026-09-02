"use client";

import { useState } from "react";
import "./NewsletterSection.css";
import { useLang } from "../components/LanguageProvider";
import { makeT } from "../lib/i18n";
import tr from "../translations/NewsletterSection.json";
import { isValidEmail } from "../lib/validation";

export default function NewsletterSection() {
    const { lang } = useLang();
    const t = makeT(tr, lang);

    const [email, setEmail] = useState("");
    const [sending, setSending] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");
    const [nlCopied, setNlCopied] = useState(false);

    const [successText, setSuccessText] = useState("");
    const [successLong, setSuccessLong] = useState("");

    const handleNlShare = async () => {
        try {
            const shareUrl = `${window.location.origin}${window.location.pathname}#newsletter`;
            if (navigator.share) {
                await navigator.share({
                    title: "Newsletter Bethel Dworp",
                    url: shareUrl
                });
                return;
            }
            await navigator.clipboard.writeText(shareUrl);
            setNlCopied(true);
            setTimeout(() => setNlCopied(false), 2000);
        } catch (e) {
            console.error("Nl share error:", e);
            if (e.name === "AbortError") {
                return;
            }
            try {
                const shareUrl = `${window.location.origin}${window.location.pathname}#newsletter`;
                await navigator.clipboard.writeText(shareUrl);
                setNlCopied(true);
                setTimeout(() => setNlCopied(false), 2000);
            } catch (err) {
                console.error("Clipboard fallback failed:", err);
            }
        }
    };

    const onSubscribe = async (e) => {
        e.preventDefault();
        setError("");

        const em = email.trim().toLowerCase();
        if (!isValidEmail(em)) {
            setError(t("email_invalid"));
            return;
        }

        setSending(true);
        try {
            // Le site n'écrit plus rien : la route envoie un e-mail de
            // confirmation, et l'adresse n'entre dans Firestore et dans la
            // liste d'envoi qu'une fois le lien ouvert. Sans ce détour,
            // n'importe qui pouvait remplir la liste d'adresses inventées.
            const res = await fetch("/api/newsletter/subscribe", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ email: em, source: "website" }),
            });

            if (!res.ok) {
                setError(t("subscribe_error"));
                return;
            }

            const data = await res.json().catch(() => null);
            const dejaAbonne = data?.status === "already";

            setSuccessText(dejaAbonne ? t("subscribe_already") : t("subscribe_pending_short"));
            setSuccessLong(dejaAbonne ? t("subscribe_success_long") : t("subscribe_pending_long"));
            setSuccess(true);
            setEmail("");
        } catch (err) {
            console.error("Error subscribing:", err);
            setError(t("subscribe_error"));
        } finally {
            setSending(false);
        }
    };

    return (
        <section className="nl-section" id="newsletter">
            <div className="nl-content">
                <div className="nl-card">
                    <div className="nl-card-header">
                        <h3 className="nl-subtitle">{t("newsletter")}</h3>
                        <button 
                            type="button" 
                            className={`nl-share-btn ${nlCopied ? "is-copied" : ""}`}
                            onClick={handleNlShare}
                            aria-label={t("share_link")}
                            title={t("share_link")}
                        >
                            {nlCopied ? (
                                <span className="nl-share-label">{t("link_copied")}</span>
                            ) : (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                                    <polyline points="16 6 12 2 8 6" />
                                    <line x1="12" y1="2" x2="12" y2="15" />
                                </svg>
                            )}
                        </button>
                    </div>
                    
                    <p className="nl-description">{t("newsletter_desc")}</p>

                    {success ? (
                        <div className="nl-success">
                            <div className="nl-success-title">{successText || t("subscribe_success_short")}</div>
                            <div className="nl-success-text">{successLong || t("subscribe_success_long")}</div>
                        </div>
                    ) : (
                        <form className="nl-form" onSubmit={onSubscribe}>
                            {error && <div className="nl-error">{error}</div>}

                            <div className="nl-input-group">
                                <input
                                    className="nl-input"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder={t("email_placeholder")}
                                    autoComplete="email"
                                    disabled={sending}
                                />
                                <button className="nl-button" type="submit" disabled={sending}>
                                    {sending ? t("sending") : t("subscribe")}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </section>
    );
}
