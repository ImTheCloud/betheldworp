"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import emailjs from "@emailjs/browser";
import "./ContactWidget.css";
import { useLang } from "./LanguageProvider";
import { makeT } from "../lib/i18n";
import tr from "../translations/ContactWidget.json";

const MAX_NAME = 60;
const MAX_EMAIL = 120;
const MAX_PHONE = 20;
const MAX_MESSAGE = 1200;

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

function clampStr(v, max) {
    const s = String(v ?? "");
    return s.length > max ? s.slice(0, max) : s;
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

    const scrollLockYRef = useRef(0);
    const scrollLockActiveRef = useRef(false);
    const bodyPrevRef = useRef(null);

    const lockScroll = useCallback(() => {
        if (scrollLockActiveRef.current) return;
        if (typeof window === "undefined") return;

        const body = document.body;
        const html = document.documentElement;

        scrollLockYRef.current = window.scrollY || 0;
        bodyPrevRef.current = {
            overflow: body.style.overflow,
            position: body.style.position,
            top: body.style.top,
            left: body.style.left,
            right: body.style.right,
            width: body.style.width,
            paddingRight: body.style.paddingRight,
            overscrollBehavior: (body.style.overscrollBehavior || ""),
            touchAction: (body.style.touchAction || ""),
            htmlOverflow: html.style.overflow,
            htmlOverscrollBehavior: (html.style.overscrollBehavior || ""),
        };

        const scrollbarW = window.innerWidth - (html.clientWidth || window.innerWidth);
        if (scrollbarW > 0) body.style.paddingRight = `${scrollbarW}px`;

        html.style.overflow = "hidden";
        html.style.overscrollBehavior = "none";

        body.style.overflow = "hidden";
        body.style.overscrollBehavior = "none";
        body.style.touchAction = "none";
        body.style.position = "fixed";
        body.style.top = `-${scrollLockYRef.current}px`;
        body.style.left = "0";
        body.style.right = "0";
        body.style.width = "100%";

        scrollLockActiveRef.current = true;
    }, []);

    const unlockScroll = useCallback(() => {
        if (!scrollLockActiveRef.current) return;
        if (typeof window === "undefined") return;

        const body = document.body;
        const html = document.documentElement;
        const prev = bodyPrevRef.current;

        if (prev) {
            body.style.overflow = prev.overflow;
            body.style.position = prev.position;
            body.style.top = prev.top;
            body.style.left = prev.left;
            body.style.right = prev.right;
            body.style.width = prev.width;
            body.style.paddingRight = prev.paddingRight;
            body.style.overscrollBehavior = prev.overscrollBehavior;
            body.style.touchAction = prev.touchAction;
            html.style.overflow = prev.htmlOverflow;
            html.style.overscrollBehavior = prev.htmlOverscrollBehavior;
        } else {
            body.style.overflow = "";
            body.style.position = "";
            body.style.top = "";
            body.style.left = "";
            body.style.right = "";
            body.style.width = "";
            body.style.paddingRight = "";
            body.style.overscrollBehavior = "";
            body.style.touchAction = "";
            html.style.overflow = "";
            html.style.overscrollBehavior = "";
        }

        scrollLockActiveRef.current = false;
        window.scrollTo(0, scrollLockYRef.current || 0);
    }, []);

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
        if (open) lockScroll();
        else unlockScroll();
        return () => unlockScroll();
    }, [open, lockScroll, unlockScroll]);

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
            document.querySelector("#bethel-footer") || document.querySelector("footer.footer") || document.querySelector("footer");

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
        showEmailError && !cleanEmail ? t("email_required") : showEmailError && cleanEmail && !emailOk ? t("email_invalid") : "";
    const messageError = showMessageError && !cleanMessage ? t("message_required") : "";

    const onNameChange = (e) => setName(clampStr(e.target.value, MAX_NAME));
    const onEmailChange = (e) => setFromEmail(clampStr(e.target.value, MAX_EMAIL));
    const onMessageChange = (e) => setMessage(clampStr(e.target.value, MAX_MESSAGE));

    const onPhoneChange = (e) => {
        const digitsOnly = String(e.target.value || "").replace(/\D/g, "");
        setPhone(clampStr(digitsOnly, MAX_PHONE));
    };

    const onPhoneKeyDown = (e) => {
        const allowed = ["Backspace", "Delete", "Tab", "Enter", "Escape", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];
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
                    name: clampStr(cleanName, MAX_NAME),
                    from_email: clampStr(cleanEmail, MAX_EMAIL),
                    phone: clampStr(String(phone || "").trim(), MAX_PHONE),
                    message: clampStr(cleanMessage, MAX_MESSAGE),
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
                <div className="cw-overlay" onClick={close}>
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
                                            onChange={onNameChange}
                                            onBlur={() => setTouched((tt) => ({ ...tt, name: true }))}
                                            placeholder={t("name_placeholder")}
                                            autoComplete="name"
                                            disabled={sending}
                                            required
                                            maxLength={MAX_NAME}
                                            aria-invalid={nameError ? "true" : "false"}
                                        />
                                        {nameError ? <div className="cw-hint cw-hint--error">{nameError}</div> : null}
                                    </label>

                                    <label className="cw-field">
                                        <span>{t("email_label")}</span>
                                        <input
                                            value={fromEmail}
                                            onChange={onEmailChange}
                                            onBlur={() => setTouched((tt) => ({ ...tt, email: true }))}
                                            placeholder={t("email_placeholder")}
                                            autoComplete="email"
                                            inputMode="email"
                                            disabled={sending}
                                            required
                                            maxLength={MAX_EMAIL}
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
                                                setPhone((prev) => clampStr(String(prev || "") + digitsOnly, MAX_PHONE));
                                            }}
                                            placeholder={t("phone_placeholder")}
                                            autoComplete="tel"
                                            inputMode="numeric"
                                            pattern="\d*"
                                            disabled={sending}
                                            maxLength={MAX_PHONE}
                                        />
                                    </label>

                                    <label className="cw-field">
                                        <span>{t("message_label")}</span>
                                        <textarea
                                            value={message}
                                            onChange={onMessageChange}
                                            onBlur={() => setTouched((tt) => ({ ...tt, message: true }))}
                                            placeholder={t("message_placeholder")}
                                            rows={5}
                                            required
                                            disabled={sending}
                                            maxLength={MAX_MESSAGE}
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