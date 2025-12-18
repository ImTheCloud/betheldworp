"use client";

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
            <path
                fill="#FF0000"
                d="M23.498 6.186a3.014 3.014 0 0 0-2.12-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.378.505A3.014 3.014 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.014 3.014 0 0 0 2.12 2.136c1.873.505 9.378.505 9.378.505s7.505 0 9.378-.505a3.014 3.014 0 0 0 2.12-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814Z"
            />
            <path fill="#FFFFFF" d="M9.75 15.5V8.5L16 12l-6.25 3.5Z" />
        </svg>
    );
}

export default function Gallery() {
    const IMAGES = useMemo(
        () => [
            { src: "/images/drone.jpg", alt: "Bethel 1" },
            { src: "/images/outside.jpg", alt: "Bethel 2" },
            { src: "/images/inside.jpg", alt: "Bethel 3" },
            { src: "/images/inside2.jpg", alt: "Bethel 4" },
        ],
        []
    );

    const featuredImage = IMAGES[0];
    const otherImages = IMAGES.slice(1);

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

    const [imgOpen, setImgOpen] = useState(false);
    const [activeImg, setActiveImg] = useState(null);

    const openImgModal = (img) => {
        setActiveImg(img);
        setImgOpen(true);
    };
    const closeImgModal = () => setImgOpen(false);

    const [vidOpen, setVidOpen] = useState(false);
    const [activeVid, setActiveVid] = useState(null);

    const openVidModal = (v) => {
        setActiveVid(v);
        setVidOpen(true);
    };
    const closeVidModal = () => setVidOpen(false);

    const imgRowRef = useRef(null);
    const imgRafRef = useRef(null);
    const imgLastTsRef = useRef(0);
    const imgDirRef = useRef(1);
    const imgPausedRef = useRef(false);

    useEffect(() => {
        const el = imgRowRef.current;
        if (!el) return;

        const mql = window.matchMedia?.("(prefers-reduced-motion: reduce)");
        if (mql?.matches) return;

        const speedPxPerSec = 22;

        const step = (ts) => {
            if (!imgRowRef.current) return;

            if (!imgLastTsRef.current) imgLastTsRef.current = ts;
            const dt = Math.min(50, ts - imgLastTsRef.current);
            imgLastTsRef.current = ts;

            const e = imgRowRef.current;
            const max = Math.max(0, e.scrollWidth - e.clientWidth);

            if (!imgPausedRef.current && max > 0) {
                const delta = (speedPxPerSec * dt) / 1000;
                e.scrollLeft += imgDirRef.current * delta;

                if (e.scrollLeft >= max - 1) {
                    e.scrollLeft = max;
                    imgDirRef.current = -1;
                } else if (e.scrollLeft <= 1) {
                    e.scrollLeft = 0;
                    imgDirRef.current = 1;
                }
            }

            imgRafRef.current = requestAnimationFrame(step);
        };

        imgRafRef.current = requestAnimationFrame(step);

        const pause = () => {
            imgPausedRef.current = true;
        };
        const resume = () => {
            imgPausedRef.current = false;
            imgLastTsRef.current = 0;
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
            if (imgRafRef.current) cancelAnimationFrame(imgRafRef.current);
            imgRafRef.current = null;
            imgLastTsRef.current = 0;

            el.removeEventListener("mouseenter", pause);
            el.removeEventListener("mouseleave", resume);
            el.removeEventListener("touchstart", pause);
            el.removeEventListener("touchend", resume);
            el.removeEventListener("focusin", pause);
            el.removeEventListener("focusout", resume);
            el.removeEventListener("wheel", pause);

            document.removeEventListener("visibilitychange", onVis);
        };
    }, [otherImages.length]);

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
                    <div className="gal-header">
                        <h2 className="gal-title">Galerie</h2>
                    </div>

                    <div className="gal-images">
                        <div className="gal-images-header">
                            <h3 className="gal-subtitle">Imagini</h3>
                        </div>

                        {featuredImage && (
                            <button
                                type="button"
                                className="gal-featured"
                                onClick={() => openImgModal(featuredImage)}
                                aria-label={`Open ${featuredImage.alt}`}
                            >
                                <img
                                    className="gal-featuredThumb"
                                    src={featuredImage.src}
                                    alt={featuredImage.alt}
                                    loading="lazy"
                                />
                            </button>
                        )}

                        <div className="gal-rowScroller">
                            <div className="gal-rowOutside" ref={imgRowRef}>
                                {otherImages.map((img) => (
                                    <button
                                        key={img.src}
                                        type="button"
                                        className="gal-rowCard"
                                        onClick={() => openImgModal(img)}
                                        aria-label={`Open ${img.alt}`}
                                    >
                                        <div className="gal-rowThumbWrap">
                                            <img className="gal-rowThumb" src={img.src} alt={img.alt} loading="lazy" />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="gal-videos">
                        <div className="gal-video-header">
                            <h3 className="gal-subtitle">Video</h3>
                        </div>

                        {featured && (
                            <button
                                type="button"
                                className="gal-featured"
                                onClick={() => openVidModal(featured)}
                                aria-label="Open featured video"
                            >
                                <img className="gal-featuredThumb" src={featured.thumb} alt="Featured video" loading="lazy" />
                                <div className="gal-featuredOverlay" aria-hidden="true">
                                    <div className="gal-featuredPlay">▶</div>
                                </div>
                            </button>
                        )}

                        <div className="gal-rowScroller">
                            <div className="gal-rowOutside" ref={rowRef}>
                                {others.map((v) => (
                                    <button
                                        key={v.id}
                                        type="button"
                                        className="gal-rowCard"
                                        onClick={() => openVidModal(v)}
                                        aria-label="Open video"
                                    >
                                        <div className="gal-rowThumbWrap">
                                            <img className="gal-rowThumb" src={v.thumb} alt="Video thumbnail" loading="lazy" />
                                            <div className="gal-rowPlay" aria-hidden="true">▶</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <a
                            className="gal-ytCta"
                            href="https://www.youtube.com/@bisericapenticostalabethel7695"
                            target="_blank"
                            rel="noreferrer"
                            aria-label="Visit our YouTube channel"
                        >
                            <YouTubeIcon className="gal-ytSvg" />
                            <span className="gal-ytText">Vezi mai multe pe canalul nostru YouTube</span>
                            <span className="gal-ytArrow" aria-hidden="true">→</span>
                        </a>
                    </div>
                </div>
            </section>

            {imgOpen && activeImg && (
                <div className="gal-overlay" onClick={closeImgModal}>
                    <div className="gal-modal" onClick={(e) => e.stopPropagation()}>
                        <button className="gal-close" onClick={closeImgModal} aria-label="Close">×</button>
                        <img className="gal-modalImg" src={activeImg.src} alt={activeImg.alt} />
                    </div>
                </div>
            )}

            {vidOpen && activeVid && (
                <div className="gal-overlay gal-overlay--center" onClick={closeVidModal}>
                    <div className="gal-modal gal-modal--video" onClick={(e) => e.stopPropagation()}>
                        <button className="gal-close" onClick={closeVidModal} aria-label="Close">×</button>
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