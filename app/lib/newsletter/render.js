// Rendu HTML de la newsletter hebdomadaire, SERVEUR UNIQUEMENT.
//
// Reprend le balisage de la dernière newsletter faite à la main
// (Newsletter template/newsletter_2026-11-16.html) : tableaux, styles en
// ligne, palette sombre fournie, et les règles de .agents/skills/newsletter-bethel :
// nom du jour en entier, aucun séparateur, aucun verset, image une seule fois,
// texte de l'événement repris tel que l'admin l'a écrit.
//
// Mobile d'abord : 99 % des lecteurs ouvrent le mail sur un téléphone. Les
// tailles de base sont celles du téléphone, la media query ne réduit jamais
// le texte.

import crypto from "node:crypto";
import { DAY_NAMES, SITE, dayMonth } from "./weekData";

const GREEN = "#16a34a";

export function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// « 20:00-21:30 » → « 20&zwnj;:00 – 21&zwnj;:30 » : le zwnj empêche iOS et
// Gmail de transformer l'heure en lien bleu.
function timeHtml(label) {
    const parts = String(label || "").split("-").map((x) => escapeHtml(x.trim()).replace(/(\d{1,2}):(\d{2})/, "$1&zwnj;:$2"));
    return parts.join(" – ");
}

function timesHtml(labels) {
    return (labels || []).map(timeHtml).join(" și ");
}

function timesText(labels) {
    return (labels || []).map((l) => String(l).split("-").map((x) => x.trim()).join(" – ")).join(" și ");
}

/** Paragraphes d'un texte libre : ligne vide = nouveau paragraphe, retour simple = <br>. */
function paragraphs(text) {
    return String(text || "")
        .replace(/\r\n?/g, "\n")
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => escapeHtml(p).replace(/\n/g, "<br />"));
}

// La newsletter salue déjà (« Pace, dragi frați și surori, ») : la salutation
// par laquelle l'admin commence souvent le texte de l'événement ferait doublon.
function stripGreeting(text) {
    return String(text || "").replace(/^\s*pacea domnului\s*[,!.]*\s*\n/i, "");
}

function capitalizeMonth(s) {
    return String(s).replace(/(\d+ )([a-zăâîșț])/g, (_, d, c) => d + c.toUpperCase());
}

// ── Pastilles de statut, mêmes mots et mêmes couleurs que le site ──

const BADGES = {
    event: { label: "EVENIMENT", cls: "badge-ev", bg: "#dde9fb", border: "#93b4ef", color: "#0f4c8a" },
    moved: { label: "MUTAT", cls: "badge-mut", bg: "#fcf1da", border: "#f0c76a", color: "#92600a" },
    changed: { label: "MODIFICAT", cls: "badge-mut", bg: "#fcf1da", border: "#f0c76a", color: "#92600a" },
    extra: { label: "PROGRAM SPECIAL", cls: "badge-nou", bg: "#dcfce7", border: "#86efac", color: "#15803d" },
    cancelled: { label: "ANULAT", cls: "badge-an", bg: "#fdecec", border: "#f3b4b4", color: "#b91c1c" },
    movedFrom: { label: "ANULAT", cls: "badge-an", bg: "#fdecec", border: "#f3b4b4", color: "#b91c1c" },
};

function badge(status, marginLeft = 6) {
    const b = BADGES[status];
    if (!b) return "";
    return `<span class="${b.cls}" style="display:inline-block;margin-left:${marginLeft}px;padding:2px 8px;border-radius:999px;background-color:${b.bg};border:1px solid ${b.border};color:${b.color};font-size:10px;font-weight:900;letter-spacing:0.6px;line-height:1.4;vertical-align:1px;">${b.label}</span>`;
}

// ── Boîte du jour ──

const CHIPS = {
    n: { cls: "chip-n", bg: "#f1f5f9", border: "#e2e8f0", lbl: "#64748b", num: "#0f172a" },
    s: { cls: "chip-s", bg: "#dcfce7", border: "#86efac", lbl: GREEN, num: GREEN },
    c: { cls: "chip-c", bg: "#fee2e2", border: "#fca5a5", lbl: "#dc2626", num: "#dc2626" },
};

function chipKind(status) {
    if (status === "cancelled" || status === "movedFrom") return "c";
    if (status === "normal") return "n";
    return "s";
}

function dayChip(kind, dayName, dateUTC) {
    const c = CHIPS[kind];
    return `<div class="${c.cls}" style="width:52px;background-color:${c.bg};border:1px solid ${c.border};border-radius:10px;padding:6px 0 5px;text-align:center;">
<div class="${c.cls}-lbl" style="font-size:8px;font-weight:900;color:${c.lbl};letter-spacing:0.2px;line-height:1.1;white-space:nowrap;text-transform:uppercase;">${escapeHtml(dayName.toUpperCase())}</div>
<div class="${c.cls}-num" style="font-size:19px;font-weight:900;color:${c.num};line-height:1.15;padding-top:1px;">${dateUTC.getUTCDate()}</div>
</div>`;
}

function calendarRow(day, row, isLast) {
    const kind = chipKind(row.status);
    const cancelled = kind === "c";
    const border = isLast ? "" : "border-bottom:1px solid #eef2f6;";
    const pad = isLast ? "14px 0 6px" : "14px 0";
    const padText = isLast ? "14px 0 6px 12px" : "14px 0 14px 12px";

    const timeCls = cancelled ? "t-cancel" : kind === "s" ? "t-accent" : "t-head";
    const timeColor = cancelled ? "#dc2626" : kind === "s" ? GREEN : "#0f172a";
    const titleCls = cancelled ? "t-cancel" : "t-head";
    const titleColor = cancelled ? "#dc2626" : "#0f172a";
    const titleWeight = kind === "n" ? 600 : 700;

    const time = row.times.length
        ? `<span class="no-detect" style="color:inherit !important;text-decoration:none !important;">${timesHtml(row.times)}</span>`
        : "";
    const timeLine = (time || (!cancelled && BADGES[row.status]))
        ? `<div class="${timeCls}" style="font-size:13px;font-weight:800;color:${timeColor};letter-spacing:0.3px;">${time}${cancelled ? "" : badge(row.status, time ? 6 : 0)}</div>`
        : "";

    const anulat = cancelled
        ? `<div class="t-cancel" style="font-size:13px;color:#dc2626;font-weight:800;letter-spacing:0.5px;padding-top:2px;">ANULAT</div>`
        : "";
    const note = row.note
        ? `<div class="${cancelled ? "t-cancel" : "t-muted"}" style="font-size:13px;color:${cancelled ? "#dc2626" : "#64748b"};font-weight:${cancelled ? 600 : 400};padding-top:3px;line-height:1.45;">${escapeHtml(row.note)}</div>`
        : "";

    return `<tr>
<td class="rule" width="56" valign="top" style="padding:${pad};${border}">${dayChip(kind, day.name, day.date)}</td>
<td class="rule" valign="top" style="padding:${padText};${border}">
${timeLine}
<div class="${titleCls}" style="font-size:15px;color:${titleColor};font-weight:${titleWeight};line-height:1.45;padding-top:${timeLine ? 2 : 0}px;">${escapeHtml(row.title)}</div>
${anulat}${note}
</td>
</tr>`;
}

// Un jour sans aucun créneau (pause d'été qui n'est pas affichée, par exemple)
// reste dans le calendrier : « tous les jours sont gardés ».
function emptyDayRow(day, isLast) {
    const border = isLast ? "" : "border-bottom:1px solid #eef2f6;";
    return `<tr>
<td class="rule" width="56" valign="top" style="padding:14px 0;${border}">${dayChip("n", day.name, day.date)}</td>
<td class="rule t-muted" valign="middle" style="padding:14px 0 14px 12px;${border}font-size:14px;color:#64748b;">Niciun program</td>
</tr>`;
}

function calendarHtml(days) {
    const all = [];
    days.forEach((day) => {
        if (!day.rows.length) all.push({ day, row: null });
        day.rows.forEach((row) => all.push({ day, row }));
    });
    return all.map(({ day, row }, i) => {
        const isLast = i === all.length - 1;
        return row ? calendarRow(day, row, isLast) : emptyDayRow(day, isLast);
    }).join("\n");
}

// ── Résumé des changements (annulations, déplacements, modifications) ──

function changesHtml(changes, days) {
    if (!changes.length) return "";
    const items = changes.map((r) => {
        const day = days[r.dayIndex];
        const label = `${day.name}, ${dayMonth(day.date)}`;
        return `<tr><td style="padding:7px 0;font-family:Arial,Helvetica,sans-serif;">
<div class="t-head" style="font-size:14px;color:#0f172a;line-height:1.5;">${badge(r.status, 0)} <b>${escapeHtml(label)}</b></div>
<div class="t-body" style="font-size:15px;color:#475569;line-height:1.5;padding-top:2px;">${escapeHtml(r.title)}${r.note ? `<br /><span class="t-muted" style="font-size:13px;color:#64748b;">${escapeHtml(r.note)}</span>` : ""}</div>
</td></tr>`;
    }).join("\n");
    return `<tr>
<td class="px" style="padding:22px 32px 0;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" class="box-info" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;background-color:#fffbeb;border:1px solid #fde68a;border-radius:12px;">
<tr><td style="padding:14px 16px 8px;">
<div class="t-info-title" style="font-size:15px;font-weight:900;color:#0f172a;padding-bottom:4px;">Schimbări în această săptămână</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${items}</table>
</td></tr>
</table>
</td>
</tr>`;
}

// ── Événements ──

function occurrenceLine(o) {
    const when = `${DAY_NAMES[o.dayIndex]}, ${capitalizeMonth(dayMonth(o.date))}`;
    const times = o.times.length
        ? `, <span class="no-detect" style="color:inherit !important;text-decoration:none !important;">${timesHtml(o.times)}</span>`
        : "";
    const until = o.untilNote ? `<br />${escapeHtml(o.untilNote)}` : "";
    return `${escapeHtml(when)}${times}${until}`;
}

function occurrencesHtml(group) {
    const lines = group.occurrences.map(occurrenceLine);
    if (group.place) lines.push(escapeHtml(group.place));
    return lines.join("<br />");
}

function bodyParagraphs(list, firstPadTop = 0) {
    return list.map((p, i) =>
        `<div class="t-body" style="font-size:15px;line-height:1.7;color:#475569;${i || firstPadTop ? `padding-top:${i ? 12 : firstPadTop}px;` : ""}">${p}</div>`
    ).join("\n");
}

function imageRow(src, alt) {
    if (!src) return "";
    return `<tr>
<td style="padding:0;"><img src="${escapeHtml(src)}" width="640" alt="${escapeHtml(alt)}" style="display:block;width:100%;max-width:640px;height:auto;border:0;" /></td>
</tr>`;
}

function secondaryEventHtml(group) {
    const img = group.image
        ? `<div style="padding-top:16px;"><img class="img-round" src="${escapeHtml(group.image)}" width="576" alt="${escapeHtml(group.title)}" style="display:block;width:100%;max-width:576px;height:auto;border:0;border-radius:12px;" /></div>`
        : "";
    const text = paragraphs(stripGreeting(group.description));
    return `<tr>
<td class="px" style="padding:34px 32px 0;font-family:Arial,Helvetica,sans-serif;">
<div class="rule" style="border-top:1px solid #e2e8f0;padding-top:30px;">
<div class="t-accent" style="font-size:11px;font-weight:900;color:${GREEN};letter-spacing:1.5px;text-transform:uppercase;">Tot în această săptămână</div>
<div class="h2 t-head" style="font-size:21px;font-weight:900;color:#0f172a;padding-top:5px;line-height:1.3;">${escapeHtml(group.title)}</div>
<div class="t-accent" style="font-size:13px;font-weight:800;color:${GREEN};padding-top:4px;line-height:1.6;">${occurrencesHtml(group)}</div>
${img}
${text.length ? `<div style="padding-top:14px;">${bodyParagraphs(text)}</div>` : ""}
</div>
</td>
</tr>`;
}

// ── Texte d'aperçu et objet ──

function daysPhrase(group) {
    const names = [...new Set(group.occurrences.map((o) => DAY_NAMES[o.dayIndex].toLowerCase()))];
    if (names.length <= 1) return names[0] || "";
    return `${names.slice(0, -1).join(", ")} și ${names[names.length - 1]}`;
}

export function defaultSubject(week, headline) {
    const base = `Programul săptămânii (${week.range})`;
    return headline ? `${base} ${headline.title}` : base;
}

export function defaultPreheader(week, headline) {
    const parts = [];
    if (headline) parts.push(`${headline.title}, ${daysPhrase(headline)}.`);
    if (week.changes.length) parts.push("Atenție la schimbările din program.");
    parts.push(`Programul complet al bisericii Bethel Dworp, ${week.range}.`);
    return parts.join(" ");
}

/** Le groupe d'événements mis en tête : celui choisi dans l'admin, sinon le premier avec une photo. */
export function pickHeadline(week, headlineKey) {
    if (headlineKey === "none") return null;
    const groups = week.eventGroups;
    return groups.find((g) => g.key === headlineKey) || groups.find((g) => g.image) || groups[0] || null;
}

const CSS = `
:root{color-scheme:light dark;supported-color-schemes:light dark;}
a[x-apple-data-detectors],a[href^="x-apple-data-detectors"],[x-apple-data-detectors],.x-apple-data-detectors,.x-apple-data-detectors *,span.MsoHyperlink,span.MsoHyperlinkFollowed{color:inherit !important;text-decoration:none !important;font-size:inherit !important;font-family:inherit !important;font-weight:inherit !important;line-height:inherit !important;}
.no-detect,.no-detect a,.no-detect span{color:inherit !important;text-decoration:none !important;}
.t-head .no-detect,.t-head a{color:inherit !important;text-decoration:none !important;}
.t-accent,.t-accent .no-detect,.t-accent a,.t-accent a:link,.t-accent a:visited{color:#16a34a !important;text-decoration:none !important;}
.t-muted a,.t-muted a:link,.t-muted a:visited{color:#64748b !important;text-decoration:none !important;}
.t-cancel,.t-cancel .no-detect,.t-cancel a,.t-cancel a:link,.t-cancel a:visited{color:#dc2626 !important;text-decoration:none !important;}
@media only screen and (max-width:600px){
.px{padding-left:16px !important;padding-right:16px !important;}
.hdr-pad{padding:16px !important;}
.logo-img{width:48px !important;height:48px !important;}
.logo-cell{width:64px !important;}
.h1{font-size:22px !important;}
.h2{font-size:19px !important;}
.cta{display:block !important;padding:15px 18px !important;}
}
@media (prefers-color-scheme: dark){
.bg-page,.bg-card,.bg-header{background-color:#141414 !important;}
.bg-banner{background-color:#15803d !important;}
.t-head,.t-head .no-detect,.t-head a{color:#f1f5f9 !important;}
.t-body{color:#b6c2d4 !important;}
.t-muted{color:#8a97a8 !important;}
.t-accent,.t-accent .no-detect,.t-accent a,.t-accent a:link,.t-accent a:visited{color:#4ade80 !important;}
.t-cancel,.t-cancel .no-detect,.t-cancel a,.t-cancel a:link,.t-cancel a:visited{color:#f87171 !important;}
.rule{border-color:#2e2e2e !important;}
.chip-n{background-color:#2a2a2a !important;border-color:#3e3e3e !important;color:#cbd5e1 !important;}
.chip-n-lbl{color:#94a3b8 !important;}
.chip-n-num{color:#f1f5f9 !important;}
.chip-s{background-color:#0f2918 !important;border:1px solid #4ade80 !important;color:#4ade80 !important;}
.chip-s-lbl,.chip-s-num{color:#4ade80 !important;}
.chip-c{background-color:#361010 !important;border:1px solid #f87171 !important;color:#f87171 !important;}
.chip-c-lbl,.chip-c-num{color:#f87171 !important;}
.badge-nou{background-color:#0f2918 !important;border:1px solid #4ade80 !important;color:#4ade80 !important;}
.badge-ev{background-color:#0c2340 !important;border:1px solid #60a5fa !important;color:#93c5fd !important;}
.badge-mut{background-color:#2e2306 !important;border:1px solid #fbbf24 !important;color:#fcd34d !important;}
.badge-an{background-color:#361010 !important;border:1px solid #f87171 !important;color:#fca5a5 !important;}
.box-info{background-color:#1f1a0a !important;border-color:#5c4a14 !important;}
.t-info-title{color:#f8fafc !important;}
.box-msg{background-color:#0f2918 !important;border-color:#1f5130 !important;}
.cta{background-color:#4ade80 !important;color:#052e16 !important;}
.img-round{border:1px solid #2e2e2e !important;}
.logo-box,.logo-box td,.logo-img,.logo-bg{background-color:#ffffff !important;background:#ffffff !important;background-image:linear-gradient(#ffffff,#ffffff) !important;}
}
[data-ogsc] .logo-box,[data-ogsc] .logo-box td,[data-ogsc] .logo-img,[data-ogsb] .logo-box,[data-ogsb] .logo-box td,[data-ogsb] .logo-img{background-color:#ffffff !important;background:#ffffff !important;background-image:linear-gradient(#ffffff,#ffffff) !important;}
[data-ogsc] .t-head,[data-ogsc] .t-head .no-detect,[data-ogsb] .t-head,[data-ogsb] .t-head .no-detect{color:#f1f5f9 !important;}
[data-ogsc] .t-accent,[data-ogsc] .t-accent a,[data-ogsc] .t-accent .no-detect,[data-ogsb] .t-accent,[data-ogsb] .t-accent a,[data-ogsb] .t-accent .no-detect{color:#4ade80 !important;}
[data-ogsc] .t-cancel,[data-ogsc] .t-cancel a,[data-ogsc] .t-cancel .no-detect,[data-ogsb] .t-cancel,[data-ogsb] .t-cancel a,[data-ogsb] .t-cancel .no-detect{color:#f87171 !important;}
[data-ogsc] .chip-n,[data-ogsb] .chip-n{background-color:#2a2a2a !important;border-color:#3e3e3e !important;color:#cbd5e1 !important;}
[data-ogsc] .chip-n-lbl,[data-ogsb] .chip-n-lbl{color:#94a3b8 !important;}
[data-ogsc] .chip-n-num,[data-ogsb] .chip-n-num{color:#f1f5f9 !important;}
[data-ogsc] .chip-s,[data-ogsb] .chip-s,[data-ogsc] .badge-nou,[data-ogsb] .badge-nou{background-color:#0f2918 !important;border:1px solid #4ade80 !important;color:#4ade80 !important;}
[data-ogsc] .chip-s-lbl,[data-ogsc] .chip-s-num,[data-ogsb] .chip-s-lbl,[data-ogsb] .chip-s-num{color:#4ade80 !important;}
[data-ogsc] .chip-c,[data-ogsb] .chip-c,[data-ogsc] .badge-an,[data-ogsb] .badge-an{background-color:#361010 !important;border:1px solid #f87171 !important;color:#f87171 !important;}
[data-ogsc] .chip-c-lbl,[data-ogsc] .chip-c-num,[data-ogsb] .chip-c-lbl,[data-ogsb] .chip-c-num{color:#f87171 !important;}
[data-ogsc] .badge-ev,[data-ogsb] .badge-ev{background-color:#0c2340 !important;border:1px solid #60a5fa !important;color:#93c5fd !important;}
[data-ogsc] .badge-mut,[data-ogsb] .badge-mut{background-color:#2e2306 !important;border:1px solid #fbbf24 !important;color:#fcd34d !important;}
[data-ogsc] .box-info,[data-ogsb] .box-info{background-color:#1f1a0a !important;border-color:#5c4a14 !important;}
[data-ogsc] .box-msg,[data-ogsb] .box-msg{background-color:#0f2918 !important;border-color:#1f5130 !important;}
`;

/**
 * La newsletter complète d'une semaine.
 * @param week     résultat de loadWeek
 * @param options  { message, headlineKey, subject, preheader }
 */
export function renderNewsletter(week, options = {}) {
    const headline = pickHeadline(week, options.headlineKey);
    const others = week.eventGroups.filter((g) => g !== headline);
    const subject = String(options.subject || "").trim() || defaultSubject(week, headline);
    const preheader = String(options.preheader || "").trim() || defaultPreheader(week, headline);
    const message = paragraphs(options.message);

    const bannerRange = capitalizeMonth(`${week.range} ${week.year}`);
    const heroImage = headline?.image || `${SITE}/images/landing_page/drone.jpg`;
    const heroAlt = headline ? headline.title : "Biserica Bethel Dworp";

    let introText = [];
    if (headline) {
        introText = paragraphs(stripGreeting(headline.description));
    }
    if (!headline || !introText.length) {
        introText.push(escapeHtml("Vă transmitem mai jos programul complet al acestei săptămâni."));
    }
    if (week.summer) {
        introText.push(escapeHtml("Suntem în programul de vară: ne întâlnim la seara de rugăciune de vineri și la serviciile divine de duminică. Celelalte programe din timpul săptămânii sunt anulate."));
    }

    const messageBox = message.length
        ? `<table role="presentation" class="box-msg" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;margin-top:18px;">
<tr><td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;">${bodyParagraphs(message)}</td></tr>
</table>`
        : "";

    const headTitle = headline ? headline.title : "Programul săptămânii";
    const headDate = headline
        ? `<div class="t-accent" style="font-size:13px;font-weight:800;color:${GREEN};padding-bottom:18px;line-height:1.6;">${occurrencesHtml(headline)}</div>`
        : `<div style="height:14px;line-height:14px;font-size:0;">&nbsp;</div>`;

    // Après le texte d'aperçu, des espaces invisibles empêchent Gmail et Apple
    // Mail de compléter l'aperçu avec le début du corps du message.
    const preheaderPad = "&#847;&zwnj;&nbsp;".repeat(60);

    const html = `<!doctype html>
<html lang="ro">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<meta name="format-detection" content="telephone=no,date=no,address=no,email=no,url=no" />
<title>${escapeHtml(`Programul Săptămânii, Bethel Dworp (${bannerRange})`)}</title>
<style>${CSS}</style>
</head>
<body class="bg-page" style="margin:0;padding:0;background-color:#ffffff;-webkit-text-size-adjust:100%;text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${escapeHtml(preheader)}${preheaderPad}</div>
<table role="presentation" class="bg-page" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background-color:#ffffff;">
<tr>
<td align="center" style="padding:0;">
<table role="presentation" class="bg-card" width="640" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:640px;background-color:#ffffff;">

<!-- 1. EN-TÊTE -->
<tr>
<td class="hdr-pad bg-header" style="background-color:#ffffff;padding:20px 24px;">
<table role="presentation" cellpadding="0" cellspacing="0" align="left">
<tr>
<td class="logo-cell" style="width:64px;" valign="middle">
<a href="${SITE}/" style="text-decoration:none;display:inline-block;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="logo-box" style="border-collapse:separate;border-radius:12px;border:1px solid #e2e8f0;">
<tr><td style="padding:0;line-height:0;font-size:0;border-radius:12px;"><img class="logo-img" src="${SITE}/apple-icon.png" width="48" height="48" alt="Bethel Dworp" style="display:block;width:48px;height:48px;border-radius:11px;border:0;" /></td></tr>
</table>
</a>
</td>
<td style="padding-left:12px;font-family:Arial,Helvetica,sans-serif;">
<div class="t-head" style="color:#0f172a;font-size:16px;font-weight:800;line-height:1.25;">Bethel Dworp</div>
<div class="t-muted" style="color:#64748b;font-size:12px;line-height:1.25;padding-top:3px;">Programul Săptămânii</div>
<div style="line-height:1.25;padding-top:3px;"><a class="t-accent" href="${SITE}/" style="color:${GREEN};font-size:12px;font-weight:800;text-decoration:none;font-family:Arial,Helvetica,sans-serif;white-space:nowrap;">www.betheldworp.be</a></div>
</td>
</tr>
</table>
</td>
</tr>

<!-- 2. SEMAINE -->
<tr>
<td class="bg-banner" style="background-color:${GREEN};padding:11px 20px;font-family:Arial,Helvetica,sans-serif;text-align:center;">
<div style="color:#ffffff;font-size:13px;font-weight:800;letter-spacing:0.5px;">${escapeHtml(bannerRange)}</div>
</td>
</tr>

<!-- 3. IMAGE PRINCIPALE -->
${imageRow(heroImage, heroAlt)}

<!-- 4. EN TÊTE -->
<tr>
<td class="px" style="padding:30px 32px 0;font-family:Arial,Helvetica,sans-serif;">
<div class="h1 t-head" style="font-size:23px;font-weight:900;color:#0f172a;line-height:1.3;padding-bottom:4px;">${escapeHtml(headTitle)}</div>
${headDate}
<div class="t-head" style="font-size:16px;font-weight:800;color:#0f172a;line-height:1.4;padding-bottom:10px;">Pace, dragi frați și surori,</div>
${bodyParagraphs(introText)}
${messageBox}
</td>
</tr>

<!-- 5. CALENDRIER -->
<tr>
<td class="px" style="padding:34px 32px 0;font-family:Arial,Helvetica,sans-serif;">
<div class="rule" style="border-top:1px solid #e2e8f0;padding-top:30px;">
<div class="t-accent" style="font-size:11px;font-weight:900;color:${GREEN};letter-spacing:1.5px;text-transform:uppercase;">Calendar</div>
<div class="h2 t-head" style="font-size:21px;font-weight:900;color:#0f172a;padding-top:5px;line-height:1.3;">Programul Săptămânii</div>
</div>
</td>
</tr>
${changesHtml(week.changes, week.days)}
<tr>
<td class="px" style="padding:14px 32px 0;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
${calendarHtml(week.days)}
</table>
</td>
</tr>

<!-- 6. AUTRES ÉVÉNEMENTS -->
${others.map(secondaryEventHtml).join("\n")}

<!-- 7. BOUTON -->
<tr>
<td class="px" align="center" style="padding:36px 32px 0;font-family:Arial,Helvetica,sans-serif;">
<a class="cta" href="${SITE}/ro#evenimente" style="display:inline-block;background-color:#0f172a;color:#ffffff;text-decoration:none;font-weight:800;font-size:15px;padding:14px 28px;border-radius:12px;font-family:Arial,Helvetica,sans-serif;text-align:center;">Vezi toate evenimentele pe site</a>
</td>
</tr>

<!-- 8. SALUT FINAL -->
<tr>
<td class="px" style="padding:32px 32px 30px;font-family:Arial,Helvetica,sans-serif;">
<div class="rule t-body" style="border-top:1px solid #e2e8f0;padding-top:26px;font-size:15px;line-height:1.7;color:#475569;">Vă dorim o săptămână binecuvântată și vă așteptăm cu drag la toate programele bisericii!</div>
<div class="t-head" style="font-size:15px;font-weight:900;color:#0f172a;padding-top:14px;">Echipa Bethel Dworp</div>
<div style="padding-top:4px;"><a class="t-accent" href="${SITE}/" style="color:${GREEN};text-decoration:none;font-weight:700;font-size:14px;">www.betheldworp.be</a></div>
</td>
</tr>
</table>

<!-- 9. MENTIONS ET DÉSABONNEMENT (Brevo refuse une campagne sans {{ unsubscribe }}) -->
<table role="presentation" class="bg-card" width="640" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:640px;background-color:#ffffff;">
<tr>
<td class="px" style="padding:22px 24px 28px;font-family:Arial,Helvetica,sans-serif;text-align:center;">
<div class="t-muted" style="font-size:13px;color:#64748b;line-height:1.7;">Primiți acest email deoarece faceți parte din Newsletter-ul Bisericii Bethel Dworp.</div>
<div style="padding-top:8px;"><a class="t-muted" href="{{ unsubscribe }}" style="display:inline-block;padding:10px 16px;font-size:13px;color:#64748b;text-decoration:underline;font-family:Arial,Helvetica,sans-serif;">Dezabonare</a></div>
<div class="t-muted" style="font-size:11px;color:#94a3b8;padding-top:8px;">© ${week.year} Bethel Dworp</div>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;

    // Empreinte du contenu généré à partir des données, hors objet et message :
    // elle dit si le programme a changé depuis un envoi.
    const contentHash = crypto.createHash("sha256")
        .update(JSON.stringify({ days: week.days, groups: week.eventGroups.map((g) => [g.title, g.description, g.image, g.occurrences]) }))
        .digest("hex")
        .slice(0, 16);

    return {
        html,
        subject,
        preheader,
        contentHash,
        headlineKey: headline?.key || "none",
        headlineOptions: week.eventGroups.map((g) => ({ key: g.key, title: g.title, hasImage: !!g.image })),
        images: [heroImage, ...others.map((g) => g.image).filter(Boolean)],
    };
}

export { timesText };
