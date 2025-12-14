"use client";

import { useEffect, useRef, useState } from "react";
import emailjs from "@emailjs/browser";
import "./ContactWidget.css";

export default function ContactWidget() {
    const [open, setOpen] = useState(false);
    const [pulse, setPulse] = useState(false);

    const [name, setName] = useState("");
    const [fromEmail, setFromEmail] = useState("");
    const [message, setMessage] = useState("");

    const [sending, setSending] = useState(false);
    const [success, setSuccess] = useState(false);

    const intervalRef = useRef(null);
    const timeoutRef = useRef(null);

    // Pulse: 2 pulses toutes les 10s (tant que la modale n'est pas ouverte)
    useEffect(() => {
        const startPulseLoop = () => {
            // toutes les 10s on déclenche une séquence de 2 pulses
            intervalRef.current = setInterval(() => {
                if (open) return;

                // Pulse ON
                setPulse(true);

                // OFF après 1.6s (1 pulse)
                timeoutRef.current = setTimeout(() => {
                    setPulse(false);

                    // 2e pulse après une petite pause
                    timeoutRef.current = setTimeout(() => {
                        setPulse(true);

                        // OFF après 1.6s
                        timeoutRef.current = setTimeout(() => {
                            setPulse(false);
                        }, 1600);
                    }, 500);
                }, 1600);
            }, 10000);
        };

        startPulseLoop();

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [open]);

    // Quand on ouvre, on stop le pulse tout de suite
    useEffect(() => {
        if (open) setPulse(false);
    }, [open]);

    const onSend = async (e) => {
        e.preventDefault();
        if (!message.trim()) return;

        try {
            setSending(true);

            await emailjs.send(
                process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID,
                process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID,
                {
                    name,
                    from_email: fromEmail,
                    message,
                },
                process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY
            );

            setSuccess(true);
            setName("");
            setFromEmail("");
            setMessage("");

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

    const close = () => {
        if (sending) return;
        setOpen(false);
    };

    return (
        <>
            {/* Bouton flottant */}
            <button
                type="button"
                className={`cw-fab ${pulse ? "cw-fab--pulse" : ""}`}
                onClick={() => setOpen(true)}
                aria-label="Ai o întrebare?"
                title="Ai o întrebare?"
            >
                ✉️ <span className="cw-fab-text">Ai o întrebare?</span>
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

                        {/* zone scrollable (important mobile + clavier) */}
                        <div className="cw-body">
                            {success ? (
                                <div className="cw-success">
                                    <div className="cw-success-title">Mesaj trimis ✅</div>
                                    <div className="cw-success-sub">
                                        Vă vom răspunde cât mai curând.
                                    </div>
                                </div>
                            ) : (
                                <form className="cw-form" onSubmit={onSend}>
                                    <label className="cw-field">
                                        <span>Nume</span>
                                        <input
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="Ex: Andrei Popescu"
                                            autoComplete="name"
                                            disabled={sending}
                                        />
                                    </label>

                                    <label className="cw-field">
                                        <span>Email</span>
                                        <input
                                            value={fromEmail}
                                            onChange={(e) => setFromEmail(e.target.value)}
                                            placeholder="Ex: andrei@email.com"
                                            autoComplete="email"
                                            inputMode="email"
                                            disabled={sending}
                                        />
                                    </label>

                                    <label className="cw-field">
                                        <span>Mesaj</span>
                                        <textarea
                                            value={message}
                                            onChange={(e) => setMessage(e.target.value)}
                                            placeholder="Scrie mesajul tău aici..."
                                            rows={7}
                                            required
                                            disabled={sending}
                                        />
                                    </label>

                                    <button className="cw-send" type="submit" disabled={sending}>
                                        {sending ? "Se trimite..." : "Trimite mesajul"}
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}