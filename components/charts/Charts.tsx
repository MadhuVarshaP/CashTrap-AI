"use client";

import { cur } from "@/lib/utilities/format";
import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AnalysisResult } from "@/types/finance";
import { chartTooltip } from "@/components/shared/ui";

const axis = { stroke: "#707681", fontSize: 11, tickLine: false, axisLine: false } as const;
const grid = <CartesianGrid stroke="#23262d" vertical={false} />;
const fy = (y: number) => `FY${String(y).slice(2)}`;
export const COLORS = { revenue: "#3988F5", ebitda: "#35C994", ocf: "#F5A640", ai: "#A78BFA", crit: "#F06464", muted: "#707681" };

export type Series = "revenue" | "ebitda" | "ocf";
const label: Record<Series, string> = { revenue: "Revenue", ebitda: "EBITDA", ocf: "Operating cash flow" };

export function TrendChart({ a, series, mode, from }: { a: AnalysisResult; series: Series[]; mode: "absolute" | "indexed"; from: number }) {
  const rows = a.records.filter((r) => r.year >= from);
  const base = rows[0];
  const pick = (r: typeof base, s: Series) => (s === "revenue" ? r.revenue : s === "ebitda" ? r.ebitda : r.operatingCashFlow);
  const data = rows.map((r) => {
    const o: Record<string, number | string | null> = { year: fy(r.year) };
    for (const s of series) { const v = pick(r, s), b = pick(base, s); o[s] = mode === "indexed" ? (v != null && b ? (v / b) * 100 : null) : v; }
    return o;
  });
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        {grid}
        <XAxis dataKey="year" {...axis} />
        <YAxis {...axis} width={44} tickFormatter={(v) => (mode === "indexed" ? `${v}` : `${v}`)} domain={mode === "indexed" ? ["auto", "auto"] : [0, "auto"]} />
        <Tooltip {...chartTooltip} formatter={(v: number, n: string) => [mode === "indexed" ? `${v.toFixed(0)} (base 100)` : `${cur()} ${v.toFixed(1)}m`, label[n as Series]]} />
        <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, color: "#A2A7B0", paddingTop: 8 }} formatter={(v) => label[v as Series]} />
        {series.map((s) => <Line key={s} type="monotone" dataKey={s} stroke={COLORS[s]} strokeWidth={2.2} dot={{ r: 3.5, fill: "#17191E", strokeWidth: 2 }} activeDot={{ r: 5 }} animationDuration={700} />)}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export type WC = "dso" | "dio" | "dpo" | "ccc";
export const WC_LABEL: Record<WC, string> = { dso: "DSO", dio: "DIO", dpo: "DPO", ccc: "CCC" };
const wcColor: Record<WC, string> = { dso: "#3988F5", dio: "#A78BFA", dpo: "#35C994", ccc: "#F06464" };

export function WorkingCapitalChart({ a, show }: { a: AnalysisResult; show: WC[] }) {
  const data = a.metrics.map((m) => ({ year: fy(m.year) + (m.approximate ? "*" : ""), dso: m.dso, dio: m.dio, dpo: m.dpo, ccc: m.ccc }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        {grid}
        <XAxis dataKey="year" {...axis} />
        <YAxis {...axis} width={50} unit="d" />
        <Tooltip {...chartTooltip} formatter={(v: number, n: string) => [`${v.toFixed(1)} days`, WC_LABEL[n as WC]]} />
        <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, color: "#A2A7B0", paddingTop: 8 }} formatter={(v) => WC_LABEL[v as WC]} />
        {show.map((k) => <Line key={k} type="monotone" dataKey={k} stroke={wcColor[k]} strokeWidth={k === "ccc" ? 2.8 : 2} strokeDasharray={k === "ccc" ? undefined : "0"} dot={{ r: 3.5, fill: "#17191E", strokeWidth: 2 }} connectNulls={false} animationDuration={700} />)}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** EBITDA vs OCF with the shaded gap = profit that did not become cash. */
export function DivergenceChart({ a }: { a: AnalysisResult }) {
  const data = a.records.map((r) => ({ year: fy(r.year), ebitda: r.ebitda, ocf: r.operatingCashFlow, gap: r.ebitda != null && r.operatingCashFlow != null ? [r.operatingCashFlow, r.ebitda] : null }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        {grid}
        <XAxis dataKey="year" {...axis} />
        <YAxis {...axis} width={44} />
        <Tooltip {...chartTooltip} formatter={(v: number | number[], n: string) => (n === "gap" ? [`${cur()} ${(((v as number[])[1] - (v as number[])[0])).toFixed(1)}m`, "Cash gap"] : [`${cur()} ${(v as number).toFixed(1)}m`, n === "ebitda" ? "EBITDA" : "Operating cash flow"])} />
        <Area type="monotone" dataKey="gap" stroke="none" fill="#F06464" fillOpacity={0.16} animationDuration={700} />
        <Line type="monotone" dataKey="ebitda" stroke={COLORS.ebitda} strokeWidth={2.2} dot={{ r: 3.5, fill: "#17191E", strokeWidth: 2 }} animationDuration={700} />
        <Line type="monotone" dataKey="ocf" stroke={COLORS.ocf} strokeWidth={2.2} dot={{ r: 3.5, fill: "#17191E", strokeWidth: 2 }} animationDuration={700} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Indexed growth: receivables, inventory vs revenue (base year = 100). */
export function GrowthIndexChart({ a }: { a: AnalysisResult }) {
  const b = a.records[0];
  const ix = (v: number | null, base: number | null) => (v != null && base ? (v / base) * 100 : null);
  const data = a.records.map((r) => ({ year: fy(r.year), revenue: ix(r.revenue, b.revenue), receivables: ix(r.receivables, b.receivables), inventory: ix(r.inventory, b.inventory) }));
  const n: Record<string, string> = { revenue: "Revenue", receivables: "Receivables", inventory: "Inventory" };
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        {grid}
        <XAxis dataKey="year" {...axis} />
        <YAxis {...axis} width={44} domain={[80, "auto"]} />
        <ReferenceLine y={100} stroke="#3a3f49" strokeDasharray="3 3" />
        <Tooltip {...chartTooltip} formatter={(v: number, k: string) => [`${v.toFixed(0)} (base 100)`, n[k]]} />
        <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, color: "#A2A7B0", paddingTop: 8 }} formatter={(v) => n[v]} />
        <Line type="monotone" dataKey="revenue" stroke={COLORS.revenue} strokeWidth={2.2} dot={{ r: 3 }} animationDuration={700} />
        <Line type="monotone" dataKey="receivables" stroke={COLORS.crit} strokeWidth={2.2} dot={{ r: 3 }} animationDuration={700} />
        <Line type="monotone" dataKey="inventory" stroke={COLORS.ai} strokeWidth={2.2} dot={{ r: 3 }} animationDuration={700} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Cash bridge from EBITDA to operating cash flow for the latest year. */
export function CashBridge({ a }: { a: AnalysisResult }) {
  const c = a.latestRecord, p = a.previousRecord;
  if (!p || [c.ebitda, c.operatingCashFlow, c.receivables, p.receivables, c.inventory, p.inventory, c.payables, p.payables].some((v) => v == null)) return <p className="text-[13px] text-ink3">Cash bridge needs EBITDA, OCF, receivables, inventory and payables for two years.</p>;
  const steps = [
    { name: "EBITDA", v: c.ebitda!, total: true },
    { name: "Δ Recv.", v: -(c.receivables! - p.receivables!) },
    { name: "Δ Inv.", v: -(c.inventory! - p.inventory!) },
    { name: "Δ Pay.", v: c.payables! - p.payables! },
  ];
  const run = steps.reduce((s, x) => s + x.v, 0);
  steps.push({ name: "Other", v: c.operatingCashFlow! - run });
  steps.push({ name: "OCF", v: c.operatingCashFlow!, total: true });
  let acc = 0;
  const data = steps.map((s) => {
    if (s.total) { acc = s.v; return { name: s.name, base: 0, up: s.v, down: 0, total: true, v: s.v }; }
    const start = acc; acc += s.v;
    return { name: s.name, base: Math.min(start, acc), up: s.v >= 0 ? s.v : 0, down: s.v < 0 ? -s.v : 0, total: false, v: s.v };
  });
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        {grid}
        <XAxis dataKey="name" {...axis} interval={0} tick={{ fontSize: 10, fill: "#707681" }} />
        <YAxis {...axis} width={44} />
        <Tooltip {...chartTooltip} cursor={{ fill: "#ffffff08" }} formatter={(_v, _n, p) => { const v = (p.payload as { v: number }).v; return [`${v >= 0 ? "+" : "−"}${cur()} ${Math.abs(v).toFixed(1)}m`, ""]; }} separator="" />
        <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
        <Bar dataKey="up" stackId="w" animationDuration={700}>{data.map((d, i) => <Cell key={i} fill={d.total ? "#3988F5" : "#35C994"} />)}</Bar>
        <Bar dataKey="down" stackId="w" fill="#F06464" radius={[4, 4, 0, 0]} animationDuration={700} />
      </BarChart>
    </ResponsiveContainer>
  );
}
