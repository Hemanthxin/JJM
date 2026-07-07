"use client";
import { useEffect, useRef, useState } from "react";
import Chart from "chart.js/auto";

const COL: any = { SC: "#2f6fed", ST: "#f07f2f", General: "#1ba97a" };
const HABCOL = COL;
const YRCOL = ["#9ecae1", "#6baed6", "#4292c6", "#2171b5", "#08519c", "#f9a857", "#e9603a"];
const fmtN = (v: any) => (v == null ? "—" : Math.round(v).toLocaleString("en-IN"));
const fmt1 = (v: any) => (v == null ? "—" : (+v).toLocaleString("en-IN", { maximumFractionDigits: 1 }));
const fmt2 = (v: any) => (v == null ? "—" : (+v).toLocaleString("en-IN", { maximumFractionDigits: 2 }));

export default function Dashboard({ data: D }: { data: any }) {
  const YEARS: string[] = D.meta.years;
  const GY: string[] = D.meta.gen_years;
  const districts: string[] = D.meta.districts;

  const [year] = useState("ALL"); // always all-years (trend); selector removed
  const [region, setRegion] = useState("STATE");
  const [analysis, setAnalysis] = useState("Beneficiary");
  const [cat] = useState("ALL"); // always all categories (SC + ST + General); selector removed
  const [view, setView] = useState("trend");
  const [isNarrow, setIsNarrow] = useState(false); // one-table ranking on phones
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px)");
    const upd = () => setIsNarrow(mq.matches);
    upd(); mq.addEventListener("change", upd);
    return () => mq.removeEventListener("change", upd);
  }, []);

  const mainRef = useRef<HTMLCanvasElement>(null);
  const compRef = useRef<HTMLCanvasElement>(null);
  const mainChart = useRef<Chart | null>(null);
  const compChart = useRef<Chart | null>(null);
  const mapDiv = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const geoRef = useRef<any>(null);
  const pieRef = useRef<HTMLCanvasElement>(null);
  const pieChart = useRef<Chart | null>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const miniChart = useRef<Chart | null>(null);
  const scatterRef = useRef<HTMLCanvasElement>(null);
  const scatterChart = useRef<Chart | null>(null);

  const stateOnly = analysis === "Financial" || analysis === "Per Unit";
  const effRegion = stateOnly && region !== "STATE" ? "STATE" : region;
  // "All Districts" trend/table/mini use the state aggregate (= all districts combined)
  const seriesRegion = effRegion === "ALL_DIST" ? "STATE" : effRegion;

  const cats = () => (cat === "ALL" ? ["SC", "ST", "General"] : [cat]);
  const isGrowth = view === "growth";

  // ---------- series getters ----------
  const benefSeries = (c: string) =>
    seriesRegion === "STATE"
      ? YEARS.map((y) => D.beneficiary.state[c][y])
      : YEARS.map((y) => (D.beneficiary.district[seriesRegion]?.[c] || {})[y]);
  const finSeries = (c: string, m: string) =>
    YEARS.map((y) => { const r = D.financial.state[c][y]; return r ? r[m] : null; });
  const perunitSeries = (c: string) => YEARS.map((y) => D.perunit.state[c][y]);
  const habSeries = (c: string) => {
    const src = seriesRegion === "STATE" ? D.habitation.state[c] : D.habitation.district[c]?.[seriesRegion] || {};
    return YEARS.map((y) => (src[y] || {}).pct);
  };
  const toYoY = (s: any[]) =>
    s.map((v, i) => (i === 0 || s[i - 1] == null || !s[i - 1] || v == null ? null : Math.round((100 * (v - s[i - 1])) / s[i - 1] * 100) / 100));
  const genBenefFull = () => GY.map((y) => D.beneficiary.general_full[y]);
  const genFinFull = (m: string) => GY.map((y) => { const r = D.financial.general_full[y]; return r ? (m === "exp" ? r.total_exp : m === "alloc" ? r.allocated : r.pct_exp) : null; });
  const useGenFull = () => effRegion === "STATE" && cat === "General";

  const cagrCalc = (s: any[]) => {
    const idx = s.map((v, i) => (v != null && v > 0 ? i : -1)).filter((i) => i >= 0);
    if (idx.length < 2) return null;
    const fi = idx[0], li = idx[idx.length - 1];
    return Math.round(((s[li] / s[fi]) ** (1 / (li - fi + 1)) - 1) * 1000) / 10;
  };
  const districtCagr = (d: string) => {
    const c = cat === "ALL" ? "General" : cat;
    if (analysis === "Beneficiary") return (D.beneficiary.district_cagr[d] || {})[c];
    if (analysis === "Habitation") { const src = D.habitation.district[c]?.[d] || {}; return cagrCalc(YEARS.map((y) => (src[y] || {}).pct)); }
    return null;
  };

  const districtMetricInfo = () => {
    const yr = year === "ALL" ? null : year;
    if (analysis === "Beneficiary") {
      const c = cat === "ALL" ? "General" : cat;
      const vals: any = {};
      districts.forEach((d) => { const s = D.beneficiary.district[d]?.[c] || {}; vals[d] = yr != null ? s[yr] : YEARS.reduce((a, y) => a + (s[y] || 0), 0); });
      return { vals, label: `${c} beneficiaries — ${yr || "5-yr total"}`, fmt: fmtN };
    }
    if (analysis === "Habitation") {
      const c = cat === "ALL" ? "General" : cat;
      const y = yr || YEARS[YEARS.length - 1];
      const vals: any = {};
      districts.forEach((d) => { const m = D.habitation.district[c]?.[d]?.[y]; vals[d] = m ? m.pct : null; });
      return { vals, label: `${c} FHTC coverage % — ${y}`, fmt: (v: any) => (v == null ? "—" : fmt1(v) + "%") };
    }
    return null;
  };

  // ---------- KPIs + table (computed in render) ----------
  const kpis: { l: string; v: string; d?: number }[] = [];
  let tableHead: string[] = [];
  let tableRows: any[][] = [];
  let tableTitle = "";
  const lastYoY = (s: any[]) => { for (let i = s.length - 1; i > 0; i--) { const a = s[i - 1], b = s[i]; if (a && b != null && a !== 0) return (100 * (b - a)) / a; } return null; };
  const avg = (a: any[]) => { const v = a.filter((x) => x != null); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : null; };

  function buildKpisAndTable() {
    kpis.length = 0; tableRows = [];
    const cs = cats();
    if (analysis === "Beneficiary") {
      if (useGenFull()) {
        kpis.push({ l: "General Total (all years)", v: fmtN(D.beneficiary.general_full_total) });
        kpis.push({ l: "CAGR (2019-20→2025-26)", v: fmt1(D.beneficiary.general_full_cagr) + "%" });
        kpis.push({ l: "Total Households", v: fmtN(D.meta.total_households) });
        kpis.push({ l: "Coverage as on date", v: fmtN(D.meta.coverage_as_on_date) + " (87%)" });
        tableHead = ["Year", ...GY];
        tableRows = [["FHTC provided", ...genBenefFull().map(fmtN)], ["YoY growth %", ...GY.map((y) => { const v = D.beneficiary.general_full_growth[y]; return v == null ? "—" : fmt1(v) + "%"; })]];
        tableTitle = "General Beneficiary — FHTC provided & growth";
        return;
      }
      cs.forEach((c) => { const s = benefSeries(c); const total = s.reduce((a, b) => a + (b || 0), 0); const v = year === "ALL" ? total : s[YEARS.indexOf(year)]; kpis.push({ l: year === "ALL" ? `${c} Total (5 yr)` : `${c} ${year}`, v: fmtN(v), d: year === "ALL" ? lastYoY(s) : undefined } as any); });
      if (seriesRegion === "STATE" && !isGrowth) { const eq = D.beneficiary.equity[year === "ALL" ? YEARS[YEARS.length - 1] : year]; if (eq) kpis.push({ l: "SC : ST Equity (share)", v: `${fmt1(eq.sc_share)}% / ${fmt1(eq.st_share)}%` }); }
      tableHead = ["Category", ...YEARS, "Total", "CAGR %"];
      tableRows = ["SC", "ST", "General"].map((c) => { const s = benefSeries(c); const tot = s.reduce((a, b) => a + (b || 0), 0); const cg = seriesRegion === "STATE" ? D.beneficiary.state_cagr[c] : (D.beneficiary.district_cagr[seriesRegion] || {})[c]; return [c, ...s.map(fmtN), fmtN(tot), cg == null ? "—" : fmt1(cg)]; });
      tableTitle = "Beneficiary Count by Year (with CAGR)";
    } else if (analysis === "Financial") {
      cs.forEach((c) => { const exp = finSeries(c, "exp"); const te = c === "General" ? D.financial.general_full_total_exp : exp.reduce((a, b) => a + (b || 0), 0); kpis.push({ l: `${c} Expenditure`, v: "₹" + fmt1(te) + " Cr", d: lastYoY(exp) } as any); });
      tableHead = ["Category / Metric", ...YEARS];
      ["SC", "ST", "General"].forEach((c) => {
        tableRows.push([c + " — Allocation (Cr)", ...finSeries(c, "alloc").map(fmt1)]);
        tableRows.push([c + " — Expenditure (Cr)", ...finSeries(c, "exp").map(fmt1)]);
        tableRows.push([c + " — % Exp/Alloc", ...finSeries(c, "pct_exp").map((v) => (v == null ? "—" : fmt1(v) + "%"))]);
      });
      tableTitle = "Allocation, Expenditure & % by Year (Rs Crore)";
    } else if (analysis === "Per Unit") {
      cs.forEach((c) => { const s = perunitSeries(c); const v = year === "ALL" ? avg(s) : s[YEARS.indexOf(year)]; kpis.push({ l: `${c} Per-Unit`, v: v == null ? "—" : "₹" + fmtN(v) }); });
      tableHead = ["Category", ...YEARS];
      tableRows = ["SC", "ST", "General"].map((c) => [c, ...perunitSeries(c).map((v) => (v == null ? "—" : "₹" + fmtN(v)))]);
      tableTitle = "Per-Unit Cost (Rs / beneficiary)";
    } else {
      const yi = year === "ALL" ? YEARS.length - 1 : YEARS.indexOf(year);
      cs.forEach((c) => { const s = habSeries(c); kpis.push({ l: `${c} coverage ${YEARS[yi]}`, v: s[yi] != null ? fmt1(s[yi]) + "%" : "—", d: lastYoY(s) } as any); });
      tableHead = ["Category", ...YEARS, "CAGR %"];
      tableRows = ["SC", "ST", "General"].map((c) => { const s = habSeries(c); const cg = seriesRegion === "STATE" ? D.habitation.state_cagr[c] : cagrCalc(s); return [c, ...s.map((v) => (v == null ? "—" : fmt1(v) + "%")), cg == null ? "—" : fmt1(cg)]; });
      tableTitle = "FHTC Coverage % by Year";
    }
  }
  // ranking (all-districts, by CAGR)
  const info = districtMetricInfo();

  buildKpisAndTable();
  // All-Districts: replace KPIs with highest / lowest district + values
  if (effRegion === "ALL_DIST" && info) {
    kpis.length = 0;
    const ent = districts.map((d) => ({ d, v: info.vals[d] })).filter((e) => e.v != null).sort((a, b) => b.v - a.v);
    if (ent.length) {
      const hi = ent[0], lo = ent[ent.length - 1];
      const noun = analysis === "Habitation" ? "Coverage" : "Beneficiary";
      kpis.push({ l: "Highest " + noun, v: hi.d });
      kpis.push({ l: `${hi.d} value`, v: info.fmt(hi.v) });
      kpis.push({ l: "Lowest " + noun, v: lo.d });
      kpis.push({ l: `${lo.d} value`, v: info.fmt(lo.v) });
      if (analysis === "Beneficiary") {
        kpis.push({ l: "SC Total (5 yr)", v: fmtN(benefSeries("SC").reduce((a, b) => a + (b || 0), 0)) });
        kpis.push({ l: "ST Total (5 yr)", v: fmtN(benefSeries("ST").reduce((a, b) => a + (b || 0), 0)) });
      }
    }
  }
  // heat-color range for the ranking swatches (matches the map)
  const rankVals = info ? (Object.values(info.vals).filter((v: any) => v != null) as number[]) : [];
  const rMn = rankVals.length ? Math.min(...rankVals) : 0, rMx = rankVals.length ? Math.max(...rankVals) : 1;
  const ranking = info
    ? districts.map((d) => ({ d, val: info.vals[d], cg: districtCagr(d) })).filter((e) => e.val != null).sort((a, b) => (b.cg == null ? -1e9 : b.cg) - (a.cg == null ? -1e9 : a.cg))
    : [];

  // ---------- state / single-district summary panel ----------
  function stateAggregate() {
    const yr = year === "ALL" ? null : year;
    if (analysis === "Beneficiary") {
      const c = cat === "ALL" ? "General" : cat;
      if (c === "General") { const v = yr ? D.beneficiary.general_full[yr] : D.beneficiary.general_full_total; return { title: `General FHTC — ${yr || "all years"}`, value: fmtN(v) }; }
      const s = D.beneficiary.state[c]; const v = yr ? s[yr] : YEARS.reduce((a, y) => a + (s[y] || 0), 0);
      return { title: `${c} beneficiaries — ${yr || "5-yr total"}`, value: fmtN(v) };
    }
    if (analysis === "Habitation") { const c = cat === "ALL" ? "General" : cat; const y = yr || YEARS[YEARS.length - 1]; const m = D.habitation.state[c][y] || {}; return { title: `${c} FHTC coverage — ${y}`, value: m.pct != null ? fmt1(m.pct) + "%" : "—" }; }
    if (analysis === "Financial") return { title: "Total Expenditure (all yrs)", value: "₹" + fmt1(D.financial.general_full_total_exp) + " Cr" };
    const s = D.perunit.state.General; const y = yr || YEARS[YEARS.length - 1]; return { title: `General per-unit — ${y}`, value: s[y] != null ? "₹" + fmtN(s[y]) : "—" };
  }

  const summaryPairs: [string, string][] = [];
  if (effRegion === "STATE") {
    const a = stateAggregate();
    summaryPairs.push([a.title, a.value]);
    summaryPairs.push(["Total Households", fmtN(D.meta.total_households)]);
    summaryPairs.push(["Coverage (as on date)", fmtN(D.meta.coverage_as_on_date) + " (87%)"]);
    summaryPairs.push(["General FHTC (all years)", fmtN(D.beneficiary.general_full_total)]);
    summaryPairs.push(["General Expenditure", "₹" + fmt2(D.financial.general_full_total_exp) + " Cr"]);
    summaryPairs.push(["SC total (5 yr)", fmtN(YEARS.reduce((a, y) => a + (D.beneficiary.state.SC[y] || 0), 0))]);
    summaryPairs.push(["ST total (5 yr)", fmtN(YEARS.reduce((a, y) => a + (D.beneficiary.state.ST[y] || 0), 0))]);
  } else if (effRegion !== "ALL_DIST" && info) {
    const d = effRegion, c = cat === "ALL" ? "General" : cat;
    summaryPairs.push([info.label, info.fmt(info.vals[d])]);
    const ranked = districts.filter((x) => info.vals[x] != null).map((x) => ({ x, cg: districtCagr(x) })).sort((a, b) => (b.cg == null ? -1e9 : b.cg) - (a.cg == null ? -1e9 : a.cg));
    const rk = ranked.findIndex((e) => e.x === d) + 1; const cg = districtCagr(d);
    if (rk) summaryPairs.push([`CAGR Rank (of ${ranked.length})`, "#" + rk]);
    if (cg != null) summaryPairs.push(["CAGR", fmt1(cg) + "%"]);
    if (analysis === "Beneficiary") { const s = D.beneficiary.district[d]?.[c] || {}; summaryPairs.push([`${c} 5-yr total`, fmtN(YEARS.reduce((a, y) => a + (s[y] || 0), 0))]); }
    if (analysis === "Habitation") {
      const y = year === "ALL" ? YEARS[YEARS.length - 1] : year; const m = D.habitation.district[c]?.[d]?.[y] || {};
      summaryPairs.push(["Households", fmtN(m.households)]); summaryPairs.push(["Connections", fmtN(m.connections)]);
      const cmp = D.habitation.comparative.district[d]?.[y] || {};
      if (cmp.sc_vs_gen != null) summaryPairs.push(["SC vs General", (cmp.sc_vs_gen >= 0 ? "+" : "") + fmt1(cmp.sc_vs_gen) + " pp"]);
      if (cmp.st_vs_gen != null) summaryPairs.push(["ST vs General", (cmp.st_vs_gen >= 0 ? "+" : "") + fmt1(cmp.st_vs_gen) + " pp"]);
    }
  }
  const showPie = effRegion !== "ALL_DIST";

  // ---------- color helpers for map ----------
  const lerpRYG = (t: number) => {
    const stops = [[215, 48, 39], [252, 141, 89], [254, 224, 139], [166, 217, 106], [26, 152, 80]];
    t = Math.max(0, Math.min(1, t)); const n = stops.length - 1, seg = t * n, i = Math.min(n - 1, Math.floor(seg)), f = seg - i;
    const a = stops[i], b = stops[i + 1];
    return `rgb(${a.map((x, k) => Math.round(x + (b[k] - x) * f)).join(",")})`;
  };

  // ---------- main chart ----------
  useEffect(() => {
    if (!mainRef.current) return;
    mainChart.current?.destroy();
    const baseScales = { y: { ticks: { color: "#5b6b7d" }, grid: { color: "#eaf0f6" } }, x: { ticks: { color: "#5b6b7d" }, grid: { color: "#eaf0f6" } } };
    let cfg: any;
    const cs = cats();

    // All Districts -> horizontal bar across all 31 districts
    if (effRegion === "ALL_DIST" && info) {
      const ent = districts.map((d) => [d, info.vals[d]] as [string, number]).filter((e) => e[1] != null).sort((a, b) => b[1] - a[1]);
      cfg = { type: "bar", data: { labels: ent.map((e) => e[0]), datasets: [{ label: info.label, data: ent.map((e) => e[1]), backgroundColor: ent.map((_, i) => (i < 3 ? "#1a9850" : i >= ent.length - 3 ? "#d73027" : "#2f6fed")) }] },
        options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: "#5b6b7d" }, grid: { color: "#eaf0f6" } }, y: { ticks: { color: "#5b6b7d", font: { size: 10 } }, grid: { display: false } } } } };
      mainChart.current = new Chart(mainRef.current, cfg);
      return () => mainChart.current?.destroy();
    }

    if (analysis === "Beneficiary" && useGenFull()) {
      const s = genBenefFull();
      cfg = isGrowth
        ? { type: "bar", data: { labels: GY, datasets: [{ label: "YoY %", data: toYoY(s), backgroundColor: "#1ba97acc" }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: baseScales } }
        : { type: "bar", data: { labels: GY, datasets: [{ label: "FHTC provided", data: s, backgroundColor: "#1ba97a" }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: baseScales } };
    } else if (analysis === "Beneficiary") {
      const sBy: any = {}; cs.forEach((c) => (sBy[c] = benefSeries(c)));
      cfg = chartFor(sBy, isGrowth, baseScales);
    } else if (analysis === "Financial") {
      if (useGenFull()) {
        const exp = genFinFull("exp");
        cfg = { type: "bar", data: { labels: GY, datasets: [{ label: isGrowth ? "YoY %" : "Expenditure (Cr)", data: isGrowth ? toYoY(exp) : exp, backgroundColor: "#1ba97a" }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: baseScales } };
      } else if (isGrowth) {
        const sBy: any = {}; cs.forEach((c) => (sBy[c] = finSeries(c, "exp")));
        cfg = chartFor(sBy, true, baseScales);
      } else {
        const EXPC: any = { SC: "#153e86", ST: "#a8480f", General: "#0b6b46" };   // dark blue / dark orange / dark green
        const ALLC: any = { SC: "#6f27d6", ST: "#8a5a10", General: "#0e6f8c" };   // purple / brown / teal
        const PCTC: any = { SC: "#b0114f", ST: "#2f3a4a", General: "#7a5c00" };   // magenta / slate / gold
        const ds = cs.map((c) => ({ type: "line", label: c + " Exp", data: finSeries(c, "exp"), borderColor: EXPC[c], backgroundColor: EXPC[c] + "22", borderWidth: 3, pointRadius: 3, tension: 0.3, fill: false, yAxisID: "y" }));
        const dsA = cs.map((c) => ({ type: "line", label: c + " Alloc", data: finSeries(c, "alloc"), borderColor: ALLC[c], borderWidth: 2.5, borderDash: [6, 4], pointRadius: 2, tension: 0.3, fill: false, yAxisID: "y" }));
        const ds2 = cs.map((c) => ({ type: "line", label: c + " % Exp/Alloc", data: finSeries(c, "pct_exp"), borderColor: PCTC[c], borderWidth: 2, borderDash: [2, 2], pointRadius: 0, fill: false, yAxisID: "y1" }));
        cfg = { data: { labels: YEARS, datasets: [...dsA, ...ds, ...ds2] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: "#1f2d3d" } } }, scales: { y: { position: "left", ticks: { color: "#5b6b7d" }, grid: { color: "#eaf0f6" } }, y1: { position: "right", min: 0, max: 300, ticks: { color: "#5b6b7d" }, grid: { drawOnChartArea: false } }, x: { ticks: { color: "#5b6b7d" }, grid: { color: "#eaf0f6" } } } } };
      }
    } else if (analysis === "Per Unit") {
      const sBy: any = {}; cs.forEach((c) => (sBy[c] = perunitSeries(c)));
      cfg = chartFor(sBy, isGrowth, baseScales);
    } else {
      // Habitation
      if (isGrowth) {
        const ds = cs.map((c) => ({ type: "bar", label: c + " coverage %", data: habSeries(c), backgroundColor: HABCOL[c] + "cc" }));
        cfg = { data: { labels: YEARS, datasets: ds }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: "#1f2d3d" } } }, scales: baseScales } };
      } else {
        const ds = cs.map((c) => ({ type: "line", label: c + " coverage %", data: habSeries(c), borderColor: HABCOL[c], backgroundColor: HABCOL[c] + "22", tension: 0.3, borderWidth: 3, pointRadius: 4, fill: cs.length === 1 }));
        cfg = { data: { labels: YEARS, datasets: ds }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: "#1f2d3d" } } }, scales: { y: { min: 0, max: 100, ticks: { color: "#5b6b7d", callback: (v: any) => v + "%" }, grid: { color: "#eaf0f6" } }, x: { ticks: { color: "#5b6b7d" }, grid: { color: "#eaf0f6" } } } } };
      }
    }
    mainChart.current = new Chart(mainRef.current, cfg);
    return () => mainChart.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, region, analysis, cat, view]);

  function chartFor(sBy: any, growth: boolean, baseScales: any) {
    if (growth) {
      // plot the actual year-wise values (from the table) so every year incl. 2020-21 has a bar
      const ds = Object.entries(sBy).map(([c, s]: any) => ({ type: "bar", label: c, data: s, backgroundColor: (COL[c] || "#2f6fed") + "cc" }));
      return { data: { labels: YEARS, datasets: ds }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: "#1f2d3d" } } }, scales: baseScales } };
    }
    if (year !== "ALL") {
      const yi = YEARS.indexOf(year);
      return { type: "bar", data: { labels: Object.keys(sBy), datasets: [{ label: year, data: Object.values(sBy).map((s: any) => s[yi]), backgroundColor: Object.keys(sBy).map((c) => COL[c] || "#2f6fed") }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: baseScales } };
    }
    const ds = Object.entries(sBy).map(([c, s]: any) => ({ label: c, data: s, borderColor: COL[c] || "#2f6fed", backgroundColor: (COL[c] || "#2f6fed") + "33", tension: 0.3, borderWidth: 2, pointRadius: 4, fill: false }));
    return { type: "line", data: { labels: YEARS, datasets: ds }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: "#1f2d3d" } } }, scales: baseScales } };
  }

  // ---------- comparative chart (Beneficiary & Habitation) ----------
  useEffect(() => {
    if (!compRef.current) return;
    compChart.current?.destroy();
    if (analysis !== "Beneficiary" && analysis !== "Habitation") return;
    const useState_ = effRegion === "STATE" || effRegion === "ALL_DIST";
    let cfg: any;
    if (analysis === "Beneficiary") {
      // SC:ST equity computed from the selected region's SC/ST beneficiaries (state or single district)
      const scS = useState_ ? YEARS.map((y) => D.beneficiary.state.SC[y]) : YEARS.map((y) => (D.beneficiary.district[effRegion]?.SC || {})[y]);
      const stS = useState_ ? YEARS.map((y) => D.beneficiary.state.ST[y]) : YEARS.map((y) => (D.beneficiary.district[effRegion]?.ST || {})[y]);
      const scShare = scS.map((s, i) => { const t = stS[i]; return s != null && t != null && s + t > 0 ? Math.round((s / (s + t)) * 1000) / 10 : null; });
      const stShare = scS.map((s, i) => { const t = stS[i]; return s != null && t != null && s + t > 0 ? Math.round((t / (s + t)) * 1000) / 10 : null; });
      const ratio = scS.map((s, i) => { const t = stS[i]; return s != null && t != null && t > 0 ? Math.round((s / t) * 100) / 100 : null; });
      cfg = { data: { labels: YEARS, datasets: [
        { type: "bar", label: "SC share %", data: scShare, backgroundColor: "#2f6fedcc", yAxisID: "y" },
        { type: "bar", label: "ST share %", data: stShare, backgroundColor: "#f07f2fcc", yAxisID: "y" },
        { type: "line", label: "SC : ST ratio", data: ratio, borderColor: "#1ba97a", borderWidth: 3, pointRadius: 4, fill: false, tension: 0.3, yAxisID: "y1" }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: "#1f2d3d" } } }, scales: { y: { min: 0, max: 100, position: "left", ticks: { color: "#5b6b7d", callback: (v: any) => v + "%" }, grid: { color: "#eaf0f6" } }, y1: { min: 0, position: "right", ticks: { color: "#5b6b7d" }, grid: { drawOnChartArea: false } }, x: { ticks: { color: "#5b6b7d" }, grid: { color: "#eaf0f6" } } } } };
    } else {
      const src = useState_ ? D.habitation.comparative.state : D.habitation.comparative.district[effRegion] || {};
      cfg = { data: { labels: YEARS, datasets: [
        { type: "line", label: "SC coverage %", data: YEARS.map((y) => (src[y] || {}).sc), borderColor: "#2f6fed", fill: false, tension: 0.3 },
        { type: "line", label: "ST coverage %", data: YEARS.map((y) => (src[y] || {}).st), borderColor: "#f07f2f", fill: false, tension: 0.3 },
        { type: "line", label: "General coverage %", data: YEARS.map((y) => (src[y] || {}).gen), borderColor: "#1ba97a", borderDash: [5, 4], fill: false, tension: 0.3 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: "#1f2d3d" } } }, scales: { y: { min: 0, max: 100, ticks: { color: "#5b6b7d", callback: (v: any) => v + "%" }, grid: { color: "#eaf0f6" } }, x: { ticks: { color: "#5b6b7d" }, grid: { color: "#eaf0f6" } } } } };
    }
    compChart.current = new Chart(compRef.current, cfg);
    return () => compChart.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, region, analysis, cat]);

  // ---------- side growth doughnut (STATE / single district) ----------
  useEffect(() => {
    if (!pieRef.current || !showPie) return;
    pieChart.current?.destroy();
    const c = cat === "ALL" ? "General" : cat;
    const isDist = effRegion !== "STATE" && effRegion !== "ALL_DIST";
    let labels: string[], vals: any[], unit = "", what = "Beneficiaries";
    if (!isDist && analysis === "Financial") {
      what = "Expenditure"; unit = " Cr";
      if (c === "General") { labels = GY; vals = GY.map((y) => D.financial.general_full[y].total_exp); }
      else { labels = YEARS; vals = YEARS.map((y) => { const r = D.financial.state[c][y]; return r ? r.exp : 0; }); }
    } else {
      if (isDist) { const s = D.beneficiary.district[effRegion]?.[c] || {}; labels = YEARS; vals = YEARS.map((y) => s[y] || 0); }
      else if (c === "General") { labels = GY; vals = GY.map((y) => D.beneficiary.general_full[y]); }
      else { labels = YEARS; vals = YEARS.map((y) => D.beneficiary.state[c][y] || 0); }
    }
    const total = vals.reduce((a, b) => a + (b || 0), 0) || 1;
    pieChart.current = new Chart(pieRef.current, {
      type: "doughnut",
      data: { labels, datasets: [{ data: vals, backgroundColor: labels.map((_, i) => YRCOL[i % YRCOL.length]), borderColor: "#fff", borderWidth: 2 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: "55%",
        plugins: { legend: { position: "right", labels: { color: "#1f2d3d", boxWidth: 12, font: { size: 11 } } },
          tooltip: { callbacks: { label: (x: any) => ` ${x.label}: ${unit ? "₹" + fmt1(x.parsed) : fmtN(x.parsed)}${unit} (${fmt1((100 * x.parsed) / total)}%)` } } } },
    });
    return () => pieChart.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, region, analysis, cat]);

  // ---------- category-comparison mini bar (under the table) ----------
  useEffect(() => {
    if (!miniRef.current) return;
    miniChart.current?.destroy();
    const cs = ["SC", "ST", "General"]; const colors = cs.map((c) => COL[c]);
    let vals: any[], fmtv: (v: any) => string;
    if (analysis === "Financial") { vals = cs.map((c) => (c === "General" ? D.financial.general_full_total_exp : finSeries(c, "exp").reduce((a, b) => a + (b || 0), 0))); fmtv = (v) => "₹" + fmt1(v) + " Cr"; }
    else if (analysis === "Per Unit") { vals = cs.map((c) => avg(perunitSeries(c))); fmtv = (v) => (v == null ? "—" : "₹" + fmtN(v)); }
    else if (analysis === "Habitation") { const yi = YEARS.length - 1; vals = cs.map((c) => habSeries(c)[yi]); fmtv = (v) => (v == null ? "—" : fmt1(v) + "%"); }
    else { vals = cs.map((c) => benefSeries(c).reduce((a, b) => a + (b || 0), 0)); fmtv = fmtN; }
    miniChart.current = new Chart(miniRef.current, {
      type: "bar", data: { labels: cs, datasets: [{ data: vals, backgroundColor: colors }] },
      options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (x: any) => " " + fmtv(x.parsed.x) } } }, scales: { x: { ticks: { color: "#5b6b7d" }, grid: { color: "#eaf0f6" } }, y: { ticks: { color: "#5b6b7d" }, grid: { display: false } } } },
    });
    return () => miniChart.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, region, analysis, cat, view]);

  // ---------- All-Districts: value vs CAGR scatter (fills the right column) ----------
  useEffect(() => {
    scatterChart.current?.destroy();
    if (effRegion !== "ALL_DIST" || !scatterRef.current || !info) return;
    const pts = districts.map((d) => ({ x: info.vals[d], y: districtCagr(d), d })).filter((p) => p.x != null && p.y != null);
    const xLabel = analysis === "Habitation" ? "Coverage %" : "Beneficiaries";
    scatterChart.current = new Chart(scatterRef.current, {
      type: "scatter",
      data: { datasets: [{ label: "Districts", data: pts as any, backgroundColor: "#2f6fed", pointRadius: 5, pointHoverRadius: 8, borderColor: "#1133aa" }] },
      options: { responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c: any) => `${c.raw.d}: ${info.fmt(c.raw.x)} · CAGR ${fmt1(c.raw.y)}%` } } },
        scales: {
          x: { title: { display: true, text: xLabel, color: "#5b6b7d" }, ticks: { color: "#5b6b7d" }, grid: { color: "#eaf0f6" } },
          y: { title: { display: true, text: "CAGR %", color: "#5b6b7d" }, ticks: { color: "#5b6b7d", callback: (v: any) => v + "%" }, grid: { color: "#eaf0f6" } },
        }, onClick: (_e: any, els: any) => { if (els[0]) setRegion(pts[els[0].index].d); } },
    });
    return () => scatterChart.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, region, analysis, cat]);

  // ---------- Leaflet map ----------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      const geo = geoRef.current || (await fetch("/kar_districts.json").then((r) => r.json()));
      geoRef.current = geo;
      if (cancelled || !mapDiv.current) return;
      if (!mapRef.current) {
        mapRef.current = L.map(mapDiv.current, { zoomControl: false, attributionControl: false, scrollWheelZoom: false, dragging: false, doubleClickZoom: false, zoomSnap: 0 }).setView([14.8, 76.2], 6.4);
      }
      drawMap(L);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, region, analysis, cat]);

  function drawMap(L: any) {
    const map = mapRef.current; if (!map) return;
    if (geoRef.current && !geoRef.current.__layer) {
      // first draw
    }
    // remove previous layer
    if (map.__geo) { map.removeLayer(map.__geo); }
    const info2 = districtMetricInfo();
    const vals = info2 ? info2.vals : {};
    const nums = Object.values(vals).filter((v: any) => v != null) as number[];
    const mn = nums.length ? Math.min(...nums) : 0, mx = nums.length ? Math.max(...nums) : 1;
    const colorFor = (v: any) => (v == null ? "#d9e2ec" : lerpRYG(mx > mn ? (v - mn) / (mx - mn) : 0.5));
    const mode = region === "STATE" ? "STATE" : region === "ALL_DIST" ? "ALL" : "SINGLE";
    const layer = L.geoJSON(geoRef.current, {
      style: (f: any) => {
        const d = f.properties.d;
        if (mode === "STATE") return { fillColor: "#bcd6f2", fillOpacity: 0.9, color: "#fff", weight: 1 };
        if (mode === "SINGLE") return d === region ? { fillColor: colorFor(vals[d]), fillOpacity: 0.95, color: "#1133aa", weight: 3 } : { fillColor: "#eef3f9", fillOpacity: 0.85, color: "#fff", weight: 1 };
        return { fillColor: colorFor(vals[d]), fillOpacity: 0.9, color: "#fff", weight: 1 };
      },
      onEachFeature: (f: any, lyr: any) => {
        const d = f.properties.d;
        lyr.on("click", () => setRegion(d));
        // label + value shows on HOVER (ALL mode); the selected district stays pinned in SINGLE mode
        if (info2 && vals[d] != null) {
          const pinned = mode === "SINGLE" && d === region;
          if (mode === "ALL" || pinned) {
            lyr.bindTooltip(`<b>${d}</b><br><span class="lv">${info2.fmt(vals[d])}</span>`,
              { permanent: pinned, sticky: !pinned, direction: "center", className: "distlabel", opacity: 1 });
          }
        }
        lyr.on("mouseover", () => lyr.setStyle({ weight: 2.5, color: "#12336f", fillOpacity: 0.98 }));
        lyr.on("mouseout", () => layer.resetStyle(lyr));
      },
    }).addTo(map);
    map.__geo = layer;
    setTimeout(() => { map.invalidateSize(); map.fitBounds(layer.getBounds(), { padding: [4, 4] }); }, 30);
  }

  // ---------- render ----------
  const regionName = effRegion === "STATE" ? "Karnataka (State)" : effRegion === "ALL_DIST" ? "All Districts" : effRegion;
  const showComp = analysis === "Beneficiary"; // equity chart; Habitation comparative removed

  return (
    <>
      <div className="controls">
        <div className="ctl"><label>State / District</label>
          <select value={effRegion} onChange={(e) => setRegion(e.target.value)} disabled={stateOnly}>
            <optgroup label="State"><option value="STATE">Karnataka (State)</option></optgroup>
            <optgroup label="District">
              <option value="ALL_DIST">All Districts (compare)</option>
              {districts.map((d) => <option key={d} value={d}>{d}</option>)}
            </optgroup>
          </select>
        </div>
        <div className="ctl"><label>Analysis Type</label>
          <select value={analysis} onChange={(e) => setAnalysis(e.target.value)}>
            <option value="Beneficiary">Physical Analysis</option><option value="Financial">Financial Analysis</option><option value="Per Unit">Per-Unit Cost Analysis</option><option value="Habitation">Coverage Analysis</option>
          </select>
        </div>
        <div className="ctl"><label>View</label>
          <div className="seg">{["trend", "growth"].map((v) => (
            <button key={v} className={view === v ? "active" : ""} onClick={() => setView(v)}>{v === "trend" ? "Trend" : "Growth"}</button>))}</div>
        </div>
      </div>

      <main className="dash">
        <div className="kpis">
          {kpis.map((k, i) => (
            <div className="kpi" key={i}>
              <div className="l">{k.l}</div>
              <div className="v">{k.v}</div>
              {k.d != null && <div className={"d " + (k.d >= 0 ? "up" : "down")}>{k.d >= 0 ? "▲" : "▼"} {fmt1(Math.abs(k.d))}% YoY</div>}
            </div>
          ))}
        </div>

        {/* Map + ranking — only in All Districts (compare) view */}
        {effRegion === "ALL_DIST" && (
        <div className="grid maprow">
          <div className="card">
            <h3>Karnataka Heat Map <small>{info ? info.label : "— state-level analysis"}</small></h3>
            <div ref={mapDiv} id="map" />
            <div className="legend"><span>{info ? info.fmt(Math.min(...((Object.values(info.vals).filter((v: any) => v != null)) as number[]))) : "—"}</span>
              <span className="bar" /><span>{info ? info.fmt(Math.max(...((Object.values(info.vals).filter((v: any) => v != null)) as number[]))) : "—"}</span></div>
          </div>
          <div className="card">
            {effRegion === "ALL_DIST" ? (
              <>
                <h3>{info ? `District Ranking by CAGR — ${cat === "ALL" ? "General" : cat}` : "District Ranking"}</h3>
                {info ? (
                  isNarrow ? (
                    <div className="rankwrap">
                      <table>
                        <thead><tr><th className="rk">#</th><th>District</th><th>CAGR %</th><th>{analysis === "Habitation" ? "FHTC %" : "Beneficiaries"}</th></tr></thead>
                        <tbody>
                          {ranking.map((e, i) => (
                            <tr key={e.d} onClick={() => setRegion(e.d)}>
                              <td className="rk">{i + 1}</td>
                              <td><span className="sw" style={{ background: lerpRYG(rMx > rMn && e.val != null ? (e.val - rMn) / (rMx - rMn) : 0.5) }} />{e.d}</td>
                              <td style={{ fontWeight: 700, color: "#13233a" }}>{e.cg == null ? "—" : fmt1(e.cg) + "%"}</td>
                              <td>{info.fmt(e.val)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                  <div className="rank2col">
                    {(() => { const per = Math.ceil(ranking.length / 3); return [0, 1, 2].map((col) => { const chunk = ranking.slice(col * per, col * per + per); return (
                      <table key={col}>
                        <thead><tr><th className="rk">#</th><th>District</th><th>CAGR %</th><th>{analysis === "Habitation" ? "FHTC %" : "Beneficiaries"}</th></tr></thead>
                        <tbody>
                          {chunk.map((e, i) => (
                            <tr key={e.d} onClick={() => setRegion(e.d)}>
                              <td className="rk">{col * per + i + 1}</td>
                              <td><span className="sw" style={{ background: lerpRYG(rMx > rMn && e.val != null ? (e.val - rMn) / (rMx - rMn) : 0.5) }} />{e.d}</td>
                              <td style={{ fontWeight: 700, color: "#13233a" }}>{e.cg == null ? "—" : fmt1(e.cg) + "%"}</td>
                              <td>{info.fmt(e.val)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ); }); })()}
                  </div>
                  )
                ) : (
                  <p style={{ color: "#5b6b7d", fontSize: 13 }}>Not available — Financial / Per-Unit are state-level only.</p>
                )}
              </>
            ) : (
              <>
                <h3>{effRegion === "STATE" ? "Karnataka — State Summary" : `${effRegion} — Summary`}</h3>
                <table>
                  <tbody>
                    {summaryPairs.map(([k, v], i) => (
                      <tr key={i}><td>{k}</td><td style={{ textAlign: "right", fontWeight: 700, color: "#13233a" }}>{v}</td></tr>
                    ))}
                  </tbody>
                </table>
                {showPie && (
                  <>
                    <h3 style={{ marginTop: 16 }}>Growth Analysis — share by year</h3>
                    <div className="chartbox sidefill"><canvas ref={pieRef} /></div>
                  </>
                )}
                {effRegion !== "STATE" && (
                  <p style={{ fontSize: 12, marginTop: 8 }}>
                    <a href="#" onClick={(e) => { e.preventDefault(); setRegion("ALL_DIST"); }}>← back to All Districts</a>
                  </p>
                )}
              </>
            )}
          </div>
        </div>
        )}

        {/* Trend chart with the data table below it (single card) */}
        <div className="card">
          <h3>{effRegion === "ALL_DIST"
            ? <>All Districts <small>— {info ? info.label : ""}</small></>
            : <>{analysis} {isGrowth ? "Growth" : "Trend"} <small>— {regionName}</small></>}</h3>
          <div className="chartbox" style={{ height: effRegion === "ALL_DIST" ? 640 : analysis === "Financial" ? 540 : 420 }}><canvas ref={mainRef} /></div>
          <h3 style={{ marginTop: 16 }}>{tableTitle}</h3>
          <div className="tablewrap">
            <table>
              <thead><tr>{tableHead.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
              <tbody>{tableRows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
            </table>
          </div>
          {effRegion === "ALL_DIST" && (
            <>
              <h3 style={{ marginTop: 16 }}>Districts — value vs growth (CAGR) <small>click a point to drill in</small></h3>
              <div className="chartbox" style={{ height: 280 }}><canvas ref={scatterRef} /></div>
            </>
          )}
        </div>

        {/* Comparative */}
        {showComp && (
          <div className="card" style={{ marginTop: 18 }}>
            <h3>SC : ST Equity — share (%) &amp; ratio, by year</h3>
            <div className="chartbox"><canvas ref={compRef} /></div>
          </div>
        )}
      </main>
    </>
  );
}
