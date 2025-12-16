"use client";

import { useMemo, useState } from "react";
import "./Donations.css";

const BENEFICIARY = "CENTRE CHRETIEN ROUMAIN BETHEL ASBL";
const IBAN_RAW = "BE89143108589985";
const IBAN_DISPLAY = "BE89 1431 0858 9985";

export default function Donations() {
    const donationTypes = useMemo(
        () => [
            {
                title: "Cotizația lunară",
                desc: "Susținere constantă pentru lucrarea și nevoile bisericii.",
                badge: "Regular",
                badgeType: "regular",
            },
            {
                title: "Evanghelizare",
                desc: "Cumpărare Biblii, materiale și sprijin pentru proiecte misionare.",
                badge: "Misiune",
                badgeType: "mission",
            },
            {
                title: "Ajutor Oltenia & Madagascar",
                desc: "Sprijin pentru zone defavorizate și proiecte unde biserica este implicată.",
                badge: "Ajutor",
                badgeType: "help",
            },
            {
                title: "Familie în nevoie",
                desc: "Sprijin direct pentru familii în situații dificile.",
                badge: "Sprijin",
                badgeType: "support",
            },
        ],
        []
    );

    const [copied, setCopied] = useState(false);

    const copyIban = async () => {
        try {
            await navigator.clipboard.writeText(IBAN_RAW);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            const textarea = document.createElement("textarea");
            textarea.value = IBAN_RAW;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand("copy");
            document.body.removeChild(textarea);

            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        }
    };

    return (
        <section id="donatii" className="don-section">
            <div className="don-content">
                <div className="don-header">
                    <h2 className="don-title">Donații</h2>
                    <p className="don-intro">
                        Susține lucrarea bisericii și proiectele noastre prin donații
                    </p>
                </div>

                <div className="don-bank-card">
                    <div className="don-bank-grid">
                        <div className="don-field">
                            <div className="don-field-label">Beneficiar</div>
                            <div className="don-field-value">{BENEFICIARY}</div>
                        </div>

                        <div className="don-field">
                            <div className="don-field-label">IBAN</div>
                            <div className="don-iban-row">
                                <div className="don-iban-value">{IBAN_DISPLAY}</div>
                                <button
                                    type="button"
                                    className="don-copy-btn"
                                    onClick={copyIban}
                                >
                                    {copied ? "Copiat ✓" : "Copiază IBAN"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="don-types-section">
                    <div className="don-types-grid">
                        {donationTypes.map((type) => (
                            <article key={type.title} className="don-type-card">
                                <div className={`don-type-badge don-type-badge--${type.badgeType}`}>
                                    {type.badge}
                                </div>
                                <div className="don-type-title">{type.title}</div>
                                <div className="don-type-desc">{type.desc}</div>
                            </article>
                        ))}
                    </div>
                </div>

                <div className="don-verse-highlight">
                    <div className="don-verse-content">
                        <p className="don-verse-text">
                            „Aruncă-ți pâinea pe ape, și după multă vreme o vei găsi iarăși!"
                        </p>
                        <p className="don-verse-ref">Eclesiastul 11:1</p>
                    </div>
                </div>
            </div>
        </section>
    );
}