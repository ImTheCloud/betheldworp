"use client";

// Logique d'inscription commune à la section Newsletter et au pied de page.
// Les deux formulaires n'affichent pas la même chose, mais l'enchaînement est
// identique : garde-fous contre les fautes de frappe, écriture Firestore, puis
// réplique dans Brevo.

import { useState } from "react";
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

    const setEmail = (value) => {
        setEmailState(value);
        setSuggestion(null);
        setError(null);
    };

    const subscribe = async (raw, { skipSuggestion = false } = {}) => {
        setError(null);
        setSuggestion(null);

        const em = normalizeEmail(raw);
        const proposed = skipSuggestion ? null : suggestEmail(em);
        if (proposed) {
            setSuggestion(proposed);
            return;
        }
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

    // « Ai vrut să scrii …? » → Oui : on corrige le champ et on inscrit.
    const acceptSuggestion = () => {
        if (!suggestion || sending) return;
        const fixed = suggestion;
        setEmailState(fixed);
        subscribe(fixed, { skipSuggestion: true });
    };

    // → Non, l'adresse tapée est la bonne.
    const rejectSuggestion = () => {
        if (sending) return;
        subscribe(email, { skipSuggestion: true });
    };

    return {
        email, setEmail, sending, status, subscribedEmail, error, suggestion,
        onSubmit, acceptSuggestion, rejectSuggestion,
    };
}
