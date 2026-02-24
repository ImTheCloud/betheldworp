"use client";

import "./FAQ.css";
import { useMemo, useState } from "react";
import { useLang } from "../components/LanguageProvider";
import { makeT } from "../lib/i18n";
import tr from "../translations/FAQ.json";

function ChevronIcon({ open }) {
    return (
        <svg
            className={`faq-chevron${open ? " faq-chevron--open" : ""}`}
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
        >
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function FAQItem({ question, answer, index, isOpen, onToggle }) {
    const num = String(index + 1).padStart(2, "0");
    return (
        <div className={`faq-item${isOpen ? " faq-item--open" : ""}`}>
            <button
                className="faq-question"
                onClick={() => onToggle(index)}
                aria-expanded={isOpen}
            >
                <span className="faq-q-number">{num}</span>
                <span className="faq-q-text">{question}</span>
                <ChevronIcon open={isOpen} />
            </button>

            <div className="faq-answer-wrap">
                <div className="faq-answer">
                    {answer.split("\n\n").map((block, i) => {
                        const trimmed = block.trim();
                        if (!trimmed) return null;

                        if (trimmed.includes("\n- ")) {
                            const [intro, ...rest] = trimmed.split("\n- ");
                            return (
                                <div key={i} className="faq-block">
                                    {intro && <p>{renderInline(intro)}</p>}
                                    <ul className="faq-list">
                                        {rest.map((item, j) => (
                                            <li key={j}>{renderInline(item.replace(/^- /, ""))}</li>
                                        ))}
                                    </ul>
                                </div>
                            );
                        }

                        return (
                            <p key={i} className="faq-block">
                                {renderInline(trimmed)}
                            </p>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function renderInline(text) {
    if (!text.includes("**")) return text;
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) =>
        i % 2 === 1 ? <strong key={i}>{part}</strong> : part
    );
}

export default function FAQ() {
    const { lang } = useLang();
    const t = useMemo(() => makeT(tr, lang), [lang]);
    const [openIndex, setOpenIndex] = useState(null);

    const questions = [
        { key: "q1", q: t("q1_title"), a: t("q1_body") },
        { key: "q2", q: t("q2_title"), a: t("q2_body") },
        { key: "q3", q: t("q3_title"), a: t("q3_body") },
        { key: "q4", q: t("q4_title"), a: t("q4_body") },
        { key: "q5", q: t("q5_title"), a: t("q5_body") },
    ];

    const handleToggle = (index) => {
        setOpenIndex(openIndex === index ? null : index);
    };

    const openContact = () => {
        if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("bethel:open-contact"));
        }
    };

    return (
        <section className="faq-section">
            <div className="faq-content">

                {/* Header */}
                <div className="faq-header">
                    <h2 className="faq-title">{t("section_title")}</h2>
                </div>

                {/* Accordion */}
                <div className="faq-list-wrap">
                    {questions.map((item, i) => (
                        <FAQItem
                            key={item.key}
                            index={i}
                            question={item.q}
                            answer={item.a}
                            isOpen={openIndex === i}
                            onToggle={handleToggle}
                        />
                    ))}
                </div>

                {/* Contact nudge */}
                <div className="faq-contact-nudge">
                    <span className="faq-contact-text">{t("contact_nudge")}</span>
                    <button
                        type="button"
                        className="faq-contact-btn"
                        onClick={openContact}
                    >
                        {t("contact_cta")}
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                </div>

                {/* Closing CTA */}
                <div className="faq-closing">
                    <div className="faq-closing-inner">
                        <h3 className="faq-closing-title">{t("closing_title")}</h3>
                        <p className="faq-closing-body">{t("closing_body")}</p>
                    </div>
                </div>

            </div>
        </section>
    );
}
