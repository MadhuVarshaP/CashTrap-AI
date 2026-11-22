"use client";

import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartTooltip } from "@/components/shared/ui";
import { adjustedEbitda } from "@/lib/calculations/pe-risk";
import { scaleM, cur } from "@/lib/utilities/format";
import type { AnalysisResult, RiskResult } from "@/types/finance";
import { LEVEL_HEX } from "./parts";

const axis = { stroke: "var(--c-axis)", fontSize: 11, tickLine: false, axisLine: false } as const;
const grid = <CartesianGrid stroke="var(--c-grid)" vertical={false} />;
const fy = (y: number) => `FY${String(y).slice(2)}`;
const legend = { iconType: "circle" as const, iconSize: 7, wrapperStyle: { fontSize: 11, color: "var(--c-tick)", paddingTop: 8 } };
/** compact axis labels for millions so very large companies stay readable */
export const axisM = (v: number) => { const { n, unit } = scaleM(v, 0); return `${n}${unit}`; };
const tipM = (v: number) => { const { n, unit } = scaleM(v, 1); return `${cur()} ${n}${unit}`; };
const C = { ebitda: "#35C994", ocf: "#F5A640", fcf: "#3988F5", crit: "#F06464", ai: "#A78BFA", muted: "var(--c-axis)", stress: "#F06464" };

export function EbitdaMarginChart({ a }: { a: AnalysisResult }) {
  const data = a.records.map((r, i) => ({ year: fy(r.year), ebitda: adjustedEbitda(r, a.inputs, i === a.records.length - 1), margin: r.ebitda != null && r.revenue ? (r.ebitda / r.revenue) * 100 : null }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
        {grid}<XAxis dataKey="year" {...axis} />
        <YAxis yAxisId="l" {...axis} width={48} tickFormatter={axisM} />
        <YAxis yAxisId="r" orientation="right" {...axis} width={40} unit="%" />
        <Tooltip {...chartTooltip} formatter={(v: number, n: string) => (n === "margin" ? [`${v.toFixed(1)}%`, "EBITDA margin"] : [tipM(v), "EBITDA"])} />
        <Legend {...legend} formatter={(v) => (v === "margin" ? "EBITDA margin" : "EBITDA")} />
        <Bar yAxisId="l" dataKey="ebitda" fill={C.ebitda} fillOpacity={0.85} radius={[4, 4, 0, 0]} maxBarSize={36} animationDuration={600} />
        <Line yAxisId="r" dataKey="margin" stroke={C.ai} strokeWidth={2.2} dot={{ r: 3.5, fill: "var(--c-card)", strokeWidth: 2 }} animationDuration={700} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function CashFlowChart({ a }: { a: AnalysisResult }) {
  const data = a.records.map((r) => ({ year: fy(r.year), ebitda: r.ebitda, ocf: r.operatingCashFlow, fcf: r.operatingCashFlow != null && r.capex != null ? r.operatingCashFlow - r.capex : null }));
  const name = { ebitda: "EBITDA", ocf: "Operating cash flow", fcf: "Free cash flow" } as Record<string, string>;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} barGap={2}>
        {grid}<XAxis dataKey="year" {...axis} /><YAxis {...axis} width={48} tickFormatter={axisM} />
        <Tooltip {...chartTooltip} cursor={{ fill: "var(--c-cursor)" }} formatter={(v: number, n: string) => [tipM(v), name[n]]} />
        <Legend {...legend} formatter={(v) => name[v as string]} />
        <ReferenceLine y={0} stroke="var(--c-muted)" />
        <Bar dataKey="ebitda" fill={C.ebitda} radius={[3, 3, 0, 0]} maxBarSize={22} animationDuration={600} />
        <Bar dataKey="ocf" fill={C.ocf} radius={[3, 3, 0, 0]} maxBarSize={22} animationDuration={600} />
        <Bar dataKey="fcf" fill={C.fcf} radius={[3, 3, 0, 0]} maxBarSize={22} animationDuration={600} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function OwcChart({ a }: { a: AnalysisResult }) {
  const data = a.records.map((r) => {
    const owc = r.receivables != null && r.inventory != null && r.payables != null ? r.receivables + r.inventory - r.payables : null;
    return { year: fy(r.year), owc, pct: owc != null && r.revenue ? (owc / r.revenue) * 100 : null };
  });
  if (data.every((d) => d.owc == null)) return <p className="grid h-full place-items-center px-6 text-center text-[13px] text-ink3">Operating working capital needs receivables, inventory and payables.</p>;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
        {grid}<XAxis dataKey="year" {...axis} />
        <YAxis yAxisId="l" {...axis} width={48} tickFormatter={axisM} /><YAxis yAxisId="r" orientation="right" {...axis} width={40} unit="%" />
        <Tooltip {...chartTooltip} formatter={(v: number, n: string) => (n === "pct" ? [`${v.toFixed(1)}%`, "% of revenue"] : [tipM(v), "Operating working capital"])} />
        <Legend {...legend} formatter={(v) => (v === "pct" ? "% of revenue" : "Operating working capital")} />
        <Bar yAxisId="l" dataKey="owc" fill={C.ai} fillOpacity={0.8} radius={[4, 4, 0, 0]} maxBarSize={36} animationDuration={600} />
        <Line yAxisId="r" dataKey="pct" stroke={C.ocf} strokeWidth={2.2} dot={{ r: 3.5, fill: "var(--c-card)", strokeWidth: 2 }} animationDuration={700} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function DebtChart({ a }: { a: AnalysisResult }) {
  const data = a.records.map((r, i) => { const e = adjustedEbitda(r, a.inputs, i === a.records.length - 1); const nd = r.debt != null && r.cash != null ? r.debt - r.cash : null; return { year: fy(r.year), debt: r.debt, cash: r.cash, lev: nd != null && e != null && e > 0 ? nd / e : null }; });
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
        {grid}<XAxis dataKey="year" {...axis} />
        <YAxis yAxisId="l" {...axis} width={48} tickFormatter={axisM} /><YAxis yAxisId="r" orientation="right" {...axis} width={40} unit="x" />
        <Tooltip {...chartTooltip} formatter={(v: number, n: string) => (n === "lev" ? [`${v.toFixed(2)}x`, "Net debt / EBITDA"] : [tipM(v), n === "debt" ? "Total debt" : "Cash"])} />
        <Legend {...legend} formatter={(v) => (v === "lev" ? "Net debt / EBITDA" : v === "debt" ? "Total debt" : "Cash")} />
        <ReferenceLine yAxisId="r" y={3} stroke="#F5A640" strokeDasharray="4 4" /><ReferenceLine yAxisId="r" y={4} stroke="#F06464" strokeDasharray="4 4" />
        <Bar yAxisId="l" dataKey="debt" fill={C.crit} fillOpacity={0.75} radius={[3, 3, 0, 0]} maxBarSize={22} animationDuration={600} />
        <Bar yAxisId="l" dataKey="cash" fill={C.ebitda} fillOpacity={0.85} radius={[3, 3, 0, 0]} maxBarSize={22} animationDuration={600} />
        <Line yAxisId="r" dataKey="lev" stroke={C.ai} strokeWidth={2.2} dot={{ r: 3.5, fill: "var(--c-card)", strokeWidth: 2 }} animationDuration={700} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function StressChart({ rows }: { rows: { name: string; base: number | null; stressed: number | null }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} barGap={4}>
        {grid}<XAxis dataKey="name" {...axis} /><YAxis {...axis} width={48} tickFormatter={axisM} />
        <Tooltip {...chartTooltip} cursor={{ fill: "var(--c-cursor)" }} formatter={(v: number, n: string) => [tipM(v), n === "base" ? "Base case" : "Stressed (illustrative)"]} />
        <Legend {...legend} formatter={(v) => (v === "base" ? "Base case" : "Stressed (illustrative)")} />
        <ReferenceLine y={0} stroke="var(--c-muted)" />
        <Bar dataKey="base" fill="#3988F5" radius={[3, 3, 0, 0]} maxBarSize={34} animationDuration={600} />
        <Bar dataKey="stressed" fill={C.stress} fillOpacity={0.85} radius={[3, 3, 0, 0]} maxBarSize={34} animationDuration={600} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** each pillar's share of the overall score, in points of 100 */
export function ContributionChart({ risk }: { risk: RiskResult }) {
  const data = risk.categories.map((c) => ({ name: c.name.replace(" and ", " & "), v: c.points == null || !risk.maxEvaluated ? 0 : Math.round((c.points / risk.maxEvaluated) * 1000) / 10, sev: c.severity, na: c.points == null }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
        <XAxis type="number" hide domain={[0, "dataMax"]} />
        <YAxis type="category" dataKey="name" {...axis} width={150} tick={{ fill: "var(--c-tick)", fontSize: 11.5 }} />
        <Tooltip {...chartTooltip} cursor={{ fill: "var(--c-cursor)" }} formatter={(v: number) => [`${v} of 100 points`, "Contribution"]} />
        <Bar dataKey="v" radius={[0, 6, 6, 0]} barSize={16} animationDuration={700}>
          {data.map((d) => <Cell key={d.name} fill={d.na ? "var(--c-muted)" : LEVEL_HEX[d.sev]} />)}
          <LabelList dataKey="v" position="right" fill="var(--c-tick)" fontSize={11} formatter={(v: number) => `${v}`} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
