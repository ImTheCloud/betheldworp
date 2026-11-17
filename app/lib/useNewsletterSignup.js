"use client";

// Logique d'inscription commune à la section Newsletter et au pied de page.
// Les deux formulaires n'affichent pas la même chose, mais l'enchaînement est
// identique : suggestion discrète en cas de faute de frappe, refus d'un
// domaine qui ne reçoit pas de courrier, écriture Firestore, réplique Brevo.

import { useEffect, useState } from "react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./Firebase";
import { isValidEmail, normalizeEmail } from "./validation";
import { domainAcceptsMail, suggestEmail } from "./emailCheck";

function syncBrevo(email, source) {
    // Un échec ici ne doit pas faire échouer l'abonnement : Firestore reste
    // la source de vérité, et le bouton « Sync Brevo » de l'admin rattrape.
    fetch("/api/newsletter/subscribe", {
        method: "POST",
        keepalive: true,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, source }),
    }).catch((e) => console.error("Brevo sync error:", e));
}

// error : null | { code: "invalid" | "domain" | "failed", domain? }
// status : null | "created" | "already"
export function useNewsletterSignup(source) {
    const [email, setEmailState] = useState("");
    const [sending, setSending] = useState(false);
    const [status, setStatus] = useState(null);
    const [subscribedEmail, setSubscribedEmail] = useState("");
    const [error, setError] = useState(null);
    const [suggestion, setSuggestion] = useState(null);

    // La ligne « Ai vrut să scrii …? » apparaît quand la personne marque une
    // pause en tapant, ou quitte le champ. Elle reste une simple aide : le
    // bouton d'inscription n'est jamais bloqué, l'adresse tapée fait foi.
    useEffect(() => {
        const timer = setTimeout(() => setSuggestion(suggestEmail(email)), 800);
        return () => clearTimeout(timer);
    }, [email]);

    const setEmail = (value) => {
        setEmailState(value);
        setSuggestion(null);
        setError(null);
    };

    const onBlur = () => setSuggestion(suggestEmail(email));

    const subscribe = async (raw) => {
        setError(null);

        const em = normalizeEmail(raw);
        if (!isValidEmail(em)) {
            setError({ code: "invalid" });
            return;
        }

        setSending(true);
        try {
            if (!(await domainAcceptsMail(em))) {
                setError({ code: "domain", domain: em.slice(em.lastIndexOf("@") + 1) });
                return;
            }

            const docRef = doc(db, "newsletter", em);
            const snapshot = await getDoc(docRef);

            if (snapshot.exists()) {
                // L'adresse est connue, mais elle a pu être mise en blocklist chez
                // Brevo par une désinscription faite depuis un e-mail. Redonner son
                // adresse vaut demande de retour : la route lève le blocage, et ne
                // fait rien si le contact est déjà joignable.
                syncBrevo(em, source);
                setSubscribedEmail(em);
                setStatus("already");
                return;
            }

            await setDoc(docRef, { email: em, subscribedAt: serverTimestamp(), source });
            syncBrevo(em, source);

            setSubscribedEmail(em);
            setStatus("created");
            setEmailState("");
        } catch (err) {
            console.error("Error subscribing:", err);
            setError({ code: "failed" });
        } finally {
            setSending(false);
        }
    };

    const onSubmit = (e) => {
        e.preventDefault();
        if (sending) return;
        subscribe(email);
    };

    // Un appui sur l'adresse proposée corrige le champ, sans inscrire : la
    // personne voit la correction et appuie elle-même sur « Abonează-te ».
    const applySuggestion = () => {
        if (!suggestion || sending) return;
        setEmailState(suggestion);
        setSuggestion(null);
        setError(null);
    };

    return {
        email, setEmail, onBlur, sending, status, subscribedEmail, error, suggestion,
        onSubmit, applySuggestion,
    };
}
