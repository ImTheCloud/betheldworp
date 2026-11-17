"use client";

// Newsletter de la semaine : aperçu généré à partir du programme et des
// événements, envoi en un appui depuis le téléphone.
//
// Ce qui part est toujours l'aperçu affiché : le serveur regénère le même
// HTML à partir des mêmes données et des mêmes réglages. Le brouillon
// (message, événement en tête, objet) est gardé dans newsletter_issues/{semaine}
// pour être retrouvé sur un autre appareil.

import "./WeeklyNewsletterAdmin.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../lib/Firebase";
import { adminAuthHeaders } from "../utils/churchHelpers";
import { addDaysUTC, getBrusselsWeekRange, mondayOfWeekKey, weekKeyOf } from "../../lib/weekProgram";

const MONTHS = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"];

// Même règle que le serveur (newsletter/build.js) : semaine prochaine du jeudi
// au dimanche, semaine en cours du lundi au mercredi.
function defaultWeekKey() {
    const now = new Date();
    const { start } = getBrusselsWeekRange(now);
    const dow = (now.getDay() + 6) % 7;
    return weekKeyOf(dow >= 3 ? addDaysUTC(start, 7) : start);
}

function weekFromUrl() {
    if (typeof window === "undefined") return null;
    const w = new URLSearchParams(window.location.search).get("week");
    return w && mondayOfWeekKey(w) ? w.toUpperCase() : null;
}

function shiftWeek(weekKey, delta) {
    const monday = mondayOfWeekKey(weekKey);
    return monday ? weekKeyOf(addDaysUTC(monday, delta * 7)) : weekKey;
}

function formatDateTime(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

async function postJson(url, body) {
    const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", ...(await adminAuthHeaders()) },
        body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok && data.ok !== false, status: res.status, data };
}

// Le mode sombre de l'e-mail dépend du téléphone du lecteur, pas de celui de
// l'admin. Pour montrer chaque version quel que soit le réglage de l'appareil,
// les règles « prefers-color-scheme: dark » sont forcées ou neutralisées.
function withScheme(html, dark) {
    return html.replace("@media (prefers-color-scheme: dark){", dark ? "@media all{" : "@media not all{");
}

const ERRORS = {
    sending_disabled: "Trimiterea este dezactivată pe acest server (doar site-ul publicat poate trimite).",
    count_changed: "Numărul de destinatari s-a schimbat între timp. Verifică din nou și confirmă.",
    already_sending: "O trimitere pentru această săptămână este deja în curs.",
    nobody_to_send: "Toți abonații au primit deja newsletter-ul acestei săptămâni.",
    brevo_failed: "Brevo a refuzat trimiterea. Nimic nu a plecat.",
    no_test_email: "Nu există o adresă pentru test.",
    unauthorized: "Sesiunea a expirat. Reconectează-te.",
};

export default function WeeklyNewsletterAdmin({ onDirtyChange }) {
    const [weekKey, setWeekKey] = useState(() => weekFromUrl() || defaultWeekKey());
    const [draft, setDraft] = useState({ message: "", headlineKey: "", subject: "", preheader: "" });
    const [draftLoaded, setDraftLoaded] = useState(false);
    const [preview, setPreview] = useState(null);
    const [previewError, setPreviewError] = useState("");
    const [loadingPreview, setLoadingPreview] = useState(true);
    const [status, setStatus] = useState(null);
    const [statusError, setStatusError] = useState("");
    // Aperçu en mode sombre par défaut : c'est le réglage de la plupart des téléphones.
    const [dark, setDark] = useState(true);
    const [busy, setBusy] = useState("");
    const [toast, setToast] = useState(null);
    const [confirm, setConfirm] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const iframeRef = useRef(null);
    const [frameHeight, setFrameHeight] = useState(900);

    useEffect(() => { onDirtyChange?.(false); }, [onDirtyChange]);

    // Garder la semaine dans l'adresse : le lien de la notification du
    // dimanche (…/admin?week=2026-W48#weekly) ouvre directement la bonne.
    useEffect(() => {
        const url = new URL(window.location.href);
        url.searchParams.set("week", weekKey);
        window.history.replaceState(null, "", url.toString());
    }, [weekKey]);

    // ── Brouillon de la semaine ──
    useEffect(() => {
        let alive = true;
        setDraftLoaded(false);
        getDoc(doc(db, "newsletter_issues", weekKey))
            .then((snap) => {
                if (!alive) return;
                const d = snap.exists() ? snap.data() : {};
                setDraft({
                    message: d.message || "",
                    headlineKey: d.headlineKey || "",
                    subject: d.subject || "",
                    preheader: d.preheader || "",
                });
            })
            .catch((e) => {
                console.error("newsletter_issues read failed:", e);
                if (alive) setDraft({ message: "", headlineKey: "", subject: "", preheader: "" });
            })
            .finally(() => alive && setDraftLoaded(true));
        return () => { alive = false; };
    }, [weekKey]);

    const saveTimer = useRef(null);
    const updateDraft = (field, value) => {
        setDraft((prev) => {
            const next = { ...prev, [field]: value };
            clearTimeout(saveTimer.current);
            saveTimer.current = setTimeout(() => {
                setDoc(doc(db, "newsletter_issues", weekKey), { ...next, weekKey, updatedAt: serverTimestamp() }, { merge: true })
                    .catch((e) => console.error("draft save failed:", e));
            }, 700);
            return next;
        });
    };
    useEffect(() => () => clearTimeout(saveTimer.current), []);

    const options = useMemo(() => ({ week: weekKey, ...draft }), [weekKey, draft]);

    // ── Aperçu (regénéré après chaque modification) ──
    const previewSeq = useRef(0);
    useEffect(() => {
        if (!draftLoaded) return;
        const seq = ++previewSeq.current;
        setLoadingPreview(true);
        const timer = setTimeout(async () => {
            try {
                const { ok, data, status: code } = await postJson("/api/newsletter/weekly/preview", options);
                if (seq !== previewSeq.current) return;
                if (!ok) {
                    setPreviewError(ERRORS[data.error] || `Eroare la generare (${data.error || code}).`);
                    return;
                }
                setPreview(data);
                setPreviewError("");
            } catch {
                if (seq === previewSeq.current) setPreviewError("Eroare de rețea.");
            } finally {
                if (seq === previewSeq.current) setLoadingPreview(false);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [options, draftLoaded]);

    // ── Destinataires et envois déjà faits ──
    const loadStatus = useCallback(async () => {
        setStatusError("");
        try {
            const { ok, data, status: code } = await postJson("/api/newsletter/weekly/status", { week: weekKey });
            if (!ok) {
                setStatusError(ERRORS[data.error] || `Starea nu a putut fi citită (${data.error || code}).`);
                return null;
            }
            setStatus(data);
            return data;
        } catch {
            setStatusError("Eroare de rețea.");
            return null;
        }
    }, [weekKey]);

    useEffect(() => {
        let alive = true;
        // Ancienne semaine effacée tout de suite : jamais de chiffre d'une autre semaine.
        Promise.resolve().then(() => alive && setStatus(null));
        loadStatus();
        return () => { alive = false; };
    }, [loadStatus]);

    const frameDoc = useMemo(() => {
        if (!preview?.html) return "";
        return withScheme(preview.html, dark);
    }, [preview, dark]);

    const onFrameLoad = () => {
        try {
            const h = iframeRef.current?.contentDocument?.documentElement?.scrollHeight;
            if (h) setFrameHeight(h + 8);
        } catch {
            // ignore
        }
    };

    const showToast = (kind, text) => {
        setToast({ kind, text });
        setTimeout(() => setToast(null), 6000);
    };

    const sendTest = async () => {
        if (busy) return;
        setBusy("test");
        try {
            const { ok, data } = await postJson("/api/newsletter/weekly/test", options);
            if (ok) showToast("ok", `Test trimis la ${data.to}.`);
            else showToast("error", ERRORS[data.error] || `Testul nu a plecat (${data.error}).`);
        } catch {
            showToast("error", "Eroare de rețea. Testul nu a plecat.");
        } finally {
            setBusy("");
        }
    };

    const openConfirm = async () => {
        if (busy) return;
        setBusy("check");
        const fresh = await loadStatus();
        setBusy("");
        if (fresh && fresh.recipients > 0) setConfirm(true);
    };

    const sendNow = async () => {
        if (busy || !status) return;
        setBusy("send");
        try {
            const { ok, data } = await postJson("/api/newsletter/weekly/send", {
                ...options,
                confirm: true,
                expectedCount: status.recipients,
            });
            setConfirm(false);
            if (ok) showToast("ok", `Newsletter trimis la ${plural(data.count, "abonat", "abonați")}.`);
            else showToast("error", ERRORS[data.error] || `Nimic nu a plecat (${data.error}).`);
        } catch {
            showToast("error", "Eroare de rețea. Verifică starea înainte de a reîncerca.");
        } finally {
            setBusy("");
            loadStatus();
        }
    };

    const monday = mondayOfWeekKey(weekKey);
    const weekLabel = preview?.weekKey === weekKey ? `${preview.range} ${preview.year}` : (monday ? `Săptămâna ${weekKey.slice(-2)}` : weekKey);
    const sends = status?.sends || [];
    const history = status?.history || [];
    const lastHash = history.length ? history[history.length - 1].contentHash : "";
    const changedSinceSend = sends.length > 0 && preview?.contentHash && lastHash && lastHash !== preview.contentHash;
    const isLate = sends.length > 0;
    const recipients = status?.recipients ?? 0;

    const sendLabel = !status
        ? "Trimite newsletter-ul"
        : recipients === 0
            ? (isLate ? "Toți au primit-o" : "Niciun destinatar")
            : isLate
                ? `Trimite celor ${recipients} noi`
                : "Trimite newsletter-ul";

    return (
        <div className="wn-page">
            <header className="wn-head">
                <h2 className="wn-title">Newsletter săptămânal</h2>
                <div className="wn-week">
                    <button type="button" className="wn-weekBtn" onClick={() => setWeekKey((w) => shiftWeek(w, -1))} aria-label="Săptămâna precedentă">‹</button>
                    <div className="wn-weekText">
                        <div className="wn-weekRange">{weekLabel}</div>
                        <div className="wn-weekKey">{weekKey}{weekKey === defaultWeekKey() && <span className="wn-chip">de trimis</span>}</div>
                    </div>
                    <button type="button" className="wn-weekBtn" onClick={() => setWeekKey((w) => shiftWeek(w, 1))} aria-label="Săptămâna următoare">›</button>
                </div>
            </header>

            {/* ── État ── */}
            <section className="wn-card" aria-live="polite">
                {statusError ? (
                    <p className="wn-error">{statusError}</p>
                ) : !status ? (
                    <p className="wn-muted">Se verifică abonații…</p>
                ) : (
                    <>
                        {sends.length === 0 ? (
                            <p className="wn-status"><span className="wn-dot wn-dot--todo" />Netrimis încă. Ar pleca la <b>{plural(recipients, "abonat", "abonați")}</b>.</p>
                        ) : (
                            <>
                                {sends.map((s) => {
                                    const h = history.find((x) => x.listId === s.listId);
                                    return (
                                        <p key={s.listId} className="wn-status">
                                            <span className="wn-dot wn-dot--done" />
                                            Trimis{h?.at ? ` ${formatDateTime(h.at)}` : ""} la <b>{plural(s.count, "abonat", "abonați")}</b>{sends.length > 1 ? ` (#${s.number})` : ""}.
                                        </p>
                                    );
                                })}
                                <p className="wn-status">
                                    {recipients > 0
                                        ? <><span className="wn-dot wn-dot--todo" /><b>{plural(recipients, "abonat nou nu a", "abonați noi nu au")}</b> primit-o încă.</>
                                        : <><span className="wn-dot wn-dot--done" />Toți abonații activi au primit-o.</>}
                                </p>
                                {changedSinceSend && (
                                    <p className="wn-warn">Programul s-a schimbat de la trimitere. Cei care au primit-o deja nu o vor primi din nou: doar abonații noi primesc versiunea actualizată.</p>
                                )}
                            </>
                        )}
                        {(status.blocked.length > 0 || status.missingInBrevo.length > 0 || status.onlyInBrevo.length > 0) && (
                            <button type="button" className="wn-link" onClick={() => setShowDetails((v) => !v)}>
                                {showDetails ? "Ascunde detaliile" : "Detalii despre abonați"}
                            </button>
                        )}
                        {showDetails && (
                            <div className="wn-details">
                                {status.missingInBrevo.length > 0 && <p><b>Lipsesc din Brevo, vor fi adăugați la trimitere ({status.missingInBrevo.length}):</b> {status.missingInBrevo.join(", ")}</p>}
                                {status.blocked.length > 0 && <p><b>Dezabonați din Brevo, nu primesc nimic ({status.blocked.length}):</b> {status.blocked.join(", ")}</p>}
                                {status.onlyInBrevo.length > 0 && <p><b>În Brevo dar nu activi pe site, nu primesc nimic ({status.onlyInBrevo.length}):</b> {status.onlyInBrevo.join(", ")}</p>}
                            </div>
                        )}
                        {!status.sendingAllowed && (
                            <p className="wn-info">Mod de test: de pe acest server nu pleacă niciun email, nici testul. Trimiterea funcționează doar pe www.betheldworp.be.</p>
                        )}
                    </>
                )}
            </section>

            {preview?.warnings?.length > 0 && (
                <section className="wn-card wn-card--warn">
                    {preview.warnings.map((w) => <p key={w} className="wn-warnLine">{w}</p>)}
                </section>
            )}

            {/* ── Réglages ── */}
            <section className="wn-card wn-fields">
                {preview?.headlineOptions?.length > 0 && (
                    <label className="wn-label">
                        Evenimentul principal
                        <select className="wn-input" value={draft.headlineKey || preview.headlineKey} onChange={(e) => updateDraft("headlineKey", e.target.value)}>
                            {preview.headlineOptions.map((o) => (
                                <option key={o.key} value={o.key}>{o.title}{o.hasImage ? "" : " (fără imagine)"}</option>
                            ))}
                            <option value="none">Niciunul (săptămână obișnuită)</option>
                        </select>
                    </label>
                )}
                <label className="wn-label">
                    Mesajul săptămânii <span className="wn-optional">opțional</span>
                    <textarea
                        className="wn-input wn-textarea"
                        rows={4}
                        value={draft.message}
                        placeholder="Un anunț scurt, afișat sub textul de început. Lasă gol dacă nu e nevoie."
                        onChange={(e) => updateDraft("message", e.target.value)}
                    />
                </label>
                <label className="wn-label">
                    Subiect
                    <input
                        className="wn-input"
                        value={draft.subject}
                        placeholder={preview?.subject || ""}
                        onChange={(e) => updateDraft("subject", e.target.value)}
                    />
                </label>
                <label className="wn-label">
                    Text de previzualizare <span className="wn-optional">vizibil în lista de emailuri</span>
                    <input
                        className="wn-input"
                        value={draft.preheader}
                        placeholder={preview?.preheader || ""}
                        onChange={(e) => updateDraft("preheader", e.target.value)}
                    />
                </label>
            </section>

            {/* ── Aperçu ── */}
            <section className="wn-previewWrap">
                <div className="wn-previewBar">
                    <span className="wn-previewTitle">Previzualizare {loadingPreview && <span className="wn-spinner" aria-label="Se generează" />}</span>
                    <div className="wn-toggle" role="group" aria-label="Mod de afișare">
                        <button type="button" className={!dark ? "is-on" : ""} onClick={() => setDark(false)}>Luminos</button>
                        <button type="button" className={dark ? "is-on" : ""} onClick={() => setDark(true)}>Întunecat</button>
                    </div>
                </div>
                {preview && (
                    <div className="wn-inbox">
                        <div className="wn-inboxFrom">Bethel Dworp</div>
                        <div className="wn-inboxSubject">{preview.subject}</div>
                        <div className="wn-inboxPre">{preview.preheader}</div>
                    </div>
                )}
                {previewError && <p className="wn-error">{previewError}</p>}
                {frameDoc && (
                    <iframe
                        ref={iframeRef}
                        className="wn-frame"
                        title="Previzualizarea newsletter-ului"
                        srcDoc={frameDoc}
                        sandbox="allow-same-origin"
                        onLoad={onFrameLoad}
                        style={{ height: frameHeight, background: dark ? "#141414" : "#fff" }}
                    />
                )}
            </section>

            {/* ── Actions, toujours à portée de pouce ── */}
            <div className="wn-actions">
                <button type="button" className="wn-btn wn-btn--ghost" onClick={sendTest} disabled={!!busy || !preview}>
                    {busy === "test" ? "Se trimite…" : "Trimite test"}
                </button>
                <button type="button" className="wn-btn wn-btn--primary" onClick={openConfirm} disabled={!!busy || !preview || !status || recipients === 0}>
                    {busy === "check" ? "Se verifică…" : sendLabel}
                </button>
            </div>

            {toast && <div className={`wn-toast wn-toast--${toast.kind}`} role="status">{toast.text}</div>}

            {confirm && status && preview && (
                <div className="adminModalOverlay" onClick={() => busy !== "send" && setConfirm(false)}>
                    <div className="adminConfirmModal wn-confirm" role="dialog" aria-modal="true" aria-labelledby="wn-confirm-title" onClick={(e) => e.stopPropagation()}>
                        <div className="adminModalHeader">
                            <h3 id="wn-confirm-title" className="adminModalTitle">{isLate ? "Trimite abonaților noi?" : "Trimite newsletter-ul?"}</h3>
                        </div>
                        <div className="adminModalBody">
                            <dl className="wn-dl">
                                <dt>Subiect</dt><dd>{preview.subject}</dd>
                                <dt>Listă</dt><dd>{status.listName}</dd>
                                <dt>Destinatari</dt>
                                <dd><b>{plural(status.recipients, "abonat", "abonați")}</b>{isLate ? `, care nu au primit-o încă (${status.alreadyReceived} au primit-o deja și nu o vor primi din nou)` : ""}</dd>
                                <dt>Expeditor</dt><dd>Bethel Dworp &lt;info@betheldworp.be&gt;</dd>
                            </dl>
                            <p className="wn-muted">Trimiterea pleacă imediat și nu poate fi anulată.</p>
                        </div>
                        <div className="adminModalFooter">
                            <button type="button" className="adminModalBtn adminModalBtn--cancel" onClick={() => setConfirm(false)} disabled={busy === "send"}>Anulează</button>
                            <button type="button" className="adminModalBtn adminModalBtn--primary" onClick={sendNow} disabled={busy === "send"}>
                                {busy === "send" ? "Se trimite…" : `Trimite la ${status.recipients}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
