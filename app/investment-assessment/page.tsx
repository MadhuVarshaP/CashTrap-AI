"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ChevronDown, CircleSlash, Crosshair } from "lucide-react";
import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { CashBridge, DivergenceChart, GrowthIndexChart } from "@/components/charts/Charts";
import { RiskGauge, riskColor } from "@/components/charts/RiskGauge";
import { WithAnalysis } from "@/components/shared/Guard";
import { Bar, Card, CardHead, PageTitle, Pill, SEV, SeverityBadge, chartTooltip } from "@/components/shared/ui";
import { signed } from "@/lib/utilities/format";
import type { AnalysisResult, RiskCategory } from "@/types/finance";

const PIE = ["#3988F5", "#A78BFA", "#F06464", "#F5A640", "#35C994", "#707681"];

export default function Assessment() {
  return <WithAnalysis>{(a) => <Page a={a} />}</WithAnalysis>;
}

function Page({ a }: { a: AnalysisResult }) {
  const { risk } = a;
  const [unit, setUnit] = useState<"pts" | "pct">("pts");
  const [open, setOpen] = useState<string | null>(risk.categories.slice().sort((x, y) => (y.points ?? 0) / y.max - (x.points ?? 0) / x.max)[0]?.id ?? null);
  const delta = risk.score != null && a.previousScore != null ? risk.score - a.previousScore : null;
  const top = risk.categories.filter((c) => c.points != null && c.points > 0).sort((x, y) => (y.points! / y.max) - (x.points! / x.max) || y.points! - x.points!).slice(0, 3);
  const pie = risk.categories.filter((c) => (c.points ?? 0) > 0).map((c) => ({ name: c.name, value: c.points! }));
  const weight = (max: number) => (risk.maxEvaluated ? Math.round((max / risk.maxEvaluated) * 1000) / 10 : 0); // effective weight after rescaling for missing indicators
  const fy = (y: number) => `FY${String(y).slice(2)}`;

  return (
    <>
      <PageTitle title="Investment Assessment" sub="Where financial risk is emerging, scored, evidenced and ready to investigate." right={<Pill tone="warn">Illustrative screening model</Pill>} />
      <div className="grid gap-5 xl:grid-cols-12">
        {/* A. score */}
        <Card className="xl:col-span-4">
          <CardHead title="Overall risk score" hint="Weighted 0–100 score. Higher = more identified financial risk. Normalised across the indicators that could be evaluated." />
          <RiskGauge risk={risk} size={250} />
          <div className="mt-5 grid grid-cols-3 gap-2.5">
            {[
              ["Raw points", risk.insufficient ? "—" : `${risk.rawPoints}/${risk.maxEvaluated}`],
              ["Coverage", `${risk.evaluated}/${risk.total}`],
              ["vs prior yr", delta == null ? "n/a" : signed(delta, 0, " pts")],
            ].map(([l, v]) => <div key={l} className="rounded-xl border border-line bg-bg2 p-3 text-center"><div className="font-mono text-[10px] uppercase text-ink3">{l}</div><div className={clsx("mt-1 font-display text-[17px] font-semibold tabular-nums", l === "vs prior yr" && delta != null && (delta > 0 ? "text-crit" : "text-pos"))}>{v}</div></div>)}
          </div>
          {risk.insufficient && <p role="alert" className="mt-4 rounded-xl border border-warn/30 bg-warn/5 p-3 text-[12.5px] text-warn">Fewer than 4 indicators could be evaluated. No overall score is shown. Complete the missing data.</p>}
        </Card>

        {/* B. breakdown */}
        <Card className="xl:col-span-5">
          <CardHead title="Risk breakdown" hint="Weights sum to 100, so points and percent of the total score are the same thing. Each bar shows how much of its own weight a category scored. Categories without data are not evaluated, never counted as zero risk." right={
            <div role="group" aria-label="Display unit" className="inline-flex rounded-xl border border-line bg-bg2 p-1">
              {([["pts", "Points"], ["pct", "Percent"]] as const).map(([k, l]) => <button key={k} onClick={() => setUnit(k)} aria-pressed={unit === k} className={clsx("rounded-lg px-3 py-1.5 font-mono text-[11px]", unit === k ? "bg-elev text-ink" : "text-ink3 hover:text-ink2")}>{l}</button>)}
            </div>
          } />
          <div className="space-y-4">
            {risk.categories.map((c, i) => (
              <button key={c.id} onClick={() => setOpen(c.id)} className="block w-full text-left">
                <div className="mb-1.5 flex items-center justify-between gap-3 text-[13px]">
                  <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-sm" style={{ background: PIE[i] }} />{c.name}</span>
                  {c.points == null ? <span className="font-mono text-[11px] text-ink3">NOT EVALUATED</span> : (
                    <span className="font-mono text-[12px] tabular-nums">
                      {unit === "pts" ? <>{c.points}<span className="text-ink3">/{c.max}</span></> : <>{Math.round((c.points / c.max) * 100)}%<span className="text-ink3"> of weight</span></>}
                      <span className="ml-2 text-ink3">· {weight(c.max)}% wt</span>
                    </span>
                  )}
                </div>
                {/* segmented bar: weight shown as full track, scored points filled */}
                <div className="relative">
                  <Bar value={c.points ?? 0} max={c.max} color={c.points == null ? "#3a3f49" : SEV[c.severity].hex} className="h-2.5" />
                  {c.points == null && <div className="absolute inset-0 rounded-full" style={{ background: "repeating-linear-gradient(135deg,#3a3f49 0 4px,transparent 4px 8px)", opacity: 0.5 }} />}
                </div>
              </button>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between border-t border-line pt-4 font-mono text-[11px] text-ink3"><span>TOTAL WEIGHT 100%{risk.evaluated < risk.total && " (rescaled to evaluated)"}</span><span>0–24 LOW · 25–49 MOD · 50–74 HIGH · 75+ CRIT</span></div>
        </Card>

        {/* D. distribution */}
        <Card className="xl:col-span-3">
          <CardHead title="Risk distribution" hint="Share of scored points contributed by each category." />
          <div className="h-[190px]">
            {pie.length ? (
              <ResponsiveContainer><PieChart><Pie data={pie} dataKey="value" innerRadius={52} outerRadius={80} paddingAngle={3} stroke="none" animationDuration={800}>{pie.map((p) => <Cell key={p.name} fill={PIE[risk.categories.findIndex((c) => c.name === p.name)]} />)}</Pie><Tooltip {...chartTooltip} formatter={(v: number, n: string) => [`${v} pts`, n]} /></PieChart></ResponsiveContainer>
            ) : <p className="pt-16 text-center text-[13px] text-ink3">No risk points scored.</p>}
          </div>
          <ul className="mt-2 space-y-1.5">{pie.map((p) => <li key={p.name} className="flex justify-between text-[11.5px] text-ink2"><span className="truncate pr-2">{p.name}</span><span className="font-mono text-ink3">{Math.round((p.value / risk.rawPoints) * 100)}%</span></li>)}</ul>
        </Card>

        {/* F. look closer */}
        <Card className="xl:col-span-12 !border-crit/20">
          <CardHead icon={<Crosshair size={17} className="text-crit" />} title="Where should the investment team look closer?" />
          <div className="grid gap-4 md:grid-cols-3">
            {top.map((c, i) => (
              <motion.div key={c.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="rounded-2xl border border-line bg-bg2 p-5">
                <div className="mb-3 flex items-center justify-between"><span className="font-display text-[34px] font-semibold leading-none text-ink3">0{i + 1}</span><SeverityBadge s={c.severity} /></div>
                <div className="text-[14.5px] font-medium">{c.name}</div>
                <p className="mt-2 font-mono text-[11.5px] leading-relaxed text-ink2">{c.evidence}</p>
                <p className="mt-3 text-[12.5px] text-ink3">Ask: {c.questions[0]}</p>
              </motion.div>
            ))}
            {top.length === 0 && <p className="text-[13px] text-ink2 md:col-span-3">No category scored risk points on the evaluated indicators.</p>}
          </div>
        </Card>

        {/* visual evidence */}
        <Card className="xl:col-span-4">
          <CardHead title="EBITDA vs operating cash flow" hint="The shaded band is profit that did not turn into operating cash." />
          <div className="h-[240px]"><DivergenceChart a={a} /></div>
        </Card>
        <Card className="xl:col-span-4">
          <CardHead title="Receivables & inventory vs revenue" hint="Indexed to the first year = 100. Lines rising above revenue signal cash being absorbed." />
          <div className="h-[240px]"><GrowthIndexChart a={a} /></div>
        </Card>
        <Card className="xl:col-span-4">
          <CardHead title={`Cash bridge ${fy(a.latestRecord.year)}`} hint="How EBITDA became operating cash flow. AED millions. Red = cash absorbed." />
          <div className="h-[240px]"><CashBridge a={a} /></div>
        </Card>

        {/* C. detail cards */}
        <div className="space-y-4 xl:col-span-8">
          <h2 className="font-display text-[19px] font-semibold">Risk detail</h2>
          {risk.categories.map((c) => <Detail key={c.id} c={c} open={open === c.id} toggle={() => setOpen(open === c.id ? null : c.id)} />)}
        </div>

        <div className="space-y-5 xl:col-span-4">
          {/* E. coverage */}
          <Card>
            <CardHead title="Assessment coverage" hint="Minimum 4 of 6 indicators required for an overall score." />
            <div className="mb-3 flex items-baseline gap-2"><span className="font-display text-[34px] font-semibold tabular-nums">{risk.evaluated}</span><span className="text-ink3">of {risk.total} indicators evaluated</span></div>
            <ul className="space-y-2">
              {risk.categories.map((c) => (
                <li key={c.id} className="flex items-center justify-between rounded-lg bg-bg2 px-3 py-2 text-[12.5px]">
                  <span className="truncate pr-2">{c.name}</span>
                  {c.points == null ? <span className="flex items-center gap-1 font-mono text-[10.5px] text-warn"><CircleSlash size={12} />MISSING</span> : <span className="font-mono text-[10.5px] text-pos">✓ EVALUATED</span>}
                </li>
              ))}
            </ul>
            {risk.evaluated < risk.total && <p className="mt-3 flex gap-2 text-[12px] text-warn"><AlertTriangle size={14} className="mt-0.5 shrink-0" />Incomplete assessment. The score is normalised to evaluated indicators only.</p>}
          </Card>
          <Card>
            <CardHead title="Detected signals" />
            <ul className="space-y-3">
              {a.alerts.map((al) => (
                <li key={al.id} className="rounded-xl border border-line bg-bg2 p-3.5">
                  <div className="mb-1.5 flex items-start justify-between gap-2"><span className="text-[13px] font-medium leading-snug">{al.name}</span><SeverityBadge s={al.severity} /></div>
                  <div className="font-mono text-[11px] text-ink2">{al.previous} → {al.current}</div>
                  <p className="mt-2 text-[12px] leading-relaxed text-ink3">{al.why}</p>
                </li>
              ))}
              {a.alerts.length === 0 && <li className="text-[13px] text-ink2">No signals triggered.</li>}
            </ul>
          </Card>
          <p className="rounded-2xl border border-line p-4 text-[11.5px] leading-relaxed text-ink3">These thresholds are prototype screening bands, not industry standards, and not a definitive investment decision. A flagged indicator is a potential risk to investigate, not proof of fraud, poor management or bad debt.</p>
        </div>
      </div>
    </>
  );
}

function Detail({ c, open, toggle }: { c: RiskCategory; open: boolean; toggle: () => void }) {
  const unevaluated = c.points == null;
  return (
    <div className={clsx("overflow-hidden rounded-card border bg-card transition-colors", open ? "border-[#3f4551]" : "border-line")}>
      <button onClick={toggle} aria-expanded={open} className="flex w-full items-center gap-4 p-5 text-left">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5"><span className="font-display text-[15px] font-medium">{c.name}</span>{unevaluated ? <Pill>Not evaluated</Pill> : <SeverityBadge s={c.severity} label={c.points === 0 ? "No flag" : c.severity} />}</div>
          <p className="mt-1 truncate font-mono text-[11.5px] text-ink3">{c.evidence}</p>
        </div>
        <div className="text-right"><div className="font-display text-[24px] font-semibold tabular-nums">{unevaluated ? "—" : c.points}<span className="text-[13px] text-ink3">/{c.max}</span></div></div>
        <ChevronDown size={18} className={clsx("text-ink3 transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="grid gap-5 border-t border-line p-5 md:grid-cols-2">
              <div>
                <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-ink3">Financial evidence</div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-xl bg-bg2 p-3"><div className="font-mono text-[10px] text-ink3">PREVIOUS</div><div className="mt-1 font-mono text-[12px] leading-snug">{c.prev}</div></div>
                  <div className="rounded-xl bg-bg2 p-3"><div className="font-mono text-[10px] text-ink3">CURRENT</div><div className="mt-1 font-mono text-[12px] leading-snug">{c.curr}</div></div>
                </div>
                <p className="mt-3 text-[12.5px] leading-relaxed text-ink2">{c.explanation}</p>
              </div>
              <div>
                <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-ink3">Questions to investigate</div>
                <ul className="space-y-2">{c.questions.map((q) => <li key={q} className="flex gap-2 text-[12.5px] text-ink2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />{q}</li>)}</ul>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
