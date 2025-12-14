"use client";

import { useMemo, useState } from "react";
import "./Donations.css";

const BENEFICIARY = "Centru Creștin Român Bethel Dworp";
const IBAN_RAW = "BE89143108589985";
const IBAN_DISPLAY = "BE89 1431 0858 9985";

export default function Donations() {
    const descriptions = useMemo(
        () => [
            "Cotizația lunară",
            "Evanghelizare (Biblii, materiale)",
            "Ajutor Oltenia (România) & Madagascar",
            "Familie în nevoie",
            "Alt don (scrie ce dorești)",
        ],
        []
    );

    const cards = useMemo(
        () => [
            {
                title: "Cotizația lunară",
                desc: "Susținere constantă pentru lucrarea și nevoile bisericii.",
                tag: "Regular",
            },
            {
                title: "Evanghelizare",
                desc: "Cumpărare Biblii, materiale și sprijin pentru proiecte.",
                tag: "Misiune",
            },
            {
                title: "Ajutor Oltenia (România) & Madagascar",
                desc: "Sprijin pentru zone defavorizate și proiecte unde biserica este implicată.",
                tag: "Ajutor",
            },
            {
                title: "Familie în nevoie",
                desc: "Sprijin direct pentru familii în situații dificile.",
                tag: "Sprijin",
            },
        ],
        []
    );

    const [copied, setCopied] = useState(false);

    const copyIban = async () => {
        try {
            await navigator.clipboard.writeText(IBAN_RAW);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
        } catch {
            const t = document.createElement("textarea");
            t.value = IBAN_RAW;
            document.body.appendChild(t);
            t.select();
            document.execCommand("copy");
            document.body.removeChild(t);

            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
        }
    };

    return (
        <section id="donatii" className="don-section">
            <div className="don-content">
                <h2 className="don-title">Donații</h2>

                <div className="don-card">
                    {/* LEFT */}
                    <div className="don-left">
                        {/* ✅ Title aligned with right column title */}
                        <div className="don-gridTitle don-leftTitle">Detalii donație</div>

                        <div className="don-payBox">
                            <div className="don-stack">
                                <div className="don-k">Beneficiar</div>
                                <div className="don-v">{BENEFICIARY}</div>
                            </div>

                            <div className="don-rowIban">
                                <div className="don-rowLeft">
                                    <div className="don-k">IBAN</div>
                                    <div className="don-v don-v--mono">{IBAN_DISPLAY}</div>
                                </div>

                                <button type="button" className="don-copyBtn" onClick={copyIban}>
                                    {copied ? "Copiat ✅" : "Copiază IBAN"}
                                </button>
                            </div>

                            <div className="don-desc">
                                <div className="don-descTitle">Descriere</div>
                                <div className="don-descText">Exemple: {descriptions.join(" · ")}</div>
                            </div>
                        </div>

                        <div className="don-verse">
                            <div className="don-verseTitle">Eclesiastul 11:1</div>
                            <div className="don-verseText">
                                „Aruncă-ți pâinea pe ape, și după multă vreme o vei găsi iarăși!”
                            </div>
                        </div>
                    </div>

                    {/* RIGHT */}
                    <div className="don-right">
                        <div className="don-gridTitle">Tipuri de donații</div>

                        <div className="don-grid">
                            {cards.map((c) => (
                                <div key={c.title} className="don-option">
                                    <div className="don-optionTop">
                                        <div className="don-optionTitle">{c.title}</div>
                                        <div className="don-tag">{c.tag}</div>
                                    </div>
                                    <div className="don-optionDesc">{c.desc}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}