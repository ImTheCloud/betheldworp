import "./globals.css";
import VisitTracker from "./components/VisitTracker";
import LanguageProvider from "./components/LanguageProvider";
import { cookies, headers } from "next/headers";

const SITE_TITLE = "Bethel Dworp";
const COOKIE = "bethel_lang";
const SUPPORTED = ["ro", "fr", "nl", "en"];

export const metadata = {
    title: SITE_TITLE,
    description: "Biserica Betel Dworp – Comunitate creștină penticostală",
    icons: { icon: "/icon.png" },
};

function normalizeLang(v) {
    const base = String(v || "").toLowerCase().split("-")[0];
    return SUPPORTED.includes(base) ? base : null;
}

function pickFromAcceptLanguagePrimaryOnly(al) {
    const firstToken = String(al || "").split(",")[0]?.trim() || "";
    const langPart = firstToken.split(";")[0]?.trim() || "";
    return normalizeLang(langPart);
}

async function getInitialLang() {
    const ck = await cookies();
    const c = ck.get(COOKIE)?.value;
    const fromCookie = normalizeLang(c);
    if (fromCookie) return fromCookie;

    const hd = await headers();
    const al = hd.get("accept-language");
    const fromHeader = pickFromAcceptLanguagePrimaryOnly(al);

    return fromHeader || "ro";
}

export default async function RootLayout({ children }) {
    const lang = await getInitialLang();

    return (
        <html lang={lang} suppressHydrationWarning>
        <head>
            <title>{SITE_TITLE}</title>
            <link
                rel="preload"
                as="image"
                href="/images/drone.jpg"
                fetchPriority="high"
            />
        </head>
        <body>
        <LanguageProvider initialLang={lang}>
            <VisitTracker />
            {children}
        </LanguageProvider>
        </body>
        </html>
    );
}