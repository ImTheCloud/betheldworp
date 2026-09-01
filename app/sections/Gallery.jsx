"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import "./Gallery.css";
import { useLang } from "../components/LanguageProvider";
import { makeT } from "../lib/i18n";
import tr from "../translations/Gallery.json";

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
        <svg className={className} viewBox="0 0 24 24" role="img" aria-label={title} xmlns="http://www.w3.org/2000/svg">
            <path
                fill="#FF0000"
                d="M23.498 6.186a3.014 3.014 0 0 0-2.12-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.378.505A3.014 3.014 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.014 3.014 0 0 0 2.12 2.136c1.873.505 9.378.505 9.378.505s7.505 0 9.378-.505a3.014 3.014 0 0 0 2.12-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814Z"
            />
            <path fill="#FFFFFF" d="M9.75 15.5V8.5L16 12l-6.25 3.5Z" />
        </svg>
    );
}

export default function Gallery() {
    const { lang } = useLang();
    const t = useMemo(() => makeT(tr, lang), [lang]);

    // Chaque photo porte une clé de traduction plutôt qu'un texte : les dix-neuf
    // images partageaient auparavant le même alt « Bethel », ce qui donnait, pour
    // un lecteur d'écran, dix-neuf fois le même mot. La clé est résolue au rendu,
    // pour que la description suive la langue choisie.
    const IMAGES = useMemo(
        () => [
            { src: "/images/landing_page/drone.jpg", altKey: "alt_drone", w: 1080, h: 607 },
            { src: "/images/landing_page/outside.jpg", altKey: "alt_outside", w: 811, h: 570 },
            { src: "/images/landing_page/CorMixt.jpg", altKey: "alt_cormixt", w: 2000, h: 1333 },
            { src: "/images/landing_page/WeddingCK.jpg", altKey: "alt_choir", w: 2000, h: 1333 },
            { src: "/images/landing_page/WeddingCK2.jpg", altKey: "alt_service", w: 2000, h: 1333 },
            { src: "/images/landing_page/1.Botez_2024.jpg", altKey: "alt_baptism1", w: 1080, h: 720 },
            { src: "/images/landing_page/2.Botez_2024.jpg", altKey: "alt_baptism2", w: 1080, h: 720 },
            { src: "/images/landing_page/0.church.png", altKey: "alt_worship", w: 1206, h: 653 },
            { src: "/images/landing_page/inside.jpg", altKey: "alt_inside", w: 1536, h: 2048 },
            { src: "/images/landing_page/inside2.jpg", altKey: "alt_inside2", w: 1536, h: 2048 },
            { src: "/images/landing_page/1.Huizingen.jpg", altKey: "alt_camp1", w: 2000, h: 1333 },
            { src: "/images/landing_page/2.Huizingen.jpg", altKey: "alt_camp2", w: 2000, h: 1334 },
            { src: "/images/landing_page/3.Huizingen.jpg", altKey: "alt_camp3", w: 2000, h: 1333 },
            { src: "/images/landing_page/4.Huizingen.jpg", altKey: "alt_camp4", w: 2000, h: 1333 },
            { src: "/images/landing_page/5.Huizingen.jpg", altKey: "alt_camp5", w: 2000, h: 1333 },
            { src: "/images/landing_page/6.Huizingen.jpg", altKey: "alt_camp6", w: 2000, h: 1333 },
            { src: "/images/landing_page/7.Huizingen.jpg", altKey: "alt_camp7", w: 2000, h: 1333 },
            { src: "/images/landing_page/8.Huizingen.jpg", altKey: "alt_camp8", w: 2000, h: 1333 },
            { src: "/images/landing_page/9.Huizingen.jpg", altKey: "alt_camp9", w: 2000, h: 1333 }
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
                thumb: id ? `/images/videos/${id}.jpg` : null,
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

    return (
        <>
            <section className="gal-section">
                <div className="gal-content">
                    <div className="gal-header">
                        <h2 className="gal-title">{t("title")}</h2>
                    </div>

                    <div className="gal-images">
                        <div className="gal-images-header">
                            <h3 className="gal-subtitle">{t("images")}</h3>
                        </div>

                        {featuredImage && (
                            <button
                                type="button"
                                className="gal-featured"
                                onClick={() => openImgModal(featuredImage)}
                                aria-label={t("open_image")}
                            >
                                {/* Volontairement une <img> ordinaire, et non next/image.
                                    Cette photo s'affiche sur toute la largeur : le
                                    navigateur demanderait une version de 828 à 1080 px,
                                    or le fichier n'en fait que 1080. Il n'y a rien à
                                    réduire, il ne resterait que la recompression — mesuré
                                    à 165 Ko contre 151 aujourd'hui, donc plus lourd ET
                                    moins net. Les vignettes de la rangée, elles, gagnent
                                    90 % parce qu'elles s'affichent à 320 px. */}
                                <img className="gal-featuredThumb" src={featuredImage.src} alt={t(featuredImage.altKey)} loading="lazy" />
                            </button>
                        )}

                        <div className="gal-rowScroller">
                            <div className="gal-rowOutside">
                                {otherImages.map((img) => (
                                    <button
                                        key={img.src}
                                        type="button"
                                        className="gal-rowCard"
                                        onClick={() => openImgModal(img)}
                                        aria-label={t("open_image")}
                                    >
                                        <div className="gal-rowThumbWrap">
                                            {/* Vignettes affichées à 320 px au plus (240 sur
                                                téléphone) pour des fichiers de 2000 px : c'est là
                                                que la réduction paye, environ 90 % de moins.
                                                quality 90 et non 75, les fichiers étant déjà
                                                compressés à 80. */}
                                            <Image
                                                className="gal-rowThumb"
                                                src={img.src}
                                                alt={t(img.altKey)}
                                                width={img.w}
                                                height={img.h}
                                                quality={90}
                                                sizes="(max-width: 600px) 240px, (max-width: 900px) 280px, 320px"
                                            />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="gal-videos">
                        <div className="gal-video-header">
                            <h3 className="gal-subtitle">{t("videos")}</h3>
                        </div>

                        {featured && (
                            <button
                                type="button"
                                className="gal-featured"
                                onClick={() => openVidModal(featured)}
                                aria-label={t("open_video")}
                            >
                                <img className="gal-featuredThumb" src={featured.thumb} alt={t("featured_video")} loading="lazy" />
                                <div className="gal-featuredOverlay" aria-hidden="true">
                                    <div className="gal-featuredPlay">▶</div>
                                </div>
                            </button>
                        )}

                        <div className="gal-rowScroller">
                            <div className="gal-rowOutside">
                                {others.map((v) => (
                                    <button
                                        key={v.id}
                                        type="button"
                                        className="gal-rowCard"
                                        onClick={() => openVidModal(v)}
                                        aria-label={t("open_video")}
                                    >
                                        <div className="gal-rowThumbWrap">
                                            <img className="gal-rowThumb" src={v.thumb} alt={t("video_thumbnail")} loading="lazy" />
                                            <div className="gal-rowPlay" aria-hidden="true">
                                                ▶
                                            </div>
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
                            aria-label={t("visit_youtube")}
                        >
                            <YouTubeIcon className="gal-ytSvg" />
                            <span className="gal-ytText">{t("see_more_youtube")}</span>
                            <span className="gal-ytArrow" aria-hidden="true">
                                →
                            </span>
                        </a>
                    </div>
                </div>
            </section>

            {imgOpen && activeImg && (
                <div className="gal-overlay" onClick={closeImgModal}>
                    <div className="gal-modal" onClick={(e) => e.stopPropagation()}>
                        <button className="gal-close" onClick={closeImgModal} aria-label={t("close")}>
                            ×
                        </button>
                        <img className="gal-modalImg" src={activeImg.src} alt={t(activeImg.altKey)} />
                    </div>
                </div>
            )}

            {vidOpen && activeVid && (
                <div className="gal-overlay gal-overlay--center" onClick={closeVidModal}>
                    <div className="gal-modal gal-modal--video" onClick={(e) => e.stopPropagation()}>
                        <button className="gal-close" onClick={closeVidModal} aria-label={t("close")}>
                            ×
                        </button>
                        <div className="gal-videoFrameWrap">
                            <iframe
                                className="gal-videoFrame"
                                src={`https://www.youtube-nocookie.com/embed/${activeVid.id}?autoplay=1&rel=0`}
                                title={t("youtube_player")}
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