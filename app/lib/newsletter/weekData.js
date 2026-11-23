// Rassemble tout ce que la newsletter d'une semaine doit dire, SERVEUR UNIQUEMENT.
//
// Source unique : les mêmes documents Firestore que le site (program_overrides
// de la semaine et events), passés par le même calcul de statuts
// (weekProgram.js). Rien n'est recopié à la main, donc rien ne peut diverger.

import { getDocument, listDocuments } from "../firestoreRest";
import {
    PROGRAM_SLOTS, DAY_INDEX_BY_SLOT, addDaysUTC, buildDateMeta, computeProgramCards, formatRange,
    isoDateOf, mondayOfWeekKey, normalizeActivityTitle, normalizeWeekOverride, weekKeyOf, EMPTY_OVERRIDE,
} from "../weekProgram";
import { isSummerBreakWeek } from "../programSchedule";
import tr from "../../translations/WeeklyProgram.json";

export const SITE = "https://www.betheldworp.be";

// Noms des jours, en entier, comme dans les newsletters faites à la main.
export const DAY_NAMES = ["Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă", "Duminică"];

export const MONTHS = [
    "ianuarie", "februarie", "martie", "aprilie", "mai", "iunie",
    "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie",
];

// Titres habituels tels que la newsletter les écrit (SKILL newsletter-bethel,
// « Programme standard »). Le site a ses propres libellés, plus courts : ils
// restent connus de computeProgramCards pour reconnaître les déplacements.
const NEWSLETTER_TITLES = {
    mon: "Seară de Tineret și Adolescenți",
    tue_fast: "Zi de post și mijlocire",
    tue: "Seară de rugăciune",
    tue_orch: "Repetiție Orchestră",
    wed: "Repetiția corului mixt",
    thu: "Repetiția corului bărbătesc",
    fri: "Seară de rugăciune",
    sat: "Program cu copiii",
    sun_am: "Serviciu Divin de dimineață",
    sun_pm: "Serviciu Divin de seară",
};

// Précision fixe sous certains créneaux habituels.
const SLOT_HINTS = {
    tue_orch: "La subsol, în timpul serii de rugăciune",
};

const RO = tr.ro;
const t = (key) => RO[key] ?? key;
const RO_SITE_TITLES = Object.fromEntries(PROGRAM_SLOTS.map(({ id }) => [id, RO[`act_${id}`] || ""]));

/** Programme en plus du programme habituel, le même mot que sur la pastille. */
export const SPECIAL_PROGRAM = t("status_addition");

const safeStr = (v) => String(v ?? "");

function pickRo(value) {
    if (!value) return "";
    if (typeof value === "string") return value.trim();
    return safeStr(value.ro || value.en || value.fr || value.nl).trim();
}

/** « /images/events/Ioan Panican.png » → URL absolue, encodée. */
export function absoluteImage(src) {
    const s = safeStr(src).trim();
    if (!s) return "";
    if (/^https?:\/\//i.test(s)) return encodeURI(decodeURI(s));
    return SITE + encodeURI(s.startsWith("/") ? s : `/${s}`);
}

/** « 23 noiembrie » à partir d'une date à midi UTC. */
export function dayMonth(dateUTC) {
    return `${dateUTC.getUTCDate()} ${MONTHS[dateUTC.getUTCMonth()]}`;
}

/** « 23 – 29 noiembrie » ou « 30 noiembrie – 6 decembrie ». */
export function rangeLabel(monday, sunday) {
    if (monday.getUTCMonth() === sunday.getUTCMonth()) {
        return `${monday.getUTCDate()} – ${dayMonth(sunday)}`;
    }
    return `${dayMonth(monday)} – ${dayMonth(sunday)}`;
}

function startMinutes(timeLabel) {
    const m = safeStr(timeLabel).match(/(\d{1,2}):(\d{2})/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : 24 * 60;
}

/** « 10:00 - 12:00 & 18:00 - 20:00 » → ["10:00-12:00", "18:00-20:00"] */
function splitEventTimes(time) {
    return safeStr(time).split(/&|,|\bși\b/).map((x) => x.trim()).filter(Boolean).map(formatRange);
}

function normalizeEvent(id, d) {
    const dateEvent = safeStr(d.dateEvent).trim();
    let endDate = safeStr(d.endDate).trim();
    if (endDate && endDate <= dateEvent) endDate = "";
    const images = Array.isArray(d.images) ? d.images.map((x) => safeStr(x).trim()).filter(Boolean) : [];
    if (!images.length && safeStr(d.image).trim()) images.push(safeStr(d.image).trim());
    return {
        id,
        dateEvent,
        endDate,
        time: safeStr(d.time).trim(),
        title: pickRo(d.title),
        description: pickRo(d.description),
        image: images[0] || "",
        place: safeStr(d.place).trim(),
        address: safeStr(d.address).trim(),
    };
}

/**
 * Tout le contenu d'une semaine.
 * @param weekKey « 2026-W48 »
 * @param withSequel ajoute la suite, la semaine d'après, d'un événement encore
 *                   en cours le dimanche (des invités restés jusqu'à lundi)
 */
export async function loadWeek(weekKey, { withSequel = true } = {}) {
    const monday = mondayOfWeekKey(weekKey);
    if (!monday) throw new Error(`invalid week key: ${weekKey}`);
    const sunday = addDaysUTC(monday, 6);
    const mondayISO = isoDateOf(monday);
    const sundayISO = isoDateOf(sunday);

    const [overrideDoc, eventDocs] = await Promise.all([
        getDocument(`program_overrides/${weekKey}`),
        listDocuments("events"),
    ]);

    const override = overrideDoc ? normalizeWeekOverride(overrideDoc.id, overrideDoc) : EMPTY_OVERRIDE;
    const events = eventDocs.map((d) => normalizeEvent(d.id, d));
    const eventsById = new Map(events.map((e) => [e.id, e]));
    const eventsMap = new Map(events.map((e) => [e.id, { title: e.title, time: e.time }]));

    const items = PROGRAM_SLOTS.map((s) => ({
        id: s.id,
        day: RO[`day_${s.id}`] || RO[`day_${s.id.split("_")[0]}`] || DAY_NAMES[s.dayIndex],
        times: s.times,
        title: NEWSLETTER_TITLES[s.id],
    }));

    const dateMetaById = buildDateMeta(monday);
    const { cards } = computeProgramCards({
        items, dateMetaById, override, eventsMap, t, lang: "ro", roTitles: RO_SITE_TITLES,
    });

    // Événements de la semaine : ceux qu'un créneau désigne, et ceux dont la
    // date tombe dans la semaine sans être rattachés à aucun créneau (un
    // mariage le samedi après-midi, un voyage de la chorale).
    const linkedIds = new Set(cards.flatMap((c) => [c.replacementEventId, c.additionEventId, ...(c.alsoEventIds || [])]).filter(Boolean));
    const standalone = events.filter((e) =>
        e.dateEvent && !linkedIds.has(e.id) &&
        e.dateEvent <= sundayISO && (e.endDate || e.dateEvent) >= mondayISO
    );

    // Lignes du calendrier, jour par jour.
    //
    // Un déplacement n'est montré qu'une fois, le jour d'arrivée (« Mutat de
    // marți ») : la ligne « annulé » du jour de départ ferait doublon dans
    // l'e-mail (choix du 17 nov 2026 ; le site, lui, garde les deux cartes).
    // L'activité habituelle chassée d'un créneau à une autre heure (le cor
    // mixte quand le jeûne passe au mercredi matin) apparaît annulée.
    // Une activité déplacée vers une heure libre reste « Mutat », comme sur le
    // site, avec la note « Mutat de marți ».
    const rows = cards.filter((c) => c.status !== "movedFrom").map(cardRow);

    function cardRow(c) {
        const dayIndex = DAY_INDEX_BY_SLOT[c.id];
        const eventId = c.replacementEventId && c.status === "event" ? c.replacementEventId : (c.additionEventId || "");
        let note = c.adminNote;
        if (!note && c.status === "movedFrom" && c.moveTargetId) {
            const d = DAY_INDEX_BY_SLOT[c.moveTargetId];
            note = `Mutat ${DAY_NAMES[d].toLowerCase()}, ${dayMonth(addDaysUTC(monday, d))}`;
        } else if (!note && (c.status === "moved" || c.movedIn) && c.moveSourceId) {
            const d = DAY_INDEX_BY_SLOT[c.moveSourceId];
            note = [`Mutat de ${DAY_NAMES[d].toLowerCase()}`, c.replacesNote].filter(Boolean).join(", ");
        } else if (!note && (c.status === "event" || c.status === "changed")) {
            note = c.replacesNote;
        } else if (!note && c.status === "normal") {
            note = SLOT_HINTS[c.id] || "";
        }
        // Ce dans quoi l'événement a lieu, pour sa date et sa note.
        const program = c.status === "event" && normalizeActivityTitle(c.baseTitle) !== normalizeActivityTitle(c.title)
            ? c.baseTitle
            : c.status === "extra" ? SPECIAL_PROGRAM : "";
        return {
            key: c.key,
            dayIndex,
            status: c.status,
            title: c.title,
            times: c.timeLabels,
            note: note ? note.charAt(0).toUpperCase() + note.slice(1) : "",
            eventId,
            alsoEventIds: c.alsoEventIds || [],
            inSummary: c.inSummary,
            program,
            // Les autres événements du créneau : sans ligne à eux, ils ne se
            // verraient qu'en bas de l'e-mail.
            alsoTitles: (c.alsoEventIds || []).map((id) => eventsMap.get(id)?.title).filter(Boolean),
            noteIsProgram: c.status === "event" && !!program && !c.adminNote,
        };
    }

    standalone.forEach((e) => {
        const firstISO = e.dateEvent < mondayISO ? mondayISO : e.dateEvent;
        const dayIndex = Math.round((new Date(`${firstISO}T12:00:00Z`) - monday) / 86400000);

        // Un événement qui porte le nom d'un créneau du même jour (la répétition
        // d'orchestre du mardi, créée aussi comme événement) n'ajoute pas de
        // ligne : il donne seulement sa photo et son texte au créneau.
        const wanted = normalizeActivityTitle(e.title);
        const twin = rows.find((r) => r.dayIndex === dayIndex && !r.eventId && r.status !== "cancelled" && r.status !== "movedFrom" &&
            [r.title, RO_SITE_TITLES[r.key]].some((x) => normalizeActivityTitle(x) === wanted));
        if (twin) {
            twin.eventId = e.id;
            return;
        }

        let until = "";
        const lastISO = e.endDate || e.dateEvent;
        if (lastISO > firstISO) {
            const last = new Date(`${lastISO}T12:00:00Z`);
            const lastIndex = Math.round((last - monday) / 86400000);
            until = lastIndex <= 6
                ? `Până ${DAY_NAMES[lastIndex].toLowerCase()}, ${dayMonth(last)}`
                : `Până pe ${dayMonth(last)}`;
        }
        const place = e.place && !/bethel/i.test(e.place) ? e.place : "";
        const note = [until, place].filter(Boolean).join(", ");
        rows.push({
            key: `ev-${e.id}`,
            dayIndex,
            // Un événement sans créneau (voyage de la chorale, mariage) est une
            // annonce, pas un programme : bleu, ANUNȚ.
            status: "event",
            title: e.title,
            times: splitEventTimes(e.time),
            note,
            until,
            eventId: e.id,
            inSummary: true,
        });
    });

    // Ordre du jour : par heure de début, l'ordre des créneaux départageant.
    const days = DAY_NAMES.map((name, i) => {
        const date = addDaysUTC(monday, i);
        const dayRows = rows
            .map((r, order) => ({ r, order }))
            .filter(({ r }) => r.dayIndex === i)
            .sort((a, b) => (startMinutes(a.r.times[0]) - startMinutes(b.r.times[0])) || (a.order - b.order))
            .map(({ r }) => r);
        return { index: i, name, date, iso: isoDateOf(date), rows: dayRows };
    });

    // Événements regroupés par titre : un invité qui vient vendredi et dimanche
    // est un seul événement, annoncé une fois avec ses deux dates.
    const groups = new Map();
    // Les autres événements d'un même programme (alsoEvents) n'ont pas de ligne
    // dans le calendrier, comme sur le site, mais restent annoncés plus bas.
    const announced = rows.flatMap((r) => [
        ...(r.eventId ? [{ r, eventId: r.eventId }] : []),
        ...(r.alsoEventIds || []).map((id) => ({
            r: { ...r, key: `${r.key}-also`, times: splitEventTimes(eventsById.get(id)?.time) },
            eventId: id,
        })),
    ]);
    announced.forEach(({ r, eventId }) => {
        const ev = eventsById.get(eventId);
        if (!ev) return;
        const gk = normalizeActivityTitle(ev.title) || ev.id;
        if (!groups.has(gk)) {
            groups.set(gk, { key: gk, title: ev.title, description: "", descriptions: [], image: "", place: "", eventIds: [], occurrences: [] });
        }
        const g = groups.get(gk);
        if (!g.eventIds.includes(ev.id)) g.eventIds.push(ev.id);
        if (ev.description && !g.descriptions.includes(ev.description)) g.descriptions.push(ev.description);
        if (!g.image && ev.image) g.image = absoluteImage(ev.image);
        if (!g.place && ev.place && !/bethel/i.test(ev.place)) g.place = ev.place;
        let occ = g.occurrences.find((o) => o.dayIndex === r.dayIndex);
        if (!occ) {
            occ = { dayIndex: r.dayIndex, date: addDaysUTC(monday, r.dayIndex), times: [], programs: [], untilNote: "" };
            g.occurrences.push(occ);
        }
        r.times.forEach((x) => { if (!occ.times.includes(x)) occ.times.push(x); });
        if (r.program && !occ.programs.includes(r.program)) occ.programs.push(r.program);
        if (r.until) occ.untilNote = r.until;
    });
    const nextDays = withSequel ? await addSequel([...groups.values()], events, sunday) : [];

    const eventGroups = [...groups.values()].map((g) => ({
        ...g,
        description: mergeDescriptions(g.descriptions),
        occurrences: g.occurrences.sort((a, b) => a.dayIndex - b.dayIndex),
        firstDay: Math.min(...g.occurrences.map((o) => o.dayIndex)),
    })).sort((a, b) => (a.firstDay - b.firstDay) || (Number(!a.image) - Number(!b.image)));

    return {
        weekKey,
        monday,
        sunday,
        range: rangeLabel(monday, sunday),
        year: sunday.getUTCFullYear(),
        summer: isSummerBreakWeek(monday),
        days,
        changes: rows.filter((r) => r.inSummary && ["cancelled", "movedFrom", "moved", "changed"].includes(r.status)),
        eventGroups,
        nextDays,
    };
}

/**
 * La suite d'une visite après le dimanche. Les mêmes invités (même titre) le
 * dimanche puis le lundi, sans jour d'interruption, forment un seul événement :
 * l'e-mail de la semaine annonce aussi le lundi, sinon la newsletter suivante
 * arrive trop tard (30 nov 2026, Matei Trif și Nicu Iurian à la soirée des
 * jeunes). Un événement qui revient une semaine plus tard n'est pas concerné.
 *
 * Complète les groupes et renvoie les jours à ajouter sous le calendrier, avec
 * les seules lignes de ces événements, calculées comme le reste.
 */
async function addSequel(groups, events, sunday) {
    const nextMonday = addDaysUTC(sunday, 1);
    const nextMondayISO = isoDateOf(nextMonday);
    const open = groups.filter((g) =>
        g.occurrences.some((o) => o.dayIndex === 6) &&
        events.some((e) => e.dateEvent === nextMondayISO && normalizeActivityTitle(e.title) === g.key)
    );
    if (!open.length) return [];

    const next = await loadWeek(weekKeyOf(nextMonday), { withSequel: false });
    const nextDays = [];
    open.forEach((g) => {
        const ng = next.eventGroups.find((x) => x.key === g.key);
        if (!ng) return;
        for (let i = 0; i < 7; i++) {
            const occ = ng.occurrences.find((o) => o.dayIndex === i);
            if (!occ) break;
            g.occurrences.push({ ...occ, dayIndex: 7 + i });
            const rows = next.days[i].rows.filter((r) => ng.eventIds.includes(r.eventId));
            if (!rows.length) continue;
            const day = nextDays.find((d) => d.index === i);
            if (day) day.rows.push(...rows);
            else nextDays.push({ ...next.days[i], rows });
        }
        ng.descriptions.forEach((d) => { if (!g.descriptions.includes(d)) g.descriptions.push(d); });
    });
    return nextDays.sort((a, b) => a.index - b.index);
}

/**
 * Un seul texte pour un groupe d'événements (les mêmes invités vendredi,
 * samedi et dimanche). Chaque événement dit son jour (« vineri seara, în seara
 * de rugăciune ») ; l'e-mail les annonce ensemble, dates et heures juste
 * au-dessus. Les paragraphes identiques restent ; dans un paragraphe qui ne
 * diffère que par sa fin, on garde le début commun :
 * « …prin Cuvântul lui Dumnezeu și prin cântare. » (choix du 22 nov 2026).
 * Un texte écrit tout autrement que le premier (la soirée de jeunes du lundi)
 * est laissé de côté, pour ne pas faire perdre la partie commune aux autres.
 */
export function mergeDescriptions(descriptions) {
    const list = (descriptions || []).map((d) => safeStr(d).trim()).filter(Boolean);
    if (list.length <= 1) return list[0] || "";
    const alike = list.filter((d) => commonText([list[0], d]) !== null);
    return commonText(alike) ?? list[0];
}

/** Partie commune de plusieurs textes, ou null s'ils ne se ressemblent pas assez. */
function commonText(list) {
    const all = list.map((d) => d.split(/\n\s*\n/).map((p) => p.trim()));
    if (all.some((ps) => ps.length !== all[0].length)) return null;
    const merged = [];
    for (let i = 0; i < all[0].length; i++) {
        const paras = all.map((ps) => ps[i]);
        if (paras.every((p) => p === paras[0])) {
            merged.push(paras[0]);
            continue;
        }
        const words = paras.map((p) => p.split(/\s+/));
        let n = 0;
        while (words.every((w) => n < w.length && w[n] === words[0][n])) n++;
        // Le début commun doit porter l'essentiel de la phrase.
        if (n < Math.min(...words.map((w) => w.length)) * 0.6) return null;
        const common = words[0].slice(0, n).join(" ").replace(/[\s,;:–-]+$/, "");
        merged.push(/[.!?]$/.test(common) ? common : `${common}.`);
    }
    return merged.join("\n\n");
}
