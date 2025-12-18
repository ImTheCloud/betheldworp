"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import emailjs from "@emailjs/browser";
import "./ContactWidget.css";

const isValidEmail = (value) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

export default function ContactWidget() {
    const [open, setOpen] = useState(false);
    const [pulse, setPulse] = useState(false);
    const [compact, setCompact] = useState(false); // ✅ NEW (mobile: only "?" when footer visible)

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
        if (!open) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prev;
        };
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

    // ✅ NEW: when footer is visible on mobile, shrink FAB to "?"
    useEffect(() => {
        if (typeof window === "undefined") return;

        const mq = window.matchMedia("(max-width: 700px)");
        let observer = null;
        let retryId = null;

        const teardown = () => {
            if (observer) observer.disconnect();
            observer = null;
            if (retryId) clearInterval(retryId);
            retryId = null;
        };

        const attachObserver = () => {
            const footer =
                document.querySelector("#bethel-footer") ||
                document.querySelector("footer.footer") ||
                document.querySelector("footer");

            if (!footer) return false;

            observer = new IntersectionObserver(
                ([entry]) => {
                    setCompact(Boolean(entry?.isIntersecting) && mq.matches);
                },
                { threshold: 0.01 }
            );

            observer.observe(footer);
            return true;
        };

        const setup = () => {
            teardown();

            if (!mq.matches) {
                setCompact(false);
                return;
            }

            if (attachObserver()) return;

            // footer not found yet (rare): retry a bit
            let tries = 0;
            retryId = setInterval(() => {
                tries += 1;
                if (attachObserver() || tries > 20) {
                    clearInterval(retryId);
                    retryId = null;
                }
            }, 200);
        };

        setup();

        const onChange = () => setup();

        if (mq.addEventListener) mq.addEventListener("change", onChange);
        else mq.addListener(onChange);

        return () => {
            teardown();
            if (mq.removeEventListener) mq.removeEventListener("change", onChange);
            else mq.removeListener(onChange);
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

    const nameError = showNameError && !cleanName ? "Numele este obligatoriu." : "";
    const emailError =
        showEmailError && !cleanEmail
            ? "Email este obligatoriu."
            : showEmailError && cleanEmail && !emailOk
                ? "Te rugăm să introduci un email valid."
                : "";
    const messageError = showMessageError && !cleanMessage ? "Mesajul este obligatoriu." : "";

    const onPhoneChange = (e) => {
        const digitsOnly = e.target.value.replace(/\D/g, "");
        setPhone(digitsOnly);
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

        if ((e.ctrlKey || e.metaKey) && ["a", "c", "v", "x"].includes(e.key.toLowerCase()))
            return;

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
            alert("Eroare la trimitere. Încearcă din nou.");
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
                aria-label="Ai o întrebare?"
                title="Ai o întrebare?"
            >
                <span className="cw-fab-text">Ai o întrebare</span>
                <span className="cw-fabIcon" aria-hidden="true">
          ?
        </span>
            </button>

            {open && (
                <div className="cw-overlay" onClick={close}>
                    <div className="cw-modal" onClick={(e) => e.stopPropagation()}>
                        <header className="cw-header">
                            <h2>Trimite un mesaj</h2>

                            <button
                                type="button"
                                className="cw-close"
                                onClick={close}
                                disabled={sending}
                                aria-label="Închide"
                                title="Închide"
                            >
                                ×
                            </button>
                        </header>

                        <div className="cw-body">
                            {success ? (
                                <div className="cw-success">
                                    <div className="cw-success-title">Mesaj trimis ✅</div>
                                    <div className="cw-success-sub">Vă vom răspunde cât mai curând.</div>
                                </div>
                            ) : (
                                <form className="cw-form" onSubmit={onSend} noValidate>
                                    <label className="cw-field">
                                        <span>Nume *</span>
                                        <input
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                                            placeholder="Ex: Andrei Popescu"
                                            autoComplete="name"
                                            disabled={sending}
                                            required
                                            aria-invalid={nameError ? "true" : "false"}
                                        />
                                        {nameError ? <div className="cw-hint cw-hint--error">{nameError}</div> : null}
                                    </label>

                                    <label className="cw-field">
                                        <span>Email *</span>
                                        <input
                                            value={fromEmail}
                                            onChange={(e) => setFromEmail(e.target.value)}
                                            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                                            placeholder="Ex: andrei@email.com"
                                            autoComplete="email"
                                            inputMode="email"
                                            disabled={sending}
                                            required
                                            aria-invalid={emailError ? "true" : "false"}
                                        />
                                        {emailError ? <div className="cw-hint cw-hint--error">{emailError}</div> : null}
                                    </label>

                                    <label className="cw-field">
                                        <span>Telefon (opțional)</span>
                                        <input
                                            value={phone}
                                            onChange={onPhoneChange}
                                            onKeyDown={onPhoneKeyDown}
                                            onPaste={(e) => {
                                                e.preventDefault();
                                                const text = (e.clipboardData || window.clipboardData).getData("text");
                                                const digitsOnly = String(text || "").replace(/\D/g, "");
                                                setPhone((prev) => (prev + digitsOnly).slice(0, 20));
                                            }}
                                            placeholder="Ex: 0470123456"
                                            autoComplete="tel"
                                            inputMode="numeric"
                                            pattern="\d*"
                                            disabled={sending}
                                            maxLength={20}
                                        />
                                    </label>

                                    <label className="cw-field">
                                        <span>Mesaj *</span>
                                        <textarea
                                            value={message}
                                            onChange={(e) => setMessage(e.target.value)}
                                            onBlur={() => setTouched((t) => ({ ...t, message: true }))}
                                            placeholder="Scrie mesajul tău aici..."
                                            rows={5}
                                            required
                                            disabled={sending}
                                            aria-invalid={messageError ? "true" : "false"}
                                        />
                                        {messageError ? (
                                            <div className="cw-hint cw-hint--error">{messageError}</div>
                                        ) : null}
                                    </label>

                                    <div className="cw-actions">
                                        <button className="cw-send" type="submit" disabled={sending}>
                                            {sending ? "Se trimite..." : "Trimite mesajul"}
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