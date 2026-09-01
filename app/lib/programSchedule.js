// Shared rules for the recurring weekly program, used by the public site and the admin.

/** Slots that keep running during the summer break; everything else is cancelled. */
export const SUMMER_ACTIVE_SLOT_IDS = new Set(["fri", "sun_am", "sun_pm"]);

/** The summer break covers the weeks of July and August, every year. */
export function isSummerBreakMonth(month) {
    return month === 7 || month === 8;
}

function getBrusselsYMD(dateObj) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Brussels",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(dateObj);

    let yy = 0, mm = 0, dd = 0;
    parts.forEach((p) => {
        if (p.type === "year") yy = Number(p.value);
        if (p.type === "month") mm = Number(p.value);
        if (p.type === "day") dd = Number(p.value);
    });
    return { yy, mm, dd };
}

/**
 * The month a whole week belongs to, decided by its Thursday (the ISO rule).
 * So 31 Aug, 6 Sep counts as September, and 29 Jun, 5 Jul as July.
 */
export function getISOWeekMonth(dateObj) {
    const { yy, mm, dd } = getBrusselsYMD(dateObj);
    const d = new Date(Date.UTC(yy, mm - 1, dd, 12, 0, 0));
    const isoDow = d.getUTCDay() || 7; // Mon=1 … Sun=7
    d.setUTCDate(d.getUTCDate() + (4 - isoDow)); // move to that week's Thursday
    return d.getUTCMonth() + 1;
}

/** True when the whole week containing `dateObj` is a summer-break week. */
export function isSummerBreakWeek(dateObj) {
    return isSummerBreakMonth(getISOWeekMonth(dateObj));
}

/** True when a slot falling on `dateObj` is cancelled by the summer break. */
export function isSlotOnSummerBreak(slotId, dateObj) {
    if (SUMMER_ACTIVE_SLOT_IDS.has(slotId)) return false;
    return isSummerBreakWeek(dateObj);
}

/** Same rule, from a "YYYY-MM-DD" string. */
export function isSlotOnSummerBreakISO(slotId, isoDate) {
    if (SUMMER_ACTIVE_SLOT_IDS.has(slotId)) return false;
    const s = String(isoDate || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    return isSummerBreakWeek(new Date(`${s}T12:00:00Z`));
}
