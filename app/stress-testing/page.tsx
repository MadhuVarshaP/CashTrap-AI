"use client";

import clsx from "clsx";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar as RBar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { axisM } from "@/components/risk/charts";
import { NumInput } from "@/components/risk/parts";
import { WithAnalysis } from "@/components/shared/Guard";
import { Button, Card, CardHead, PageTitle, Pill, chartTooltip } from "@/components/shared/ui";
import { BASE_CASE, CASE_NAMES, DOWNSIDE_CASE, SEVERE_CASE, runCase, type Case, type Outcome } from "@/lib/calculations/scenarios";
import { useApp } from "@/lib/state/store";
import { DASH, fmtM, fmtX, cur } from "@/lib/utilities/format";
import type { AnalysisResult, Num } from "@/types/finance";

export default function StressPage() {
  return <WithAnalysis>{(a) => <Page a={a} />}</WithAnalysis>;
}

const COLORS = ["#A2A7B0", "#F5A640", "#F06464"];
const FIELDS: { key: keyof Case; label: string; unit: string; min: number; max: number; step: number }[] = [
  { key: "revenueDrop", label: "Revenue decline", unit: "%", min: 0, max: 60, step: 1 },
  { key: "marginDrop", label: "EBITDA margin reduction", unit: "pp", min: 0, max: 20, step: 0.5 },
  { key: "dsoIncrease", label: "DSO increase", unit: "days", min: 0, max: 90, step: 1 },
  { key: "dioIncrease", label: "DIO increase", unit: "days", min: 0, max: 90, step: 1 },
  { key: "interestRise", label: "Interest rate increase", unit: "pp", min: 0, max: 10, step: 0.25 },
  { key: "extraBorrowing", label: "Additional borrowing", unit: "m", min: 0, max: 1000, step: 1 },
];

type Row = { id: string; label: string; get: (o: Outcome) => Num; fmt: (v: Num) => string; goodUp: boolean | null };
const ROWS: Row[] = [
  { id: "rev", label: "Revenue", get: (o) => o.revenue, fmt: fmtM, goodUp: true },
  { id: "e", label: "EBITDA", get: (o) => o.ebitda, fmt: fmtM, goodUp: true },
  { id: "ae", label: "Adjusted EBITDA", get: (o) => o.adjustedEbitda, fmt: fmtM, goodUp: true },
  { id: "ocf", label: "Operating cash flow", get: (o) => o.ocf, fmt: fmtM, goodUp: true },
  { id: "fcf", label: "Free cash flow", get: (o) => o.fcf, fmt: fmtM, goodUp: true },
  { id: "ic", label: "Interest coverage", get: (o) => o.interestCover, fmt: (v) => fmtX(v, 1), goodUp: true },
  { id: "lev", label: "Net debt / EBITDA", get: (o) => o.netDebtToEbitda, fmt: (v) => (v === 0 ? "net cash" : fmtX(v, 2)), goodUp: false },
  { id: "dscr", label: "Debt service coverage", get: (o) => o.dscr, fmt: (v) => fmtX(v, 2), goodUp: true },
  { id: "sf", label: "Potential cash shortfall", get: (o) => o.shortfall, fmt: (v) => (v == null ? DASH : v === 0 ? "none" : fmtM(v)), goodUp: false },
  { id: "unc", label: "…left after cash and new borrowing", get: (o) => o.uncovered, fmt: (v) => (v == null ? DASH : v === 0 ? "none" : fmtM(v)), goodUp: false },
];

const CHARTS = [
  { id: "cash", label: "Earnings & cash", rows: ["ae", "ocf", "fcf"], names: ["Adjusted EBITDA", "Operating CF", "Free cash flow"], money: true },
  { id: "lev", label: "Leverage & coverage", rows: ["lev", "ic", "dscr"], names: ["Net debt / EBITDA", "Interest cover", "DSCR"], money: false },
  { id: "sf", label: "Cash shortfall", rows: ["sf", "unc"], names: ["Shortfall", "After cash & borrowing"], money: true },
] as const;

function Page({ a }: { a: AnalysisResult }) {
  const { active, updateInputs } = useApp();
  const [cases, setCases] = useState<Case[]>([BASE_CASE, DOWNSIDE_CASE, SEVERE_CASE]);
  const [sel, setSel] = useState(1);
  const [chart, setChart] = useState<(typeof CHARTS)[number]["id"]>("cash");
  const out = useMemo(() => cases.map((k) => runCase(a, k)), [a, cases]);
  const set = (i: number, key: keyof Case, v: number) => setCases((cs) => cs.map((c, j) => (j === i ? { ...c, [key]: Math.max(0, v) } : c)));
  const reset = () => setCases([BASE_CASE, DOWNSIDE_CASE, SEVERE_CASE]);
  const cfg = CHARTS.find((c) => c.id === chart)!;
  const get = (id: string) => ROWS.find((r) => r.id === id)!;
  const data = cfg.rows.map((id, i) => ({ name: cfg.names[i], s0: get(id).get(out[0]), s1: get(id).get(out[1]), s2: get(id).get(out[2]) }));
  const notes = [...new Set(out.flatMap((o) => o.notes))];
  const hasNeg = out.some((o) => o.ebitda != null && o.ebitda <= 0);

  return (
    <>
      <PageTitle title="Acquisition Stress Testing" sub="How resilient is the company if conditions turn? Hypothetical scenarios built on the latest actual year." right={<div className="flex flex-wrap gap-2"><Button variant="ghost" onClick={reset}><RotateCcw size={14} /> Reset scenarios</Button></div>} />

      <div className="mb-5 flex gap-3 rounded-2xl border border-warn/25 bg-warn/5 p-4 text-[12.5px] leading-relaxed text-ink2">
        <AlertTriangle size={17} className="mt-0.5 shrink-0 text-warn" />
        <p><b className="text-ink">Scenario analysis, not actual results and not a forecast.</b> The base case is the latest reported year (FY{a.latestRecord.year}) held constant. Downside and severe cases apply the assumptions you set below to that year. The default assumptions are proposed screening values to edit, not market views. Tax effects and any release of working capital from lower activity are not modelled.</p>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {[["Historical actuals", `Uploaded FY${a.records[0].year}–FY${a.latestRecord.year}. The base case equals the latest actual year.`, "#3988F5"], ["Management forecasts", "None uploaded. This module does not use or generate forecasts.", "#707681"], ["Hypothetical scenarios", "Downside and severe cases: your assumptions applied to the latest actual year.", "#F5A640"]].map(([t, d, col]) => <div key={t} className="rounded-xl border border-line bg-card p-3.5"><div className="flex items-center gap-2 text-[12.5px] font-medium"><span className="h-2 w-2 rounded-full" style={{ background: col }} />{t}</div><p className="mt-1 text-[11.5px] leading-snug text-ink3">{d}</p></div>)}
      </div>
      <div className="grid gap-5 xl:grid-cols-12">
        <Card className="xl:col-span-4">
          <CardHead title="Assumptions" hint="Change any value: every result recalculates immediately." />
          <div role="tablist" aria-label="Scenario" className="mb-4 flex gap-1.5">
            {CASE_NAMES.map((n, i) => (
              <button key={n} role="tab" aria-selected={sel === i} onClick={() => setSel(i)} className={clsx("tap flex-1 rounded-xl border px-2 py-2 text-[12px]", sel === i ? "border-accent/50 bg-accent/10 text-ink" : "border-line bg-bg2 text-ink2 hover:text-ink")}>
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: COLORS[i] }} />{n.replace(" case", "")}
              </button>
            ))}
          </div>
          {sel === 0 ? (
            <p className="rounded-xl bg-bg2 p-4 text-[12.5px] leading-relaxed text-ink2">The base case applies no changes: it is the latest actual year (FY{a.latestRecord.year}) as reported, so the other scenarios have a fixed point to be compared with. Pick Downside or Severe to edit assumptions.</p>
          ) : (
            <div className="space-y-4">
              {FIELDS.map((f) => (
                <div key={f.key}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label htmlFor={`${f.key}-${sel}`} className="font-mono text-[10.5px] uppercase tracking-wider text-ink3">{f.label}</label>
                    <span className="flex h-8 items-center rounded-lg bg-bg2 px-2.5 transition-colors focus-within:bg-elev">
                      <input id={`${f.key}-${sel}`} inputMode="decimal" value={cases[sel][f.key]} onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) set(sel, f.key, n); }} className="w-16 bg-transparent text-right font-mono text-[13px] tabular-nums outline-none" />
                      <span className="ml-1.5 font-mono text-[10.5px] text-ink3">{f.unit}</span>
                    </span>
                  </div>
                  <input type="range" min={f.min} max={f.max} step={f.step} value={Math.min(cases[sel][f.key], f.max)} onChange={(e) => set(sel, f.key, Number(e.target.value))} className="w-full" aria-label={f.label} />
                </div>
              ))}
            </div>
          )}
          <div className="mt-5 border-t border-line pt-4"><NumInput label="Minimum operating cash" value={a.inputs.minOperatingCash} unit={`${cur()} m`} onCommit={(n) => updateInputs({ minOperatingCash: n })} hint="Cash the business must keep. Cash above it, plus any extra borrowing, is counted against a shortfall." /></div>
        </Card>

        <Card className="xl:col-span-8" hover={false}>
          <CardHead title="Scenario results" hint={`${cur()} millions. Change shown against the base case. Hypothetical, built on FY${a.latestRecord.year}.`} />
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[560px] border-collapse text-[12.5px]">
              <thead>
                <tr className="border-b border-line font-mono text-[10px] uppercase tracking-wider text-ink3">
                  <th className="py-2.5 text-left font-medium">Measure</th>
                  {CASE_NAMES.map((n, i) => <th key={n} className="px-2 py-2.5 text-right font-medium"><span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: COLORS[i] }} />{n.replace(" case", "")}</th>)}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => {
                  const base = r.get(out[0]);
                  return (
                    <tr key={r.id} className="border-b border-line/60">
                      <td className="py-2.5 pr-2 text-ink2">{r.label}</td>
                      {out.map((o, i) => {
                        const v = r.get(o);
                        const d = i > 0 && v != null && base != null ? v - base : null;
                        const worse = d != null && d !== 0 && r.goodUp != null && (d > 0) !== r.goodUp;
                        return (
                          <td key={i} className="px-2 py-2.5 text-right">
                            <div className="font-mono tabular-nums text-ink">{r.fmt(v)}</div>
                            {d != null && d !== 0 && <div className={clsx("font-mono text-[10.5px]", worse ? "text-crit" : "text-pos")}>{d > 0 ? "+" : "−"}{r.fmt(Math.abs(d)).replace("net cash", "")}</div>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {hasNeg && <p role="alert" className="mt-3 rounded-xl border border-crit/30 bg-crit/5 p-3 text-[12.5px] text-crit">In at least one scenario EBITDA turns negative, so leverage and coverage ratios are not meaningful there and are shown as “—”.</p>}
          {notes.length > 0 && <ul className="mt-3 space-y-1 text-[11.5px] text-ink3">{notes.map((n) => <li key={n}>• {n}</li>)}</ul>}
        </Card>

        <Card id="compare" className="xl:col-span-12 scroll-mt-24">
          <CardHead title="Scenario comparison" hint="The same measure under the three scenarios." right={
            <div role="tablist" aria-label="Chart" className="inline-flex rounded-xl border border-line bg-bg2 p-1">
              {CHARTS.map((c) => <button key={c.id} role="tab" aria-selected={chart === c.id} onClick={() => setChart(c.id)} className={clsx("rounded-lg px-3 py-1.5 font-mono text-[11px]", chart === c.id ? "bg-elev text-ink" : "text-ink3 hover:text-ink2")}>{c.label}</button>)}
            </div>
          } />
          <div className="h-[300px]">
            <ResponsiveContainer>
              <BarChart data={data} margin={{ top: 8, right: 4, left: -6, bottom: 0 }}>
                <CartesianGrid stroke="#23262d" vertical={false} />
                <XAxis dataKey="name" stroke="#707681" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#707681" fontSize={11} tickLine={false} axisLine={false} width={48} tickFormatter={cfg.money ? axisM : (v: number) => `${v}x`} />
                <ReferenceLine y={0} stroke="#3a3f49" />
                <Tooltip {...chartTooltip} cursor={{ fill: "#ffffff08" }} formatter={(v: number, n: string) => [cfg.money ? fmtM(v) : `${v.toFixed(2)}x`, CASE_NAMES[Number(n.slice(1))]]} />
                <Legend wrapperStyle={{ fontSize: 11, color: "#A2A7B0" }} formatter={(v: string) => CASE_NAMES[Number(v.slice(1))]} />
                {[0, 1, 2].map((i) => <RBar key={i} dataKey={`s${i}`} fill={COLORS[i]} radius={[3, 3, 0, 0]} maxBarSize={34} animationDuration={500} />)}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </>
  );
}
