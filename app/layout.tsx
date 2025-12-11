import "./globals.css";

export const metadata = {
    title: "Bethel Dworp",
    description: "Biserica Betel Dworp – Comunitate creștină penticostală",
    icons: {
        icon: "/logo.png",
    },
};

// @ts-ignore
export default function RootLayout({ children }) {
    return (
        <html lang="ro">
        <body>{children}</body>
        </html>
    );
}