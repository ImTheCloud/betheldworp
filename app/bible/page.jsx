"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import BibleReaderHeader from "./BibleReaderHeader";
import ContactWidget from "../components/ContactWidget";
import { useLang } from "../components/LanguageProvider";
import { makeT } from "../lib/i18n";
import tr from "../translations/Bible.json";
import "./bible.css";

const API = "https://api.getbible.net/v2/cornilescu";

/* ── Old Testament / New Testament split ─────── */
const OT_MAX = 39; // books 1–39

export default function BiblePage() {
    const { lang } = useLang();
    const t = useMemo(() => makeT(tr, lang), [lang]);

    /* ── state ──────────────────────────────────── */
    const [books, setBooks] = useState(null);
    const [selectedBook, setSelectedBook] = useState(null);
    const [chapters, setChapters] = useState(null);   // chapter list for selected book
    const [selectedChapter, setSelectedChapter] = useState(1);
    const [verses, setVerses] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    /* ── fetch books list ──────────────────────── */
    useEffect(() => {
        fetch(`${API}/books.json`)
            .then((r) => r.json())
            .then((data) => {
                const list = Object.values(data).sort((a, b) => a.nr - b.nr);
                setBooks(list);
                setSelectedBook(list[0]); // default: Geneza
            })
            .catch(console.error);
    }, []);

    /* ── when book changes, fetch its chapter count ── */
    useEffect(() => {
        if (!selectedBook) return;
        setLoading(true);
        setSelectedChapter(1);

        fetch(selectedBook.url)
            .then((r) => r.json())
            .then((data) => {
                const chapterList = Object.keys(data.chapters || data)
                    .map(Number)
                    .filter(n => n > 0)
                    .sort((a, b) => a - b);
                setChapters(chapterList);
                if (chapterList.length > 0) {
                    setSelectedChapter(chapterList[0]);
                }
            })
            .catch(console.error);
    }, [selectedBook]);

    /* ── when chapter changes, fetch verses ───── */
    useEffect(() => {
        if (!selectedBook || !selectedChapter) return;
        setLoading(true);

        fetch(`${API}/${selectedBook.nr}/${selectedChapter}.json`)
            .then((r) => r.json())
            .then((data) => {
                setVerses(data.verses || []);
                setLoading(false);
                // scroll reading area to top
                document.querySelector(".bible-reading-area")?.scrollTo(0, 0);
            })
            .catch(console.error);
    }, [selectedBook, selectedChapter]);

    const selectBook = useCallback((book) => {
        setSelectedBook(book);
        setSidebarOpen(false);
    }, []);

    const otBooks = useMemo(() => books?.filter((b) => b.nr <= OT_MAX) || [], [books]);
    const ntBooks = useMemo(() => books?.filter((b) => b.nr > OT_MAX) || [], [books]);

    const goChapter = (dir) => {
        if (!chapters) return;
        const idx = chapters.indexOf(selectedChapter);
        const nextIdx = idx + dir;
        if (nextIdx >= 0 && nextIdx < chapters.length) {
            setSelectedChapter(chapters[nextIdx]);
        }
    };

    return (
        <div className="bible-page">
            <BibleReaderHeader />

            {/* ── Hero ─────────────────────────────── */}
            <div className="bible-page-hero">
                <h1 className="bible-page-hero-title">{t("hero_title")}</h1>
                <p className="bible-page-hero-subtitle">{t("hero_subtitle")}</p>
            </div>

            {/* ── Reader ───────────────────────────── */}
            <div className="bible-reader">
                {/* mobile toggle */}
                <button
                    className="bible-sidebar-toggle"
                    onClick={() => setSidebarOpen((v) => !v)}
                    aria-label="Toggle book list"
                >
                    <span className="bible-sidebar-toggle-icon">☰</span>
                    <span>{selectedBook?.name || "…"}</span>
                </button>

                {/* sidebar - book list */}
                <aside className={`bible-sidebar ${sidebarOpen ? "is-open" : ""}`}>
                    <div className="bible-sidebar-inner">
                        <div className="bible-sidebar-section">
                            <div className="bible-sidebar-label">{t("old_testament")}</div>
                            {otBooks.map((b) => (
                                <button
                                    key={b.nr}
                                    className={`bible-book-btn ${selectedBook?.nr === b.nr ? "is-active" : ""}`}
                                    onClick={() => selectBook(b)}
                                >
                                    {b.name}
                                </button>
                            ))}
                        </div>
                        <div className="bible-sidebar-section">
                            <div className="bible-sidebar-label">{t("new_testament")}</div>
                            {ntBooks.map((b) => (
                                <button
                                    key={b.nr}
                                    className={`bible-book-btn ${selectedBook?.nr === b.nr ? "is-active" : ""}`}
                                    onClick={() => selectBook(b)}
                                >
                                    {b.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </aside>

                {/* main content */}
                <div className="bible-main">
                    {/* chapter nav */}
                    {chapters && (
                        <div className="bible-chapter-nav">
                            <div className="bible-chapter-pills">
                                {chapters.map((ch) => (
                                    <button
                                        key={ch}
                                        className={`bible-chapter-pill ${selectedChapter === ch ? "is-active" : ""}`}
                                        onClick={() => setSelectedChapter(ch)}
                                    >
                                        {ch}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* reading area */}
                    <div className="bible-reading-area">
                        {loading ? (
                            <div className="bible-loading">
                                <div className="bible-loading-spinner" />
                            </div>
                        ) : (
                            <>
                                <h2 className="bible-chapter-title">
                                    {selectedBook?.name} {selectedChapter}
                                </h2>
                                <div className="bible-verses">
                                    {verses?.map((v) => (
                                        <p key={v.verse} className="bible-verse">
                                            <span className="bible-verse-num">{v.verse}</span>
                                            <span className="bible-verse-text">{v.text}</span>
                                        </p>
                                    ))}
                                </div>

                                {/* prev / next */}
                                <div className="bible-pager">
                                    <button
                                        className="bible-pager-btn"
                                        disabled={!chapters || chapters.indexOf(selectedChapter) === 0}
                                        onClick={() => goChapter(-1)}
                                    >
                                        ← {t("prev_chapter")}
                                    </button>
                                    <button
                                        className="bible-pager-btn"
                                        disabled={!chapters || chapters.indexOf(selectedChapter) === chapters.length - 1}
                                        onClick={() => goChapter(1)}
                                    >
                                        {t("next_chapter")} →
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <ContactWidget />
        </div>
    );
}
