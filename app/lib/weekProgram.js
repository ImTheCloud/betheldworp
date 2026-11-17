// Calcul du programme d'une semaine, partagé par le site (WeeklyProgram.jsx)
// et par la newsletter générée côté serveur.
//
// Les deux doivent dire exactement la même chose : un créneau « Anulat » sur
// le site doit l'être aussi dans l'e-mail. C'est pourquoi la déduction des
// statuts vit ici, sans React ni Firestore, et qu'aucun des deux ne la refait
// de son côté.

import { isSlotOnSummerBreak } from "./programSchedule";

/** Créneaux du programme hebdomadaire, dans l'ordre d'affichage. */
export const PROGRAM_SLOTS = [
    { id: "mon", dayIndex: 0, times: ["20:00-21:30"] },
    { id: "tue_fast", dayIndex: 1, times: ["10:00-14:00"] },
    { id: "tue", dayIndex: 1, times: ["20:00-21:30"] },
    { id: "tue_orch", dayIndex: 1, times: ["20:00-21:30"] },
    { id: "wed", dayIndex: 2, times: ["20:00-21:30"] },
    { id: "thu", dayIndex: 3, times: ["20:00-21:30"] },
    { id: "fri", dayIndex: 4, times: ["20:00-21:30"] },
    { id: "sat", dayIndex: 5, times: ["11:00-13:30"] },
    { id: "sun_am", dayIndex: 6, times: ["10:00-12:00"] },
    { id: "sun_pm", dayIndex: 6, times: ["18:00-20:00"] },
];

export const DAY_INDEX_BY_SLOT = Object.fromEntries(PROGRAM_SLOTS.map((s) => [s.id, s.dayIndex]));

const DAY_MS = 24 * 60 * 60 * 1000;

const safeArr = (v) => (Array.isArray(v) ? v : []);
const safeStr = (v) => String(v ?? "");
const safeObj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});

export function normalizeActivityTitle(str) {
    return safeStr(str)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

export function pickByLang(value, lang) {
    if (!value) return "";
    if (typeof value === "string") return String(value || "").trim();
    if (typeof value === "object") {
        const v = value?.[lang] ?? value?.ro ?? value?.en ?? "";
        return String(v || "").trim();
    }
    return "";
}

// ── Dates (toujours à l'heure de Bruxelles, ancrées à midi UTC) ──

export function addDaysUTC(date, days) {
    return new Date(date.getTime() + days * DAY_MS);
}

export function getBrusselsYMD(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Brussels",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date);

    let yy = 0, mm = 0, dd = 0;
    parts.forEach((p) => {
        if (p.type === "year") yy = Number(p.value);
        if (p.type === "month") mm = Number(p.value);
        if (p.type === "day") dd = Number(p.value);
    });
    return { yy, mm, dd };
}

/** Lundi et dimanche de la semaine qui contient `date`, à midi UTC. */
export function getBrusselsWeekRange(date = new Date()) {
    const { yy, mm, dd } = getBrusselsYMD(date);
    const noonUTC = new Date(Date.UTC(yy, mm - 1, dd, 12, 0, 0));
    const dow = noonUTC.getUTCDay();
    const mondayIndex = (dow + 6) % 7;
    const start = addDaysUTC(noonUTC, -mondayIndex);
    const end = addDaysUTC(start, 6);
    return { start, end };
}

export function getISOWeekYearAndNumberUTC(dateUTC) {
    const d = new Date(Date.UTC(dateUTC.getUTCFullYear(), dateUTC.getUTCMonth(), dateUTC.getUTCDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const isoYear = d.getUTCFullYear();
    const yearStart = new Date(Date.UTC(isoYear, 0, 1));
    const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return { isoYear, week };
}

/** Clé de la semaine telle que l'admin l'écrit dans program_overrides, ex. « 2026-W48 ». */
export function weekKeyOf(mondayUTC) {
    const { isoYear, week } = getISOWeekYearAndNumberUTC(mondayUTC);
    return `${String(isoYear).padStart(4, "0")}-W${String(week).padStart(2, "0")}`;
}

/** Lundi (midi UTC) d'une clé « 2026-W48 ». */
export function mondayOfWeekKey(weekKey) {
    const m = safeStr(weekKey).trim().toUpperCase().match(/^(\d{4})-W(\d{2})$/);
    if (!m) return null;
    const year = Number(m[1]);
    const week = Number(m[2]);
    if (week < 1 || week > 53) return null;
    // Le 4 janvier est toujours dans la semaine 1.
    const jan4 = new Date(Date.UTC(year, 0, 4, 12, 0, 0));
    const jan4Dow = jan4.getUTCDay() || 7;
    const monday = addDaysUTC(jan4, 1 - jan4Dow + (week - 1) * 7);
    return weekKeyOf(monday) === `${m[1]}-W${m[2]}` ? monday : null;
}

/** « 2026-11-23 » pour une date à midi UTC. */
export function isoDateOf(dateUTC) {
    return dateUTC.toISOString().slice(0, 10);
}

function formatTimeToken(token) {
    const t = safeStr(token).trim();
    const m = t.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return t;
    return `${String(Number(m[1]))}:${m[2]}`;
}

/** « 20:00 - 21:30 » → « 20:00-21:30 ». Les plages séparées par « & » restent séparées. */
export function formatRange(range) {
    const raw = safeStr(range).trim().replace(/\s+/g, "");
    const [start, end] = raw.split("-");
    if (!start || !end) return safeStr(range);
    return `${formatTimeToken(start)}-${formatTimeToken(end)}`;
}

function rangeMinutes(label) {
    const m = safeStr(label).match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
    if (!m) return null;
    return [Number(m[1]) * 60 + Number(m[2]), Number(m[3]) * 60 + Number(m[4])];
}

/** Vrai si une des plages de `a` recouvre une des plages de `b` (ou si une heure manque). */
function timesOverlap(a, b) {
    const ra = a.map(rangeMinutes), rb = b.map(rangeMinutes);
    if (ra.some((r) => !r) || rb.some((r) => !r) || !ra.length || !rb.length) return true;
    return ra.some(([s1, e1]) => rb.some(([s2, e2]) => s1 < e2 && s2 < e1));
}

function formatBrusselsParts(dateObj) {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Brussels", day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(dateObj);
    let dd = "00", mm = "00", yy = "0000";
    parts.forEach((p) => {
        if (p.type === "day") dd = p.value;
        if (p.type === "month") mm = p.value;
        if (p.type === "year") yy = p.value;
    });
    return { dd, mm, yy };
}

/** Pour chaque créneau : sa date (jj/mm, jj/mm/aaaa) et s'il tombe dans la pause d'été. */
export function buildDateMeta(weekStartUTC) {
    const byId = {};
    PROGRAM_SLOTS.forEach(({ id, dayIndex }) => {
        const d = addDaysUTC(weekStartUTC, dayIndex);
        const { dd, mm, yy } = formatBrusselsParts(d);
        byId[id] = { date: d, dm: `${dd}/${mm}`, full: `${dd}/${mm}/${yy}`, summerBreak: isSlotOnSummerBreak(id, d) };
    });
    return byId;
}

/** Forme stable d'un document program_overrides. */
export function normalizeWeekOverride(docId, data) {
    const weekKey = safeStr(data?.weekKey || docId).trim().toUpperCase();
    return {
        weekKey,
        cancelledSet: new Set(safeArr(data?.affectedProgramIds).map((v) => safeStr(v).trim()).filter(Boolean)),
        replacements: safeObj(data?.replacements),
        additions: safeObj(data?.additions),
        // Autres événements pendant le même programme : { sun_am: ["id"] }.
        alsoEvents: safeObj(data?.alsoEvents),
        customTitles: safeObj(data?.customTitles),
        customTimes: safeObj(data?.customTimes),
        notes: safeObj(data?.notes),
    };
}

export const EMPTY_OVERRIDE = normalizeWeekOverride("", {});

/**
 * Toutes les cartes d'une semaine, avec leur statut.
 *
 *   "normal"     programme habituel
 *   "cancelled"  Anulat     créneau annulé, rien ne le remplace ailleurs
 *   "movedFrom"  Anulat     créneau annulé dont l'activité a lieu un autre jour
 *   "moved"      Mutat      titre manuel qui reprend l'activité d'un créneau annulé
 *   "changed"    Modificat  titre ou heure changés à la main, sans déplacement
 *   "event"      Eveniment  créneau remplacé par un événement
 *   "extra"      Program special  réunion en plus du programme habituel
 *
 * @param items      [{ id, day, times, title }] dans la langue affichée
 * @param override   résultat de normalizeWeekOverride
 * @param eventsMap  Map id → { title, time } dans la langue affichée
 * @param t          traduction (clés de WeeklyProgram.json)
 * @param lang       langue affichée
 * @param roTitles   titres roumains par créneau, ex. { mon: "Seară de Tineret…" }
 */
export function computeProgramCards({ items, dateMetaById, override, eventsMap, t, lang, roTitles = {} }) {
    const { cancelledSet, replacements, additions, customTitles, customTimes, notes } = override || EMPTY_OVERRIDE;
    const alsoEvents = (override || EMPTY_OVERRIDE).alsoEvents || {};
    const lowerDay = (d) => (lang === "en" ? d : d.toLowerCase());

    const baseCards = items.map((item, idx) => {
        const id = safeStr(item?.id || `day-${idx}`).trim();
        const replacementEventId = safeStr(replacements[id]).trim();
        const replacementEvent = replacementEventId ? eventsMap.get(replacementEventId) : null;
        const isBrokenOverride = replacementEventId && !replacementEvent;
        const customTitle = pickByLang(customTitles?.[id], lang);
        const customTime = safeStr(customTimes?.[id]).trim();
        return {
            item,
            id,
            day: safeStr(item?.day).trim(),
            replacementEventId,
            replacementEvent,
            isReplaced: !!replacementEvent,
            isSummerBreak: !!dateMetaById?.[id]?.summerBreak,
            isOverrideCancelled: cancelledSet.has(id) && !isBrokenOverride,
            customTitle,
            customTime,
            isManual: customTitle !== "" || customTime !== "",
            // Titre habituel dans la langue affichée et en roumain : l'admin ne
            // remplit parfois que le titre roumain.
            defaultTitles: [item?.title, roTitles[id]].map(normalizeActivityTitle).filter(Boolean),
        };
    });

    // Déplacements : un créneau annulé (ni remplacé, ni modifié) dont l'activité
    // habituelle réapparaît, en titre manuel, sur un autre créneau de la semaine.
    // Ex. le post annulé mardi et écrit à la main mercredi.
    const movedFromById = {};
    const movedToById = {};
    baseCards.forEach((target) => {
        if (!target.customTitle || target.isReplaced) return;
        const wanted = normalizeActivityTitle(target.customTitle);
        const source = baseCards.find((c) =>
            c.id !== target.id &&
            c.isOverrideCancelled && !c.isReplaced && !c.isManual &&
            !movedToById[c.id] &&
            c.defaultTitles.includes(wanted)
        );
        if (!source) return;
        movedFromById[target.id] = source;
        movedToById[source.id] = target;
    });

    const cards = [];
    baseCards.forEach((c) => {
        const { item, id, day, replacementEventId, replacementEvent, isReplaced, isSummerBreak, isOverrideCancelled, customTitle, customTime, isManual } = c;
        const moveSource = movedFromById[id];
        const moveTarget = movedToById[id];

        let status = "normal";
        if (moveTarget) status = "movedFrom";
        else if (moveSource) status = "moved";
        // Un événement posé sur plusieurs créneaux du même jour (dimanche matin et
        // soir) reçoit de l'admin une heure par créneau : ce n'est pas une
        // modification manuelle, la carte reste un événement. Seul un titre écrit
        // à la main en fait un « Modificat ».
        else if (isReplaced && !customTitle) status = "event";
        else if (isManual) status = "changed";
        else if (isOverrideCancelled || isSummerBreak) status = "cancelled";

        const statusLabel = {
            changed: t("status_replaced"),
            event: t("status_event"),
            cancelled: t("status_cancelled"),
            moved: t("status_moved"),
            // Le jour de départ est d'abord annulé : la note dit où l'activité part.
            movedFrom: t("status_cancelled"),
        }[status] || "";
        const isCancelled = status === "cancelled" || status === "movedFrom";

        // La note saisie dans l'admin passe avant la note automatique.
        const adminNote = pickByLang(notes?.[id], lang);
        const autoNote = moveTarget
            ? t("move_to").replace("{day}", lowerDay(moveTarget.day))
            : moveSource
                ? t("move_from").replace("{day}", lowerDay(moveSource.day))
                : "";
        const note = adminNote || autoNote;

        const dm = safeStr(dateMetaById?.[id]?.dm || "");
        const full = safeStr(dateMetaById?.[id]?.full || "");

        const title = customTitle || (isReplaced ? replacementEvent.title : item?.title);
        const displayTime = isReplaced && replacementEvent.time ? replacementEvent.time : null;
        const cleanedTimes = safeArr(item?.times).map((x) => safeStr(x).trim()).filter(Boolean);
        const timeLabels = customTime
            ? [formatRange(customTime)]
            : (isReplaced && displayTime ? [formatRange(displayTime)] : cleanedTimes.map(formatRange));

        // Ce que la modification fait disparaître du créneau, pour le résumé :
        // lundi, le cor bărbătesc prend la place de la soirée des jeunes.
        // Un événement, lui, ne remplace rien : l'invité vient pendant le programme
        // habituel (« în cadrul programului: Seară de rugăciune »).
        // Une activité écrite sur un créneau annulé, à une heure qui ne recouvre
        // pas l'activité habituelle, ne la « remplace » pas : le créneau habituel
        // est simplement annulé (9 nov 2026 : le jeûne déplacé au mercredi matin,
        // le cor mixte du mercredi soir annulé).
        const displaced = (status === "moved" || status === "changed") && title !== item?.title &&
            cancelledSet.has(id) && !timesOverlap(timeLabels, cleanedTimes.map(formatRange));
        const replacesNote = title !== item?.title && !displaced
            ? status === "event"
                ? t("during").replace("{title}", item?.title || "")
                : (status === "moved" || status === "changed")
                    ? t("replaces").replace("{title}", item?.title || "")
                    : ""
            : "";

        // Résumé : un déplacement tient en une seule ligne, sur le jour d'arrivée
        // (« Zi de post și mijlocire, de marți pe miercuri »).
        let summaryNote = "";
        if (status === "moved") {
            summaryNote = [
                t("move_summary").replace("{from}", lowerDay(moveSource.day)).replace("{to}", lowerDay(day)),
                replacesNote,
            ].filter(Boolean).join(", ");
        } else {
            summaryNote = [adminNote, replacesNote].filter(Boolean).join(", ");
        }

        // Activité à une autre heure que le programme habituel annulé : deux
        // cartes. Si elle vient d'un autre jour, elle reste un déplacement ;
        // sinon, c'est un ajout. Le programme habituel reste annulé.
        if (displaced) {
            cards.push({
                key: `${id}-added`, id, day, title, baseTitle: item?.title || "", note, adminNote,
                status: status === "moved" ? "moved" : "extra",
                statusLabel: status === "moved" ? statusLabel : t("status_addition"), timeLabels, dm, full,
                summaryNote: status === "moved"
                    ? t("move_summary").replace("{from}", lowerDay(moveSource.day)).replace("{to}", lowerDay(day))
                    : adminNote,
                isCancelled: false, isManual: true, isReplaced: false, replacementEventId: "", replacesNote: "",
                alsoEventIds: [], movedIn: status === "moved",
                moveSourceId: moveSource?.id || "", moveTargetId: "", inSummary: true,
            });
            cards.push({
                key: id, id, day, title: item?.title || "", baseTitle: item?.title || "", note: "", adminNote: "",
                status: "cancelled", statusLabel: t("status_cancelled"), timeLabels: cleanedTimes.map(formatRange),
                dm, full, summaryNote: "", isCancelled: true, isManual: false, isReplaced: false,
                replacementEventId: "", replacesNote: "", alsoEventIds: [], moveSourceId: "", moveTargetId: "",
                inSummary: true,
            });
            const extraId = safeStr(additions[id]).trim();
            if (!extraId || !eventsMap.get(extraId)) return;
        }

        if (!displaced) cards.push({
            key: id, id, day, title, baseTitle: item?.title || "", note, adminNote, status, statusLabel,
            timeLabels, dm, full, summaryNote, isCancelled, isManual, isReplaced, replacementEventId,
            replacesNote,
            // Autres événements du même programme (alsoEvents) : jamais de carte
            // à eux dans le programme de la semaine, la carte du créneau garde
            // l'événement principal. La newsletter s'en sert pour les annoncer.
            alsoEventIds: safeArr(alsoEvents[id]).map((v) => safeStr(v).trim()).filter((v) => v && v !== replacementEventId && eventsMap.has(v)),
            moveSourceId: moveSource?.id || "", moveTargetId: moveTarget?.id || "",
            inSummary: status === "changed" || status === "event" || status === "moved" ||
                (status === "cancelled" && isOverrideCancelled),
        });

        const additionEventId = safeStr(additions[id]).trim();
        const additionEvent = additionEventId ? eventsMap.get(additionEventId) : null;
        if (additionEvent) {
            cards.push({
                key: `${id}-extra`,
                id,
                day,
                title: additionEvent.title,
                baseTitle: "",
                note: "",
                adminNote: "",
                summaryNote: "",
                status: "extra",
                statusLabel: t("status_addition"),
                timeLabels: additionEvent.time ? [formatRange(additionEvent.time)] : [],
                dm,
                full,
                isCancelled: false,
                isManual: false,
                isReplaced: false,
                additionEventId,
                replacesNote: "",
                inSummary: true,
            });
        }
    });

    // Le résumé reprend les cartes à signaler, et, juste sous l'événement
    // principal d'un créneau, les autres événements du même programme
    // (alsoEvents). Ceux-ci n'ont pas de carte : la grille garde une carte
    // par créneau, le résumé dit tout ce qui se passe.
    const changes = [];
    cards.forEach((c) => {
        if (c.inSummary) changes.push(c);
        (c.alsoEventIds || []).forEach((alsoId) => {
            const ev = eventsMap.get(alsoId);
            if (!ev) return;
            const during = c.baseTitle ? t("during").replace("{title}", c.baseTitle) : "";
            changes.push({
                key: `${c.key}-also-${alsoId}`,
                id: c.id,
                day: c.day,
                title: ev.title,
                status: "event",
                statusLabel: t("status_event"),
                summaryNote: during,
                eventId: alsoId,
                inSummary: true,
            });
        });
    });

    // Le titre du résumé dit ce qu'il contient : des événements seuls ne sont pas
    // des « changements ».
    const hasEventsOnly = changes.length > 0 && changes.every((c) => c.status === "event" || c.status === "extra");
    const hasNoEvents = changes.every((c) => c.status !== "event" && c.status !== "extra");
    const changesTitle = hasEventsOnly ? t("events_title") : hasNoEvents ? t("changes_title") : t("changes_events_title");

    return { cards, changes, changesTitle };
}
