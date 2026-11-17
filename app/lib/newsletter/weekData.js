// Rassemble tout ce que la newsletter d'une semaine doit dire, SERVEUR UNIQUEMENT.
//
// Source unique : les mêmes documents Firestore que le site (program_overrides
// de la semaine et events), passés par le même calcul de statuts
// (weekProgram.js). Rien n'est recopié à la main, donc rien ne peut diverger.

import { getDocument, listDocuments } from "../firestoreRest";
import {
    PROGRAM_SLOTS, DAY_INDEX_BY_SLOT, addDaysUTC, buildDateMeta, computeProgramCards, formatRange,
    isoDateOf, mondayOfWeekKey, normalizeActivityTitle, normalizeWeekOverride, EMPTY_OVERRIDE,
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
 */
export async function loadWeek(weekKey) {
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
    const rows = cards.filter((c) => c.status !== "movedFrom").flatMap((c) => {
        const own = cardRow(c);
        if (!c.displacedBase) return [own];
        return [own, {
            key: `${c.key}-base`, dayIndex: own.dayIndex, status: "cancelled", title: c.displacedBase.title,
            times: c.displacedBase.timeLabels, note: "", eventId: "", alsoEventIds: [], inSummary: true,
        }];
    });

    function cardRow(c) {
        const dayIndex = DAY_INDEX_BY_SLOT[c.id];
        const eventId = c.replacementEventId && c.status === "event" ? c.replacementEventId : (c.additionEventId || "");
        let note = c.adminNote;
        if (!note && c.status === "movedFrom" && c.moveTargetId) {
            const d = DAY_INDEX_BY_SLOT[c.moveTargetId];
            note = `Mutat ${DAY_NAMES[d].toLowerCase()}, ${dayMonth(addDaysUTC(monday, d))}`;
        } else if (!note && c.status === "moved" && c.moveSourceId) {
            const d = DAY_INDEX_BY_SLOT[c.moveSourceId];
            note = [`Mutat de ${DAY_NAMES[d].toLowerCase()}`, c.replacesNote].filter(Boolean).join(", ");
        } else if (!note && (c.status === "event" || c.status === "changed")) {
            note = c.replacesNote;
        } else if (!note && c.status === "normal") {
            note = SLOT_HINTS[c.id] || "";
        }
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
            status: "extra",
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
            groups.set(gk, { key: gk, title: ev.title, description: "", image: "", place: "", eventIds: [], occurrences: [] });
        }
        const g = groups.get(gk);
        if (!g.eventIds.includes(ev.id)) g.eventIds.push(ev.id);
        if (!g.description && ev.description) g.description = ev.description;
        if (!g.image && ev.image) g.image = absoluteImage(ev.image);
        if (!g.place && ev.place && !/bethel/i.test(ev.place)) g.place = ev.place;
        let occ = g.occurrences.find((o) => o.dayIndex === r.dayIndex);
        if (!occ) {
            occ = { dayIndex: r.dayIndex, date: addDaysUTC(monday, r.dayIndex), times: [], untilNote: "" };
            g.occurrences.push(occ);
        }
        r.times.forEach((x) => { if (!occ.times.includes(x)) occ.times.push(x); });
        if (r.until) occ.untilNote = r.until;
    });
    const eventGroups = [...groups.values()].map((g) => ({
        ...g,
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
    };
}
