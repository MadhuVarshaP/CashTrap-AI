"use client";

import clsx from "clsx";
import { Bar as RBar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardHead, Pill, chartTooltip } from "@/components/shared/ui";
import { SOURCE, benchRange, fmtBench, resolveIndustry, type BenchMetric } from "@/lib/benchmarks/resolve";
import { adjustedEbitda } from "@/lib/calculations/pe-risk";
import { resolveThresholds } from "@/lib/calculations/thresholds";
import type { AnalysisResult } from "@/types/finance";

/** company versus the selected industry: median, typical range and where the company sits */
export function BenchmarkComparison({ a }: { a: AnalysisResult }) {
  const ctx = resolveIndustry(a.inputs);
  const m = a.latest, c = a.latestRecord;
  const e = adjustedEbitda(c, a.inputs, true);
  const lev = m.netDebt != null && e != null && e > 0 ? m.netDebt / e : null;
  const cover = c.interestExpense && c.interestExpense > 0 && e != null ? e / c.interestExpense : null;
  const rows: { metric: BenchMetric; label: string; value: number | null; higherIsWorse: boolean | null }[] = [
    { metric: "ebitdaMargin", label: "EBITDA margin", value: m.ebitdaMargin == null ? null : m.ebitdaMargin * 100, higherIsWorse: false },
    { metric: "dso", label: "DSO", value: m.dso, higherIsWorse: true },
    { metric: "dio", label: "DIO", value: m.dio, higherIsWorse: true },
    { metric: "dpo", label: "DPO", value: m.dpo, higherIsWorse: null },
    { metric: "ccc", label: "Cash conversion cycle", value: m.ccc, higherIsWorse: true },
    { metric: "debtEbitda", label: "Net debt / EBITDA", value: lev, higherIsWorse: true },
    { metric: "intCover", label: "Interest coverage", value: cover, higherIsWorse: false },
  ];
  return (
    <Card tint="violet" className="xl:col-span-7" hover={false}>
      <CardHead title="Industry benchmark comparison" hint={ctx.selected ? `Selected industry: ${ctx.name}${ctx.subName ? ` · ${ctx.subName}` : ""}. Benchmark period: ${SOURCE.year}, updated ${SOURCE.updated}. The median is not a target.` : "Select an industry under Data & upload to compare the company with its industry."} right={ctx.selected ? <Pill tone="accent">{ctx.name}</Pill> : <Pill tone="warn">No industry</Pill>} />
      <div className="-mx-5 overflow-x-auto px-5">
        <table className="w-full min-w-[560px] border-collapse text-[12.5px]">
          <thead><tr className="border-b border-line font-mono text-[10px] uppercase tracking-wider text-ink3">{["Metric", "Company", "Industry median", "Typical range", "Position"].map((h, i) => <th key={h} className={clsx("py-2.5 font-medium", i === 0 ? "text-left" : "px-2 text-right")}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => {
              const na = ctx.selected && ((r.metric === "dio" && ctx.relevance("dio") === "na") || (r.metric === "debtEbitda" && ctx.relevance("lev") === "na") || (r.metric === "intCover" && ctx.relevance("int") === "na") || ((r.metric === "dso" || r.metric === "ccc") && ctx.relevance("dso") === "na"));
              const b = ctx.bench(r.metric);
              const have = ctx.selected && b.status !== "unavailable" && b.median != null;
              const pos = !have || r.value == null ? null : b.low != null && r.value < b.low ? "below" : b.high != null && r.value > b.high ? "above" : "within";
              const worse = pos && r.higherIsWorse != null && ((pos === "above") === r.higherIsWorse) && pos !== "within";
              return (
                <tr key={r.metric} className="border-b border-line/60">
                  <td className="py-2.5 pr-2 text-ink2">{r.label}</td>
                  <td className="px-2 py-2.5 text-right font-mono tabular-nums">{fmtBench(r.value, r.metric)}</td>
                  <td className="px-2 py-2.5 text-right font-mono tabular-nums">{na ? <span className="text-ink3">Not applicable</span> : have ? fmtBench(b.median, r.metric) : <span className="text-warn">Unavailable</span>}</td>
                  <td className="px-2 py-2.5 text-right font-mono text-[11.5px] tabular-nums text-ink3">{have && !na ? benchRange(b, r.metric) : "—"}</td>
                  <td className={clsx("px-2 py-2.5 text-right font-mono text-[11.5px]", !pos || na ? "text-ink3" : pos === "within" ? "text-pos" : worse ? "text-crit" : "text-ink2")}>{na ? "N/A" : pos ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-ink3">Source: Damodaran Online (NYU Stern), {SOURCE.geography}, medians of industry-group aggregates; typical range = 25th–75th percentile. Leverage there is gross debt incl. leases ÷ EBITDA and coverage is EBIT-based, so those two are not like-for-like. “Unavailable” = Industry Benchmark Unavailable. Operating-cash and free-cash-flow conversion have no verified industry source and are scored on proposed screening thresholds.</p>
    </Card>
  );
}

/** operating cash flow as a share of adjusted EBITDA, year by year, against the screening cut-offs in force */
export function CashConversionChart({ a }: { a: AnalysisResult }) {
  const { cuts } = resolveThresholds(a.inputs);
  const data = a.records.map((r, i) => { const e = adjustedEbitda(r, a.inputs, i === a.records.length - 1); return { year: `FY${String(r.year).slice(2)}`, v: e != null && e > 0 && r.operatingCashFlow != null ? (r.operatingCashFlow / e) * 100 : null }; });
  const [lo, mid] = [cuts.ocf[0], cuts.ocf[1]];
  return (
    <Card tint="mint" className="xl:col-span-5">
      <CardHead title="Cash conversion analysis" hint={`Operating cash flow ÷ adjusted EBITDA. Lines are the proposed screening cut-offs (${lo}% Low, ${mid}% Moderate), not industry averages.`} />
      <div className="h-[250px]">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid stroke="var(--c-grid)" vertical={false} />
            <XAxis dataKey="year" stroke="var(--c-axis)" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--c-axis)" fontSize={11} tickLine={false} axisLine={false} unit="%" domain={[0, (m: number) => Math.max(100, Math.ceil(m / 10) * 10)]} />
            <Tooltip {...chartTooltip} cursor={{ fill: "var(--c-cursor)" }} formatter={(v: number) => [`${v.toFixed(0)}%`, "Cash conversion"]} />
            <ReferenceLine y={lo} stroke="#10B981" strokeDasharray="4 4" /><ReferenceLine y={mid} stroke="#F59E0B" strokeDasharray="4 4" />
            <RBar dataKey="v" radius={[4, 4, 0, 0]} maxBarSize={44} animationDuration={600}>{data.map((d, i) => <Cell key={i} fill={d.v == null ? "var(--c-muted)" : d.v >= lo ? "#10B981" : d.v >= mid ? "#F59E0B" : "#F43F5E"} />)}</RBar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 font-mono text-[10.5px] text-ink3">Industry Benchmark Unavailable for cash conversion: no verified source.</p>
    </Card>
  );
}
