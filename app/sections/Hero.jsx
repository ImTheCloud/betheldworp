"use client";

import "./Hero.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/Firebase";
import { useLang } from "../components/LanguageProvider";
import { makeT } from "../lib/i18n";
import tr from "../translations/Hero.json";

function pickByLang(value, lang) {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (typeof value === "object") {
        const v = value?.[lang] ?? value?.ro ?? value?.en ?? "";
        return String(v || "").trim();
    }
    return "";
}

export default function Hero() {
    const { lang } = useLang();
    const t = useMemo(() => makeT(tr, lang), [lang]);

    const [verse, setVerse] = useState({ reference: "", text: "" });
    const [loading, setLoading] = useState(true);
    const [loadFailed, setLoadFailed] = useState(false);
    const [entered, setEntered] = useState(false);

    const lastRef = useRef({ reference: "", text: "" });

    useEffect(() => {
        const id = setTimeout(() => setEntered(true), 90);
        return () => clearTimeout(id);
    }, []);

    useEffect(() => {
        const ref = doc(db, "monthly_verse", "current");

        const unsub = onSnapshot(
            ref,
            (snap) => {
                const data = snap.data() || {};

                const reference = pickByLang(data.reference, lang);
                const text = pickByLang(data.text, lang);

                const prev = lastRef.current;
                if (prev.reference !== reference || prev.text !== text) {
                    lastRef.current = { reference, text };
                    setVerse({ reference, text });
                }

                setLoadFailed(false);
                setLoading(false);
            },
            () => {
                setLoadFailed(true);
                setLoading(false);
            }
        );

        return () => unsub();
    }, [lang]);

    const emptyVerse = !verse.reference && !verse.text;
    const error = loadFailed ? t("error_load_verse") : emptyVerse && !loading ? t("error_no_verse") : "";

    return (
        <section className="hero">
            <img
                className="hero-bgImg"
                src="/images/drone.jpg"
                alt=""
                aria-hidden="true"
                loading="eager"
                decoding="async"
                fetchPriority="high"
            />

            <div className={`hero-content ${entered ? "is-entered" : ""}`.trim()}>
                <h1 className="hero-title">{t("title")}</h1>
                <h2 className="hero-subtitle">{t("subtitle")}</h2>

                <div className="hero-verse" aria-live="polite">
                    <div className="hero-verseLabel">
                        {t("monthly_verse")}
                        {verse.reference ? ` : ${verse.reference}` : ""}
                        {loading ? ` ${t("loading")}` : ""}
                    </div>

                    {verse.text ? <p className="hero-verseText">{verse.text}</p> : null}
                    {error ? <div className="ec-inlineError">{error}</div> : null}
                </div>
            </div>
        </section>
    );
}