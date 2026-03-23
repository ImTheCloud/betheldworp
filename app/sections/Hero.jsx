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
    const [bgLoaded, setBgLoaded] = useState(false);

    const lastRef = useRef({ reference: "", text: "" });
    const imgRef = useRef(null);

    // Initial check in case the image is already downloaded/cached
    useEffect(() => {
        if (imgRef.current && imgRef.current.complete) {
            setBgLoaded(true);
        }
    }, []);

    // Only start entry animations once the background is loaded
    useEffect(() => {
        if (bgLoaded) {
            const id = setTimeout(() => setEntered(true), 90);
            return () => clearTimeout(id);
        }
    }, [bgLoaded]);

    useEffect(() => {
        setLoading(true);
        setLoadFailed(false);

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

    const showSkeleton = loading && !verse.text;

    return (
        <section className="hero">
            {!bgLoaded && (
                <div className="hero-loader">
                    <div className="hero-spinner"></div>
                </div>
            )}
            
            <img
                ref={imgRef}
                className={`hero-bgImg ${bgLoaded ? 'is-loaded' : ''}`}
                src="/images/landing_page/drone.jpg"
                alt=""
                aria-hidden="true"
                loading="eager"
                decoding="async"
                fetchPriority="high"
                onLoad={() => setBgLoaded(true)}
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

                    {(verse.text || showSkeleton) ? (
                        <p className={`hero-verseText ${showSkeleton ? "is-skeleton" : ""}`.trim()}>
                            {showSkeleton ? "\u00A0" : verse.text}
                        </p>
                    ) : null}

                    {error ? <div className="ec-inlineError">{error}</div> : null}
                </div>
            </div>
        </section>
    );
}