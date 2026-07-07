"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Chart from "chart.js/auto";

/* ---- data spelling -> geojson (properties.d) spelling ---- */
const GEO_NAME: Record<string, string> = {
  Belgavi: "Belagavi", Bellary: "Ballari", "Bengaluru Rural": "Bengaluru (Rural)",
  "Bengaluru Urban": "Bengaluru (Urban)", Chamrajanagara: "Chamarajanagara",
  Chikkamangaluru: "Chikkamagaluru", Davangere: "Davanagere", Mysore: "Mysuru",
  Ramnagar: "Ramanagara", Tumkur: "Tumakur", Vijayapur: "Vijayapura",
};
const geoOf = (d: string) => GEO_NAME[d] || d;
const DATA_NAME: Record<string, string> = Object.fromEntries(Object.entries(GEO_NAME).map(([k, v]) => [v, k]));
const dataOf = (geo: string) => DATA_NAME[geo] || geo;

const OVERALL = "#2f6fed", SCCOL = "#7b3ff2", STCOL = "#f07f2f";
const PALETTE = ["#2f6fed", "#7b3ff2", "#f07f2f", "#1ba97a", "#e9603a", "#00a3bf", "#d9488a", "#8bc34a", "#ffb300", "#5c6bc0", "#26a69a"];
const fmtN = (v: any) => (v == null ? "—" : Math.round(v).toLocaleString("en-IN"));
const short = (s: string) => (s.length > 22 ? s.slice(0, 20) + "…" : s);
const DIVCOLORS: Record<string, string> = {
  "Bengaluru Division": "#2f6fed", "Mysuru Division": "#f07f2f", "Belagavi Division": "#1ba97a", "Kalaburagi Division": "#7b3ff2",
};
// the representative "headline" indicator (tableIdx-indIdx) used when comparing a topic
const TOPIC_HEADLINE: Record<string, string> = {
  "1. Demographics": "0-1",            // Female %
  "2. JJM Awareness": "0-0",           // Aware of JJM – Yes
  "3. FHTC Coverage": "0-0",           // Households with FHTC – Yes
  "4. Satisfaction & Tap": "0-1",      // Satisfied
  "5. Availability & Quality": "1-0",  // Year-round supply after JJM (10–12 months)
  "6. Water Utilization": "0-0",       // Uses JJM water for drinking
  "7. Impact": "0-1",                  // Increased income-generating work
  "8. Implementation": "0-0",          // No payment for connection
  "9. RWH & GWH": "0-0",               // Rain water harvesting – Yes
  "10. BCC": "0-0",                    // Awareness campaigns conducted – Yes
};
// red (low) -> yellow -> green (high) heat scale for rankings / map
const lerpRYG = (t: number) => {
  t = Math.max(0, Math.min(1, t));
  const a = t < 0.5 ? [214, 64, 64] : [240, 190, 40], b = t < 0.5 ? [240, 190, 40] : [38, 166, 90], u = t < 0.5 ? t * 2 : (t - 0.5) * 2;
  return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * u)).join(",")})`;
};

type ChartKind = "doughnut" | "pie" | "polarArea" | "bar" | "hbar" | "stacked" | "radar" | "line";
const CHART_OPTS: { v: ChartKind; t: string }[] = [
  { v: "doughnut", t: "Doughnut" }, { v: "pie", t: "Pie" }, { v: "bar", t: "Bar" },
  { v: "hbar", t: "Horizontal Bar" }, { v: "stacked", t: "Stacked" }, { v: "line", t: "Line" }, { v: "radar", t: "Radar" },
];

/* assign a distinct, suitable chart type to every table in the topic
   (distribution tables rotate doughnut/pie/polar; comparison tables rotate bar/hbar/radar/line/stacked) */
function assignTypes(tables: any[]): ChartKind[] {
  const dist: ChartKind[] = ["doughnut", "pie", "polarArea"];
  const comp: ChartKind[] = ["bar", "hbar", "radar", "line", "stacked"];
  let d = 0, c = 0;
  return tables.map((t) => {
    const inds = t.indicators, n = inds.length;
    const share = Math.abs(inds.reduce((a: number, i: any) => a + (i.oP || 0), 0) - 100) < 12;
    if (n <= 2 || (share && n <= 7)) { const x = dist[d % dist.length]; d++; return x; }
    const x = comp[c % comp.length]; c++; return x;
  });
}

/* ================= per-table chart + table ================= */
type Metric = "all" | "pct" | "n";
const PRE: Record<string, string> = { Overall: "o", SC: "sc", ST: "st" };

function TableBlock({ table, metric, type: defaultType }: { table: any; metric: Metric; type: ChartKind }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const chart = useRef<Chart | null>(null);
  const [cat, setCat] = useState<"all" | "sc" | "st">("all");
  const [type, setType] = useState<ChartKind>(defaultType);
  const showN = metric !== "pct";
  const showP = metric !== "n";
  // table columns follow BOTH the category (All/SC/ST) and the metric (All/%/N) toggles
  const CATS: [string, string][] = cat === "all" ? [["Overall", "o"], ["SC", "sc"], ["ST", "st"]] : cat === "sc" ? [["SC", "sc"]] : [["ST", "st"]];
  const headCells = CATS.flatMap(([lbl, pre]) => [
    ...(showN ? [{ k: pre + "N", t: `${lbl} N` }] : []),
    ...(showP ? [{ k: pre + "P", t: `${lbl} %` }] : []),
  ]);
  useEffect(() => {
    if (!canvas.current) return;
    const inds = table.indicators;
    const cm = metric === "n" ? "n" : "pct";          // chart magnitude (All uses % for comparability)
    const key = cm === "pct" ? "P" : "N";
    const suf = cm === "pct" ? "%" : "";
    const V = (o: string) => inds.map((i: any) => i[o + key]);
    const labels = inds.map((i: any) => short(i.label));
    const full = inds.map((i: any) => i.label);
    const palette = inds.map((_: any, k: number) => PALETTE[k % PALETTE.length]);
    const rgba = (h: string, a: number) => { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
    const catPre = cat === "all" ? "o" : cat;          // single-series prefix (All -> Overall)
    const catLabel = cat === "all" ? "Overall" : cat.toUpperCase();
    const tip = (idx: number, pre: string) => {
      const i = inds[idx]; const n = fmtN(i[pre + "N"]); const p = i[pre + "P"] + "%";
      return metric === "n" ? n : metric === "pct" ? p : `${n} (${p})`;
    };
    const legendTop = { legend: { position: "top" as const, labels: { boxWidth: 14, color: "#000", font: { size: 13 } } },
      tooltip: { callbacks: { label: (c: any) => `${c.dataset.label}: ${tip(c.dataIndex, PRE[c.dataset.label])}` } } };
    const trioAll = [
      { label: "Overall", data: V("o"), backgroundColor: OVERALL, borderColor: OVERALL, borderRadius: 4 },
      { label: "SC", data: V("sc"), backgroundColor: SCCOL, borderColor: SCCOL, borderRadius: 4 },
      { label: "ST", data: V("st"), backgroundColor: STCOL, borderColor: STCOL, borderRadius: 4 },
    ];
    const trio = cat === "all" ? trioAll : trioAll.filter((d) => PRE[d.label] === cat);
    let cfg: any;
    if (type === "doughnut" || type === "pie" || type === "polarArea") {
      cfg = { type, data: { labels: full, datasets: [{ data: V(catPre), backgroundColor: palette, borderColor: "#fff", borderWidth: 2 }] },
        options: { responsive: true, maintainAspectRatio: false, ...(type === "doughnut" ? { cutout: "58%" } : {}),
          plugins: { legend: { position: "right", labels: { boxWidth: 14, color: "#000", font: { size: 13 }, padding: 9 } }, tooltip: { callbacks: { label: (c: any) => `${c.label}: ${tip(c.dataIndex, catPre)}` } } } } };
    } else if (type === "hbar") {
      cfg = { type: "bar", data: { labels, datasets: [{ label: catLabel, data: V(catPre), backgroundColor: palette, borderRadius: 4 }] },
        options: { indexAxis: "y", responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c: any) => tip(c.dataIndex, catPre) } } },
          scales: { x: { beginAtZero: true, ticks: { callback: (v: any) => v + suf } }, y: { ticks: { font: { size: 10 } } } } } };
    } else if (type === "stacked") {
      const stackAll = [
        { label: "SC", data: inds.map((i: any) => i.scN), backgroundColor: SCCOL, borderRadius: 3 },
        { label: "ST", data: inds.map((i: any) => i.stN), backgroundColor: STCOL, borderRadius: 3 }];
      const stackDs = cat === "all" ? stackAll : stackAll.filter((d) => PRE[d.label] === cat);
      cfg = { type: "bar", data: { labels, datasets: stackDs },
        options: { responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: "top", labels: { boxWidth: 14, color: "#000", font: { size: 13 } } }, tooltip: { callbacks: { label: (c: any) => `${c.dataset.label}: ${tip(c.dataIndex, c.dataset.label === "SC" ? "sc" : "st")}` } } },
          scales: { x: { stacked: true, ticks: { font: { size: 10 }, maxRotation: 55 } }, y: { stacked: true, beginAtZero: true } } } };
    } else if (type === "radar") {
      cfg = { type: "radar", data: { labels, datasets: trio.map((d) => ({ label: d.label, data: d.data, borderColor: d.borderColor, backgroundColor: rgba(d.borderColor, 0.13), borderWidth: 2, pointRadius: 2 })) },
        options: { responsive: true, maintainAspectRatio: false, plugins: legendTop, scales: { r: { beginAtZero: true, ticks: { display: false }, pointLabels: { font: { size: 9 } } } } } };
    } else if (type === "line") {
      cfg = { type: "line", data: { labels, datasets: trio.map((d) => ({ label: d.label, data: d.data, borderColor: d.borderColor, backgroundColor: rgba(d.borderColor, 0.25), tension: 0.3, pointRadius: 3, fill: false })) },
        options: { responsive: true, maintainAspectRatio: false, plugins: legendTop, scales: { y: { beginAtZero: true, ticks: { callback: (v: any) => v + suf } }, x: { ticks: { font: { size: 10 }, maxRotation: 55 } } } } };
    } else {
      cfg = { type: "bar", data: { labels, datasets: trio },
        options: { responsive: true, maintainAspectRatio: false, plugins: legendTop, scales: { y: { beginAtZero: true, ticks: { callback: (v: any) => v + suf } }, x: { ticks: { font: { size: 10 }, maxRotation: 55 } } } } };
    }
    chart.current?.destroy();
    chart.current = new Chart(canvas.current, cfg);
    return () => chart.current?.destroy();
  }, [table, metric, type, cat]);

  return (
    <div className="card">
      <div className="cardhead">
        <div className="ct"><b>{table.title}</b><small>Base N={fmtN(table.base.overall)} · SC {fmtN(table.base.sc)} · ST {fmtN(table.base.st)}</small></div>
        <div className="headctl">
          <select className="chartsel" value={type} onChange={(e) => setType(e.target.value as ChartKind)} title="Chart type">
            {CHART_OPTS.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select>
          <div className="seg catseg">{(["all", "sc", "st"] as const).map((c) => (
            <button key={c} className={cat === c ? "active" : ""} onClick={() => setCat(c)}>{c === "all" ? "All" : c.toUpperCase()}</button>))}</div>
        </div>
      </div>
      <div className="chartbox"><canvas ref={canvas} /></div>
      <div className="tablewrap">
        <table>
          <thead><tr>
            <th>Indicator</th>
            {headCells.map((h) => <th key={h.k}>{h.t}</th>)}
          </tr></thead>
          <tbody>
            {table.indicators.map((i: any, k: number) => (
              <tr key={k}>
                <td style={{ textAlign: "left" }}>{i.label}</td>
                {headCells.map((h) => <td key={h.k}>{h.k.endsWith("N") ? fmtN(i[h.k]) : i[h.k]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* small composition doughnut (SC vs ST) for the info card */
function CompositionDoughnut({ cards }: { cards: any }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const chart = useRef<Chart | null>(null);
  useEffect(() => {
    if (!canvas.current || !cards) return;
    chart.current?.destroy();
    chart.current = new Chart(canvas.current, {
      type: "doughnut",
      data: { labels: ["SC", "ST"], datasets: [{ data: [cards.sc, cards.st], backgroundColor: [SCCOL, STCOL], borderColor: "#fff", borderWidth: 3 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: "62%",
        plugins: { legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 12 } } },
          tooltip: { callbacks: { label: (c: any) => `${c.label}: ${Math.round(c.raw).toLocaleString("en-IN")} (${Math.round((100 * c.raw) / (cards.sc + cards.st))}%)` } } } },
    });
    return () => chart.current?.destroy();
  }, [cards]);
  return <canvas ref={canvas} />;
}

/* ================= Karnataka map ================= */
function KarnatakaMap({ level, unit, divisions, onPick, heat, divColorMap }:
  { level: string; unit: string; divisions: Record<string, string[]>; onPick: (d: string) => void;
    heat?: { vals: Record<string, number>; mn: number; mx: number }; divColorMap?: Record<string, string> }) {
  const div = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const geo = useRef<any>(null);
  const pick = useRef(onPick); pick.current = onPick;

  // build / redraw
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      const g = geo.current || (await fetch("/kar_districts.json").then((r) => r.json()));
      geo.current = g;
      if (cancelled || !div.current) return;
      if (!map.current)
        map.current = L.map(div.current, { zoomControl: false, attributionControl: false, scrollWheelZoom: false, dragging: false, doubleClickZoom: false, zoomSnap: 0 }).setView([14.8, 76.2], 6.4);
      const m = map.current;
      if (m.__geo) m.removeLayer(m.__geo);
      const hi = new Set<string>();
      if (level === "District") hi.add(geoOf(unit));
      else if (level === "Division") (divisions[unit] || []).forEach((d) => hi.add(geoOf(d)));
      const layer = L.geoJSON(g, {
        style: (f: any) => {
          const d = f.properties.d;
          if (heat) { const v = heat.vals[dataOf(d)]; return { fillColor: v == null ? "#e2eaf6" : lerpRYG(heat.mx > heat.mn ? (v - heat.mn) / (heat.mx - heat.mn) : 0.5), fillOpacity: 0.9, color: "#fff", weight: 1 }; }
          if (divColorMap) return { fillColor: divColorMap[dataOf(d)] || "#e2eaf6", fillOpacity: 0.82, color: "#fff", weight: 1 };
          if (level === "State") return { fillColor: "#2f6fed", fillOpacity: 0.7, color: "#fff", weight: 1 };
          return hi.has(d)
            ? { fillColor: "#2f6fed", fillOpacity: 0.92, color: "#12336f", weight: 2.5 }
            : { fillColor: "#e2eaf6", fillOpacity: 0.85, color: "#fff", weight: 1 };
        },
        onEachFeature: (f: any, lyr: any) => {
          const d = f.properties.d;
          lyr.on("click", () => pick.current(dataOf(d)));
          lyr.on("mouseover", () => lyr.setStyle({ weight: 3, color: "#12336f", fillOpacity: 0.98 }));
          lyr.on("mouseout", () => layer.resetStyle(lyr));
          const hv = heat ? heat.vals[dataOf(d)] : null;
          lyr.bindTooltip(hv != null ? `<b>${d}</b><br><span class="lv">${hv}</span>` : `<b>${d}</b>`,
            { direction: "center", className: "distlabel", sticky: !hi.has(d), permanent: hi.has(d), opacity: 1 });
        },
      }).addTo(m);
      m.__geo = layer;
      const fit = () => { if (!m.__geo) return; m.invalidateSize(); try { m.fitBounds(m.__geo.getBounds(), { padding: [10, 10] }); } catch {} };
      requestAnimationFrame(() => { fit(); setTimeout(fit, 150); setTimeout(fit, 400); });
    })();
    return () => { cancelled = true; };
  }, [level, unit, divisions, heat, divColorMap]);

  // responsive: refit whenever the container resizes
  useEffect(() => {
    if (!div.current) return;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const m = map.current; if (!m || !m.__geo) return;
        m.invalidateSize();
        try { m.fitBounds(m.__geo.getBounds(), { padding: [10, 10] }); } catch {}
      });
    });
    ro.observe(div.current);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <div ref={div} className="kmap" />;
}

/* division comparison bar chart — one bar per division, distinct colour */
function DivBarChart({ data, suf }: { data: { u: string; v: number }[]; suf: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const chart = useRef<Chart | null>(null);
  useEffect(() => {
    if (!canvas.current) return;
    chart.current?.destroy();
    chart.current = new Chart(canvas.current, {
      type: "bar",
      data: { labels: data.map((d) => d.u.replace(" Division", "")), datasets: [{ data: data.map((d) => d.v), backgroundColor: data.map((d) => DIVCOLORS[d.u] || "#888"), borderRadius: 6 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c: any) => `${c.raw}${suf}` } } },
        scales: { y: { beginAtZero: true, ticks: { color: "#5b6b7d", callback: (v: any) => v + suf } }, x: { ticks: { color: "#1f2d3d", font: { size: 12 } } } } },
    });
    return () => chart.current?.destroy();
  }, [data, suf]);
  return <canvas ref={canvas} />;
}

/* per-table compare card: one table, compared across all districts / divisions */
const COMPARE_OPTS: { v: ChartKind; t: string }[] = [
  { v: "doughnut", t: "Doughnut" }, { v: "pie", t: "Pie" }, { v: "polarArea", t: "Polar" }, { v: "bar", t: "Bar" }, { v: "hbar", t: "Horizontal Bar" },
];
function CompareCard({ title, indLabel, data, isDiv }: { title: string; indLabel: string; data: any[]; isDiv: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const chart = useRef<Chart | null>(null);
  const [type, setType] = useState<ChartKind>(isDiv ? "doughnut" : "hbar");
  const [cat, setCat] = useState<"all" | "sc" | "st">("all");
  const pre = cat === "sc" ? "sc" : cat === "st" ? "st" : "o";     // value prefix for the chart
  const rows = useMemo(() => [...data].sort((a, b) => (b.ind[pre + "P"] ?? -1) - (a.ind[pre + "P"] ?? -1)), [data, pre]);
  const cols: [string, string][] = cat === "all" ? [["Overall", "o"], ["SC", "sc"], ["ST", "st"]] : cat === "sc" ? [["SC", "sc"]] : [["ST", "st"]];
  const headCells = cols.flatMap(([l, p]) => [{ k: p + "N", t: `${l} N` }, { k: p + "P", t: `${l} %` }]);
  useEffect(() => {
    if (!canvas.current) return;
    const vals = rows.map((r) => r.ind[pre + "P"]);
    const mn = Math.min(...vals), mx = Math.max(...vals);
    const labels = rows.map((r) => isDiv ? r.u.replace(" Division", "") : r.u);
    const colors = rows.map((r) => isDiv ? (DIVCOLORS[r.u] || "#888") : lerpRYG(mx > mn ? (r.ind[pre + "P"] - mn) / (mx - mn) : 0.5));
    chart.current?.destroy();
    let cfg: any;
    if (type === "doughnut" || type === "pie" || type === "polarArea") {
      cfg = { type, data: { labels, datasets: [{ data: vals, backgroundColor: colors, borderColor: "#fff", borderWidth: 2 }] },
        options: { responsive: true, maintainAspectRatio: false, ...(type === "doughnut" ? { cutout: "55%" } : {}),
          plugins: { legend: { position: "right", labels: { boxWidth: 12, color: "#000", font: { size: 10.5 }, padding: 6 } }, tooltip: { callbacks: { label: (c: any) => `${c.label}: ${c.raw}%` } } } } };
    } else {
      cfg = { type: "bar", data: { labels, datasets: [{ data: vals, backgroundColor: colors, borderRadius: 4 }] },
        options: { indexAxis: type === "hbar" ? "y" : "x", responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c: any) => `${c.raw}%` } } },
          scales: type === "hbar" ? { x: { beginAtZero: true, ticks: { callback: (v: any) => v + "%" } }, y: { ticks: { font: { size: 9 } } } } : { y: { beginAtZero: true, ticks: { callback: (v: any) => v + "%" } }, x: { ticks: { font: { size: 9 }, maxRotation: 60 } } } } };
    }
    chart.current = new Chart(canvas.current, cfg);
    return () => chart.current?.destroy();
  }, [rows, type, cat, isDiv, pre]);
  const vv = rows.map((r) => r.ind[pre + "P"]); const vmn = Math.min(...vv), vmx = Math.max(...vv);
  return (
    <div className="card">
      <div className="cardhead">
        <div className="ct"><b>{title}</b><small>by {isDiv ? "division" : "district"} · {indLabel}</small></div>
        <div className="headctl">
          <select className="chartsel" value={type} onChange={(e) => setType(e.target.value as ChartKind)}>
            {COMPARE_OPTS.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select>
          <div className="seg catseg">{(["all", "sc", "st"] as const).map((c) => (
            <button key={c} className={cat === c ? "active" : ""} onClick={() => setCat(c)}>{c === "all" ? "All" : c.toUpperCase()}</button>))}</div>
        </div>
      </div>
      <div className="chartbox"><canvas ref={canvas} /></div>
      <div className="tablewrap">
        <table>
          <thead><tr><th>#</th><th style={{ textAlign: "left" }}>{isDiv ? "Division" : "District"}</th>
            {headCells.map((h) => <th key={h.k}>{h.t}</th>)}</tr></thead>
          <tbody>{rows.map((e, i) => (
            <tr key={e.u}>
              <td>{i + 1}</td>
              <td style={{ textAlign: "left" }}><span className="sw" style={{ background: isDiv ? (DIVCOLORS[e.u] || "#888") : lerpRYG(vmx > vmn ? (e.ind[pre + "P"] - vmn) / (vmx - vmn) : 0.5) }} />{e.u}</td>
              {headCells.map((h) => <td key={h.k}>{h.k.endsWith("N") ? fmtN(e.ind[h.k]) : e.ind[h.k]}</td>)}
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

/* ================= main ================= */
export default function PrimaryAnalysis() {
  const [pd, setPd] = useState<any>(null);
  const [level, setLevel] = useState("State");
  const [unit, setUnit] = useState("Karnataka");
  const [sheet, setSheet] = useState("");
  const [metric, setMetric] = useState<Metric>("all");
  const [indKey, setIndKey] = useState("0-0"); // selected indicator (tableIdx-indIdx) for compare modes
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px)");
    const upd = () => setIsNarrow(mq.matches);
    upd(); mq.addEventListener("change", upd);
    return () => mq.removeEventListener("change", upd);
  }, []);

  useEffect(() => { fetch("/primary_data.json").then((r) => r.json()).then((d) => { setPd(d); setSheet(d.sheets[0]); }); }, []);

  const units: string[] = (pd && pd.levels[level]) || [];
  useEffect(() => { if (units.length && !units.includes(unit)) setUnit(units[0]); }, [level, pd]); // eslint-disable-line

  const node = pd?.data?.[level]?.[unit];
  const tables = node?.tables?.[sheet] || [];
  const cards = node?.cards;
  // every card defaults to a doughnut; the per-card dropdown can switch it to anything else
  const types = useMemo(() => tables.map(() => "doughnut" as ChartKind), [tables]);
  const districtCount = pd ? (level === "State" ? pd.levels.District.length : level === "Division" ? (pd.divisions[unit]?.length || 0) : 1) : 0;

  // ----- compare modes: All Districts / All Divisions -----
  const isComp = level === "All Districts" || level === "All Divisions";
  const compKey = level === "All Divisions" ? "Division" : "District";
  const compUnits: string[] = !pd ? [] : level === "All Divisions" ? Object.keys(pd.divisions) : pd.levels.District;
  const refTables = pd?.data?.State?.Karnataka?.tables?.[sheet] || [];
  const indOptions = useMemo(() => refTables.flatMap((t: any, ti: number) =>
    t.indicators.map((ind: any, ii: number) => ({ key: `${ti}-${ii}`, ti, ii, tt: t.title, label: ind.label }))), [refTables]);
  // when the topic changes, compare by that topic's headline indicator
  useEffect(() => { if (indOptions.length) { const h = TOPIC_HEADLINE[sheet]; setIndKey(indOptions.some((o: any) => o.key === h) ? h : indOptions[0].key); } }, [sheet, indOptions]); // eslint-disable-line
  const selInd = indOptions.find((o: any) => o.key === indKey) || indOptions[0];
  const mKey = "oP"; // compare always ranks by Overall %
  const ranked = useMemo(() => {
    if (!isComp || !selInd) return [] as { u: string; v: number }[];
    return compUnits.map((u) => { const t = pd.data[compKey]?.[u]?.tables?.[sheet]?.[selInd.ti]; const ind = t?.indicators?.[selInd.ii]; return { u, v: ind ? ind[mKey] : null }; })
      .filter((e) => e.v != null).sort((a: any, b: any) => b.v - a.v) as { u: string; v: number }[];
  }, [isComp, level, sheet, indKey, metric, pd]); // eslint-disable-line
  const rvals = ranked.map((e) => e.v);
  const rMn = rvals.length ? Math.min(...rvals) : 0, rMx = rvals.length ? Math.max(...rvals) : 1;
  const heat = useMemo(() => level === "All Districts" ? { vals: Object.fromEntries(ranked.map((e) => [e.u, e.v])), mn: rMn, mx: rMx } : undefined, [ranked, level]); // eslint-disable-line
  const divColorMap = useMemo(() => { if (level !== "All Divisions" || !pd) return undefined; const m: Record<string, string> = {}; for (const [div, dists] of Object.entries(pd.divisions)) for (const d of dists as string[]) m[d] = DIVCOLORS[div] || "#888"; return m; }, [level, pd]);
  const fmtV = (v: number) => v + "%";
  // per-table comparison: every table of the topic, compared across all districts/divisions (by its 1st indicator)
  const compTables = useMemo(() => {
    if (!isComp || !pd) return [] as { title: string; indLabel: string; data: any[] }[];
    return refTables.map((t: any, ti: number) => ({
      title: t.title, indLabel: t.indicators?.[0]?.label || "",
      data: compUnits.map((u) => { const ind = pd.data[compKey]?.[u]?.tables?.[sheet]?.[ti]?.indicators?.[0]; return ind ? { u, v: ind.oP, ind } : { u, v: null, ind: null }; })
        .filter((e: any) => e.v != null).sort((a: any, b: any) => b.v - a.v),
    }));
  }, [isComp, level, sheet, pd]); // eslint-disable-line

  if (!pd) return <main className="dash"><div className="card" style={{ marginTop: 20 }}><h3>Loading primary analysis…</h3></div></main>;

  return (
    <>
      <div className="controls">
        <div className="ctl"><label>Level</label>
          <select value={level} onChange={(e) => setLevel(e.target.value)}>
            <option>State</option><option>District</option><option>All Districts</option><option>Division</option><option>All Divisions</option>
          </select>
        </div>
        {(level === "District" || level === "Division") && (
          <div className="ctl"><label>{level === "District" ? "District" : "Division"}</label>
            <select value={unit} onChange={(e) => setUnit(e.target.value)}>
              {units.map((u) => <option key={u}>{u}</option>)}
            </select>
          </div>
        )}
        <div className="ctl"><label>Topic</label>
          <select value={sheet} onChange={(e) => setSheet(e.target.value)}>
            {pd.sheets.map((s: string) => <option key={s}>{s}</option>)}
          </select>
        </div>
        {!isComp && (
          <div className="ctl"><label>Values</label>
            <div className="seg">{(["all", "pct", "n"] as Metric[]).map((v) => (
              <button key={v} className={metric === v ? "active" : ""} onClick={() => setMetric(v)}>{v === "all" ? "All" : v === "pct" ? "%" : "N"}</button>))}</div>
          </div>
        )}
      </div>

      <main className="dash">
        {isComp ? (
          <>
            {/* compare summary */}
            <div className="kpis">
              <div className="kpi"><div className="l">Comparing</div><div className="v">{compUnits.length}</div><div className="d up">{level === "All Divisions" ? "divisions" : "districts"} · {sheet}</div></div>
              {ranked.length > 0 && <>
                <div className="kpi"><div className="l">Highest — {selInd?.label}</div><div className="v" style={{ color: "#1ba97a" }}>{ranked[0].u.replace(" Division", "")}</div><div className="d up">{fmtV(ranked[0].v)}</div></div>
                <div className="kpi"><div className="l">Lowest — {selInd?.label}</div><div className="v" style={{ color: "#e9603a" }}>{ranked[ranked.length - 1].u.replace(" Division", "")}</div><div className="d up">{fmtV(ranked[ranked.length - 1].v)}</div></div>
              </>}
            </div>

            {/* one card per table, each compared across all districts / divisions */}
            <div className={"grid primary-charts " + (compTables.length % 4 === 0 ? "cols4" : "cols3")}>
              {compTables.map((c, i) => <CompareCard key={sheet + level + i} title={c.title} indLabel={c.indLabel} data={c.data} isDiv={level === "All Divisions"} />)}
            </div>
          </>
        ) : (
          <>
            {/* summary cards */}
            <div className="kpis">
              <div className="kpi"><div className="l">Overall (Base N)</div><div className="v">{fmtN(cards?.overall)}</div><div className="d up">{unit}</div></div>
              <div className="kpi"><div className="l">SC (N)</div><div className="v" style={{ color: SCCOL }}>{fmtN(cards?.sc)}</div><div className="d up">{cards ? Math.round((100 * cards.sc) / cards.overall) : 0}% of sample</div></div>
              <div className="kpi"><div className="l">ST (N)</div><div className="v" style={{ color: STCOL }}>{fmtN(cards?.st)}</div><div className="d up">{cards ? Math.round((100 * cards.st) / cards.overall) : 0}% of sample</div></div>
              <div className="kpi"><div className="l">Total Districts</div><div className="v" style={{ color: "#1ba97a" }}>{districtCount}</div><div className="d up">{level === "State" ? "Karnataka" : level === "Division" ? unit : "district"}</div></div>
            </div>

            {/* per-table charts */}
            <div className={"grid primary-charts " + (tables.length % 4 === 0 ? "cols4" : "cols3")}>
              {tables.map((t: any, i: number) => <TableBlock key={sheet + i} table={t} metric={metric} type={types[i]} />)}
            </div>
          </>
        )}
      </main>
    </>
  );
}
