"use client";

import { useState } from "react";
import "./NewsletterSection.css";
import { useLang } from "../components/LanguageProvider";
import { makeT } from "../lib/i18n";
import tr from "../translations/NewsletterSection.json";
import { useNewsletterSignup } from "../lib/useNewsletterSignup";
import EmailSuggestion, { useEmailCheckText } from "../components/EmailSuggestion";

export default function NewsletterSection() {
    const { lang } = useLang();
    const t = makeT(tr, lang);

    const nl = useNewsletterSignup("website");
    const tc = useEmailCheckText();
    const [nlCopied, setNlCopied] = useState(false);

    const errorText = !nl.error ? ""
        : nl.error.code === "invalid" ? t("email_invalid")
        : nl.error.code === "domain" ? tc("domain_missing").replace("{domain}", nl.error.domain)
        : t("subscribe_error");

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

                    {nl.status ? (
                        <div className="nl-success" role="status">
                            <div className="nl-success-title">
                                {nl.status === "already" ? t("subscribe_already") : t("subscribe_success_short")}
                            </div>
                            <div className="nl-success-text">{t("subscribe_success_long")}</div>
                            <div className="nl-success-address">
                                {tc("sent_to").replace("{email}", nl.subscribedEmail)}
                            </div>
                        </div>
                    ) : (
                        <form className="nl-form" onSubmit={nl.onSubmit} noValidate>
                            {errorText && <div className="nl-error" role="alert">{errorText}</div>}

                            <div className="nl-input-group">
                                <input
                                    className="nl-input"
                                    type="email"
                                    inputMode="email"
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    value={nl.email}
                                    onChange={(e) => nl.setEmail(e.target.value)}
                                    placeholder={t("email_placeholder")}
                                    autoComplete="email"
                                    aria-label={t("email_placeholder")}
                                    disabled={nl.sending}
                                />
                                {!nl.suggestion && (
                                    <button className="nl-button" type="submit" disabled={nl.sending}>
                                        {nl.sending ? t("sending") : t("subscribe")}
                                    </button>
                                )}
                            </div>

                            <EmailSuggestion
                                suggestion={nl.suggestion}
                                onAccept={nl.acceptSuggestion}
                                onReject={nl.rejectSuggestion}
                                disabled={nl.sending}
                            />
                        </form>
                    )}
                </div>
            </div>
        </section>
    );
}
