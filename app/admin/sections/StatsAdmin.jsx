"use client";

import "./StatsAdmin.css";
import { useEffect, useMemo, useState } from "react";
import { collection, collectionGroup, getDocs } from "firebase/firestore";
import { db } from "../../lib/Firebase";
import BackfillExpiry from "../components/BackfillExpiry";
import AdminSearch from "../components/AdminSearch";
import ConfirmModal from "../components/ConfirmModal";
import { useCallback } from "react";

const BOT_ICON = "🤖";
const HUMAN_ICON = "👤";

const SITE_START_KEY = "2025-12-21";


function IconMap(props) {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
        </svg>
    );
}

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
    const m = path.match(/(?:visits|world_map_visits)\/day_(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})\/(?:visitors|map_visitors)\//);
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

function getDayLetter(dateKey) {
    const [y, m, d] = s(dateKey).split("-").map(Number);
    if (!y || !m || !d) return "";
    const dt = new Date(y, m - 1, d);
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dt.getDay()] || "";
}

function BarChart({ rows, title }) {
    if (!rows || rows.length === 0) {
        return (
            <div className="statsBarChartWrap">
                <div className="statsBarChartTitle">{title}</div>
                <div className="statsBarChart">
                    <div className="statsBarEmpty">No data available</div>
                </div>
            </div>
        );
    }

    const maxVal = Math.max(...rows.map((r) => r.count));

    return (
        <div className="statsBarChartWrap">
            <div className="statsBarChartTitle">{title}</div>
            <div className="statsBarChartScroll">
                <div className="statsBarChart">
                    {rows.map((d) => {
                        const heightPct = maxVal > 0 ? (d.count / maxVal) * 100 : 0;

                        return (
                            <div key={d.day} className="statsBarCol">
                                <div className="statsBarTooltip">
                                    {formatEnDateFromKey(d.day)}: {d.count}
                                </div>
                                {d.count > 0 && (
                                    <div className="statsBarValue">{d.count}</div>
                                )}
                                <div className="statsBarFill" style={{ height: `${heightPct}%` }}></div>
                                <div className="statsBarLabel">
                                    <span>{formatEnDateFromKey(d.day).slice(0, 5)}</span>
                                    <span className="statsBarDayLetter">{getDayLetter(d.day)}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function DonutWithLegend({ title, rows, total, search, centerLabel, nameLabel }) {
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
                            {Number(total) || 0}
                        </text>
                        <text x="60" y="74" textAnchor="middle" className="statsDonutCenterSmall">
                            {centerLabel || "visits"}
                        </text>
                    </svg>
                </div>

                <div className="statsLegend">
                    <div className="statsLegendHead">
                        <div className="statsLegendHeadCell"></div>
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

    const [rangeMode, setRangeMode] = useState("7");
    const [page, setPage] = useState("lp");
    const [visitorType, setVisitorType] = useState("human");
    const [mode, setMode] = useState("cities");
    const [search, setSearch] = useState("");

    const [modal, setModal] = useState({ isOpen: false, title: "", message: "" });
    const openInfoModal = useCallback((title, message) => {
        setModal({
            isOpen: true,
            title,
            message,
            actions: [
                {
                    label: "OK",
                    variant: "primary",
                    onClick: () => setModal((prev) => ({ ...prev, isOpen: false }))
                }
            ]
        });
    }, []);

    const todayKey = useMemo(() => brusselsDayKey(), []);
    const siteStartLabel = useMemo(() => formatEnDateFromKey(SITE_START_KEY), []);

    const [allDailyVisits, setAllDailyVisits] = useState([]);
    const [allUniqueVisitors, setAllUniqueVisitors] = useState([]);
    const [allWorldMapVisits, setAllWorldMapVisits] = useState([]);

    useEffect(() => {
        let alive = true;

        (async () => {
            try {
                setLoading(true);

                const [dailySnap, globalSnap, worldMapSnap] = await Promise.all([
                    getDocs(collectionGroup(db, "visitors")),
                    getDocs(collection(db, "visits_global")),
                    getDocs(collectionGroup(db, "map_visitors")),
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
                        timestamp: d.timestamp || 0,
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
                        timestamp: d.timestamp || 0,
                    });
                });

                const worldMap = [];
                worldMapSnap.forEach((docSnap) => {
                    const d = docSnap.data() || {};
                    const day = getDayFromSnap(docSnap, d);
                    worldMap.push({
                        day,
                        country: clamp(d.country, 60),
                        city: clamp(d.city, 60),
                        language: normalizeLang(d.language),
                        deviceType: normalizeDevice(d.deviceType),
                        geoStatus: d.geoStatus || "unknown",
                        preciseLat: d.preciseLat,
                        preciseLng: d.preciseLng,
                        timeHM: d.timeHM || "??:??",
                        visitorId: d.visitorId || docSnap.id,
                        timestamp: d.timestamp || 0
                    });
                });

                if (!alive) return;
                setAllDailyVisits(daily);
                setAllUniqueVisitors(unique);
                setAllWorldMapVisits(worldMap);
                setLoading(false);
            } catch (e) {
                if (!alive) return;
                console.error(e);
                setLoading(false);
                openInfoModal("Loading Error", "Could not load visits.");
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

    const raw = useMemo(() => {
        if (page === "world_map") {
            if (visitorType === "human") return allWorldMapVisits;
            if (visitorType === "unique") {
                // Deduplicate by visitorId to find unique people on the map
                const uniqueMap = new Map();
                // We sort by day to make sure the "first" visit is the one we keep
                const sorted = [...allWorldMapVisits].sort((a, b) => a.day.localeCompare(b.day));
                sorted.forEach(v => {
                    if (v.visitorId && !uniqueMap.has(v.visitorId)) {
                        uniqueMap.set(v.visitorId, v);
                    }
                });
                return Array.from(uniqueMap.values());
            }
            return [];
        } else {
            // LP
            if (visitorType === "human") return allDailyVisits;
            if (visitorType === "unique") return allUniqueVisitors;
            return [];
        }
    }, [page, visitorType, allWorldMapVisits, allDailyVisits, allUniqueVisitors]);

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
        const byGeo = {};
        const byDay = {};

        if (rangeKeys) {
            rangeKeys.forEach(k => { byDay[k] = 0; });
        }

        scoped.forEach((r) => {
            const c = sanitizeKey(r.country);
            const ci = makeCityKey(r.country, r.city);
            const lg = normalizeLang(r.language);
            const dv = normalizeDevice(r.deviceType);
            const g = sanitizeKey(r.geoStatus);

            byCountry[c] = (byCountry[c] || 0) + 1;
            byCity[ci] = (byCity[ci] || 0) + 1;
            byLang[lg] = (byLang[lg] || 0) + 1;
            byDevice[dv] = (byDevice[dv] || 0) + 1;
            byGeo[g] = (byGeo[g] || 0) + 1;

            if (r.day && r.day !== "0000-00-00") {
                byDay[r.day] = (byDay[r.day] || 0) + 1;
            }
        });

        const timeline = Object.keys(byDay).map(k => ({
            day: k,
            count: byDay[k]
        }));
        timeline.sort((a, b) => a.day.localeCompare(b.day));

        return { byCountry, byCity, byLang, byDevice, byGeo, timeline };
    }, [scoped, rangeKeys]);

    const rowsForMode = useMemo(() => {
        const sortRows = (rows) => {
            // Always sort descending by default now that sortBy is gone
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

        if (mode === "geo_status") {
            return sortRows(
                Object.keys(agg.byGeo).map((k) => ({
                    key: k,
                    label: unsanitizeKey(k),
                    count: Number(agg.byGeo[k]) || 0,
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
        const prefix = visitorType === "unique" 
                ? "Real Traffic" 
                : page === "world_map" 
                    ? "World Map Visits" 
                    : "Daily Traffic";
        if (mode === "countries") return `${prefix} • Distribution by Country`;
        if (mode === "cities") return `${prefix} • Distribution by City`;
        if (mode === "languages") return `${prefix} • Distribution by Language`;
        if (mode === "geo_status") return `${prefix} • Geolocation Status`;
        return `${prefix} • Distribution by Device`;
    }, [mode, page, visitorType]);

    const modeTabs = [
        { id: "cities", label: "Cities" },
        { id: "countries", label: "Countries" },
        { id: "languages", label: "Languages" },
        { id: "devices", label: "Devices" },
        ...(page === "world_map" && (visitorType === "human" || visitorType === "unique") ? [{ id: "geo_status", label: "Geo Status" }] : []),
    ];

    const nameLabel = useMemo(() => {
        if (mode === "countries") return "Country";
        if (mode === "cities") return "City";
        if (mode === "languages") return "Language";
        if (mode === "geo_status") return "Status";
        return "Device";
    }, [mode]);

    const centerLabel = visitorType === "unique" ? "total" : page === "world_map" ? "map" : "visits";

    return (
        <div className="adminFullPage">
            <BackfillExpiry />
            <div className="adminFullTop">
                <h2 className="adminTitle">Statistics</h2>

                <div className="statsActions">
                    <select
                        className="adminSelect"
                        value={mode}
                        onChange={(e) => {
                            setMode(e.target.value);
                            setSearch("");
                        }}
                        aria-label="Select category"
                    >
                        {modeTabs.map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.label}
                            </option>
                        ))}
                    </select>

                    <select
                        className="adminSelect"
                        value={page}
                        onChange={(e) => {
                            setPage(e.target.value);
                            setSearch("");
                        }}
                        aria-label="Select page"
                    >
                        <option value="lp">Landing Page</option>
                        <option value="world_map">World Map</option>
                    </select>

                    <select
                        className="adminSelect"
                        value={visitorType}
                        onChange={(e) => {
                            setVisitorType(e.target.value);
                            setSearch("");
                        }}
                        aria-label="Select visitor type"
                    >
                        <option value="human">Daily Traffic</option>
                        <option value="unique">Real Traffic</option>
                    </select>

                    <select
                        className="adminSelect"
                        value={rangeMode}
                        onChange={(e) => setRangeMode(e.target.value)}
                        aria-label="Select range"
                    >
                        <option value="all">{`All time`}</option>
                        <option value="today">Today</option>
                        <option value="7">Last 7 days</option>
                        <option value="30">Last 30 days</option>
                        <option value="90">Last 90 days</option>
                    </select>
                </div>

                <AdminSearch
                    value={search}
                    onChange={setSearch}
                    placeholder="Search"
                />
            </div>

            {loading ? (
                <div className="adminSkeleton" />
            ) : (
                <div className="adminFullContent">
                    <BarChart
                        title={`${visitorType === "unique" ? "Real Traffic" : "Daily Traffic"} • Timeline`}
                        rows={agg.timeline}
                    />

                    <DonutWithLegend
                        title={donutTitle}
                        rows={rowsForMode}
                        total={total}
                        search={search}
                        centerLabel={centerLabel}
                        nameLabel={nameLabel}
                    />

                    {page === "world_map" && (visitorType === "human" || visitorType === "unique") && agg.byGeo["granted"] > 0 && (
                        <div className="statsCard" style={{ marginTop: "24px" }}>
                            <div className="statsCardTop">
                                <div className="statsCardTitle">
                                    Recent Precise Positions
                                    <span className="statsGPSCounter">{scoped.length}</span>
                                </div>
                            </div>
                            <div className="statsLegendScroll">
                                <div className="statsLegendHead statsGPSHead">
                                    <div className="statsLegendHeadCell">Date / Time</div>
                                    <div className="statsLegendHeadCell">Location</div>
                                    <div className="statsLegendHeadCell statsRight">Maps</div>
                                </div>
                                {scoped
                                    .sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0))
                                    .map((v, i) => (
                                        <div key={i} className="statsLegendRow statsGPSRow">
                                            <div className="statsGPSInfo">
                                                <div className="statsGPSDateCol">
                                                    <span className="statsGPSDate">{formatEnDateFromKey(v.day)}</span>
                                                    <span className="statsGPSTime">{v.timeHM}</span>
                                                </div>
                                                <div className="statsGPSLocation">
                                                    {v.city}, {v.country}
                                                </div>
                                            </div>
                                            <div className="statsLegendCount statsRight statsGPSMaps">
                                                {v.preciseLat && v.preciseLng ? (
                                                    <a
                                                        href={`https://www.google.com/maps?q=${v.preciseLat},${v.preciseLng}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="adminBtn adminBtnPrimary statsGPSBtn"
                                                        title="View on Google Maps"
                                                    >
                                                        <IconMap className="statsGPSBtnIcon" />
                                                    </a>
                                                ) : (
                                                    <span className="statsGPSNoCoord">No GPS</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}
                    <ConfirmModal
                        isOpen={modal.isOpen}
                        title={modal.title}
                        message={modal.message}
                        variant={modal.variant}
                        actions={modal.actions}
                        onConfirm={modal.onConfirm}
                        onCancel={() => setModal({ ...modal, isOpen: false })}
                    />
                </div>
            )}
        </div>
    );
}
