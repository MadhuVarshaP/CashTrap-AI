"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import { Info, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { Bar as RBar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button, Card, CardHead, CountNum, Money, PageTitle, Pill, chartTooltip } from "@/components/shared/ui";
import { cashRelease } from "@/lib/calculations/metrics";
import { useApp } from "@/lib/state/store";
import { fmtNum } from "@/lib/utilities/format";

const SCEN = [
  { id: "cons", name: "Conservative", cut: 8, color: "#A2A7B0", note: "Tighter follow-up on overdue accounts" },
  { id: "base", name: "Base", cut: 15, color: "#3988F5", note: "Revised credit terms + collections discipline" },
  { id: "opt", name: "Optimistic", cut: 25, color: "#35C994", note: "Full return toward prior-year DSO" },
];

const num = (s: string) => (s.trim() === "" ? NaN : Number(s));

function NumField({ label, value, onChange, unit, error }: { label: string; value: string; onChange: (v: string) => void; unit: string; error?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-wider text-ink3">{label}</span>
      <span className={clsx("flex h-12 items-center rounded-xl border bg-bg2 px-3 focus-within:border-accent", error ? "border-crit" : "border-line")}>
        <input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-transparent font-mono text-[16px] tabular-nums outline-none" aria-invalid={!!error} />
        <span className="ml-2 whitespace-nowrap font-mono text-[11px] text-ink3">{unit}</span>
      </span>
      {error && <span role="alert" className="mt-1 block text-[11.5px] text-crit">{error}</span>}
    </label>
  );
}

export default function CashImpact() {
  const { analysis, active } = useApp();
  // DSO is measured on credit sales when supplied, so the same base is used for the cash-release maths
  const creditBasis = analysis?.latestRecord.creditSales != null;
  const defRev = analysis?.latestRecord.creditSales ?? analysis?.latestRecord.revenue ?? 471;
  const defDso = analysis?.latest.dso ?? 75.9;

  const [rev, setRev] = useState("");
  const [dso, setDso] = useState("");
  const [targets, setTargets] = useState<number[]>([]);
  const [sel, setSel] = useState(1);

  const reset = () => {
    setRev(defRev.toFixed(1)); setDso(defDso.toFixed(1));
    setTargets(SCEN.map((s) => Math.max(0, Math.round(defDso - s.cut))));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(reset, [active.id, analysis?.generatedAt]);

  const R = num(rev), D = num(dso);
  const revErr = isNaN(R) ? "Enter a number" : R <= 0 ? "Must be greater than 0" : undefined;
  const dsoErr = isNaN(D) ? "Enter a number" : D < 0 || D > 365 ? "Between 0 and 365" : undefined;
  const valid = !revErr && !dsoErr && targets.length === 3;
  const T = targets[sel] ?? 0;
  const set = (i: number, v: number) => setTargets((t) => t.map((x, j) => (j === i ? v : x)));
  const release = (t: number) => (valid ? cashRelease(R, D, t) : 0);
  const days = valid ? D - T : 0;
  const lessThanZero = valid && days <= 0;
  const maxT = valid ? Math.max(1, Math.round(D)) : 100;
  const dailyRev = valid ? R / 365 : 0;
  const ccc = analysis?.latest.ccc;

  const chart = [
    { name: "Current", dso: valid ? D : 0, color: "#F06464" },
    ...SCEN.map((s, i) => ({ name: s.name, dso: targets[i] ?? 0, color: s.color })),
  ];

  return (
    <>
      <PageTitle title="Cash Impact Calculator" sub="Quantify the working-capital cash that better collections could release." right={<Button variant="ghost" onClick={reset}><RotateCcw size={14} /> Reset to company data</Button>} />
      <div className="grid gap-5 xl:grid-cols-12">
        <Card className="xl:col-span-4">
          <CardHead title="Inputs" hint="Prefilled from the active company's latest year. Edit any value to model your own case." />
          <div className="space-y-4">
            <NumField label={creditBasis ? "Annual credit sales" : "Annual revenue"} value={rev} onChange={setRev} unit="AED m" error={revErr} />
            <NumField label="Current DSO" value={dso} onChange={setDso} unit="days" error={dsoErr} />
            <NumField label={`Target DSO · ${SCEN[sel].name}`} value={String(targets[sel] ?? "")} onChange={(v) => { const n = num(v); if (!isNaN(n)) set(sel, Math.max(0, n)); }} unit="days" error={valid && T > D ? "Target is above current DSO" : undefined} />
            <input type="range" min={0} max={maxT} step={1} value={Math.min(T, maxT)} onChange={(e) => set(sel, Number(e.target.value))} className="w-full" aria-label="Target DSO slider" />
            <div className="flex justify-between font-mono text-[10px] text-ink3"><span>0d</span><span>current {valid ? fmtNum(D, 0) : "—"}d</span></div>
          </div>
          <div className="mt-5 rounded-xl border border-line bg-bg2 p-3.5 font-mono text-[11.5px] leading-relaxed text-ink2">
            Cash release = (Revenue ÷ 365) × (Current DSO − Target DSO)<br />
            <span className="text-ink3">= ({valid ? fmtNum(R) : "—"} ÷ 365) × ({valid ? fmtNum(D) : "—"} − {fmtNum(T, 0)})</span>
          </div>
        </Card>

        <div className="space-y-5 xl:col-span-8">
          <motion.div key={sel} initial={{ opacity: 0.6 }} animate={{ opacity: 1 }} className="relative overflow-hidden rounded-card border border-line bg-card p-6 sm:p-8">
            <div className="absolute inset-y-0 left-0 w-1" style={{ background: SCEN[sel].color }} />
            <div className="flex items-center justify-between"><span className="font-mono text-[11px] uppercase tracking-wider text-ink3">Potential cash release · {SCEN[sel].name}</span><Pill tone="warn">Illustrative</Pill></div>
            <div className="mt-3 font-display text-[44px] font-semibold leading-none tracking-tight sm:text-[64px]">
              {valid && !lessThanZero ? <Money value={release(T)} prefix="AED " suffix="m" /> : <span className="text-ink3">AED 0.0m</span>}
            </div>
            <p className="mt-2 text-[13px] text-ink2">{lessThanZero ? "Target DSO is not lower than current DSO, so no cash is released." : `≈ AED ${valid ? fmtNum(dailyRev, 2) : "—"}m of cash per day of DSO improvement.`}</p>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Current DSO", valid ? <CountNum key="a" value={D} decimals={1} suffix=" d" /> : "—"],
                ["Target DSO", <CountNum key="b" value={T} decimals={1} suffix=" d" />],
                ["Days improved", valid ? <CountNum key="c" value={Math.max(0, days)} decimals={1} suffix=" d" /> : "—"],
                ["Improvement", valid && D > 0 ? <CountNum key="d" value={Math.max(0, (days / D) * 100)} decimals={1} suffix="%" /> : "—"],
              ].map(([l, v]) => <div key={l as string} className="rounded-xl bg-bg2 p-3.5"><div className="font-mono text-[10px] uppercase text-ink3">{l}</div><div className="mt-1 font-display text-[20px] font-semibold">{v}</div></div>)}
            </div>
            {ccc != null && valid && !lessThanZero && <p className="mt-4 font-mono text-[11.5px] text-ink3">Pro-forma cash conversion cycle: {fmtNum(ccc, 0)}d → {fmtNum(ccc - days, 0)}d (all else equal)</p>}
          </motion.div>

          <div className="grid gap-4 md:grid-cols-3">
            {SCEN.map((s, i) => (
              <button key={s.id} onClick={() => setSel(i)} aria-pressed={sel === i} className={clsx("rounded-card border bg-card p-5 text-left transition-colors", sel === i ? "border-[#4a505c] bg-elev" : "border-line hover:border-[#3a3f49]")}>
                <div className="flex items-center gap-2 text-[13px] font-medium"><span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />{s.name}</div>
                <div className="mt-2 font-display text-[24px] font-semibold tabular-nums">{valid ? `AED ${fmtNum(Math.max(0, release(targets[i] ?? 0)))}m` : "—"}</div>
                <div className="mt-1 font-mono text-[11px] text-ink3">Target {targets[i]}d</div>
                <p className="mt-2 text-[11.5px] leading-snug text-ink3">{s.note}</p>
              </button>
            ))}
          </div>

          <Card>
            <CardHead title="Current vs proposed DSO" hint="Days sales outstanding under each scenario. Lower means faster collection." />
            <div className="h-[230px]">
              <ResponsiveContainer>
                <BarChart data={chart} layout="vertical" margin={{ left: 10, right: 48 }}>
                  <CartesianGrid stroke="#23262d" horizontal={false} />
                  <XAxis type="number" stroke="#707681" fontSize={11} tickLine={false} axisLine={false} unit="d" />
                  <YAxis type="category" dataKey="name" stroke="#A2A7B0" fontSize={12} tickLine={false} axisLine={false} width={92} />
                  <Tooltip {...chartTooltip} cursor={{ fill: "#ffffff08" }} formatter={(v: number) => [`${v.toFixed(1)} days`, "DSO"]} />
                  <ReferenceLine x={0} stroke="#3a3f49" />
                  <RBar dataKey="dso" radius={[0, 8, 8, 0]} barSize={22} animationDuration={500}>
                    {chart.map((c, i) => <Cell key={i} fill={c.color} fillOpacity={i === 0 || i - 1 === sel ? 1 : 0.55} />)}
                    <LabelList dataKey="dso" position="right" formatter={(v: number) => `${v.toFixed(0)}d`} fill="#A2A7B0" fontSize={11} />
                  </RBar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="flex gap-3 rounded-2xl border border-warn/25 bg-warn/5 p-4 text-[12.5px] leading-relaxed text-ink2">
            <Info size={17} className="mt-0.5 shrink-0 text-warn" />
            <p>This is an illustrative working-capital improvement estimate, not guaranteed cash recovery or additional profit. It is a one-off release of cash tied up in receivables and assumes revenue and customer mix stay constant.</p>
          </div>
        </div>
      </div>
    </>
  );
}
