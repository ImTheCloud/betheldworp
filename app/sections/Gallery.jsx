"use client";

// app/sections/Gallery.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import "./Gallery.css";

function getYouTubeId(url) {
    try {
        const u = new URL(url);
        if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
        if (u.hostname.includes("youtu.be")) return u.pathname.replace("/", "");
        return null;
    } catch {
        return null;
    }
}

function YouTubeIcon({ className = "", title = "YouTube" }) {
    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            role="img"
            aria-label={title}
            xmlns="http://www.w3.org/2000/svg"
        >
            {/* rounded rectangle */}
            <path
                fill="#FF0000"
                d="M23.498 6.186a3.014 3.014 0 0 0-2.12-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.378.505A3.014 3.014 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.014 3.014 0 0 0 2.12 2.136c1.873.505 9.378.505 9.378.505s7.505 0 9.378-.505a3.014 3.014 0 0 0 2.12-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814Z"
            />
            {/* play triangle */}
            <path fill="#FFFFFF" d="M9.75 15.5V8.5L16 12l-6.25 3.5Z" />
        </svg>
    );
}

export default function Gallery() {
    const IMAGES = useMemo(
        () => [
            { src: "/image/drone.jpg", alt: "Bethel 1" },
            { src: "/image/outside.jpg", alt: "Bethel 2" },
            { src: "/image/inside.jpg", alt: "Bethel 3" },
            { src: "/image/inside2.jpg", alt: "Bethel 4" },
        ],
        []
    );

    const YOUTUBE_URLS = useMemo(
        () => [
            "https://www.youtube.com/watch?v=i-w84etcA0E",
            "https://www.youtube.com/watch?v=Lo8toEg93hg",
            "https://www.youtube.com/watch?v=OHvzc69tSZE",
            "https://www.youtube.com/watch?v=FuDxPPFtX9Q",
            "https://www.youtube.com/watch?v=SGzcz308AQo",
            "https://www.youtube.com/watch?v=i1HpR9CkMZY",
            "https://www.youtube.com/watch?v=WMmyRWf9hFE",
        ],
        []
    );

    const VIDEOS = useMemo(() => {
        return YOUTUBE_URLS.map((url) => {
            const id = getYouTubeId(url);
            return {
                id,
                url,
                thumb: id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null,
            };
        }).filter((v) => Boolean(v.id));
    }, [YOUTUBE_URLS]);

    const featured = VIDEOS[0] || null;
    const others = VIDEOS.slice(1);

    // Image modal
    const [imgOpen, setImgOpen] = useState(false);
    const [activeImg, setActiveImg] = useState(null);

    const openImgModal = (img) => {
        setActiveImg(img);
        setImgOpen(true);
    };
    const closeImgModal = () => setImgOpen(false);

    // Video modal
    const [vidOpen, setVidOpen] = useState(false);
    const [activeVid, setActiveVid] = useState(null);

    const openVidModal = (v) => {
        setActiveVid(v);
        setVidOpen(true);
    };
    const closeVidModal = () => setVidOpen(false);

    // Auto-scroll row (slow ping-pong)
    const rowRef = useRef(null);
    const rafRef = useRef(null);
    const lastTsRef = useRef(0);
    const dirRef = useRef(1);
    const pausedRef = useRef(false);

    useEffect(() => {
        const el = rowRef.current;
        if (!el) return;

        const mql = window.matchMedia?.("(prefers-reduced-motion: reduce)");
        if (mql?.matches) return;

        const speedPxPerSec = 22;

        const step = (ts) => {
            if (!rowRef.current) return;

            if (!lastTsRef.current) lastTsRef.current = ts;
            const dt = Math.min(50, ts - lastTsRef.current);
            lastTsRef.current = ts;

            const e = rowRef.current;
            const max = Math.max(0, e.scrollWidth - e.clientWidth);

            if (!pausedRef.current && max > 0) {
                const delta = (speedPxPerSec * dt) / 1000;
                e.scrollLeft += dirRef.current * delta;

                if (e.scrollLeft >= max - 1) {
                    e.scrollLeft = max;
                    dirRef.current = -1;
                } else if (e.scrollLeft <= 1) {
                    e.scrollLeft = 0;
                    dirRef.current = 1;
                }
            }

            rafRef.current = requestAnimationFrame(step);
        };

        rafRef.current = requestAnimationFrame(step);

        const pause = () => {
            pausedRef.current = true;
        };
        const resume = () => {
            pausedRef.current = false;
            lastTsRef.current = 0;
        };

        el.addEventListener("mouseenter", pause);
        el.addEventListener("mouseleave", resume);
        el.addEventListener("touchstart", pause, { passive: true });
        el.addEventListener("touchend", resume, { passive: true });
        el.addEventListener("focusin", pause);
        el.addEventListener("focusout", resume);
        el.addEventListener("wheel", pause, { passive: true });

        const onVis = () => {
            if (document.hidden) pause();
            else resume();
        };
        document.addEventListener("visibilitychange", onVis);

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
            lastTsRef.current = 0;

            el.removeEventListener("mouseenter", pause);
            el.removeEventListener("mouseleave", resume);
            el.removeEventListener("touchstart", pause);
            el.removeEventListener("touchend", resume);
            el.removeEventListener("focusin", pause);
            el.removeEventListener("focusout", resume);
            el.removeEventListener("wheel", pause);

            document.removeEventListener("visibilitychange", onVis);
        };
    }, [others.length]);

    return (
        <>
            <section id="galerie" className="gal-section">
                <div className="gal-content">
                    <h2 className="gal-title">Galerie</h2>

                    {/* ===== IMAGES ===== */}
                    <div className="gal-grid">
                        {IMAGES.map((img) => (
                            <button
                                key={img.src}
                                type="button"
                                className="gal-card"
                                onClick={() => openImgModal(img)}
                                aria-label={`Open image ${img.alt}`}
                                title={img.alt}
                            >
                                <img className="gal-img" src={img.src} alt={img.alt} loading="lazy" />
                            </button>
                        ))}
                    </div>

                    {/* ===== VIDEOS ===== */}
                    <div className="gal-videos">
                        <h3 className="gal-subtitle">Video</h3>

                        {/* Featured */}
                        {featured && (
                            <button
                                type="button"
                                className="gal-featured"
                                onClick={() => openVidModal(featured)}
                                aria-label="Open featured video"
                                title="Open video"
                            >
                                <img className="gal-featuredThumb" src={featured.thumb} alt="Featured video" loading="lazy" />
                                <div className="gal-featuredOverlay" aria-hidden="true">
                                    <div className="gal-featuredPlay">▶</div>
                                </div>
                            </button>
                        )}

                        {/* Scroll row */}
                        <div className="gal-rowScroller">
                            <div className="gal-rowOutside" ref={rowRef}>
                                {others.map((v) => (
                                    <button
                                        key={v.id}
                                        type="button"
                                        className="gal-rowCard"
                                        onClick={() => openVidModal(v)}
                                        aria-label="Open video"
                                        title="Open video"
                                    >
                                        <div className="gal-rowThumbWrap">
                                            <img className="gal-rowThumb" src={v.thumb} alt="Video thumbnail" loading="lazy" />
                                            <div className="gal-rowPlay" aria-hidden="true">
                                                ▶
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* YouTube channel CTA (real icon, no background) */}
                        <a
                            className="gal-ytCta"
                            href="https://www.youtube.com/@bisericapenticostalabethel7695"
                            target="_blank"
                            rel="noreferrer"
                            aria-label="Visit our YouTube channel"
                            title="YouTube"
                        >
                            <YouTubeIcon className="gal-ytSvg" />
                            <span className="gal-ytText">Vezi mai multe pe canalul nostru YouTube</span>
                            <span className="gal-ytArrow" aria-hidden="true">
                →
              </span>
                        </a>
                    </div>
                </div>
            </section>

            {/* ===== Image Modal ===== */}
            {imgOpen && activeImg && (
                <div className="gal-overlay" onClick={closeImgModal}>
                    <div className="gal-modal" onClick={(e) => e.stopPropagation()}>
                        <button className="gal-close" onClick={closeImgModal} aria-label="Close" title="Close">
                            ×
                        </button>
                        <img className="gal-modalImg" src={activeImg.src} alt={activeImg.alt} />
                    </div>
                </div>
            )}

            {/* ===== Video Modal ===== */}
            {vidOpen && activeVid && (
                <div className="gal-overlay" onClick={closeVidModal}>
                    <div className="gal-modal gal-modal--video" onClick={(e) => e.stopPropagation()}>
                        <button className="gal-close" onClick={closeVidModal} aria-label="Close" title="Close">
                            ×
                        </button>

                        <div className="gal-videoFrameWrap">
                            <iframe
                                className="gal-videoFrame"
                                src={`https://www.youtube.com/embed/${activeVid.id}?autoplay=1&rel=0`}
                                title="YouTube video player"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowFullScreen
                            />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}