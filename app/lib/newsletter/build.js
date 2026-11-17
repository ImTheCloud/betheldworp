// Construit la newsletter d'une semaine à partir du corps d'une requête admin.
// Partagé par les routes aperçu, test et envoi : l'e-mail envoyé est
// exactement celui que l'admin a vu dans l'aperçu.

import { loadWeek } from "./weekData";
import { renderNewsletter } from "./render";
import { getBrusselsWeekRange, mondayOfWeekKey, weekKeyOf, addDaysUTC } from "../weekProgram";

const MAX_MESSAGE = 4000;

/**
 * Semaine proposée par défaut : la semaine prochaine du jeudi au dimanche
 * (on prépare l'envoi du week-end), la semaine en cours du lundi au mercredi
 * (l'envoi du dimanche a pu être oublié).
 */
export function defaultWeekKey(now = new Date()) {
    const { start } = getBrusselsWeekRange(now);
    const dow = (now.getUTCDay() + 6) % 7; // lundi = 0
    return weekKeyOf(dow >= 3 ? addDaysUTC(start, 7) : start);
}

export function parseOptions(payload) {
    const weekKey = String(payload?.week || "").trim().toUpperCase() || defaultWeekKey();
    if (!mondayOfWeekKey(weekKey)) return { error: "invalid_week" };
    return {
        weekKey,
        options: {
            message: String(payload?.message || "").slice(0, MAX_MESSAGE),
            headlineKey: String(payload?.headlineKey || "").slice(0, 200),
            subject: String(payload?.subject || "").replace(/[\r\n]+/g, " ").slice(0, 200),
            preheader: String(payload?.preheader || "").replace(/[\r\n]+/g, " ").slice(0, 300),
        },
    };
}

export async function buildNewsletter(payload) {
    const parsed = parseOptions(payload);
    if (parsed.error) return parsed;
    const week = await loadWeek(parsed.weekKey);
    const rendered = renderNewsletter(week, parsed.options);
    return { weekKey: parsed.weekKey, week, rendered };
}

// Une image de plusieurs mégaoctets se charge mal sur un téléphone en 4G et
// alourdit le message au point que certains clients la masquent.
const HEAVY_IMAGE = 600 * 1024;

export async function collectWarnings(week, rendered) {
    const warnings = [];
    await Promise.all(rendered.images.map(async (src) => {
        try {
            const res = await fetch(src, { method: "HEAD", cache: "no-store" });
            if (!res.ok) {
                warnings.push(`Imaginea nu se încarcă (${res.status}): ${decodeURI(src)}`);
                return;
            }
            const size = Number(res.headers.get("content-length") || 0);
            if (size > HEAVY_IMAGE) {
                warnings.push(`Imagine grea (${(size / 1024 / 1024).toFixed(1)} MB), se va încărca greu pe telefon: ${decodeURI(src.split("/").pop())}`);
            }
        } catch {
            warnings.push(`Imaginea nu a putut fi verificată: ${decodeURI(src)}`);
        }
    }));
    week.eventGroups.forEach((g) => {
        if (!g.description) warnings.push(`Evenimentul „${g.title}” nu are text în română.`);
    });

    // Règle de l'église : la Cina Domnului est un jour de jeûne, le programme
    // du soir est toujours annulé. Un oubli dans Program Overrides afficherait
    // le culte du soir comme d'habitude, sur le site et dans l'e-mail.
    week.eventGroups
        .filter((g) => /cina domnului/i.test(g.title))
        .forEach((g) => g.occurrences.forEach((o) => {
            if (o.dayIndex !== 6) return;
            const evening = week.days[6].rows.find((r) => r.key === "sun_pm");
            if (evening && evening.status !== "cancelled" && evening.status !== "movedFrom") {
                warnings.push("Cina Domnului: programul de seară de duminică nu este anulat. Anulează-l în Program Overrides (Sunday PM, Cancelled).");
            }
        }));
    const sundayEnd = addDaysUTC(week.sunday, 1);
    if (sundayEnd < new Date()) warnings.push("Această săptămână s-a încheiat deja.");
    return warnings;
}
