"use client";

import { useState, useEffect, useMemo } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/Firebase";
import { useLang } from "./LanguageProvider";
import { makeT } from "../lib/i18n";
import tr from "../translations/NewsletterPopup.json";
import "./NewsletterPopup.css";

const STORAGE_KEY = "nl_popup_status"; // 'subscribed' | 'dismissed' | null
const SHOW_DELAY = 10000; // 10 seconds

export default function NewsletterPopup() {
    const { lang } = useLang();
    const t = useMemo(() => makeT(tr, lang), [lang]);

    const [isVisible, setIsVisible] = useState(false);
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState("idle"); // idle, sending, success, error
    const [errorMsg, setErrorMsg] = useState("");

    useEffect(() => {
        // Check if user has already subscribed or dismissed
        const storedStatus = localStorage.getItem(STORAGE_KEY);
        if (storedStatus) return;

        // Show popup after delay
        const timer = setTimeout(() => {
            setIsVisible(true);
        }, SHOW_DELAY);

        return () => clearTimeout(timer);
    }, []);

    const handleClose = (permanently = false) => {
        setIsVisible(false);
        if (permanently) {
            localStorage.setItem(STORAGE_KEY, "dismissed");
        }
    };

    const handleSubscribe = async (e) => {
        e.preventDefault();
        if (!email || !email.includes("@")) {
            setErrorMsg(t("email_invalid"));
            return;
        }

        setStatus("sending");
        setErrorMsg("");

        try {
            const cleanEmail = email.trim().toLowerCase();
            await setDoc(doc(db, "newsletter", cleanEmail), {
                email: cleanEmail,
                createdAt: serverTimestamp(),
                source: "popup"
            });

            setStatus("success");
            localStorage.setItem(STORAGE_KEY, "subscribed");

            // Close automatically after success
            setTimeout(() => {
                setIsVisible(false);
            }, 3000);
        } catch (err) {
            console.error(err);
            setStatus("error");
            setErrorMsg(t("error_generic"));
        }
    };

    const handleAlreadySubscribed = () => {
        localStorage.setItem(STORAGE_KEY, "subscribed");
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div className="nl-popup-overlay">
            <div className="nl-popup-card">
                <button
                    className="nl-popup-close"
                    onClick={() => handleClose(false)}
                    aria-label="Close"
                >
                    ×
                </button>

                {status === "success" ? (
                    <div className="nl-popup-success">
                        <div className="nl-popup-success-icon">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#059669' }}>
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                <path d="M22 4L12 14.01l-3-3" />
                            </svg>
                        </div>
                        <h3>{t("success_title")}</h3>
                        <p>{t("success_desc")}</p>
                    </div>
                ) : (
                    <>
                        <h3 className="nl-popup-title">{t("title")}</h3>
                        <p className="nl-popup-desc">{t("desc")}</p>

                        <form className="nl-popup-form" onSubmit={handleSubscribe}>
                            <div>
                                <input
                                    type="email"
                                    className="nl-popup-input"
                                    placeholder={t("email_placeholder")}
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={status === "sending"}
                                />
                                {errorMsg && <div className="nl-popup-error">{errorMsg}</div>}
                            </div>

                            <div className="nl-popup-actions">
                                <button
                                    type="submit"
                                    className="nl-popup-btn nl-popup-btn--primary"
                                    disabled={status === "sending"}
                                >
                                    {status === "sending" ? t("sending") : t("subscribe")}
                                </button>

                                <button
                                    type="button"
                                    className="nl-popup-btn nl-popup-btn--secondary"
                                    onClick={handleAlreadySubscribed}
                                >
                                    {t("already_subscribed")}
                                </button>
                            </div>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}
