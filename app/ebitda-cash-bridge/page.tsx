"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import { AlertTriangle, Info } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Bar as RBar, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Waterfall } from "@/components/charts/Waterfall";
import { NumInput, Stat } from "@/components/risk/parts";
import { axisM } from "@/components/risk/charts";
import { WithAnalysis } from "@/components/shared/Guard";
import { Card, CardHead, PageTitle, chartTooltip } from "@/components/shared/ui";
import { buildBridge, bridgeSteps, type BridgeYear } from "@/lib/calculations/cashbridge";
import { useApp } from "@/lib/state/store";
import { DASH, fmtM, fmtPct, cur } from "@/lib/utilities/format";
import type { AnalysisResult } from "@/types/finance";

export default function BridgePage() {
  return <WithAnalysis>{(a) => <Page a={a} />}</WithAnalysis>;
}

const fy = (y: number) => `FY${String(y).slice(2)}`;

function Page({ a }: { a: AnalysisResult }) {
  const { updateInputs } = useApp();
  const years = useMemo(() => buildBridge(a), [a]);
  const [yr, setYr] = useState(a.latestRecord.year);
  const b = years.find((x) => x.year === yr) ?? years[years.length - 1];
  const verified = a.inputs.adjustmentStatus === "verified" && (a.inputs.ebitdaAdjustment != null || a.records.some((r) => r.ebitdaAdjustment != null));

  if (!b) return <PageTitle title="EBITDA-to-Cash Bridge" sub="Needs at least two years of balance-sheet data to measure the working-capital movement." />;
  const gapDrivers = b.drivers;
  const gapAbs = b.gap != null ? Math.abs(b.gap) : null;

  const chart = years.map((y) => ({ year: fy(y.year), adjusted: y.adjusted, ocf: y.ocf, fcf: y.fcf, conv: y.conversion == null ? null : y.conversion * 100 }));

  return (
    <>
      <PageTitle title="EBITDA-to-Cash Bridge" sub="How much of accounting earnings actually becomes cash, and where the difference goes." />

      <div role="tablist" aria-label="Year" className="mb-5 flex flex-wrap gap-1.5">
        {years.map((y) => (
          <button key={y.year} role="tab" aria-selected={yr === y.year} onClick={() => setYr(y.year)} className={clsx("tap rounded-xl border px-4 py-2 font-mono text-[12px]", yr === y.year ? "border-accent/50 bg-accent/10 text-ink" : "border-line bg-card text-ink2 hover:text-ink")}>FY{y.year}</button>
        ))}
      </div>

      {b.missing.length > 0 && (
        <div role="alert" className="mb-5 flex gap-3 rounded-2xl border border-warn/30 bg-warn/5 p-4 text-[12.5px] leading-relaxed text-ink2">
          <AlertTriangle size={17} className="mt-0.5 shrink-0 text-warn" />
          <p><b className="text-ink">FY{b.year}: some components were not supplied.</b> Missing: {b.missing.join(", ")}. They are shown as gaps (n/s), not zero; their effect sits inside “Other”, so Other overstates what is truly unexplained.{b.missing.includes("cash taxes") && " You can enter cash taxes for the latest year below; it is labelled as an investor input."}</p>
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Reported EBITDA" value={fmtM(b.reported)} />
        <Stat label="Adjusted EBITDA" value={fmtM(b.adjusted)} sub={verified ? "includes verified adjustments" : "= reported (none verified)"} />
        <Stat label="Operating cash flow" value={fmtM(b.ocf)} sub="as reported" />
        <Stat label="Free cash flow" value={fmtM(b.fcf)} sub="OCF − capex" tone={b.fcf != null && b.fcf < 0 ? "crit" : undefined} />
        <Stat label="Cash conversion" value={fmtPct(b.conversion, 0)} sub="OCF ÷ adjusted EBITDA" tone={b.conversion != null ? (b.conversion < 0.5 ? "crit" : b.conversion < 0.8 ? "warn" : "pos") : undefined} />
        <Stat label="Cash gap" value={fmtM(b.gap)} sub="adjusted EBITDA − OCF" tone={b.gap != null && b.gap > 0 && b.adjusted ? (b.gap / b.adjusted > 0.5 ? "crit" : "warn") : undefined} />
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHead title={`FY${b.year} bridge: Reported EBITDA to free cash flow`} hint="Green adds, red reduces. A dashed grey bar means the item was not supplied. “Other” is the residual that reconciles to reported operating cash flow." />
          <Waterfall steps={bridgeSteps(b)} height={320} negLabel="cash absorbed" />
          <div className="mt-3 grid gap-2 font-mono text-[11px] text-ink3 sm:grid-cols-2">
            <span>Free cash flow = Adjusted EBITDA − increase in working capital − cash taxes − cash interest − capex ± other cash adjustments.</span>
            <span>Operating cash flow ({fmtM(b.ocf)}) is reported separately: Free cash flow = OCF − capex = {fmtM(b.fcf)}.</span>
          </div>
        </Card>

        <Card className="xl:col-span-5">
          <CardHead title="What explains the cash gap" hint="The gap between Adjusted EBITDA and operating cash flow, split by cause. Only the working-capital line is working capital." />
          {b.gap == null ? <p className="text-[13px] text-ink2">Needs EBITDA and operating cash flow.</p> : (
            <>
              <div className="mb-4 font-display text-[28px] font-semibold tracking-tight">{fmtM(b.gap)} <span className="text-[13px] font-normal text-ink3">did not arrive as operating cash</span></div>
              <div className="space-y-3.5">
                {gapDrivers.map((d) => {
                  const share = d.value != null && gapAbs ? (d.value / gapAbs) * 100 : null;
                  return (
                    <div key={d.id}>
                      <div className="flex items-baseline justify-between gap-3 text-[12.5px]"><span className="text-ink">{d.label}</span><span className="font-mono tabular-nums text-ink2">{d.value == null ? "not supplied" : fmtM(d.value)}{share != null && <span className="text-ink3"> · {share.toFixed(0)}%</span>}</span></div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-elev"><motion.div className={clsx("h-full rounded-full", d.id === "other" ? "bg-ai" : d.id === "wc" ? "bg-warn" : "bg-accent")} initial={{ width: 0 }} animate={{ width: `${share == null ? 0 : Math.max(0, Math.min(100, share))}%` }} /></div>
                      <p className="mt-1 text-[11.5px] leading-snug text-ink3">{d.note}</p>
                    </div>
                  );
                })}
              </div>
              <p className="mt-4 rounded-xl border border-line bg-bg2 p-3 text-[12px] leading-relaxed text-ink3">Assumes reported operating cash flow is struck after interest and tax paid. The working-capital movement uses year-end balances (receivables + inventory − payables), so it can differ from the cash-flow statement's own lines. Only the working-capital line is working capital.</p>
            </>
          )}
        </Card>

        <Card className="xl:col-span-12">
          <CardHead title="Inputs for the bridge" hint="Adjustments and taxes the file did not carry. These are investor inputs, labelled as such, never guessed." />
          <div className="grid gap-4 md:grid-cols-3">
            <NumInput label={`Cash taxes paid, FY${a.latestRecord.year}`} value={a.latestRecord.cashTaxes ?? a.inputs.cashTaxes} unit={`${cur()} m`} onCommit={(n) => updateInputs({ cashTaxes: n })} hint={a.latestRecord.cashTaxes != null ? "Read from the file: clear a value in Company Analysis to override." : "Investor input. Leave blank if unknown."} />
            <div className="rounded-xl bg-bg2 p-3.5 text-[12.5px] leading-relaxed text-ink2 md:col-span-2">
              <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-ink3">EBITDA adjustments</div>
              {verified ? <>Verified adjustments are included: reported {fmtM(b.reported)} → adjusted {fmtM(b.adjusted)}.</> : <>No verified adjustments, so adjusted EBITDA equals reported EBITDA. Enter an adjustment and how well it is documented under <Link href="/investment-assessment" className="text-accent hover:underline">Investment Risk → Quality of earnings</Link>; only <i>verified</i> adjustments move the bridge.</>}
            </div>
          </div>
        </Card>

        <Card className="xl:col-span-7">
          <CardHead title="Multi-year comparison" hint="Adjusted EBITDA, operating cash flow and free cash flow for each year, with cash conversion." />
          <div className="h-[290px]">
            <ResponsiveContainer>
              <ComposedChart data={chart} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
                <CartesianGrid stroke="#23262d" vertical={false} />
                <XAxis dataKey="year" stroke="#707681" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis yAxisId="l" stroke="#707681" fontSize={11} tickLine={false} axisLine={false} width={48} tickFormatter={axisM} />
                <YAxis yAxisId="r" orientation="right" stroke="#707681" fontSize={11} tickLine={false} axisLine={false} width={40} unit="%" />
                <Tooltip {...chartTooltip} formatter={(v: number, n: string) => (n === "conv" ? [`${v.toFixed(0)}%`, "Cash conversion"] : [fmtM(v), n === "adjusted" ? "Adjusted EBITDA" : n === "ocf" ? "Operating cash flow" : "Free cash flow"])} />
                <Legend wrapperStyle={{ fontSize: 11, color: "#A2A7B0" }} formatter={(v) => (v === "adjusted" ? "Adjusted EBITDA" : v === "ocf" ? "Operating cash flow" : v === "fcf" ? "Free cash flow" : "Cash conversion (right)")} />
                <ReferenceLine yAxisId="l" y={0} stroke="#3a3f49" />
                <RBar yAxisId="l" dataKey="adjusted" fill="#35C994" radius={[3, 3, 0, 0]} maxBarSize={22} animationDuration={600} />
                <RBar yAxisId="l" dataKey="ocf" fill="#F5A640" radius={[3, 3, 0, 0]} maxBarSize={22} animationDuration={600} />
                <RBar yAxisId="l" dataKey="fcf" fill="#3988F5" radius={[3, 3, 0, 0]} maxBarSize={22} animationDuration={600} />
                <Line yAxisId="r" dataKey="conv" stroke="#A78BFA" strokeWidth={2.2} dot={{ r: 3.5, fill: "#17191E", strokeWidth: 2 }} animationDuration={700} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="xl:col-span-5" hover={false}>
          <CardHead title="Bridge by year" hint={`${cur()} millions. n/s = not supplied.`} />
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[320px] border-collapse text-[12px]">
              <thead><tr className="border-b border-line font-mono text-[10px] uppercase tracking-wider text-ink3"><th className="py-2 text-left font-medium">Item</th>{years.map((y) => <th key={y.year} className="px-2 py-2 text-right font-medium">FY{y.year}</th>)}</tr></thead>
              <tbody>
                {([
                  ["Reported EBITDA", (y: BridgeYear) => y.reported, false],
                  ["+ Verified adjustments", (y: BridgeYear) => y.adjustment, false],
                  ["= Adjusted EBITDA", (y: BridgeYear) => y.adjusted, true],
                  ["− Working capital", (y: BridgeYear) => y.wcIncrease, false],
                  ["− Cash taxes", (y: BridgeYear) => y.taxes, false],
                  ["− Capex", (y: BridgeYear) => y.capex, false],
                  ["− Cash interest", (y: BridgeYear) => y.interest, false],
                  ["± Other", (y: BridgeYear) => y.other, false],
                  ["= Free cash flow", (y: BridgeYear) => y.fcf, true],
                  ["Operating cash flow", (y: BridgeYear) => y.ocf, true],
                  ["Cash gap", (y: BridgeYear) => y.gap, false],
                ] as [string, (y: BridgeYear) => number | null, boolean][]).map(([l, f, bold]) => (
                  <tr key={l} className="border-b border-line/60">
                    <td className={clsx("py-2 pr-2", bold ? "font-medium text-ink" : "text-ink2")}>{l}</td>
                    {years.map((y) => <td key={y.year} className={clsx("px-2 py-2 text-right font-mono tabular-nums", bold ? "text-ink" : "text-ink2")}>{f(y) == null ? "n/s" : f(y)!.toLocaleString("en-US", { maximumFractionDigits: 1 })}</td>)}
                  </tr>
                ))}
                <tr><td className="py-2 pr-2 font-medium text-ink">Cash conversion</td>{years.map((y) => <td key={y.year} className="px-2 py-2 text-right font-mono tabular-nums">{y.conversion == null ? DASH : fmtPct(y.conversion, 0)}</td>)}</tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>

    </>
  );
}
