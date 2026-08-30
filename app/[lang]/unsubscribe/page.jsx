"use client";

import { useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../lib/Firebase";

export default function UnsubscribePage() {
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState("idle");
    const [message, setMessage] = useState("");

    const handleUnsubscribe = async (e) => {
        e.preventDefault();
        const cleanEmail = email.trim().toLowerCase();
        
        if (!cleanEmail) {
            setMessage("Vă rugăm să introduceți o adresă de e-mail validă.");
            return;
        }
        
        setStatus("loading");
        
        try {
            const ref = doc(db, "newsletter", cleanEmail);
            const snap = await getDoc(ref);
            
            if (snap.exists()) {
                await setDoc(ref, { unsubscribed: true, updatedAt: new Date() }, { merge: true });

                // Send ntfy notification
                try {
                    const topic = "bethel_churches_notifications_f93k2n8";
                    const notifyUrl = `https://ntfy.sh/${topic}?title=${encodeURIComponent("Dezabonare Newsletter")}&priority=default&tags=email,warning`;
                    fetch(notifyUrl, {
                        method: 'POST',
                        body: `E-mailul ${cleanEmail} s-a dezabonat.`
                    }).catch(err => console.error("ntfy error:", err));
                } catch (notifyErr) {
                    console.error("Failed to send notification:", notifyErr);
                }

                setStatus("success");
                setMessage("V-ați dezabonat cu succes.");
            } else {
                setStatus("error");
                setMessage("Această adresă de e-mail nu este abonată la newsletter.");
            }
        } catch (error) {
            console.error(error);
            setStatus("error");
            setMessage("A apărut o eroare. Vă rugăm să încercați din nou.");
        }
    };

    return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#f9fafb", padding: "20px" }}>
            <div style={{ maxWidth: "400px", width: "100%", backgroundColor: "#ffffff", padding: "40px 30px", borderRadius: "16px", boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)" }}>
                <div style={{ textAlign: "center", marginBottom: "30px" }}>
                    <h1 style={{ fontSize: "24px", fontWeight: "bold", color: "#111827", margin: "0 0 10px 0" }}>Dezabonare Newsletter</h1>
                    <p style={{ color: "#6b7280", fontSize: "14px", margin: 0 }}>Introduceți adresa de e-mail pentru a vă dezabona de la newsletter-ul nostru.</p>
                </div>

                {status === "success" ? (
                    <div>
                        <div style={{ backgroundColor: "#ecfdf5", color: "#065f46", padding: "16px", borderRadius: "8px", textAlign: "center", fontWeight: "500", marginBottom: "20px" }}>
                            {message}
                        </div>
                        <div style={{ textAlign: "center" }}>
                            <button
                                onClick={async () => {
                                    try {
                                        setStatus("loading");
                                        const ref = doc(db, "newsletter", email.trim().toLowerCase());
                                        await setDoc(ref, { unsubscribed: false, updatedAt: new Date() }, { merge: true });
                                        setStatus("idle");
                                        setEmail("");
                                    } catch (err) {
                                        console.error(err);
                                        setStatus("error");
                                        setMessage("A apărut o eroare la re-abonare.");
                                    }
                                }}
                                style={{
                                    backgroundColor: "transparent",
                                    color: "#4f46e5",
                                    border: "none",
                                    textDecoration: "underline",
                                    cursor: "pointer",
                                    fontSize: "14px",
                                    fontWeight: "500"
                                }}
                            >
                                Anulează dezabonarea (Re-abonare)
                            </button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleUnsubscribe}>
                        <div style={{ marginBottom: "20px" }}>
                            <label htmlFor="email" style={{ display: "block", fontSize: "14px", fontWeight: "500", color: "#374151", marginBottom: "8px" }}>
                                Adresa de e-mail
                            </label>
                            <input 
                                type="email" 
                                id="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                style={{
                                    width: "100%",
                                    padding: "12px",
                                    border: "1px solid #d1d5db",
                                    borderRadius: "8px",
                                    fontSize: "16px",
                                    outline: "none",
                                    boxSizing: "border-box"
                                }}
                                placeholder="adresa@email.com"
                            />
                        </div>
                        
                        {status === "error" && (
                            <div style={{ color: "#dc2626", fontSize: "14px", marginBottom: "16px", textAlign: "center" }}>
                                {message}
                            </div>
                        )}

                        <button 
                            type="submit" 
                            disabled={status === "loading"}
                            style={{
                                width: "100%",
                                backgroundColor: "#ef4444",
                                color: "white",
                                fontWeight: "600",
                                padding: "12px",
                                borderRadius: "8px",
                                border: "none",
                                cursor: status === "loading" ? "not-allowed" : "pointer",
                                opacity: status === "loading" ? 0.7 : 1,
                                fontSize: "16px"
                            }}
                        >
                            {status === "loading" ? "Se procesează..." : "Dezabonare"}
                        </button>
                    </form>
                )}
                
                <div style={{ textAlign: "center", marginTop: "24px" }}>
                    <a href="/" style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "10px 20px",
                        backgroundColor: "#f3f4f6",
                        color: "#374151",
                        fontSize: "14px",
                        fontWeight: "600",
                        textDecoration: "none",
                        borderRadius: "8px",
                        transition: "all 0.2s ease"
                    }}
                    onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = "#e5e7eb";
                        e.currentTarget.style.color = "#111827";
                    }}
                    onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = "#f3f4f6";
                        e.currentTarget.style.color = "#374151";
                    }}
                    >
                        Înapoi la pagina principală
                    </a>
                </div>
            </div>
        </div>
    );
}
