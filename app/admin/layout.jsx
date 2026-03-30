export const metadata = {
    robots: { index: false, follow: false },
};

export default function AdminLayout({ children }) {
    return (
        <html lang="en">
            <body>
                {children}
            </body>
        </html>
    );
}


