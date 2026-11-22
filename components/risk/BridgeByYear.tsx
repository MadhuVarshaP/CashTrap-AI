"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { useState } from "react";
import { Card, CardHead } from "@/components/shared/ui";
import { Tilt } from "@/components/shared/Tilt";
import type { BridgeYear } from "@/lib/calculations/cashbridge";
import { fmtM, fmtPct } from "@/lib/utilities/format";

type Row = { id: string; label: string; sign: string; get: (y: BridgeYear) => number | null; kind: "total" | "in" | "out" | "mix"; strong?: boolean };

const ROWS: Row[] = [
  { id: "rep", label: "Reported EBITDA", sign: "", get: (y) => y.reported, kind: "total" },
  { id: "adj", label: "Verified adjustments", sign: "+", get: (y) => y.adjustment, kind: "in" },
  { id: "adjd", label: "Adjusted EBITDA", sign: "=", get: (y) => y.adjusted, kind: "total", strong: true },
  { id: "wc", label: "Increase in working capital", sign: "−", get: (y) => y.wcIncrease, kind: "out" },
  { id: "tax", label: "Cash taxes", sign: "−", get: (y) => y.taxes, kind: "out" },
  { id: "int", label: "Cash interest", sign: "−", get: (y) => y.interest, kind: "out" },
  { id: "capex", label: "Capital expenditure", sign: "−", get: (y) => y.capex, kind: "out" },
  { id: "oth", label: "Other cash adjustments", sign: "±", get: (y) => y.other, kind: "mix" },
  { id: "fcf", label: "Free cash flow", sign: "=", get: (y) => y.fcf, kind: "total", strong: true },
  { id: "ocf", label: "Operating cash flow", sign: "", get: (y) => y.ocf, kind: "total" },
  { id: "gap", label: "Cash gap (adj. EBITDA − OCF)", sign: "", get: (y) => y.gap, kind: "mix" },
];

const barColor = (r: Row, v: number) => (r.kind === "total" ? (v < 0 ? "bg-crit" : "bg-accent") : r.kind === "in" ? "bg-pos" : r.kind === "out" ? "bg-crit/80" : v >= 0 ? (r.id === "gap" ? "bg-warn" : "bg-pos") : r.id === "gap" ? "bg-pos" : "bg-crit/80");

/** the year-by-year bridge: summary cards you can tilt and select, and a wide matrix with a proportional bar in every cell */
export function BridgeByYear({ years, selected, onSelect }: { years: BridgeYear[]; selected: number; onSelect: (y: number) => void }) {
  const [mode, setMode] = useState<"amount" | "pct">("amount");
  const [hot, setHot] = useState<string | null>(null);
  const trend = (i: number) => (i === 0 || years[i].fcf == null || years[i - 1].fcf == null ? null : years[i].fcf! - years[i - 1].fcf!);

  return (
    <Card className="xl:col-span-12" hover={false}>
      <CardHead title="Bridge by year" hint="Choose a year to focus the waterfall above. Every bar is sized against that year's adjusted EBITDA, so years of different size compare fairly." right={
        <div role="tablist" aria-label="Value mode" className="inline-flex rounded-xl border border-line bg-bg2 p-1">
          {([["amount", "Amount"], ["pct", "% of adj. EBITDA"]] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={mode === k} onClick={() => setMode(k)} className={clsx("rounded-lg px-3 py-1.5 font-mono text-[11px] transition-colors", mode === k ? "bg-card text-ink shadow-card" : "text-ink3 hover:text-ink2")}>{l}</button>)}
        </div>
      } />

      {/* year cards */}
      <div className="mb-6 grid gap-4 [perspective:1200px] sm:grid-cols-2 xl:grid-cols-4">
        {years.map((y, i) => {
          const on = y.year === selected;
          const conv = y.conversion == null ? null : Math.max(0, Math.min(1, y.conversion));
          const t = trend(i);
          return (
            <Tilt as="button" key={y.year} onClick={() => onSelect(y.year)} aria-pressed={on} aria-label={`Focus FY${y.year}`}
              className={clsx("rounded-2xl border bg-card p-4", on ? "border-accent shadow-lift ring-1 ring-accent/40" : "border-line shadow-card hover:border-line2")}>
              <div className="flex items-center justify-between"><span className="font-display text-[17px] font-semibold">FY{y.year}</span>{on && <span className="rounded-full bg-accent/10 px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-wider text-accent">in focus</span>}</div>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-wider text-ink3">Free cash flow</div>
                  <div className={clsx("font-display text-[22px] font-semibold tabular-nums", y.fcf != null && y.fcf < 0 && "text-crit")}>{fmtM(y.fcf)}</div>
                  <div className="mt-0.5 inline-flex items-center gap-1 font-mono text-[10.5px] text-ink3">
                    {t == null ? <Minus size={12} /> : t >= 0 ? <ArrowUpRight size={12} className="text-pos" /> : <ArrowDownRight size={12} className="text-crit" />}{t == null ? "first year shown" : `${t >= 0 ? "+" : "−"}${fmtM(Math.abs(t))} vs prior`}
                  </div>
                </div>
                {/* conversion ring */}
                <svg width="62" height="62" viewBox="0 0 62 62" aria-label={`Cash conversion ${fmtPct(y.conversion, 0)}`}>
                  <circle cx="31" cy="31" r="25" fill="none" stroke="var(--c-elev)" strokeWidth="7" />
                  {conv != null && <motion.circle cx="31" cy="31" r="25" fill="none" stroke={conv >= 0.8 ? "#35C994" : conv >= 0.5 ? "#F5A640" : "#F06464"} strokeWidth="7" strokeLinecap="round" strokeDasharray={2 * Math.PI * 25} initial={{ strokeDashoffset: 2 * Math.PI * 25 }} animate={{ strokeDashoffset: 2 * Math.PI * 25 * (1 - conv) }} transition={{ duration: 0.9, ease: "easeOut" }} transform="rotate(-90 31 31)" />}
                  <text x="31" y="35" textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--c-ink)">{y.conversion == null ? "—" : `${Math.round(y.conversion * 100)}%`}</text>
                </svg>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3 font-mono text-[10.5px]">
                <div><div className="text-ink3">Adj. EBITDA</div><div className="text-[12.5px] text-ink">{fmtM(y.adjusted)}</div></div>
                <div><div className="text-ink3">Operating CF</div><div className="text-[12.5px] text-ink">{fmtM(y.ocf)}</div></div>
              </div>
            </Tilt>
          );
        })}
      </div>

      {/* wide matrix */}
      <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
        <table className="w-full min-w-[720px] border-separate border-spacing-0 text-[12.5px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-card py-3 pr-4 text-left font-mono text-[10px] font-medium uppercase tracking-wider text-ink3">Step</th>
              {years.map((y) => (
                <th key={y.year} className="p-0 text-right">
                  <button onClick={() => onSelect(y.year)} className={clsx("tap w-full rounded-t-xl px-4 py-3 font-mono text-[11px] font-medium uppercase tracking-wider", y.year === selected ? "bg-accent/10 text-accent" : "text-ink3 hover:bg-elev hover:text-ink2")}>FY{y.year}</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.id} onMouseEnter={() => setHot(r.id)} onMouseLeave={() => setHot(null)} className={clsx("transition-colors", hot === r.id && "[&>td]:bg-elev/70")}>
                <td className={clsx("sticky left-0 z-10 whitespace-nowrap border-t border-line py-3 pr-4 transition-colors", hot === r.id ? "bg-elev" : "bg-card", r.strong ? "font-medium text-ink" : "text-ink2")}>
                  <span className="mr-2 inline-block w-3 text-center font-mono text-ink3">{r.sign}</span>{r.label}
                </td>
                {years.map((y) => {
                  const v = r.get(y);
                  const base = y.adjusted && Math.abs(y.adjusted) > 0 ? Math.abs(y.adjusted) : null;
                  const w = v == null || base == null ? 0 : Math.min(100, (Math.abs(v) / base) * 100);
                  return (
                    <td key={y.year} className={clsx("min-w-[150px] border-t border-line px-4 py-2.5 text-right transition-colors", y.year === selected && "bg-accent/[0.04]")}>
                      <div className={clsx("font-mono tabular-nums", r.strong ? "font-semibold text-ink" : "text-ink2", v != null && v < 0 && r.kind === "total" && "text-crit")}>
                        {v == null ? <span className="text-ink3">n/s</span> : mode === "amount" ? v.toLocaleString("en-US", { maximumFractionDigits: 1 }) : base ? `${((v / base) * 100).toFixed(0)}%` : "—"}
                      </div>
                      <div className="ml-auto mt-1.5 h-1.5 w-full rounded-full bg-elev">
                        {v != null && <motion.div key={`${mode}-${y.year}-${r.id}`} className={clsx("h-full rounded-full", barColor(r, v))} initial={{ width: 0 }} animate={{ width: `${w}%` }} transition={{ duration: 0.6, ease: "easeOut" }} style={{ marginLeft: "auto" }} />}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <td className="sticky left-0 z-10 border-t border-line bg-card py-3 pr-4 font-medium text-ink"><span className="mr-2 inline-block w-3" />Cash conversion</td>
              {years.map((y) => <td key={y.year} className={clsx("border-t border-line px-4 py-3 text-right font-mono font-semibold tabular-nums", y.year === selected && "bg-accent/[0.04]", y.conversion != null && (y.conversion >= 0.8 ? "text-pos" : y.conversion < 0.5 ? "text-crit" : "text-warn"))}>{fmtPct(y.conversion, 0)}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-ink3">{mode === "amount" ? "Amounts in millions." : "Each value as a share of that year's adjusted EBITDA."} n/s = not supplied (its effect sits inside “Other”). Bars use the same colours as the waterfall: green adds, red absorbs cash, blue totals, amber is the cash gap.</p>
    </Card>
  );
}
