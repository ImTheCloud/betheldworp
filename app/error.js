"use client";

export default function Error({ reset }) {
    return (
        <div
            style={{
                minHeight: "100vh",
                padding: 24,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#f6f7fb",
            }}
        >
            <div
                style={{
                    width: "100%",
                    maxWidth: 560,
                    background: "#fff",
                    borderRadius: 18,
                    padding: 22,
                    boxShadow: "0 12px 34px rgba(0,0,0,0.08)",
                    border: "1px solid rgba(0,0,0,0.06)",
                }}
            >
                <div note="" style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div
                        aria-hidden="true"
                        style={{
                            width: 42,
                            height: 42,
                            borderRadius: 14,
                            display: "grid",
                            placeItems: "center",
                            background: "rgba(31, 102, 255, 0.12)",
                            color: "#1f66ff",
                            fontWeight: 900,
                            fontSize: 18,
                            flexShrink: 0,
                        }}
                    >
                        !
                    </div>

                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 6, color: "#0f172a" }}>
                            Une erreur est survenue
                        </div>

                        <div style={{ fontSize: 14, lineHeight: 1.55, color: "#475569" }}>
                            Un problème technique empêche l’affichage correct de la page.
                            <br />
                            Si le problème persiste, contacte-nous :{" "}
                            <a
                                href="mailto:claudiu.dev@outlook.com"
                                style={{ color: "#1f66ff", textDecoration: "none", fontWeight: 800 }}
                            >
                                claudiu.dev@outlook.com
                            </a>
                        </div>
                    </div>
                </div>

                <div style={{ marginTop: 16 }}>
                    <button
                        onClick={() => reset()}
                        style={{
                            cursor: "pointer",
                            padding: "12px 16px",
                            borderRadius: 14,
                            border: "1px solid rgba(31, 102, 255, 0.22)",
                            background: "#1f66ff",
                            color: "#fff",
                            fontWeight: 900,
                            fontSize: 14,
                            boxShadow: "0 10px 20px rgba(31, 102, 255, 0.18)",
                        }}
                    >
                        Recharger
                    </button>
                </div>

                <div style={{ marginTop: 12, fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                    Astuce : essaie un autre navigateur ou désactive temporairement les bloqueurs de contenu.
                    <br />
                    Si tu nous écris, indique l’appareil et le navigateur (ex : iPhone / Safari).
                </div>
            </div>
        </div>
    );
}