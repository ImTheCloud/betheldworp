"use client";

import "./StatsAdmin.css";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/Firebase";

function safeStr(v) {
    return String(v ?? "");
}

function getBrusselsDayKey(date = new Date()) {
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

function unsanitizeKey(str) {
    return safeStr(str)
        .split("_")
        .map((s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : ""))
        .join(" ");
}

function extractCounts(data, prefix) {
    const counts = {};
    const raw = data || {};

    if (raw[prefix] && typeof raw[prefix] === "object") {
        Object.entries(raw[prefix]).forEach(([k, v]) => {
            counts[k] = typeof v === "number" ? v : 0;
        });
    }

    Object.entries(raw).forEach(([k, v]) => {
        if (k.startsWith(prefix + ".")) {
            const name = k.substring(prefix.length + 1);
            counts[name] = typeof v === "number" ? v : 0;
        }
    });

    return counts;
}

function toPercent(count, total) {
    const c = Number(count) || 0;
    const t = Number(total) || 0;
    if (!t) return "0%";
    const p = (c / t) * 100;
    return `${Math.round(p * 10) / 10}%`;
}

function buildLastNDaysKeys(n, endKey) {
    const [yy, mm, dd] = safeStr(endKey).split("-").map(Number);
    const end = new Date(yy, (mm || 1) - 1, dd || 1);
    const keys = [];
    for (let i = n - 1; i >= 0; i--) {
        const dt = new Date(end);
        dt.setDate(dt.getDate() - i);
        keys.push(getBrusselsDayKey(dt));
    }
    return keys;
}

function normalizeCityKey(key) {
    const parts = safeStr(key).split("__").filter(Boolean);
    if (parts.length >= 3) return `${parts[0]}__${parts[parts.length - 1]}`;
    return safeStr(key);
}

function parseCityKeyNoRegion(key) {
    const k = normalizeCityKey(key);
    const parts = safeStr(k).split("__");
    if (parts.length >= 2) {
        const country = unsanitizeKey(parts[0]);
        const city = unsanitizeKey(parts[1]);
        return `${city}, ${country}`;
    }
    return unsanitizeKey(k);
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

export default function StatsAdmin() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [daysMap, setDaysMap] = useState({});
    const [daysList, setDaysList] = useState([]);

    const [rangeMode, setRangeMode] = useState("today");
    const [tab, setTab] = useState("cities");
    const [query, setQuery] = useState("");

    useEffect(() => {
        let unsubVisits = null;

        setLoading(true);
        setError("");

        unsubVisits = onSnapshot(
            collection(db, "visits"),
            (snap) => {
                const map = {};
                const list = [];
                snap.forEach((d) => {
                    const id = d.id || "";
                    if (!id.startsWith("day_")) return;
                    const data = d.data() || {};
                    const date = data.date || id.slice(4);
                    const total = typeof data.total === "number" ? data.total : 0;
                    map[date] = { ...data, date, total };
                    list.push({ date, total });
                });
                list.sort((a, b) => a.date.localeCompare(b.date));
                setDaysMap(map);
                setDaysList(list);
                setLoading(false);
            },
            (err) => {
                console.error(err);
                setError("Nu am putut încărca statisticile.");
                setLoading(false);
            }
        );

        return () => {
            if (unsubVisits) unsubVisits();
        };
    }, []);

    const todayKey = useMemo(() => getBrusselsDayKey(), []);

    const selectedKeys = useMemo(() => {
        if (rangeMode === "all") return daysList.map((d) => d.date);
        if (rangeMode === "today") return [todayKey];
        const n = Number(rangeMode);
        if (Number.isFinite(n) && n > 0) return buildLastNDaysKeys(n, todayKey);
        return [todayKey];
    }, [rangeMode, daysList, todayKey]);

    const selectedDays = useMemo(() => {
        return selectedKeys.map((k) => daysMap[k]).filter(Boolean);
    }, [selectedKeys, daysMap]);

    const totalSelected = useMemo(() => {
        return selectedDays.reduce((acc, d) => acc + (Number(d.total) || 0), 0);
    }, [selectedDays]);

    const aggregateCounts = (prefix) => {
        const agg = {};
        selectedDays.forEach((day) => {
            const obj = extractCounts(day, prefix);
            Object.entries(obj).forEach(([k, v]) => {
                const key = prefix === "byCity" ? normalizeCityKey(k) : k;
                agg[key] = (agg[key] || 0) + (Number(v) || 0);
            });
        });
        return agg;
    };

    const countriesAll = useMemo(() => {
        const obj = aggregateCounts("byCountry");
        const rows = Object.keys(obj).map((k) => ({
            key: k,
            name: unsanitizeKey(k),
            count: Number(obj[k]) || 0,
        }));
        rows.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
        return rows;
    }, [selectedDays]);

    const citiesAll = useMemo(() => {
        const obj = aggregateCounts("byCity");
        const rows = Object.keys(obj).map((k) => ({
            key: k,
            name: parseCityKeyNoRegion(k),
            count: Number(obj[k]) || 0,
        }));
        rows.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
        return rows;
    }, [selectedDays]);

    const allRows = useMemo(() => {
        return tab === "countries" ? countriesAll : citiesAll;
    }, [tab, countriesAll, citiesAll]);

    const placesTotal = useMemo(() => {
        return allRows.filter((r) => r.count > 0).length;
    }, [allRows]);

    const q = useMemo(() => safeStr(query).trim().toLowerCase(), [query]);

    const filteredRows = useMemo(() => {
        if (!q) return allRows;
        return allRows.filter((r) => safeStr(r.name).toLowerCase().includes(q));
    }, [allRows, q]);

    const donut = useMemo(() => {
        const total = Math.max(0, Number(totalSelected) || 0);
        const title = tab === "countries" ? "Distribuție pe țări" : "Distribuție pe orașe";
        const base = allRows.filter((r) => r.count > 0);

        const topN = 10;
        const slicesSrc = base.slice(0, topN);

        const cx = 60;
        const cy = 60;
        const r = 46;
        const stroke = 12;

        if (!total || !slicesSrc.length) return { total, title, slices: [] };

        if (slicesSrc.length === 1) {
            const hue = 10;
            return {
                total,
                title,
                slices: [
                    {
                        key: slicesSrc[0].key,
                        label: slicesSrc[0].name,
                        count: slicesSrc[0].count,
                        color: `hsl(${hue} 70% 45%)`,
                        isFull: true,
                        stroke,
                    },
                ],
            };
        }

        const sumTop = slicesSrc.reduce((a, r) => a + r.count, 0);
        const denom = sumTop || 1;

        let angle = 0;
        const overlap = 0.8;

        const segs = slicesSrc.map((row, idx) => {
            const pct = row.count / denom;
            const start = angle;
            const delta = Math.max(0, pct) * 360;
            let end = start + delta;
            angle = end;

            if (idx === slicesSrc.length - 1) end = 360;

            let startAdj = start;
            let endAdj = end;

            if (delta > 0) {
                if (idx !== 0) startAdj = Math.max(0, startAdj - overlap / 2);
                if (idx !== slicesSrc.length - 1) endAdj = Math.min(360, endAdj + overlap / 2);
            }

            const path = delta > 0 ? arcPath(cx, cy, r, startAdj, endAdj) : null;
            const hue = (idx * 42) % 360;

            return {
                key: row.key,
                label: row.name,
                count: row.count,
                color: `hsl(${hue} 70% 45%)`,
                path,
                stroke,
                isFull: false,
            };
        });

        return { total, title, slices: segs };
    }, [tab, allRows, totalSelected]);

    const legendNameLabel = tab === "countries" ? "Țări" : "Orașe";
    const placesLabel = tab === "countries" ? "Țări totale" : "Orașe totale";

    return (
        <div className="adminCard">
            <div className="adminTop statsTopBar">
                <h2 className="adminTitle">Statistici</h2>

                <div className="adminActions statsFilter">
                    <select
                        className="statsSelect"
                        value={rangeMode}
                        onChange={(e) => setRangeMode(e.target.value)}
                        aria-label="Selectează perioada"
                    >
                        <option value="today">Azi</option>
                        <option value="7">Ultimele 7 zile</option>
                        <option value="30">Ultimele 30 zile</option>
                        <option value="all">Toate</option>
                    </select>
                </div>
            </div>

            <div className="statsTabsWrap" role="tablist" aria-label="Statistici">
                <div className="statsTabs">
                    <span className={`statsTabsPill ${tab === "cities" ? "is-on" : ""}`} aria-hidden="true" />
                    <button
                        type="button"
                        className={`statsTab ${tab === "cities" ? "is-active" : ""}`}
                        onClick={() => {
                            setTab("cities");
                            setQuery("");
                        }}
                        role="tab"
                        aria-selected={tab === "cities"}
                    >
                        Orașe
                    </button>
                    <button
                        type="button"
                        className={`statsTab ${tab === "countries" ? "is-active" : ""}`}
                        onClick={() => {
                            setTab("countries");
                            setQuery("");
                        }}
                        role="tab"
                        aria-selected={tab === "countries"}
                    >
                        Țări
                    </button>
                </div>
            </div>

            <div className="statsSpacer" aria-hidden="true" />

            {loading ? (
                <div className="adminSkeleton" />
            ) : (
                <div className="statsContent">
                    {error ? <div className="adminAlert">{error}</div> : null}

                    <div className="statsChartCard" aria-label="Grafic">
                        <div className="statsChartTop">
                            <div className="statsChartTitle">{donut.title}</div>
                            <div className="statsChartMetaPill">
                                <span className="statsChartMetaLabel">{placesLabel}</span>
                                <span className="statsChartMetaValue">{placesTotal}</span>
                            </div>
                        </div>

                        <div className="statsDonutWrap">
                            <div className="statsDonut">
                                <svg viewBox="0 0 120 120" className="statsDonutSvg" role="img" aria-label="Grafic rotund">
                                    <circle cx="60" cy="60" r="46" className="statsDonutBg" />
                                    {donut.slices.map((s) =>
                                        s.isFull ? (
                                            <circle
                                                key={s.key}
                                                cx="60"
                                                cy="60"
                                                r="46"
                                                className="statsDonutSeg"
                                                style={{ stroke: s.color, strokeWidth: s.stroke }}
                                            >
                                                <title>{`${s.label}: ${s.count} (${toPercent(s.count, Math.max(1, totalSelected))})`}</title>
                                            </circle>
                                        ) : s.path ? (
                                            <path
                                                key={s.key}
                                                d={s.path}
                                                className="statsDonutSeg"
                                                style={{ stroke: s.color, strokeWidth: s.stroke }}
                                            >
                                                <title>{`${s.label}: ${s.count} (${toPercent(s.count, Math.max(1, totalSelected))})`}</title>
                                            </path>
                                        ) : null
                                    )}
                                    <circle cx="60" cy="60" r="34" className="statsDonutHole" />
                                    <text x="60" y="58" textAnchor="middle" className="statsDonutCenterBig">
                                        {totalSelected || 0}
                                    </text>
                                    <text x="60" y="74" textAnchor="middle" className="statsDonutCenterSmall">
                                        total
                                    </text>
                                </svg>
                            </div>

                            <div className="statsLegend" aria-label="Legendă">
                                <label className="statsSearch">
                                    <span className="statsSearchLabel">Caută</span>
                                    <input
                                        className="statsSearchInput"
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        placeholder={`scrie un ${tab === "countries" ? "stat" : "oraș"}…`}
                                    />
                                </label>

                                <div className="statsLegendHead" role="row" aria-label="Coloane legendă">
                                    <div className="statsLegendHeadCell statsLegendHeadName">{legendNameLabel}</div>
                                    <div className="statsLegendHeadCell statsLegendHeadCount">Vizite</div>
                                    <div className="statsLegendHeadCell statsLegendHeadPct">%</div>
                                </div>

                                {filteredRows.length ? (
                                    <div className="statsLegendScroll" role="table" aria-label="Listă completă">
                                        {filteredRows.map((r, idx) => {
                                            const hue = (idx * 42) % 360;
                                            const color = `hsl(${hue} 70% 45%)`;
                                            return (
                                                <div key={r.key} className="statsLegendRow">
                                                    <span className="statsLegendDot" style={{ background: color }} />
                                                    <span className="statsLegendName" title={r.name}>
                            {r.name}
                          </span>
                                                    <span className="statsLegendCount">{r.count}</span>
                                                    <span className="statsLegendVal">{toPercent(r.count, Math.max(1, totalSelected))}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="adminEmpty">Nu există rezultate.</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}