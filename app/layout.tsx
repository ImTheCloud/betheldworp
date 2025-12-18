import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import VisitTracker from "./components/VisitTracker";

const SITE_TITLE = "Bethel Dworp";

export const metadata: Metadata = {
    title: SITE_TITLE,
    description: "Biserica Betel Dworp – Comunitate creștină penticostală",
    icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
    return (
        <html lang="ro">
        <head>
            <title>{SITE_TITLE}</title>
            <link rel="preload" as="image" href="/images/drone.jpg" fetchPriority="high" />
        </head>
        <body>
        <VisitTracker />
        {children}
        </body>
        </html>
    );
}