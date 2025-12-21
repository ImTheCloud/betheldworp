"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import emailjs from "@emailjs/browser";
import "./ContactWidget.css";
import { useLang } from "./LanguageProvider";
import { makeT } from "../lib/i18n";
import tr from "../translations/ContactWidget.json";

const LIMITS = {
    name: 60,
    email: 120,
    phone: 20,
    message: 1500,
};

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

function lockBodyScroll() {
    if (typeof window === "undefined") return () => {};
    const body = document.body;
    const docEl = document.documentElement;

    const scrollY = window.scrollY || docEl.scrollTop || 0;

    const prev = {
        position: body.style.position,
        top: body.style.top,
        left: body.style.left,
        right: body.style.right,
        width: body.style.width,
        overflow: body.style.overflow,
    };

    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";

    return () => {
        body.style.position = prev.position;
        body.style.top = prev.top;
        body.style.left = prev.left;
        body.style.right = prev.right;
        body.style.width = prev.width;
        body.style.overflow = prev.overflow;
        window.scrollTo(0, scrollY);
    };
}

export default function ContactWidget() {
    const { lang } = useLang();
    const t = useMemo(() => makeT(tr, lang), [lang]);

    const [open, setOpen] = useState(false);
    const [pulse, setPulse] = useState(false);
    const [compact, setCompact] = useState(false);

    const [name, setName] = useState("");
    const [fromEmail, setFromEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [message, setMessage] = useState("");

    const [sending, setSending] = useState(false);
    const [success, setSuccess] = useState(false);
    const [triedSubmit, setTriedSubmit] = useState(false);

    const [touched, setTouched] = useState({ name: false, email: false, message: false });

    const intervalRef = useRef(null);
    const timeoutRef = useRef(null);

    const stopTimers = useCallback(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        intervalRef.current = null;
        timeoutRef.current = null;
    }, []);

    const openWidget = useCallback(() => {
        stopTimers();
        setPulse(false);
        setOpen(true);
    }, [stopTimers]);

    const close = useCallback(() => {
        if (sending) return;
        setOpen(false);
    }, [sending]);

    useEffect(() => {
        let unlock = null;
        if (open) unlock = lockBodyScroll();
        return () => {
            if (unlock) unlock();
        };
    }, [open]);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const docEl = document.documentElement;

        const setVhVar = () => {
            const vv = window.visualViewport;
            const h = vv?.height ?? window.innerHeight ?? docEl.clientHeight ?? 0;
            docEl.style.setProperty("--cw-vh", `${h * 0.01}px`);
        };

        if (open) {
            setVhVar();
            const vv = window.visualViewport;
            if (vv) {
                vv.addEventListener("resize", setVhVar);
                vv.addEventListener("scroll", setVhVar);
            }
            window.addEventListener("resize", setVhVar);
            return () => {
                const vv2 = window.visualViewport;
                if (vv2) {
                    vv2.removeEventListener("resize", setVhVar);
                    vv2.removeEventListener("scroll", setVhVar);
                }
                window.removeEventListener("resize", setVhVar);
                docEl.style.removeProperty("--cw-vh");
            };
        }
    }, [open]);

    useEffect(() => {
        const handler = () => openWidget();
        window.addEventListener("bethel:open-contact", handler);
        return () => window.removeEventListener("bethel:open-contact", handler);
    }, [openWidget]);

    useEffect(() => {
        stopTimers();

        intervalRef.current = setInterval(() => {
            if (open) return;
            setPulse(true);
            timeoutRef.current = setTimeout(() => setPulse(false), 1200);
        }, 5000);

        return () => stopTimers();
    }, [open, stopTimers]);

    useEffect(() => {
        if (open) setPulse(false);
    }, [open]);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const getFooter = () =>
            document.querySelector("#bethel-footer") ||
            document.querySelector("footer.footer") ||
            document.querySelector("footer");

        const computeCompact = () => {
            const footer = getFooter();
            if (footer) {
                const r = footer.getBoundingClientRect();
                const vh = window.innerHeight || document.documentElement.clientHeight || 0;
                return r.top < vh && r.bottom > 0;
            }
            const doc = document.documentElement;
            return window.innerHeight + window.scrollY >= doc.scrollHeight - 120;
        };

        const update = () => setCompact(computeCompact());

        update();
        window.addEventListener("scroll", update, { passive: true });
        window.addEventListener("resize", update);

        const id = setInterval(update, 250);
        setTimeout(() => clearInterval(id), 6000);

        return () => {
            window.removeEventListener("scroll", update);
            window.removeEventListener("resize", update);
            clearInterval(id);
        };
    }, []);

    const cleanName = name.trim();
    const cleanEmail = fromEmail.trim();
    const cleanMessage = message.trim();

    const emailOk = useMemo(() => isValidEmail(cleanEmail), [cleanEmail]);
    const canSend = Boolean(cleanName) && emailOk && Boolean(cleanMessage);

    const showNameError = triedSubmit || touched.name;
    const showEmailError = triedSubmit || touched.email;
    const showMessageError = triedSubmit || touched.message;

    const nameError = showNameError && !cleanName ? t("name_required") : "";
    const emailError =
        showEmailError && !cleanEmail
            ? t("email_required")
            : showEmailError && cleanEmail && !emailOk
                ? t("email_invalid")
                : "";
    const messageError = showMessageError && !cleanMessage ? t("message_required") : "";

    const onPhoneChange = (e) => {
        const digitsOnly = e.target.value.replace(/\D/g, "");
        setPhone(digitsOnly.slice(0, LIMITS.phone));
    };

    const onPhoneKeyDown = (e) => {
        const allowed = [
            "Backspace",
            "Delete",
            "Tab",
            "Enter",
            "Escape",
            "ArrowLeft",
            "ArrowRight",
            "ArrowUp",
            "ArrowDown",
            "Home",
            "End",
        ];
        if (allowed.includes(e.key)) return;
        if ((e.ctrlKey || e.metaKey) && ["a", "c", "v", "x"].includes(e.key.toLowerCase())) return;
        if (!/^\d$/.test(e.key)) e.preventDefault();
    };

    const onSend = async (e) => {
        e.preventDefault();
        setTriedSubmit(true);

        if (!canSend) return;

        try {
            setSending(true);

            await emailjs.send(
                process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID,
                process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID,
                {
                    name: cleanName,
                    from_email: cleanEmail,
                    phone: String(phone || "").trim(),
                    message: cleanMessage,
                },
                process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY
            );

            setSuccess(true);
            setName("");
            setFromEmail("");
            setPhone("");
            setMessage("");
            setTriedSubmit(false);
            setTouched({ name: false, email: false, message: false });

            setTimeout(() => {
                setSuccess(false);
                setOpen(false);
            }, 1800);
        } catch (err) {
            console.error(err);
            alert(t("send_error_alert"));
        } finally {
            setSending(false);
        }
    };

    return (
        <>
            <button
                type="button"
                className={`cw-fab ${pulse ? "cw-fab--pulse" : ""} ${compact ? "cw-fab--compact" : ""}`}
                onClick={openWidget}
                aria-label={t("fab_aria")}
                title={t("fab_title")}
            >
                <span className="cw-fab-text">{t("fab_text")}</span>
                <span className="cw-fabIcon" aria-hidden="true">
                    ?
                </span>
            </button>

            {open && (
                <div
                    className="cw-overlay"
                    onClick={close}
                    onTouchMove={(e) => {
                        if (e.target === e.currentTarget) e.preventDefault();
                    }}
                >
                    <div className="cw-modal" onClick={(e) => e.stopPropagation()}>
                        <header className="cw-header">
                            <h2>{t("modal_title")}</h2>
                            <button
                                type="button"
                                className="cw-close"
                                onClick={close}
                                disabled={sending}
                                aria-label={t("close")}
                                title={t("close")}
                            >
                                ×
                            </button>
                        </header>

                        <div className="cw-body">
                            {success ? (
                                <div className="cw-success">
                                    <div className="cw-success-title">{t("sent_title")}</div>
                                    <div className="cw-success-sub">{t("sent_subtitle")}</div>
                                </div>
                            ) : (
                                <form className="cw-form" onSubmit={onSend} noValidate>
                                    <label className="cw-field">
                                        <span>{t("name_label")}</span>
                                        <input
                                            value={name}
                                            onChange={(e) => setName(String(e.target.value || "").slice(0, LIMITS.name))}
                                            onBlur={() => setTouched((tt) => ({ ...tt, name: true }))}
                                            placeholder={t("name_placeholder")}
                                            autoComplete="name"
                                            disabled={sending}
                                            required
                                            maxLength={LIMITS.name}
                                            aria-invalid={nameError ? "true" : "false"}
                                        />
                                        {nameError ? <div className="cw-hint cw-hint--error">{nameError}</div> : null}
                                    </label>

                                    <label className="cw-field">
                                        <span>{t("email_label")}</span>
                                        <input
                                            value={fromEmail}
                                            onChange={(e) => setFromEmail(String(e.target.value || "").slice(0, LIMITS.email))}
                                            onBlur={() => setTouched((tt) => ({ ...tt, email: true }))}
                                            placeholder={t("email_placeholder")}
                                            autoComplete="email"
                                            inputMode="email"
                                            disabled={sending}
                                            required
                                            maxLength={LIMITS.email}
                                            aria-invalid={emailError ? "true" : "false"}
                                        />
                                        {emailError ? <div className="cw-hint cw-hint--error">{emailError}</div> : null}
                                    </label>

                                    <label className="cw-field">
                                        <span>{t("phone_label")}</span>
                                        <input
                                            value={phone}
                                            onChange={onPhoneChange}
                                            onKeyDown={onPhoneKeyDown}
                                            onPaste={(e) => {
                                                e.preventDefault();
                                                const text = (e.clipboardData || window.clipboardData).getData("text");
                                                const digitsOnly = String(text || "").replace(/\D/g, "");
                                                setPhone((prev) => (prev + digitsOnly).slice(0, LIMITS.phone));
                                            }}
                                            placeholder={t("phone_placeholder")}
                                            autoComplete="tel"
                                            inputMode="numeric"
                                            pattern="\d*"
                                            disabled={sending}
                                            maxLength={LIMITS.phone}
                                        />
                                    </label>

                                    <label className="cw-field">
                                        <span>{t("message_label")}</span>
                                        <textarea
                                            value={message}
                                            onChange={(e) => setMessage(String(e.target.value || "").slice(0, LIMITS.message))}
                                            onBlur={() => setTouched((tt) => ({ ...tt, message: true }))}
                                            placeholder={t("message_placeholder")}
                                            rows={5}
                                            required
                                            disabled={sending}
                                            maxLength={LIMITS.message}
                                            aria-invalid={messageError ? "true" : "false"}
                                        />
                                        {messageError ? <div className="cw-hint cw-hint--error">{messageError}</div> : null}
                                    </label>

                                    <div className="cw-actions">
                                        <button className="cw-send" type="submit" disabled={sending}>
                                            {sending ? t("sending") : t("send")}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}