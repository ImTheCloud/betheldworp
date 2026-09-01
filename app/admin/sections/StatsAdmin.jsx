"use client";

import "./StatsAdmin.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../lib/Firebase";
import AdminSearch from "../components/AdminSearch";
import ConfirmModal from "../components/ConfirmModal";



function s(v) {
    return String(v ?? "");
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

function unsanitizeKey(str) {
    return s(str)
        .split("_")
        .map((x) => (x ? x.charAt(0).toUpperCase() + x.slice(1) : ""))
        .join(" ");
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

    // Un document par jour, contenant uniquement des compteurs. Aucune ligne
    // individuelle : il n'y a plus rien à parcourir visiteur par visiteur.
    const [jours, setJours] = useState([]);

    useEffect(() => {
        let vivant = true;

        (async () => {
            try {
                setLoading(true);
                const snap = await getDocs(collection(db, "stats_daily"));
                const lus = [];
                snap.forEach((d) => {
                    const v = d.data() || {};
                    lus.push({
                        day: v.day || d.id,
                        visits: Number(v.visits) || 0,
                        countries: v.countries || {},
                        cities: v.cities || {},
                        devices: v.devices || {},
                        languages: v.languages || {},
                        mapVisits: Number(v.mapVisits) || 0,
                        mapCountries: v.mapCountries || {},
                        mapCities: v.mapCities || {},
                        mapDevices: v.mapDevices || {},
                        mapLanguages: v.mapLanguages || {},
                        mapGeo: v.mapGeo || {},
                    });
                });
                lus.sort((a, b) => a.day.localeCompare(b.day));
                if (!vivant) return;
                setJours(lus);
                setLoading(false);
            } catch (e) {
                if (!vivant) return;
                console.error(e);
                setLoading(false);
                openInfoModal("Loading Error", "Could not load statistics.");
            }
        })();

        return () => { vivant = false; };
    }, []);

    const rangeKeys = useMemo(() => {
        if (rangeMode === "all") return null;
        if (rangeMode === "today") return new Set([todayKey]);
        const n = Number(rangeMode);
        if (!Number.isFinite(n) || n <= 0) return null;
        return new Set(buildLastNDaysKeys(n, todayKey));
    }, [rangeMode, todayKey]);

    const scoped = useMemo(
        () => (rangeKeys ? jours.filter((j) => rangeKeys.has(j.day)) : jours),
        [jours, rangeKeys]
    );

    // Additionne les compteurs des jours retenus. Les clés sont déjà sous leur
    // forme canonique dans la base : rien à normaliser ici, sinon les totaux
    // migrés et les nouveaux ne se cumuleraient pas.
    const agg = useMemo(() => {
        const carte = page === "world_map";
        const cumul = (cible, source) => {
            Object.entries(source || {}).forEach(([k, v]) => {
                cible[k] = (cible[k] || 0) + (Number(v) || 0);
            });
        };

        const byCountry = {}, byCity = {}, byLang = {}, byDevice = {}, byGeo = {}, byDay = {};
        if (rangeKeys) rangeKeys.forEach((k) => { byDay[k] = 0; });

        scoped.forEach((j) => {
            byDay[j.day] = (byDay[j.day] || 0) + (carte ? j.mapVisits : j.visits);
            cumul(byCountry, carte ? j.mapCountries : j.countries);
            cumul(byCity, carte ? j.mapCities : j.cities);
            cumul(byLang, carte ? j.mapLanguages : j.languages);
            cumul(byDevice, carte ? j.mapDevices : j.devices);
            if (carte) cumul(byGeo, j.mapGeo);
        });

        const timeline = Object.keys(byDay)
            .map((k) => ({ day: k, count: byDay[k] }))
            .sort((a, b) => a.day.localeCompare(b.day));

        return { byCountry, byCity, byLang, byDevice, byGeo, timeline };
    }, [scoped, rangeKeys, page]);

    const total = useMemo(
        () => scoped.reduce((s, j) => s + (page === "world_map" ? j.mapVisits : j.visits), 0),
        [scoped, page]
    );

    // Deux repères qui ignorent volontairement le sélecteur de période : le
    // cumul depuis l'ouverture de la v2 du site, et le compteur du jour. Ils
    // gardent le même sens quand la vue est filtrée sur sept jours.
    const totalDepuisOuverture = useMemo(
        () => jours.reduce((s, j) => s + (page === "world_map" ? j.mapVisits : j.visits), 0),
        [jours, page]
    );

    const totalAujourdhui = useMemo(() => {
        const j = jours.find((x) => x.day === todayKey);
        if (!j) return 0;
        return page === "world_map" ? j.mapVisits : j.visits;
    }, [jours, todayKey, page]);

    // Lu dans les données plutôt que codé en dur : si un jour plus ancien
    // apparaît, la mention suit au lieu de mentir.
    const jourDOuverture = jours.length ? jours[0].day : "";


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
        const prefix = page === "world_map" ? "World Map Visits" : "Daily Traffic";
        if (mode === "countries") return `${prefix} • Distribution by Country`;
        if (mode === "cities") return `${prefix} • Distribution by City`;
        if (mode === "languages") return `${prefix} • Distribution by Language`;
        if (mode === "geo_status") return `${prefix} • Geolocation Status`;
        return `${prefix} • Distribution by Device`;
    }, [mode, page]);

    const modeTabs = [
        { id: "cities", label: "Cities" },
        { id: "countries", label: "Countries" },
        { id: "languages", label: "Languages" },
        { id: "devices", label: "Devices" },
        ...(page === "world_map" ? [{ id: "geo_status", label: "Geo Status" }] : []),
    ];

    const nameLabel = useMemo(() => {
        if (mode === "countries") return "Country";
        if (mode === "cities") return "City";
        if (mode === "languages") return "Language";
        if (mode === "geo_status") return "Status";
        return "Device";
    }, [mode]);

    const centerLabel = page === "world_map" ? "map" : "visits";

    return (
        <div className="adminFullPage">
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
                    <div className="statsKpis">
                        <div className="statsKpi">
                            <div className="statsKpiValue">{totalDepuisOuverture.toLocaleString("fr-BE")}</div>
                            <div className="statsKpiLabel">
                                {page === "world_map" ? "Map visits since launch" : "Visits since launch"}
                            </div>
                            {jourDOuverture ? (
                                <div className="statsKpiHint">since {formatEnDateFromKey(jourDOuverture)}</div>
                            ) : null}
                        </div>
                        <div className="statsKpi">
                            <div className="statsKpiValue">{totalAujourdhui.toLocaleString("fr-BE")}</div>
                            <div className="statsKpiLabel">
                                {page === "world_map" ? "Map visits today" : "Visits today"}
                            </div>
                            <div className="statsKpiHint">{formatEnDateFromKey(todayKey)}</div>
                        </div>
                    </div>

                    <BarChart
                        title={`${page === "world_map" ? "World Map Visits" : "Daily Traffic"} • Timeline`}
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
