"use client";

import "./StatsAdmin.css";
import { useEffect, useMemo, useState } from "react";
import { collection, collectionGroup, getDocs } from "firebase/firestore";
import { db } from "../../lib/Firebase";

const BOT_ICON = "🤖";
const HUMAN_ICON = "👤";

const SITE_START_KEY = "2025-12-21";

function s(v) {
    return String(v ?? "");
}

function clamp(v, max = 80) {
    const x = s(v).trim();
    return x ? x.slice(0, max) : "Unknown";
}

function normalizeLang(v) {
    const base = s(v).toLowerCase().split("-")[0] || "unknown";
    return (base || "unknown").slice(0, 16);
}

function normalizeDevice(v) {
    const x = s(v).toLowerCase();
    if (x === "mobile" || x === "desktop") return x;
    return "unknown";
}

function languageDisplayName(code) {
    const c = s(code).trim().toLowerCase();
    if (!c || c === "unknown") return "Unknown";

    try {
        const dn = new Intl.DisplayNames(["en"], { type: "language" });
        const name = dn.of(c);
        if (name) return name.charAt(0).toUpperCase() + name.slice(1);
    } catch {
        // ignore
    }

    const map = {
        ro: "Romanian",
        fr: "French",
        en: "English",
        nl: "Dutch",
        de: "German",
        es: "Spanish",
        it: "Italian",
        pt: "Portuguese",
        ar: "Arabic",
        tr: "Turkish",
        ru: "Russian",
        pl: "Polish",
    };

    return map[c] || c.toUpperCase();
}

function formatEnDateFromKey(key) {
    const [yy, mm, dd] = s(key).split("-").map(Number);
    if (!yy || !mm || !dd) return s(key);
    // Format: DD/MM/YYYY
    return `${String(dd).padStart(2, "0")}/${String(mm).padStart(2, "0")}/${yy}`;
}

function sanitizeKey(v) {
    return (
        s(v)
            .trim()
            .toLowerCase()
            .replace(/\./g, "_")
            .replace(/\//g, "_")
            .replace(/\s+/g, "_")
            .replace(/__+/g, "_")
            .slice(0, 80) || "unknown"
    );
}

function unsanitizeKey(str) {
    return s(str)
        .split("_")
        .map((x) => (x ? x.charAt(0).toUpperCase() + x.slice(1) : ""))
        .join(" ");
}

function makeCityKey(country, city) {
    return `${sanitizeKey(country)}__${sanitizeKey(city)}`;
}

function cityLabelWithCountry(k) {
    const parts = s(k).split("__");
    const countryPart = parts[0] || "unknown";
    const cityPart = parts[1] ? parts[1] : parts[0] || "unknown";
    return `${unsanitizeKey(cityPart)}, ${unsanitizeKey(countryPart)}`;
}

function toPercent(count, total) {
    const c = Number(count) || 0;
    const t = Number(total) || 0;
    if (!t) return "0%";
    const p = (c / t) * 100;
    return `${Math.round(p * 10) / 10}%`;
}

function normalizeDayKey(raw) {
    const x = s(raw).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(x)) return x;
    const m = x.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    return "0000-00-00";
}

function brusselsDayKey(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Brussels",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date);

    let y = "0000",
        m = "00",
        d = "00";
    parts.forEach((p) => {
        if (p.type === "year") y = p.value;
        if (p.type === "month") m = p.value;
        if (p.type === "day") d = p.value;
    });
    return `${y}-${m}-${d}`;
}

function buildLastNDaysKeys(n, endKey) {
    const [yy, mm, dd] = s(endKey).split("-").map(Number);
    const end = new Date(yy, (mm || 1) - 1, dd || 1);
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
        const dt = new Date(end);
        dt.setDate(dt.getDate() - i);
        out.push(brusselsDayKey(dt));
    }
    return out;
}

function getDayFromSnap(snap, data) {
    const day = normalizeDayKey(data?.day);
    if (day !== "0000-00-00") return day;

    const path = snap?.ref?.path || "";
    const m = path.match(/visits\/day_(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})\/visitors\//);
    if (m?.[1]) return normalizeDayKey(m[1]);

    return "0000-00-00";
}

function polarToCartesian(cx, cy, r, angleDeg) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx, cy, r, startAngle, endAngle) {
    const start = polarToCartesian(cx, cy, r, endAngle);
    const end = polarToCartesian(cx, cy, r, startAngle);
    const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

function hsl(i) {
    const hue = (i * 47) % 360;
    return `hsl(${hue} 70% 45%)`;
}

function DonutWithLegend({ title, rows, total, search, onSearch, centerLabel, nameLabel }) {
    const base = rows.filter((r) => (Number(r.count) || 0) > 0);

    const q = s(search).trim().toLowerCase();
    const filtered = q ? base.filter((x) => s(x.label).toLowerCase().includes(q)) : base;

    const topN = 10;

    const { slices, segs, colorByKey } = useMemo(() => {
        const colorMap = {};
        base.forEach((r, idx) => {
            colorMap[r.key] = hsl(idx);
        });

        const top = base.slice(0, topN);
        const others = base.slice(topN).reduce((a, r) => a + (Number(r.count) || 0), 0);
        const slicesLocal = others > 0 ? [...top, { key: "__others__", label: "Others", count: others }] : top;

        if (others > 0) colorMap.__others__ = hsl(top.length);

        const cx = 60;
        const cy = 60;
        const r = 46;
        const stroke = 12;

        const denom = Math.max(1, slicesLocal.reduce((a, x) => a + (Number(x.count) || 0), 0));
        let angle = 0;

        const segsLocal = slicesLocal.map((sl, idx) => {
            const pct = (Number(sl.count) || 0) / denom;
            const start = angle;
            const delta = Math.max(0, pct) * 360;

            let end = start + delta;
            angle = end;

            if (idx === slicesLocal.length - 1) end = 360;

            const overlap = 0.8;
            let startAdj = start;
            let endAdj = end;
            if (delta > 0) {
                if (idx !== 0) startAdj = Math.max(0, startAdj - overlap / 2);
                if (idx !== slicesLocal.length - 1) endAdj = Math.min(360, endAdj + overlap / 2);
            }

            return {
                ...sl,
                color: colorMap[sl.key] || hsl(idx),
                stroke,
                path: delta > 0 ? arcPath(cx, cy, r, startAdj, endAdj) : null,
            };
        });

        return { slices: slicesLocal, segs: segsLocal, colorByKey: colorMap };
    }, [base]);

    const isSingleSlice = slices.length === 1 && (Number(slices[0]?.count) || 0) > 0;
    const tooltipTotal = Math.max(1, total);

    return (
        <div className="statsCard">
            <div className="statsCardTop">
                <div className="statsCardTitle">{title}</div>
            </div>

            <div className="statsDonutWrap">
                <div className="statsDonut">
                    <svg viewBox="0 0 120 120" className="statsDonutSvg" role="img" aria-label="Donut Chart">
                        <circle cx="60" cy="60" r="46" className="statsDonutBg" />

                        {isSingleSlice ? (
                            <circle
                                cx="60"
                                cy="60"
                                r="46"
                                className="statsDonutSeg"
                                style={{
                                    stroke: colorByKey[slices[0].key] || hsl(0),
                                    strokeWidth: segs[0]?.stroke || 12,
                                }}
                            >
                                <title>{`${slices[0].label}: ${slices[0].count} (${toPercent(
                                    slices[0].count,
                                    tooltipTotal
                                )})`}</title>
                            </circle>
                        ) : (
                            segs.map((sg) =>
                                sg.path ? (
                                    <path
                                        key={sg.key}
                                        d={sg.path}
                                        className="statsDonutSeg"
                                        style={{ stroke: sg.color, strokeWidth: sg.stroke }}
                                    >
                                        <title>{`${sg.label}: ${sg.count} (${toPercent(sg.count, tooltipTotal)})`}</title>
                                    </path>
                                ) : null
                            )
                        )}

                        <circle cx="60" cy="60" r="34" className="statsDonutHole" />
                        <text x="60" y="58" textAnchor="middle" className="statsDonutCenterBig">
                            {total || 0}
                        </text>
                        <text x="60" y="74" textAnchor="middle" className="statsDonutCenterSmall">
                            {centerLabel || "visits"}
                        </text>
                    </svg>
                </div>

                <div className="statsLegend">
                    <label className="statsSearch">
                        <span className="statsSearchLabel">Search</span>
                        <input
                            className="statsSearchInput"
                            value={search}
                            onChange={(e) => onSearch(e.target.value)}
                            placeholder="search..."
                        />
                    </label>

                    <div className="statsLegendHead">
                        <div className="statsLegendHeadCell">{nameLabel || "Name"}</div>
                        <div className="statsLegendHeadCell statsRight">Visits</div>
                        <div className="statsLegendHeadCell statsRight">100%</div>
                    </div>

                    {filtered.length ? (
                        <div className="statsLegendScroll">
                            {filtered.map((r2, idx) => {
                                const color = colorByKey[r2.key] || hsl(idx);
                                return (
                                    <div key={r2.key} className="statsLegendRow">
                                        <span className="statsLegendDot" style={{ background: color }} />
                                        <span className="statsLegendName" title={r2.label}>
                                            {r2.label}
                                        </span>
                                        <span className="statsLegendCount statsRight">{r2.count}</span>
                                        <span className="statsLegendPct statsRight">
                                            {toPercent(r2.count, tooltipTotal)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="statsEmpty">No results found.</div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function StatsAdmin() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [rangeMode, setRangeMode] = useState("today");
    const [source, setSource] = useState("visits");
    const [mode, setMode] = useState("cities");
    const [search, setSearch] = useState("");

    const todayKey = useMemo(() => brusselsDayKey(), []);
    const siteStartLabel = useMemo(() => formatEnDateFromKey(SITE_START_KEY), []);

    const [allDailyVisits, setAllDailyVisits] = useState([]);
    const [allUniqueVisitors, setAllUniqueVisitors] = useState([]);
    const [allBotVisits, setAllBotVisits] = useState([]);

    useEffect(() => {
        let alive = true;

        (async () => {
            try {
                setLoading(true);
                setError("");

                const [dailySnap, globalSnap, botSnap] = await Promise.all([
                    getDocs(collectionGroup(db, "visitors")),
                    getDocs(collection(db, "visits_global")),
                    getDocs(collection(db, "bot_visits")),
                ]);

                const daily = [];
                dailySnap.forEach((docSnap) => {
                    const d = docSnap.data() || {};
                    const day = getDayFromSnap(docSnap, d);
                    daily.push({
                        day,
                        country: clamp(d.country, 60),
                        city: clamp(d.city, 60),
                        language: normalizeLang(d.language),
                        deviceType: normalizeDevice(d.deviceType),
                    });
                });

                const unique = [];
                globalSnap.forEach((docSnap) => {
                    const d = docSnap.data() || {};
                    unique.push({
                        day: normalizeDayKey(d.firstDay),
                        country: clamp(d.country, 60),
                        city: clamp(d.city, 60),
                        language: normalizeLang(d.language),
                        deviceType: normalizeDevice(d.deviceType),
                    });
                });

                const bots = [];
                botSnap.forEach((docSnap) => {
                    const d = docSnap.data() || {};
                    bots.push({
                        day: normalizeDayKey(d.day),
                        country: clamp(d.country, 60),
                        city: clamp(d.city, 60),
                        language: normalizeLang(d.language),
                        deviceType: normalizeDevice(d.deviceType),
                        userAgent: clamp(d.userAgent, 200),
                    });
                });

                if (!alive) return;
                setAllDailyVisits(daily);
                setAllUniqueVisitors(unique);
                setAllBotVisits(bots);
                setLoading(false);
            } catch (e) {
                if (!alive) return;
                console.error(e);
                setError("Could not load visits.");
                setLoading(false);
            }
        })();

        return () => {
            alive = false;
        };
    }, []);

    const rangeKeys = useMemo(() => {
        if (rangeMode === "all") return null;
        if (rangeMode === "today") return new Set([todayKey]);
        const n = Number(rangeMode);
        if (!Number.isFinite(n) || n <= 0) return null;
        return new Set(buildLastNDaysKeys(n, todayKey));
    }, [rangeMode, todayKey]);

    const raw = source === "bots" ? allBotVisits : source === "unique" ? allUniqueVisitors : allDailyVisits;

    const scoped = useMemo(() => {
        if (!rangeKeys) return raw;
        return raw.filter((r) => rangeKeys.has(r.day) || r.day === "0000-00-00");
    }, [raw, rangeKeys]);

    const total = scoped.length;

    const agg = useMemo(() => {
        const byCountry = {};
        const byCity = {};
        const byLang = {};
        const byDevice = {};

        scoped.forEach((r) => {
            const c = sanitizeKey(r.country);
            const ci = makeCityKey(r.country, r.city);
            const lg = normalizeLang(r.language);
            const dv = normalizeDevice(r.deviceType);

            byCountry[c] = (byCountry[c] || 0) + 1;
            byCity[ci] = (byCity[ci] || 0) + 1;
            byLang[lg] = (byLang[lg] || 0) + 1;
            byDevice[dv] = (byDevice[dv] || 0) + 1;
        });

        return { byCountry, byCity, byLang, byDevice };
    }, [scoped]);

    const rowsForMode = useMemo(() => {
        const sortRows = (rows) => {
            rows.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
            return rows;
        };

        if (mode === "countries") {
            return sortRows(
                Object.keys(agg.byCountry).map((k) => ({
                    key: k,
                    label: unsanitizeKey(k),
                    count: Number(agg.byCountry[k]) || 0,
                }))
            );
        }

        if (mode === "cities") {
            return sortRows(
                Object.keys(agg.byCity).map((k) => ({
                    key: k,
                    label: cityLabelWithCountry(k),
                    count: Number(agg.byCity[k]) || 0,
                }))
            );
        }

        if (mode === "languages") {
            return sortRows(
                Object.keys(agg.byLang).map((k) => ({
                    key: k,
                    label: languageDisplayName(k),
                    count: Number(agg.byLang[k]) || 0,
                }))
            );
        }

        return sortRows(
            Object.keys(agg.byDevice).map((k) => ({
                key: k,
                label: unsanitizeKey(k),
                count: Number(agg.byDevice[k]) || 0,
            }))
        );
    }, [agg, mode]);

    const donutTitle = useMemo(() => {
        const prefix = source === "bots" ? `${BOT_ICON} Bots` : source === "unique" ? "Unique Visitors" : "Visits";
        if (mode === "countries") return `${prefix} • Distribution by Country`;
        if (mode === "cities") return `${prefix} • Distribution by City`;
        if (mode === "languages") return `${prefix} • Distribution by Language`;
        return `${prefix} • Distribution by Device`;
    }, [mode, source]);

    const modeTabs = [
        { id: "cities", label: "Cities" },
        { id: "countries", label: "Countries" },
        { id: "languages", label: "Languages" },
        { id: "devices", label: "Devices" },
    ];

    const nameLabel = useMemo(() => {
        if (mode === "countries") return "Country";
        if (mode === "cities") return "City";
        if (mode === "languages") return "Language";
        return "Device";
    }, [mode]);

    const centerLabel = source === "bots" ? "bots" : source === "unique" ? "visitors" : "visits";

    return (
        <div className="statsPage">
            <div className="statsTop">
                <h2 className="adminTitle">Statistics</h2>

                <div className="statsTopRight">
                    <select
                        className="statsSelect"
                        value={source}
                        onChange={(e) => {
                            setSource(e.target.value);
                            setSearch("");
                        }}
                        aria-label="Select source"
                    >
                        <option value="visits">{HUMAN_ICON} Human Visits</option>
                        <option value="unique">{HUMAN_ICON} Unique Visitors</option>
                        <option value="bots">{BOT_ICON} Detected Bots</option>
                    </select>

                    <select
                        className="statsSelect"
                        value={rangeMode}
                        onChange={(e) => setRangeMode(e.target.value)}
                        aria-label="Select range"
                    >
                        <option value="all">{`All time (${siteStartLabel})`}</option>
                        <option value="today">Today</option>
                        <option value="7">Last 7 days</option>
                        <option value="30">Last 30 days</option>
                        <option value="90">Last 90 days</option>
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="adminSkeleton" />
            ) : (
                <div className="statsLayout">
                    {error ? <div className="adminAlert">{error}</div> : null}

                    <div className="statsTabs" role="tablist" aria-label="Charts">
                        {modeTabs.map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                className={`statsTab ${mode === t.id ? "is-active" : ""}`}
                                onClick={() => {
                                    setMode(t.id);
                                    setSearch("");
                                }}
                                role="tab"
                                aria-selected={mode === t.id}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    <DonutWithLegend
                        title={donutTitle}
                        rows={rowsForMode}
                        total={total}
                        search={search}
                        onSearch={setSearch}
                        centerLabel={centerLabel}
                        nameLabel={nameLabel}
                    />
                </div>
            )}
        </div>
    );
}
