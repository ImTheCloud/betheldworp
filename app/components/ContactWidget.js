"use client";

import { useEffect, useState } from "react";
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

    /* 👉 Pulse après 10 secondes */
    useEffect(() => {
        const t = setTimeout(() => {
            setPulse(true);

            // stop l’animation après 6 secondes
            setTimeout(() => setPulse(false), 6000);
        }, 10000);

        return () => clearTimeout(t);
    }, []);

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

    return (
        <>
            {/* Bouton flottant */}
            <button
                type="button"
                className={`cw-fab ${pulse ? "cw-fab--pulse" : ""}`}
                onClick={() => setOpen(true)}
                aria-label="Ai o întrebare?"
            >
                ✉️ Ai o întrebare?
            </button>

            {open && (
                <div className="cw-overlay" onClick={() => !sending && setOpen(false)}>
                    <div className="cw-modal" onClick={(e) => e.stopPropagation()}>
                        <header className="cw-header">
                            <h2>Trimite un mesaj</h2>
                            <button
                                className="cw-close"
                                onClick={() => setOpen(false)}
                                disabled={sending}
                            >
                                ×
                            </button>
                        </header>

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
                                        disabled={sending}
                                    />
                                </label>

                                <label className="cw-field">
                                    <span>Email</span>
                                    <input
                                        value={fromEmail}
                                        onChange={(e) => setFromEmail(e.target.value)}
                                        placeholder="Ex: andrei@email.com"
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
            )}
        </>
    );
}