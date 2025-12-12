"use client";
import { useMemo, useState } from "react";
import "./ContactSection.css";

export default function ContactSection() {
    const [name, setName] = useState("");
    const [fromEmail, setFromEmail] = useState("");
    const [subject, setSubject] = useState("");
    const [message, setMessage] = useState("");

    const mailToHref = useMemo(() => {
        const to = "claudiu.dev@outlook.com";
        const safeSubject = (subject || "Întrebare - Bethel Dworp").trim();

        const body =
            `Nume: ${name || "-"}\n` +
            `Email: ${fromEmail || "-"}\n\n` +
            `${message || ""}\n`;

        return `mailto:${to}?subject=${encodeURIComponent(
            safeSubject
        )}&body=${encodeURIComponent(body)}`;
    }, [name, fromEmail, subject, message]);

    const onSubmit = (e) => {
        e.preventDefault();
        window.location.href = mailToHref;
    };

    return (
        <section id="contact" className="contact-section">
            <div className="contact-content">
                <h2 className="contact-title">Contact</h2>

                <form className="contact-form" onSubmit={onSubmit}>
                    <div className="contact-fields">
                        <label className="contact-field">
                            <span>Nume</span>
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Ex: Andrei Popescu"
                                autoComplete="name"
                            />
                        </label>

                        <label className="contact-field">
                            <span>Email</span>
                            <input
                                value={fromEmail}
                                onChange={(e) => setFromEmail(e.target.value)}
                                placeholder="Ex: andrei@email.com"
                                autoComplete="email"
                                inputMode="email"
                            />
                        </label>

                        <label className="contact-field contact-field--full">
                            <span>Subiect</span>
                            <input
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                placeholder="Ex: Întrebare despre program"
                            />
                        </label>

                        <label className="contact-field contact-field--full">
                            <span>Mesaj</span>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Scrie mesajul tău aici..."
                                rows={7}
                            />
                        </label>
                    </div>

                    <button className="contact-btn" type="submit">
                        Trimite mesajul
                    </button>
                </form>
            </div>
        </section>
    );
}