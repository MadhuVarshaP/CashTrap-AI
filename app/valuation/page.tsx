"use client";

import { AlertTriangle, Gauge, Scale } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Bar as RBar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { axisM } from "@/components/risk/charts";
import { NumInput, Stat } from "@/components/risk/parts";
import { WithAnalysis } from "@/components/shared/Guard";
import { Card, CardHead, PageTitle, Pill, chartTooltip } from "@/components/shared/ui";
import { buildValuation, scenarioReturns } from "@/lib/calculations/valuation";
import { useApp } from "@/lib/state/store";
import { fmtM, fmtX, cur } from "@/lib/utilities/format";
import type { AnalysisResult } from "@/types/finance";

export default function ValuationPage() {
  return <WithAnalysis>{(a) => <Page a={a} />}</WithAnalysis>;
}

function Page({ a }: { a: AnalysisResult }) {
  const { updateInputs, active } = useApp();
  const i = a.inputs, v = buildValuation(a), r = v.returns, c = a.latestRecord;
  // downside / upside are shifts from the base case: editable, illustrative, never forecasts
  const [dg, setDg] = useState({ down: -5, up: 3 });
  const [dx, setDx] = useState({ down: -1, up: 1 });
  const cases = r ? [
    { name: "Downside", r: scenarioReturns(a, r.growth + dg.down, r.holdYears, Math.max(0.5, r.exitMultiple + dx.down), "scenario") },
    { name: "Base", r },
    { name: "Upside", r: scenarioReturns(a, r.growth + dg.up, r.holdYears, r.exitMultiple + dx.up, "scenario") },
  ] : [];
  const debtPct = v.enterpriseValue && v.acquisitionDebt != null ? (v.acquisitionDebt / v.enterpriseValue) * 100 : null;
  const entryTone = v.entryLeverage != null && v.entryLeverage > 5 ? "crit" : v.entryLeverage != null && v.entryLeverage > 4 ? "warn" : undefined;
  const postTone = v.postLeverage != null && v.postLeverage > 5 ? "crit" : v.postLeverage != null && v.postLeverage > 4 ? "warn" : undefined;
  const sources = v.enterpriseValue == null ? [] : [
    { name: "Acquisition debt", v: v.acquisitionDebt ?? 0, side: "Sources", color: "#F5A640" },
    { name: "Investor equity", v: i.equityInvested ?? 0, side: "Sources", color: "#3988F5" },
    { name: "Enterprise value", v: v.enterpriseValue, side: "Uses", color: "#35C994" },
  ];

  return (
    <>
      <PageTitle title="Acquisition Valuation" sub="Entry price, deal leverage and the equity cheque, kept separate from the risk assessment." />

      <div className="grid gap-5 xl:grid-cols-12">
        <Card className="xl:col-span-4">
          <CardHead title="Deal inputs" hint={`${cur()} millions. Nothing here is estimated for you: leave a field blank if it is unknown.`} />
          <div className="space-y-3">
            <NumInput label="Proposed enterprise value" value={i.enterpriseValue} unit={`${cur()} m`} onCommit={(n) => updateInputs({ enterpriseValue: n })} />
            <NumInput label="…or entry EV / EBITDA multiple" value={i.entryMultiple} unit="x" onCommit={(n) => updateInputs({ entryMultiple: n })} hint="Used only when no enterprise value is entered: EV = multiple × adjusted EBITDA." />
            <NumInput label="Existing net debt" value={i.existingNetDebt ?? v.netDebt} unit={`${cur()} m`} onCommit={(n) => updateInputs({ existingNetDebt: n })} hint={i.existingNetDebt != null ? "Your override. Clear it to return to total debt − cash from the file." : "From the file (total debt − cash). Type to override, e.g. to add debt-like items."} />
            <NumInput label="Proposed acquisition debt" value={i.acquisitionDebt} unit={`${cur()} m`} onCommit={(n) => updateInputs({ acquisitionDebt: n })} hint="Blank = enterprise value − equity." />
            <NumInput label="Investor equity contribution" value={i.equityInvested} unit={`${cur()} m`} onCommit={(n) => updateInputs({ equityInvested: n })} />
            <NumInput label="Available cash used in the deal" value={i.availableCash} unit={`${cur()} m`} onCommit={(n) => updateInputs({ availableCash: n })} hint={`Subject to transaction adjustments. Target holds ${fmtM(c.cash)}; blank = none used.`} />
          </div>
          <div className="mt-4 rounded-xl bg-bg2 p-3.5 font-mono text-[11.5px] leading-relaxed text-ink2">
            Entry EV/EBITDA = EV ÷ adjusted EBITDA<br />Equity value ≈ EV − net debt<br />Post-deal net debt = existing + new debt − cash used<br />Post-deal leverage = post-deal net debt ÷ adjusted EBITDA
          </div>
        </Card>

        <div className="space-y-5 xl:col-span-8">
          <Card>
            <CardHead title="Entry valuation" hint="From the data and your inputs." />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <Stat label="Enterprise value" value={fmtM(v.enterpriseValue)} sub={v.evDerived ? "entry multiple × adjusted EBITDA" : v.enterpriseValue == null ? "not entered" : "entered"} />
              <Stat label="Entry EV / adjusted EBITDA" value={fmtX(v.entryMultiple, 1)} sub={v.reportedMultiple != null && v.reportedMultiple !== v.entryMultiple ? `${fmtX(v.reportedMultiple, 1)} on reported` : undefined} />
              <Stat label="Approx. equity value" value={fmtM(v.equityValue)} sub="EV − existing net debt" />
            </div>
            {v.enterpriseValue == null && <p className="mt-3 text-[12.5px] text-ink3">Enter a proposed enterprise value or an entry multiple to see the entry valuation.</p>}
          </Card>

          <div className="grid gap-5 md:grid-cols-2">
            <Card>
              <CardHead title="EBITDA normalisation impact" hint="Only verified adjustments count." />
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Reported EBITDA" value={fmtM(v.reportedEbitda)} />
                <Stat label="Adjusted EBITDA" value={fmtM(v.adjustedEbitda)} sub={v.normalisation ? `${v.normalisation > 0 ? "+" : "−"}${fmtM(Math.abs(v.normalisation))}` : "no verified adjustments"} />
              </div>
              <p className="mt-3 text-[12px] leading-relaxed text-ink3">{v.normalisation && v.entryMultiple != null ? `At ${fmtX(v.entryMultiple, 1)}, the adjustment is worth about ${fmtM(Math.abs(v.normalisation) * v.entryMultiple)} of enterprise value: it deserves proof.` : "Adjusted EBITDA equals reported EBITDA. Add adjustments and their support status under Investment Risk → Quality of earnings."}</p>
            </Card>
            <Card>
              <CardHead title="Existing debt exposure" hint="Before the transaction." />
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Total debt" value={fmtM(c.debt)} /><Stat label="Cash" value={fmtM(c.cash)} /><Stat label="Net debt" value={fmtM(v.netDebt)} sub={v.netDebt != null && v.adjustedEbitda != null && v.adjustedEbitda > 0 ? `${fmtX(v.netDebt / v.adjustedEbitda)} EBITDA` : undefined} />
              </div>
            </Card>
          </div>

          <Card>
            <CardHead title="Acquisition leverage and equity requirement" hint="What the proposed structure implies." />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Acquisition debt" value={fmtM(v.acquisitionDebt)} sub={v.debtDerived ? "derived: EV − equity" : undefined} />
              <Stat label="Acquisition leverage" value={fmtX(v.entryLeverage)} sub="new debt ÷ adjusted EBITDA" tone={entryTone} />
              <Stat label="Post-deal net debt" value={fmtM(v.postNetDebt)} sub={`cash used ${fmtM(v.availableCash ?? 0)}`} />
              <Stat label="Post-deal leverage" value={fmtX(v.postLeverage)} sub="net debt ÷ adjusted EBITDA" tone={postTone} />
              <Stat label="Equity requirement" value={fmtM(v.equityRequirement)} sub="EV − acquisition debt" />
              <Stat label="Equity you entered" value={fmtM(i.equityInvested)} />
            </div>
            {v.fundingGap != null && Math.abs(v.fundingGap) > 0.05 && <p role="alert" className="mt-3 flex gap-2 rounded-xl border border-warn/30 bg-warn/5 p-3 text-[12.5px] text-warn"><AlertTriangle size={14} className="mt-0.5 shrink-0" />Sources and uses differ by {fmtM(Math.abs(v.fundingGap))}: debt + equity {v.fundingGap > 0 ? "fall short of" : "exceed"} enterprise value.</p>}
            {sources.length > 0 && (
              <div className="mt-4 h-[190px]">
                <ResponsiveContainer>
                  <BarChart data={[{ name: "Sources", debt: v.acquisitionDebt ?? 0, equity: i.equityInvested ?? 0 }, { name: "Uses", ev: v.enterpriseValue ?? 0 }]} layout="vertical" margin={{ left: 0, right: 16 }}>
                    <CartesianGrid stroke="#23262d" horizontal={false} />
                    <XAxis type="number" stroke="#707681" fontSize={11} tickLine={false} axisLine={false} tickFormatter={axisM} />
                    <YAxis type="category" dataKey="name" stroke="#A2A7B0" fontSize={12} tickLine={false} axisLine={false} width={64} />
                    <Tooltip {...chartTooltip} cursor={{ fill: "#ffffff08" }} formatter={(x: number, n: string) => [fmtM(x), n === "debt" ? "Acquisition debt" : n === "equity" ? "Investor equity" : "Enterprise value"]} />
                    <RBar dataKey="debt" stackId="s" fill="#F5A640" barSize={26} />
                    <RBar dataKey="equity" stackId="s" fill="#3988F5" barSize={26} />
                    <RBar dataKey="ev" stackId="s" fill="#35C994" barSize={26}><Cell fill="#35C994" /></RBar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card>
            <CardHead title="Working-capital adjustment considerations" hint="Possible price or peg discussions. Estimates, not guarantees." />
            <div className="grid gap-3 sm:grid-cols-2">
              <Stat label="Working capital above prior-year share of revenue" value={v.wcExcess == null ? "—" : fmtM(v.wcExcess)} sub="possible normalised-working-capital (peg) discussion" />
              <Stat label="One-off cash from cutting DSO by 15 days" value={fmtM(v.cashRelease15)} sub="see Cash Impact for all three components" />
            </div>
          </Card>

          <Card>
            <CardHead title="Funding structure" hint="How the enterprise value is financed." />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Debt funding" value={debtPct == null ? "—" : `${debtPct.toFixed(0)}%`} sub={fmtM(v.acquisitionDebt)} />
              <Stat label="Equity funding" value={debtPct == null || i.equityInvested == null ? "—" : `${(100 - debtPct).toFixed(0)}%`} sub={fmtM(i.equityInvested)} />
              <Stat label="Debt / equity" value={v.acquisitionDebt != null && i.equityInvested ? fmtX(v.acquisitionDebt / i.equityInvested) : "—"} />
              <Stat label="Equity value (EV − net debt)" value={fmtM(v.equityValue)} sub="approximate" />
            </div>
          </Card>
          <Card>
            <CardHead title="Illustrative returns" hint="Assumption-driven, not a forecast. Ignores financing costs and tax." right={<Pill tone="warn">Assumptions</Pill>} />
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <NumInput label="Holding period" value={i.holdYears} unit="years" onCommit={(n) => updateInputs({ holdYears: n })} hint="Default 5." />
              <NumInput label="EBITDA growth" value={i.ebitdaGrowth} unit="% a year" onCommit={(n) => updateInputs({ ebitdaGrowth: n })} hint="Default: historical, capped 0–10%." />
              <NumInput label="Exit multiple" value={i.exitMultiple} unit="x" onCommit={(n) => updateInputs({ exitMultiple: n })} hint="Default: entry multiple." />
            </div>
            {r == null ? <p className="text-[13px] text-ink2">Needs a proposed enterprise value, equity invested and positive adjusted EBITDA.</p> : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat label="Exit EBITDA" value={fmtM(r.exitEbitda)} sub={`${r.growth.toFixed(1)}% a year · ${r.growthSource}`} />
                <Stat label="Exit EV" value={fmtM(r.exitEv)} sub={`${fmtX(r.exitMultiple, 1)} · ${r.exitMultipleSource}`} />
                <Stat label="Exit equity" value={fmtM(r.exitEquity)} sub={r.paydown == null ? "debt paydown not modelled (no capex)" : `after ${fmtM(r.paydown)} debt repaid`} />
                <Stat label="MOIC / IRR" value={`${r.moic.toFixed(2)}x / ${r.irr.toFixed(0)}%`} tone={r.moic < 1 ? "crit" : undefined} sub={`${r.holdYears}-year hold`} />
              </div>
            )}
          </Card>
          {cases.length > 0 && (
            <Card hover={false}>
              <CardHead title="Base, downside and upside cases" hint="Downside and upside shift the base case by the amounts you set. Illustrative assumptions, not verified transaction information and not forecasts." right={<Pill tone="warn">Assumptions</Pill>} />
              <div className="mb-4 grid gap-3 sm:grid-cols-4">
                <NumInput label="Downside: growth shift" value={dg.down} unit="pp" onCommit={(n) => setDg({ ...dg, down: n ?? 0 })} />
                <NumInput label="Downside: exit multiple shift" value={dx.down} unit="x" onCommit={(n) => setDx({ ...dx, down: n ?? 0 })} />
                <NumInput label="Upside: growth shift" value={dg.up} unit="pp" onCommit={(n) => setDg({ ...dg, up: n ?? 0 })} />
                <NumInput label="Upside: exit multiple shift" value={dx.up} unit="x" onCommit={(n) => setDx({ ...dx, up: n ?? 0 })} />
              </div>
              <div className="-mx-5 overflow-x-auto px-5">
                <table className="w-full min-w-[640px] border-collapse text-[12.5px]">
                  <thead><tr className="border-b border-line font-mono text-[10px] uppercase tracking-wider text-ink3"><th className="py-2.5 text-left font-medium">Case</th>{["EBITDA growth", "Exit multiple", "Exit EBITDA", "Exit EV", "Exit equity", "MOIC", "IRR"].map((h) => <th key={h} className="px-2 py-2.5 text-right font-medium">{h}</th>)}</tr></thead>
                  <tbody>
                    {cases.map((c) => (
                      <tr key={c.name} className="border-b border-line/60">
                        <td className="py-2.5 text-ink">{c.name}</td>
                        {c.r == null ? <td colSpan={7} className="px-2 py-2.5 text-right text-ink3">not calculable</td> : [`${c.r.growth.toFixed(1)}%`, fmtX(c.r.exitMultiple, 1), fmtM(c.r.exitEbitda), fmtM(c.r.exitEv), fmtM(c.r.exitEquity), `${c.r.moic.toFixed(2)}x`, `${c.r.irr.toFixed(0)}%`].map((t, k) => <td key={k} className={"px-2 py-2.5 text-right font-mono tabular-nums " + (k >= 5 && c.r!.moic < 1 ? "text-crit" : "text-ink")}>{t}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>

        <Card className="xl:col-span-12" hover={false}>
          <CardHead title="Two separate assessments" hint="Risk and attractiveness answer different questions and are never merged into one verdict." />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-line bg-bg2 p-5">
              <div className="mb-2 flex items-center gap-2 font-display text-[14px] font-medium"><Gauge size={16} className="text-accent" /> Investment risk</div>
              <div className="font-display text-[30px] font-semibold">{a.risk.score == null ? "Insufficient data" : `${a.risk.score}/100`}</div>
              <p className="mt-1 text-[12.5px] text-ink2">{a.risk.classification} · confidence {a.risk.confidence.level} · {a.risk.coverage}% of the model assessed. How much financial risk the data shows. <Link href="/investment-assessment" className="text-accent hover:underline">Detail →</Link></p>
            </div>
            <div className="rounded-2xl border border-line bg-bg2 p-5">
              <div className="mb-2 flex items-center gap-2 font-display text-[14px] font-medium"><Scale size={16} className="text-ai" /> Investment attractiveness</div>
              <div className="font-display text-[30px] font-semibold text-ink2">Not scored</div>
              <p className="mt-1 text-[12.5px] text-ink2">Depends on price, structure, growth and exit: not on the risk score alone. The facts above ({fmtX(v.entryMultiple, 1)} entry multiple, {fmtX(v.postLeverage)} post-deal leverage{r ? `, ${r.moic.toFixed(2)}x illustrative MOIC` : ""}) are for the investment team to weigh. No buy or reject view is given.</p>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
