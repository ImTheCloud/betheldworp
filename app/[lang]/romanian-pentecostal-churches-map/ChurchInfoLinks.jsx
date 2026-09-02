import { ensureExternalLink } from "./mapHelpers";

// Les liens d'une eglise : site, telephone, itineraire, reseaux. Affiche a
// deux endroits, dans la fiche laterale et dans la feuille du bas, d'ou son
// extraction.
const ChurchInfoLinks = ({ church, t }) => {
    if (!church) return null;

    return (
        <div className="churchDetailsInfoList">
            <div className={`churchDetailsInfoItem ${!church.phone ? "not-provided" : ""}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <rect width="24" height="24" rx="5" fill="#10B981" />
                    <g transform="translate(4.5, 4.5) scale(0.625)" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </g>
                </svg>
                {church.phone ? (
                    <a href={`tel:${church.phone}`}>{church.phone}</a>
                ) : (
                    <span>{t("phone")} {t("notSpecified")}</span>
                )}
            </div>

            <div className={`churchDetailsInfoItem ${!church.email ? "not-provided" : ""}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <rect width="24" height="24" rx="5" fill="#3B82F6" />
                    <g transform="translate(4.5, 4.5) scale(0.625)" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                    </g>
                </svg>
                {church.email ? (
                    <a href={`mailto:${church.email}`}>{church.email}</a>
                ) : (
                    <span>{t("email")} {t("notSpecified")}</span>
                )}
            </div>

            <div className={`churchDetailsInfoItem ${!church.website ? "not-provided" : ""}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <rect width="24" height="24" rx="5" fill="#8B5CF6" />
                    <g transform="translate(4.5, 4.5) scale(0.625)" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="2" y1="12" x2="22" y2="12" />
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </g>
                </svg>
                {church.website ? (
                    <a href={ensureExternalLink(church.website)} target="_blank" rel="noopener noreferrer">
                        {t("website")}
                    </a>
                ) : (
                    <span>{t("website")} {t("notSpecified")}</span>
                )}
            </div>

            <div className={`churchDetailsInfoItem youtubeItem ${!church.youtube ? "not-provided" : ""}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#FF0000">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
                {church.youtube ? (
                    <a href={ensureExternalLink(church.youtube)} target="_blank" rel="noopener noreferrer">
                        YouTube
                    </a>
                ) : (
                    <span>YouTube {t("notSpecified")}</span>
                )}
            </div>

            <div className={`churchDetailsInfoItem facebookItem ${!church.facebook ? "not-provided" : ""}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
                {church.facebook ? (
                    <a href={ensureExternalLink(church.facebook)} target="_blank" rel="noopener noreferrer">
                        Facebook
                    </a>
                ) : (
                    <span>Facebook {t("notSpecified")}</span>
                )}
            </div>

            <div className={`churchDetailsInfoItem instagramItem ${!church.instagram ? "not-provided" : ""}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <defs>
                        <linearGradient id="shared-ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#f09433" />
                            <stop offset="25%" stopColor="#e6683c" />
                            <stop offset="50%" stopColor="#dc2743" />
                            <stop offset="75%" stopColor="#cc2366" />
                            <stop offset="100%" stopColor="#bc1888" />
                        </linearGradient>
                    </defs>
                    <rect width="24" height="24" rx="5" fill="url(#shared-ig-grad)" />
                    <g transform="translate(4.5, 4.5) scale(0.625)" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
                        <rect x="2" y="2" width="20" height="20" rx="5" />
                        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                    </g>
                </svg>
                {church.instagram ? (
                    <a href={ensureExternalLink(church.instagram)} target="_blank" rel="noopener noreferrer">
                        Instagram
                    </a>
                ) : (
                    <span>Instagram {t("notSpecified")}</span>
                )}
            </div>
        </div>
    );
};

export default ChurchInfoLinks;
