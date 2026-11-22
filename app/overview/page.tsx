"use client";

import { motion } from "framer-motion";
import { Activity, ArrowRight, ArrowRightLeft, Calculator, FileText, Gauge, Scale, Sparkles, Table2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import clsx from "clsx";
import { RiskGauge, riskColor } from "@/components/charts/RiskGauge";
import { Series, TrendChart, WC, WC_LABEL, WorkingCapitalChart } from "@/components/charts/Charts";
import { Kpi, KpiCard } from "@/components/dashboard/KpiCard";
import { PillarSection } from "@/components/risk/pillars";
import { BenchmarkComparison, CashConversionChart } from "@/components/risk/BenchTable";
import { DebtChart } from "@/components/risk/charts";
import { LevelBadge } from "@/components/risk/parts";
import { WithAnalysis } from "@/components/shared/Guard";
import { Bar, Card, CardHead, PageTitle, Pill, SeverityBadge } from "@/components/shared/ui";
import { useApp } from "@/lib/state/store";
import { fmtDays, fmtM, fmtPct, growth, signed, cur } from "@/lib/utilities/format";
import { buildExecutiveInsight } from "@/lib/calculations/narrative";
import { buildFindings } from "@/lib/calculations/findings";
import { adjustedEbitda } from "@/lib/calculations/pe-risk";
import { potentialRelease } from "@/lib/calculations/wc-release";
import type { AnalysisResult } from "@/types/finance";

const Tabs = <T extends string>({ items, value, onChange, label }: { items: { id: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) => (
  <div role="tablist" aria-label={label} className="inline-flex rounded-xl border border-line bg-bg2 p-1">
    {items.map((i) => (
      <button key={i.id} role="tab" aria-selected={value === i.id} onClick={() => onChange(i.id)} className={clsx("rounded-lg px-3 py-1.5 font-mono text-[11px] transition-colors", value === i.id ? "bg-elev text-ink" : "text-ink3 hover:text-ink2")}>{i.label}</button>
    ))}
  </div>
);

/** the six headline measures an investment partner reads first */
function headline(a: AnalysisResult): Kpi[] {
  const { risk, latestRecord: c, previousRecord: p } = a;
  const e = adjustedEbitda(c, a.inputs, true), pe = p ? adjustedEbitda(p, a.inputs, false) : null;
  const verified = e != null && c.ebitda != null && e !== c.ebitda;
  const nd = c.debt != null && c.cash != null ? c.debt - c.cash : null;
  const lev = nd != null && e != null && e > 0 ? nd / e : null;
  const pndE = p && p.debt != null && p.cash != null && pe != null && pe > 0 ? (p.debt - p.cash) / pe : null;
  const conv = (r: typeof c, x: number | null) => (x != null && x > 0 && r.operatingCashFlow != null ? r.operatingCashFlow / x : null);
  const cv = conv(c, e), pcv = p ? conv(p, pe) : null;
  const fcf = (r: typeof c | null) => (r && r.operatingCashFlow != null && r.capex != null ? r.operatingCashFlow - r.capex : null);
  const f1 = fcf(c), f0 = fcf(p);
  const rel = potentialRelease(a);
  const sign = (v: number | null, d = 1, suf = "") => (v == null ? "" : `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(d)}${suf}`);
  const cls = risk.classification;
  return [
    { label: "Investment Risk Index", tip: "Weighted 0–100 screening score across five risk pillars. Higher = more identified financial risk. Not a probability of failure and not a recommendation.", value: risk.score, kind: "score", change: risk.score == null ? "Insufficient data" : `${cls} · confidence ${risk.confidence.level} · ${risk.coverage}% coverage`, tone: risk.score == null ? "neutral" : risk.score < 25 ? "pos" : risk.score < 50 ? "neutral" : "neg", trend: [a.previousScore, risk.score].filter((v): v is number => v != null) },
    { label: "Adjusted EBITDA", tip: "Reported EBITDA plus adjustments marked verified. Unverified adjustments are not counted.", value: e, kind: "money", change: verified ? "incl. verified adjustments" : "= reported · none verified", tone: "neutral", trend: a.records.map((r, i) => adjustedEbitda(r, a.inputs, i === a.records.length - 1)).filter((v): v is number => v != null) },
    { label: "EBITDA-to-OCF Conversion", tip: "Operating cash flow ÷ adjusted EBITDA. Above 80% is typically healthy; below 50% deserves scrutiny.", value: cv, kind: "pct", change: cv != null && pcv != null ? `${sign((cv - pcv) * 100, 1, " pp")} YoY` : "—", tone: cv == null ? "neutral" : cv >= 0.8 ? "pos" : cv < 0.5 ? "neg" : "neutral", trend: a.records.map((r, i) => conv(r, adjustedEbitda(r, a.inputs, i === a.records.length - 1))).filter((v): v is number => v != null).map((v) => v * 100) },
    { label: "Net Debt / EBITDA", tip: "Net debt ÷ adjusted EBITDA. Negative means more cash than debt. Cut-offs are proposed screening values, not industry standards.", value: lev, kind: "x", change: nd != null && nd <= 0 ? "net cash position" : lev != null && pndE != null ? `${sign(lev - pndE, 2, "x")} YoY` : "—", tone: lev == null ? "neutral" : lev < 2 ? "pos" : lev > 3 ? "neg" : "neutral", trend: a.records.map((r, i) => { const x = adjustedEbitda(r, a.inputs, i === a.records.length - 1); return r.debt != null && r.cash != null && x != null && x > 0 ? (r.debt - r.cash) / x : null; }).filter((v): v is number => v != null) },
    { label: "Potential WC Cash Release", tip: "Cash that would be released if DSO and DIO returned to last year's level. A one-off estimate using the company's own history, not guaranteed cash. Model your own targets in Cash Impact.", value: rel.total, kind: "money", change: rel.total == null ? "needs two years of days" : rel.total === 0 ? "no deterioration to reverse" : rel.basis, tone: "neutral", trend: [] },
    { label: "Free Cash Flow", tip: "Operating cash flow − capital expenditure, after interest.", value: f1, kind: "money", change: f1 == null ? "capex not supplied" : f0 != null && f0 !== 0 ? `${sign(((f1 - f0) / Math.abs(f0)) * 100, 1, "%")} YoY` : "—", tone: f1 == null ? "neutral" : f1 < 0 ? "neg" : f0 != null && f1 > f0 ? "pos" : "neutral", trend: a.records.map(fcf).filter((v): v is number => v != null) },
  ];
}

function reported(a: AnalysisResult): Kpi[] {
  const c = a.latestRecord, p = a.previousRecord, m = a.latest, pm = a.previous;
  const t = (f: (r: typeof c) => number | null) => a.records.map(f).filter((v): v is number => v != null);
  const g = (cur: number | null, prev: number | null) => growth(cur, prev);
  const gl = (x: number | null) => (x == null ? "—" : `${signed(x * 100, 1, "%")} YoY`);
  const tone = (x: number | null, goodUp = true): Kpi["tone"] => (x == null ? "neutral" : Math.abs(x) < 0.005 ? "neutral" : (x > 0) === goodUp ? "pos" : "neg");
  const rg = g(c.revenue, p?.revenue ?? null), eg = g(c.ebitda, p?.ebitda ?? null), og = g(c.operatingCashFlow, p?.operatingCashFlow ?? null), dg = g(m.netDebt, pm?.netDebt ?? null);
  const mp = m.ebitdaMargin != null && pm?.ebitdaMargin != null ? (m.ebitdaMargin - pm.ebitdaMargin) * 100 : null;
  const cp = m.cashConversion != null && pm?.cashConversion != null ? (m.cashConversion - pm.cashConversion) * 100 : null;
  return [
    { label: "Revenue", tip: "Total annual sales for the latest financial year.", value: c.revenue, kind: "money", change: gl(rg), tone: tone(rg), trend: t((r) => r.revenue) },
    { label: "EBITDA", tip: "Earnings before interest, tax, depreciation and amortisation: a proxy for operating profit.", value: c.ebitda, kind: "money", change: gl(eg), tone: tone(eg), trend: t((r) => r.ebitda) },
    { label: "Operating Cash Flow", tip: "Cash actually generated by operations after working-capital movements.", value: c.operatingCashFlow, kind: "money", change: gl(og), tone: tone(og), trend: t((r) => r.operatingCashFlow) },
    { label: "Net Debt", tip: "Total debt minus cash. Rising net debt with falling cash generation raises leverage risk.", value: m.netDebt, kind: "money", change: gl(dg), tone: tone(dg, false), trend: a.metrics.map((x) => x.netDebt).filter((v): v is number => v != null) },
    { label: "EBITDA Margin", tip: "EBITDA as a percentage of revenue.", value: m.ebitdaMargin, kind: "pct", change: mp == null ? "—" : `${signed(mp, 1, " pp")} YoY`, tone: tone(mp), trend: a.metrics.map((x) => x.ebitdaMargin).filter((v): v is number => v != null).map((v) => v * 100) },
    { label: "Cash Conversion", tip: "Operating cash flow ÷ EBITDA. Above 80% is typically healthy; below 50% deserves scrutiny.", value: m.cashConversion, kind: "pct", change: cp == null ? "—" : `${signed(cp, 1, " pp")} YoY`, tone: tone(cp), trend: a.metrics.map((x) => x.cashConversion).filter((v): v is number => v != null).map((v) => v * 100) },
  ];
}

export default function Overview() {
  return <WithAnalysis>{(a) => <Dashboard a={a} />}</WithAnalysis>;
}

function Dashboard({ a }: { a: AnalysisResult }) {
  const { active } = useApp();
  const [series, setSeries] = useState<Series[]>(["revenue", "ebitda", "ocf"]);
  const [mode, setMode] = useState<"absolute" | "indexed">("indexed");
  const first = a.records[0].year;
  const [from, setFrom] = useState(first);
  const [wc, setWc] = useState<WC[]>(["dso", "dio", "dpo", "ccc"]);
  const [open, setOpen] = useState(false);
  const hl = headline(a);
  const rep = reported(a);
  const concerns = buildFindings(a, 3);
  const insight = buildExecutiveInsight(a);
  const years = `FY${first}–FY${a.latestRecord.year}`;
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? (arr.length > 1 ? arr.filter((x) => x !== v) : arr) : [...arr, v]);

  return (
    <>
      <PageTitle title="Investment Overview" sub="Find hidden financial risks. Unlock cash. Make smarter investment decisions." />

      {/* A. company strip */}
      <Card className="mb-5 flex flex-col gap-4 !py-4 md:flex-row md:items-center md:justify-between" hover={false}>
        <div className="min-w-0">
          <div className="font-display text-[19px] font-semibold">{active.name}</div>
          <div className="text-[12.5px] text-ink2">{active.industry}</div>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[11.5px] text-ink2">
          <span><span className="text-ink3">INDUSTRY </span>{a.risk.industry.selected ? a.risk.industry.name : <Link href="/investment-assessment" className="text-warn hover:underline">not selected</Link>}</span>
          <span><span className="text-ink3">PERIOD </span>{years}</span>
          <span><span className="text-ink3">LAST RUN </span>{new Date(a.generatedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
          <Pill tone="pos">● Analysis complete</Pill>
          
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-12">
        {/* B. headline KPIs */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:col-span-12">
          {hl.map((k, i) => <motion.div key={k.label} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}><KpiCard k={k} big /></motion.div>)}
        </div>

        {/* B2. concerns at a glance */}
        <Card className="xl:col-span-12" hover={false}>
          <CardHead title="Most significant concerns" hint="The three largest risks by points and quantified impact, from calculated figures only. Potential risks to investigate, not conclusions." right={<Link href="/investment-assessment" className="text-[12px] text-accent hover:underline">Full risk analysis →</Link>} />
          {concerns.length === 0 ? <p className="text-[13px] text-ink2">No indicator scored risk points on the data supplied.</p> : (
            <div className="grid gap-3 lg:grid-cols-3">
              {concerns.map((f, n) => (
                <Link key={f.id} href="/investment-assessment" className="tap block rounded-xl border border-line bg-bg2 p-4 hover:border-[#3f4551]">
                  <div className="mb-2 flex items-center justify-between gap-2"><span className="font-display text-[22px] font-semibold leading-none text-ink3">0{n + 1}</span><LevelBadge level={f.level} /></div>
                  <div className="text-[13.5px] font-medium leading-snug">{f.title}</div>
                  <p className="mt-1.5 line-clamp-2 font-mono text-[11px] leading-relaxed text-ink2">{f.evidence}</p>
                  {f.impact && <p className="mt-1.5 text-[11.5px] leading-snug text-warn">{f.impact}</p>}
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* B3. five pillars */}
        <div id="health" className="scroll-mt-24 xl:col-span-12"><PillarSection risk={a.risk} /></div>

        <BenchmarkComparison a={a} />
        <CashConversionChart a={a} />

        <div className="flex flex-col gap-5 xl:col-span-8">
        <Card hover={false} className="!py-4">
          <div className="mb-3 font-mono text-[10px] uppercase tracking-wider text-ink3">Reported performance · FY{a.latestRecord.year}</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
            {rep.map((k) => (
              <div key={k.label}>
                <div className="truncate text-[11px] text-ink3">{k.label}</div>
                <div className="font-display text-[17px] font-semibold tabular-nums">{k.value == null ? "—" : k.kind === "money" ? fmtM(k.value) : fmtPct(k.value)}</div>
                <div className={clsx("font-mono text-[10.5px]", k.tone === "pos" ? "text-pos" : k.tone === "neg" ? "text-crit" : "text-ink3")}>{k.change}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* C. trend chart */}
        <Card id="performance" className="flex-1 scroll-mt-24">
          <CardHead title="Financial performance" hint="Profit and cash generation over time. Divergence between EBITDA and operating cash flow is the key signal." right={
            <div className="flex flex-wrap gap-2">
              <Tabs label="Mode" value={mode} onChange={setMode} items={[{ id: "indexed", label: "Indexed" }, { id: "absolute", label: cur() + " m" }]} />
              {a.records.length > 2 && <Tabs label="Period" value={String(from)} onChange={(v) => setFrom(Number(v))} items={[{ id: String(first), label: `FY${String(first).slice(2)}+` }, { id: String(a.records[1].year), label: `FY${String(a.records[1].year).slice(2)}+` }]} />}
            </div>
          } />
          <div className="mb-3 flex flex-wrap gap-2">
            {(["revenue", "ebitda", "ocf"] as Series[]).map((s) => (
              <button key={s} onClick={() => setSeries(toggle(series, s))} aria-pressed={series.includes(s)} className={clsx("rounded-full border px-3 py-1 font-mono text-[11px] transition-colors", series.includes(s) ? "border-accent/40 bg-accent/10 text-ink" : "border-line text-ink3 hover:text-ink2")}>{s === "ocf" ? "Operating CF" : s[0].toUpperCase() + s.slice(1)}</button>
            ))}
          </div>
          <div className="h-[280px]"><TrendChart a={a} series={series} mode={mode} from={from} /></div>
        </Card>
        </div>

        {/* E. risk snapshot */}
        <Card id="risk-summary" className="scroll-mt-24 xl:col-span-4">
          <CardHead title="Risk snapshot" hint="Weighted screening score. Higher = more identified financial risk. A prototype methodology, not an investment verdict." right={<Link href="/investment-assessment" className="text-[12px] text-accent hover:underline">Detail →</Link>} />
          <RiskGauge risk={a.risk} />
          <div className="mt-4 text-center font-mono text-[11px] text-ink3">COVERAGE {a.risk.coverage}% OF MODEL · {a.risk.evaluated}/{a.risk.total} INDICATORS{a.risk.coverage < 100 && <span className="text-warn"> · INCOMPLETE</span>}</div>
          <div className="mt-4 space-y-2.5">
            {a.risk.categories.map((c) => (
              <div key={c.id}>
                <div className="mb-1 flex justify-between text-[11.5px] text-ink2"><span>{c.name}</span><span className="font-mono text-ink3">{c.points == null ? "n/a" : `${c.points}/${c.max}`}</span></div>
                <Bar value={c.points ?? 0} max={c.max} color={c.points == null ? "#3a3f49" : riskColor((c.points / (c.max || 1)) * 100)} className="h-1.5" />
              </div>
            ))}
          </div>
        </Card>


        {/* F. signals */}
        <Card className="xl:col-span-5">
          <CardHead title="Key risk signals" hint="Automatically detected patterns. These are potential risks requiring investigation, not proof of wrongdoing." right={<Pill>{a.alerts.length} detected</Pill>} />
          <div className="space-y-3">
            {a.alerts.slice(0, 4).map((al) => (
              <Link key={al.id} href="/investment-assessment" className="block rounded-xl border border-line bg-bg2 p-3.5 transition-colors hover:border-[#3f4551]">
                <div className="mb-1.5 flex items-start justify-between gap-2"><span className="text-[13px] font-medium leading-snug">{al.name}</span><SeverityBadge s={al.severity} /></div>
                <p className="font-mono text-[11px] leading-relaxed text-ink2">{al.evidence}</p>
              </Link>
            ))}
            {a.alerts.length === 0 && <p className="text-[13px] text-ink2">No automated signals triggered on the available data.</p>}
          </div>
        </Card>

        {/* D. working capital */}
        <Card className="xl:col-span-7">
          <CardHead title="Working capital cycle" hint="DSO + DIO − DPO = cash conversion cycle: the days cash is tied up between paying suppliers and collecting from customers." right={
            <div className="flex gap-1.5">{(["dso", "dio", "dpo", "ccc"] as WC[]).map((k) => (
              <button key={k} onClick={() => setWc(toggle(wc, k))} aria-pressed={wc.includes(k)} className={clsx("rounded-lg border px-2.5 py-1 font-mono text-[11px]", wc.includes(k) ? "border-accent/40 bg-accent/10 text-ink" : "border-line text-ink3")}>{WC_LABEL[k]}</button>
            ))}</div>
          } />
          <div className="grid gap-4 md:grid-cols-[1fr_190px]">
            <div className="h-[240px]"><WorkingCapitalChart a={a} show={wc} /></div>
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-1">
              {(["dso", "dio", "dpo", "ccc"] as WC[]).map((k) => {
                const d = a.previous && a.latest[k] != null && a.previous[k] != null ? (a.latest[k] as number) - (a.previous[k] as number) : null;
                const bad = d != null && (k === "dpo" ? d < -1 : d > 1);
                return (
                  <div key={k} className="rounded-xl border border-line bg-bg2 px-3 py-2.5">
                    <div className="font-mono text-[10px] text-ink3">{WC_LABEL[k]}</div>
                    <div className="flex items-baseline justify-between"><span className="font-display text-[20px] font-semibold tabular-nums">{fmtDays(a.latest[k] as number | null, 0)}</span><span className={clsx("font-mono text-[11px]", d == null ? "text-ink3" : bad ? "text-crit" : "text-pos")}>{d == null ? "—" : signed(d, 1, "d")}</span></div>
                  </div>
                );
              })}
            </div>
          </div>
          {a.metrics.some((m) => m.approximate) && <p className="mt-3 font-mono text-[10.5px] text-ink3">* First year uses closing balances only (no opening balance available): treat as approximate.</p>}
        </Card>

        {/* leverage trend */}
        <Card className="xl:col-span-5">
          <CardHead title="Leverage trend" hint="Total debt, cash and net debt ÷ adjusted EBITDA. Dashed lines mark 3x and 4x (proposed screening levels)." />
          <div className="h-[250px]"><DebtChart a={a} /></div>
        </Card>

        {/* G. AI panel */}
        <div className="relative overflow-hidden rounded-card border border-ai/30 bg-gradient-to-b from-ai/[0.07] to-card p-5 sm:p-6 xl:col-span-7">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2"><Sparkles size={16} className="text-ai" /><h3 className="font-display text-[15px] font-medium">Investment summary</h3></div>
            {/* <Pill tone="ai">Deterministic demo</Pill> */}
          </div>
          <p className="text-[14px] leading-relaxed text-ink">{insight.headline}</p>
          {open && <motion.ul initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-3 space-y-2 overflow-hidden text-[13px] leading-relaxed text-ink2">{insight.points.map((p) => <li key={p} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ai" />{p}</li>)}</motion.ul>}
          <button onClick={() => setOpen(!open)} className="mt-3 text-[12px] text-ai hover:underline">{open ? "Show less" : "Show supporting evidence"}</button>
          <p className="mt-4 border-t border-line pt-3 text-[11px] text-ink3">Generated from calculated metrics only. No external AI model was called.</p>
          <Link href="/investment-assessment" className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-ai/15 px-4 text-[13px] font-medium text-ai hover:bg-ai/25 sm:min-h-[40px]">Explore full assessment <ArrowRight size={15} /></Link>
        </div>

        {/* H. quick nav */}
        <div className="grid gap-4 sm:grid-cols-2 xl:col-span-12 xl:grid-cols-4">
          {[
            { href: "/company-analysis", t: "Upload & validate data", d: "Records, data quality, history", i: Table2 },
            { href: "/investment-assessment", t: "Investment risk analysis", d: `Score ${a.risk.score ?? "n/a"}/100 · ${a.risk.classification}`, i: Gauge },
            { href: "/cash-impact", t: "Working-capital cash release", d: "DSO, DIO and DPO scenarios", i: Calculator },
            { href: "/ebitda-cash-bridge", t: "EBITDA-to-cash bridge", d: "Earnings versus actual cash", i: ArrowRightLeft },
            { href: "/stress-testing", t: "Stress testing", d: "Base, downside and severe cases", i: Activity },
            { href: "/valuation", t: "Acquisition valuation", d: "Entry multiple, leverage, equity", i: Scale },
            { href: "/due-diligence-report", t: "Due diligence report", d: "6 sections · edit · PDF download", i: FileText },
          ].map((q) => (
            <Link key={q.href} href={q.href} className="group flex items-center gap-4 rounded-card border border-line bg-card p-5 transition-colors hover:border-accent/40">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-elev text-ink2 transition-colors group-hover:text-accent"><q.i size={20} /></span>
              <span className="min-w-0 flex-1"><span className="block text-[14px] font-medium">{q.t}</span><span className="block truncate text-[12px] text-ink3">{q.d}</span></span>
              <ArrowRight size={16} className="text-ink3 transition-transform group-hover:translate-x-1" />
            </Link>
          ))}
        </div>
      </div>
      <p className="mt-6 text-center font-mono text-[10.5px] text-ink3">{fmtM(a.latestRecord.revenue)} revenue · {fmtPct(a.latest.cashConversion)} cash conversion · Figures as supplied by the uploader.</p>
    </>
  );
}
