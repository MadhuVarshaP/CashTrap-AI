"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Crosshair, FileText, Info, Sparkles } from "lucide-react";
import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { CashBridge, WorkingCapitalChart } from "@/components/charts/Charts";
import { RiskGauge } from "@/components/charts/RiskGauge";
import { CashFlowChart, DebtChart, EbitdaMarginChart, OwcChart, StressChart } from "@/components/risk/charts";
import { IndicatorCard, LEVEL_HEX, LevelBadge, NumInput, Stat } from "@/components/risk/parts";
import { WithAnalysis } from "@/components/shared/Guard";
import { Bar, Button, Card, CardHead, PageTitle, Pill } from "@/components/shared/ui";
import { buildFindings } from "@/lib/calculations/findings";
import { adjustedEbitda, allIndicators, levelName } from "@/lib/calculations/pe-risk";
import { DEFAULT_STRESS, runStress, type StressInput } from "@/lib/calculations/stress";
import { buildValuation } from "@/lib/calculations/valuation";
import { THRESHOLD_DEFS, resolveThresholds } from "@/lib/calculations/thresholds";
import { IndustryProfile } from "@/components/risk/IndustryProfile";
import { INDICATOR_METRIC, METRIC, getBench, benchRange, fmtBench, type BenchMetric } from "@/lib/benchmarks/resolve";
import { industryById } from "@/lib/benchmarks/industries";
import { useApp } from "@/lib/state/store";
import { fmtDays, fmtM, fmtPct, fmtX, signed, cur } from "@/lib/utilities/format";
import type { AnalysisResult, AssessmentInputs, RiskCategory } from "@/types/finance";

const TABS = [
  { id: "dash", label: "Risk dashboard" },
  { id: "qoe", label: "Quality of earnings" },
  { id: "cash", label: "Cash flow" },
  { id: "wc", label: "Working capital" },
  { id: "debt", label: "Debt & repayment" },
  { id: "liq", label: "Liquidity & stress" },
  { id: "val", label: "Valuation" },
  { id: "thr", label: "Thresholds" },
  { id: "reg", label: "Indicator register" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const PILLAR_INFO: Record<string, { purpose: string; formulas: string[] }> = {
  qoe: { purpose: "Are the reported earnings reliable and sustainable?", formulas: ["EBITDA margin = EBITDA ÷ Revenue", "Adjusted EBITDA = Reported EBITDA + verified adjustments", "EBITDA growth = (Current − Previous) ÷ |Previous|"] },
  cash: { purpose: "How well does the company turn accounting earnings into cash?", formulas: ["OCF conversion = Operating cash flow ÷ Adjusted EBITDA", "Free cash flow = Operating cash flow − Capex", "FCF conversion = Free cash flow ÷ Adjusted EBITDA"] },
  wc: { purpose: "Is cash being trapped in receivables, stock and payables?", formulas: ["DSO = Avg receivables ÷ Credit sales × 365", "DIO = Avg inventory ÷ COGS × 365", "DPO = Avg payables ÷ Purchases × 365", "CCC = DSO + DIO − DPO", "OWC = Trade receivables + Inventory − Trade payables"] },
  debt: { purpose: "Can the company comfortably meet its financial obligations?", formulas: ["Net debt = Total debt − Cash", "Net debt / EBITDA = Net debt ÷ Adjusted EBITDA", "Interest cover = EBITDA ÷ Cash interest", "DSCR = (OCF + interest) ÷ (Interest + Scheduled principal)"] },
  liq: { purpose: "Can the company withstand a financial downturn?", formulas: ["Current ratio = Current assets ÷ Current liabilities", "Quick ratio = (Current assets − Inventory) ÷ Current liabilities", "Stressed EBITDA = Stressed revenue × (Margin − margin drop)"] },
};

export default function Assessment() {
  return <WithAnalysis>{(a) => <Page a={a} />}</WithAnalysis>;
}

function Page({ a }: { a: AnalysisResult }) {
  const [tab, setTab] = useState<Tab>("dash");
  const { risk } = a;
  return (
    <>
      <PageTitle title="Investment Risk Analysis" sub="Five pillars of financial risk, scored from the data, evidenced and ready to investigate." right={
        <div className="flex flex-wrap gap-2"><Pill tone="warn">Screening score · not a recommendation</Pill><Link href="/due-diligence-report"><Button variant="ghost"><FileText size={14} /> Due diligence report</Button></Link></div>
      } />
      <IndustryProfile />
      <div role="tablist" aria-label="Investment risk sections" className="-mx-4 mb-6 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={clsx("tap shrink-0 rounded-xl border px-4 py-2.5 text-[13px]", tab === t.id ? "border-accent/50 bg-accent/10 text-ink" : "border-line bg-card text-ink2 hover:border-line2 hover:text-ink")}>{t.label}</button>
        ))}
      </div>
      <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        {tab === "dash" && <Dashboard a={a} go={setTab} />}
        {tab === "qoe" && <QoE a={a} pillar={risk.categories[0]} />}
        {tab === "cash" && <Cash a={a} pillar={risk.categories[1]} />}
        {tab === "wc" && <WC a={a} pillar={risk.categories[2]} />}
        {tab === "debt" && <Debt a={a} pillar={risk.categories[3]} />}
        {tab === "liq" && <Liquidity a={a} pillar={risk.categories[4]} />}
        {tab === "val" && <Valuation a={a} />}
        {tab === "thr" && <Thresholds a={a} />}
        {tab === "reg" && <Register a={a} />}
      </motion.div>
      <p className="mt-8 rounded-2xl border border-line p-4 text-[11.5px] leading-relaxed text-ink3">This is a screening score, not a probability of investment failure or an investment recommendation. Thresholds are proposed screening bands, not industry standards. Industry benchmarks (Damodaran, US listed companies) are applied only where a verified figure exists for the selected industry; otherwise “Industry Benchmark Unavailable” is shown. A flagged indicator is a potential risk to investigate, not proof of fraud, poor management or bad debt.</p>
    </>
  );
}

/* ------------------------------------------------------------------ shared bits */

function PillarHeader({ p }: { p: RiskCategory }) {
  const info = PILLAR_INFO[p.id];
  const assessed = p.indicators.filter((i) => i.points != null).length;
  return (
    <Card className="mb-5" hover={false}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5"><h2 className="font-display text-[19px] font-semibold">{p.name}</h2><Pill>{p.weight} pts weight</Pill>{p.points != null && <LevelBadge level={p.severity} />}</div>
          <p className="mt-1.5 text-[13px] text-ink2">{info.purpose}</p>
          <p className="mt-1 font-mono text-[11px] text-ink3">{assessed} of {p.indicators.length} indicators assessed · {p.max} of {p.weight} points assessable</p>
        </div>
        <div className="shrink-0 text-right"><div className="font-display text-[34px] font-semibold leading-none tabular-nums">{p.points == null ? "—" : p.points}<span className="text-[15px] text-ink3">/{p.max || p.weight}</span></div><div className="mt-1 font-mono text-[10.5px] text-ink3">POINTS OF ASSESSED MAXIMUM</div></div>
      </div>
      <div className="mt-4 rounded-xl bg-bg2 p-3.5"><div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-ink3">Calculations used</div><ul className="grid gap-x-6 gap-y-1 font-mono text-[11.5px] text-ink2 md:grid-cols-2">{info.formulas.map((f) => <li key={f}>{f}</li>)}</ul></div>
    </Card>
  );
}
const Indicators = ({ p }: { p: RiskCategory }) => <div className="space-y-3">{p.indicators.map((i) => <IndicatorCard key={i.id} i={i} />)}</div>;

/* ------------------------------------------------------------------ dashboard */

function Dashboard({ a, go }: { a: AnalysisResult; go: (t: Tab) => void }) {
  const { risk } = a;
  const delta = risk.score != null && a.previousScore != null ? risk.score - a.previousScore : null;
  const inds = allIndicators(risk);
  const flags = inds.filter((i) => i.level === "High" || i.level === "Critical").sort((x, y) => (y.points ?? 0) - (x.points ?? 0));
  const unassessed = inds.filter((i) => i.points == null && i.applicable);
  const notApplicable = inds.filter((i) => !i.applicable);
  const findings = useMemo(() => buildFindings(a), [a]);
  return (
    <div className="grid gap-5 xl:grid-cols-12">
      <Card className="xl:col-span-4">
        <CardHead title="Overall investment risk" hint="Points earned ÷ points assessable × 100. Higher = more identified financial risk. Computed only from indicators the data could support." />
        <RiskGauge risk={risk} size={240} />
        <div className="mt-5 grid grid-cols-3 gap-2.5">
          <Stat label="Points" value={risk.insufficient ? "—" : `${risk.rawPoints}/${risk.maxEvaluated}`} />
          <Stat label="Data coverage" value={`${risk.coverage}%`} tone={risk.coverage < 70 ? "warn" : undefined} />
          <Stat label="vs prior yr" value={delta == null ? "n/a" : signed(delta, 0, " pts")} tone={delta == null ? undefined : delta > 0 ? "crit" : "pos"} />
        </div>
        <div className="mt-4 rounded-xl border border-line bg-bg2 p-3.5 text-[12px] leading-relaxed text-ink2"><span className="font-mono text-[10px] uppercase tracking-wider text-ink3">Confidence · </span><span className={clsx("font-medium", risk.confidence.level === "High" ? "text-pos" : risk.confidence.level === "Low" ? "text-crit" : "text-warn")}>{risk.confidence.level}</span> <span className="text-ink3">(separate from the score)</span><br />{risk.confidence.reasons.join(" · ")}.</div>
        {risk.insufficient && <p role="alert" className="mt-4 rounded-xl border border-warn/30 bg-warn/5 p-3 text-[12.5px] text-warn">Less than {40}% of the model could be assessed, so no overall score is shown. Add the missing data listed under Coverage.</p>}
        <p className="mt-4 font-mono text-[10.5px] text-ink3">LAST ASSESSED {new Date(a.generatedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }).toUpperCase()}</p>
      </Card>

      <Card className="xl:col-span-8">
        <CardHead title="Risk pillars" hint="Each pillar has a fixed weight. Bars show points earned of the points that could be assessed. Select a pillar for its indicators." />
        <div className="space-y-4">
          {risk.categories.map((p) => {
            const n = p.indicators.filter((i) => i.points != null).length;
            return (
              <button key={p.id} onClick={() => go(p.id as Tab)} className="block w-full rounded-xl p-1 text-left transition-colors hover:bg-bg2">
                <div className="mb-1.5 flex items-center justify-between gap-3 text-[13px]">
                  <span className="flex min-w-0 items-center gap-2"><span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: p.points == null ? "var(--c-muted)" : LEVEL_HEX[p.severity] }} /><span className="truncate">{p.name}</span><span className="hidden font-mono text-[10.5px] text-ink3 sm:inline">{p.weight} pts weight</span></span>
                  <span className="shrink-0 font-mono text-[12px] tabular-nums">{p.points == null ? <span className="text-ink3">NOT ASSESSED</span> : <>{p.points}<span className="text-ink3">/{p.max}</span></>}</span>
                </div>
                <Bar value={p.points ?? 0} max={p.max || 1} color={p.points == null ? "var(--c-muted)" : LEVEL_HEX[p.severity]} className="h-2.5" />
                <div className="mt-1 font-mono text-[10.5px] text-ink3">{n} of {p.indicators.length} indicators assessed</div>
              </button>
            );
          })}
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 font-mono text-[11px] text-ink3"><span>WEIGHTS 25 · 25 · 20 · 20 · 10 = 100</span><span>0–24 LOW · 25–49 MODERATE · 50–74 HIGH · 75+ CRITICAL</span></div>
      </Card>

      <Card className="xl:col-span-12">
        <CardHead title="Risk heatmap" hint="Every indicator, coloured by risk level. Hatched = Not Assessed (data missing) or Not Applicable to this industry." right={<div className="hidden items-center gap-3 font-mono text-[10px] text-ink3 sm:flex">{(["Low", "Medium", "High", "Critical"] as const).map((l) => <span key={l} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: LEVEL_HEX[l] }} />{levelName(l)}</span>)}</div>} />
        <div className="space-y-3">
          {risk.categories.map((p) => (
            <div key={p.id}>
              <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-ink3">{p.name}</div>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {p.indicators.map((i) => (
                  <button key={i.id} onClick={() => go(p.id as Tab)} title={`${i.name}: ${levelName(i.level)}${i.points != null ? ` (${i.points}/${i.max})` : ""}`} className="min-h-[52px] rounded-lg border px-2.5 py-2 text-left" style={i.level ? { background: LEVEL_HEX[i.level] + "22", borderColor: LEVEL_HEX[i.level] + "66" } : { background: "repeating-linear-gradient(135deg,var(--c-elev) 0 5px,var(--c-card) 5px 10px)", borderColor: i.applicable ? "var(--c-line)" : "var(--c-line)", opacity: i.applicable ? 1 : 0.6 }}>
                    <span className="line-clamp-2 block text-[11px] leading-tight text-ink2">{i.name}</span>
                    <span className="mt-0.5 block font-mono text-[10px] text-ink3">{!i.applicable ? "N/A" : i.points == null ? "not assessed" : `${i.points}/${i.max}`}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="xl:col-span-12">
        <CardHead title="Assessment coverage" hint="Share of the applicable model the supplied data could support. Missing data is never scored as zero risk; not-applicable indicators are left out." />
        <div className="mb-2 flex items-baseline gap-2"><span className="font-display text-[34px] font-semibold tabular-nums">{risk.coverage}%</span><span className="text-ink3">of the model assessed · {risk.evaluated} of {risk.total} indicators</span></div>
        <Bar value={risk.coverage} max={100} color={risk.coverage >= 70 ? "#35C994" : "#F5A640"} className="h-2" />
        {notApplicable.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-ink3">Not applicable to {risk.industry.name} ({notApplicable.length}): excluded from the score</div>
            <p className="rounded-lg bg-bg2 px-3 py-2 text-[12px] leading-relaxed text-ink2">{notApplicable.map((i) => i.name).join(" · ")}</p>
          </div>
        )}
        {unassessed.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-ink3">Not assessed ({unassessed.length})</div>
            <ul className="space-y-1.5">{unassessed.map((i) => <li key={i.id} className="flex flex-wrap items-baseline justify-between gap-x-3 rounded-lg bg-bg2 px-3 py-2 text-[12px]"><span className="text-ink2">{i.name}</span><span className="font-mono text-[10.5px] text-warn">needs {i.requires.join(" + ").toLowerCase()}</span></li>)}</ul>
          </div>
        )}
        {risk.warnings.length > 0 && <ul className="mt-4 space-y-1.5">{risk.warnings.slice(0, 5).map((w) => <li key={w} className="flex gap-2 text-[12px] text-warn"><Info size={13} className="mt-0.5 shrink-0" />{w}</li>)}</ul>}
      </Card>

      <Card className="xl:col-span-12 !border-ai/25">
        <CardHead icon={<Sparkles size={17} className="text-ai" />} title="Investment findings" hint="The three most material risks, written only from calculated metrics. Hypotheses are labelled as such." right={<Pill tone="ai">Deterministic · no AI model called</Pill>} />
        {findings.length === 0 ? <p className="text-[13px] text-ink2">No indicator scored risk points on the evaluated data.</p> : (
          <div className="grid gap-4 lg:grid-cols-3">
            {findings.map((f, n) => (
              <div key={f.id} className="flex flex-col rounded-2xl border border-line bg-bg2 p-5">
                <div className="mb-3 flex items-center justify-between"><span className="font-display text-[30px] font-semibold leading-none text-ink3">0{n + 1}</span><LevelBadge level={f.level} /></div>
                <div className="text-[14.5px] font-medium">{f.title}</div>
                <dl className="mt-3 space-y-3 text-[12.5px] leading-relaxed">
                  <div><dt className="font-mono text-[10px] uppercase tracking-wider text-accent">Evidence · confirmed</dt><dd className="mt-1 font-mono text-[11.5px] text-ink">{f.evidence}</dd></div>
                  <div><dt className="font-mono text-[10px] uppercase tracking-wider text-ink3">Why it matters to an investor</dt><dd className="mt-1 text-ink2">{f.why}</dd></div>
                  <div><dt className="font-mono text-[10px] uppercase tracking-wider text-ink3">Potential financial impact</dt><dd className="mt-1 text-ink2">{f.impact ?? "Cannot be sized from the supplied data."}</dd></div>
                  <div><dt className="font-mono text-[10px] uppercase tracking-wider text-ink3">Verify with</dt><dd className="mt-1 text-ink2">{f.verify.join(" · ")}</dd></div>
                  <div><dt className="font-mono text-[10px] uppercase tracking-wider text-ink3">Ask management</dt><dd className="mt-1 text-ink2">{f.questions[0]}</dd></div>
                </dl>
              </div>
            ))}
          </div>
        )}
        <p className="mt-4 flex gap-2 text-[11.5px] text-ink3"><Crosshair size={13} className="mt-0.5 shrink-0" />An unusual movement is a reason to investigate, not proof of wrongdoing. This panel never recommends buying or rejecting the target.</p>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ pillar tabs */

const STATUS = [
  { v: "verified", l: "Verified: documents seen and reconciled" },
  { v: "needs-docs", l: "Unusual: needs documentation" },
  { v: "unsupported", l: "Large and unsupported" },
  { v: "unexplained", l: "Material and unexplained" },
] as const;

function QoE({ a, pillar }: { a: AnalysisResult; pillar: RiskCategory }) {
  const { updateInputs } = useApp();
  const c = a.latestRecord, v = buildValuation(a);
  const i = a.inputs;
  return (
    <>
      <PillarHeader p={pillar} />
      <div className="mb-5 grid gap-5 xl:grid-cols-12">
        <Card className="xl:col-span-7"><CardHead title="EBITDA and margin" hint="Bars: EBITDA (adjusted for the latest year if adjustments are verified). Line: EBITDA margin." /><div className="h-[260px]"><EbitdaMarginChart a={a} /></div></Card>
        <Card className="xl:col-span-5">
          <CardHead title="EBITDA adjustments" hint={`For FY${c.year}. Only adjustments marked verified are added to EBITDA. Do not assume a one-off is legitimate: require documents.`} />
          <div className="grid gap-3">
            <NumInput label={`Adjustment claimed (${cur()} m)`} value={i.ebitdaAdjustment} unit={`${cur()} m`} onCommit={(n) => updateInputs({ ebitdaAdjustment: n })} hint="Positive adds back cost; negative removes income." />
            <label className="block"><span className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-wider text-ink3">Support status</span>
              <select value={i.adjustmentStatus ?? ""} onChange={(e) => updateInputs({ adjustmentStatus: (e.target.value || undefined) as AssessmentInputs["adjustmentStatus"] })} className="h-11 w-full rounded-xl border border-line bg-bg2 px-3 text-[13px] outline-none focus:border-accent"><option value="">Not entered</option>{STATUS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}</select>
            </label>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2.5">
            <Stat label="Reported" value={fmtM(v.reportedEbitda)} /><Stat label="Adjusted" value={fmtM(v.adjustedEbitda)} /><Stat label="Difference" value={v.normalisation == null ? "—" : fmtM(v.normalisation)} />
          </div>
        </Card>
      </div>
      <Indicators p={pillar} />
    </>
  );
}

function Cash({ a, pillar }: { a: AnalysisResult; pillar: RiskCategory }) {
  const c = a.latestRecord, e = adjustedEbitda(c, a.inputs, true);
  const fcf = c.operatingCashFlow != null && c.capex != null ? c.operatingCashFlow - c.capex : null;
  const short = fcf != null && fcf < 0;
  return (
    <>
      <PillarHeader p={pillar} />
      <div className="mb-5 grid gap-5 xl:grid-cols-12">
        <Card className="xl:col-span-7"><CardHead title="EBITDA, operating and free cash flow" hint="Free cash flow needs capital expenditure; it is blank where capex was not supplied." /><div className="h-[260px]"><CashFlowChart a={a} /></div></Card>
        <Card className="xl:col-span-5"><CardHead title={`Cash bridge FY${String(c.year).slice(2)}`} hint="How EBITDA became operating cash flow. Red = cash absorbed." /><div className="h-[260px]"><CashBridge a={a} /></div></Card>
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="OCF conversion" value={e != null && e > 0 && c.operatingCashFlow != null ? fmtPct(c.operatingCashFlow / e, 0) : "—"} />
        <Stat label="Free cash flow" value={fmtM(fcf)} tone={short ? "crit" : undefined} />
        <Stat label="FCF conversion" value={e != null && e > 0 && fcf != null ? fmtPct(fcf / e, 0) : "—"} />
        <Stat label="Capex" value={fmtM(c.capex)} />
      </div>
      {short && <p role="alert" className="mb-5 rounded-xl border border-crit/30 bg-crit/5 p-3.5 text-[13px] text-crit">Cash generation is insufficient to support capital expenditure: operating cash flow of {fmtM(c.operatingCashFlow)} is below capex of {fmtM(c.capex)}.</p>}
      <Indicators p={pillar} />
    </>
  );
}

function WC({ a, pillar }: { a: AnalysisResult; pillar: RiskCategory }) {
  const L = a.latest, P = a.previous, c = a.latestRecord;
  const nwc = c.currentAssets != null && c.currentLiabilities != null ? c.currentAssets - c.currentLiabilities : null;
  const owc = c.receivables != null && c.inventory != null && c.payables != null ? c.receivables + c.inventory - c.payables : null;
  const d = (k: "dso" | "dio" | "dpo" | "ccc") => (L[k] != null && P?.[k] != null ? signed((L[k] as number) - (P[k] as number), 1, " d") : undefined);
  return (
    <>
      <PillarHeader p={pillar} />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="DSO" value={fmtDays(L.dso)} sub={d("dso")} /><Stat label="DIO" value={fmtDays(L.dio)} sub={d("dio")} /><Stat label="DPO" value={fmtDays(L.dpo)} sub={d("dpo")} />
        <Stat label="CCC" value={fmtDays(L.ccc)} sub={d("ccc")} /><Stat label="Operating WC" value={fmtM(owc)} /><Stat label="Net working capital" value={fmtM(nwc)} />
      </div>
      <div className="mb-5 grid gap-5 xl:grid-cols-12">
        <Card className="xl:col-span-7"><CardHead title="Cash conversion cycle" hint="DSO + DIO − DPO. CCC is a cross-check on the three days measures, not a separate score, so the same deterioration is not counted twice." /><div className="h-[260px]"><WorkingCapitalChart a={a} show={["dso", "dio", "dpo", "ccc"]} /></div></Card>
        <Card className="xl:col-span-5"><CardHead title="Operating working capital" hint="Receivables + inventory − payables, and its share of revenue. A rising share means growth is consuming cash." /><div className="h-[260px]"><OwcChart a={a} /></div></Card>
      </div>
      <p className="mb-5 flex gap-2 rounded-xl border border-line bg-card p-3.5 text-[12.5px] text-ink2"><Info size={14} className="mt-0.5 shrink-0 text-accent" />Receivables, inventory and payables indicators are scored on changes in days. The overall indicator is scored on cash consumed relative to revenue. Overdue receivables and slow-moving stock can only be flagged when ageing data is supplied.</p>
      <Indicators p={pillar} />
    </>
  );
}

function LeverageMeter({ v }: { v: number | null }) {
  const pos = v == null ? null : Math.max(0, Math.min(5, v)) / 5 * 100;
  return (
    <div>
      <div className="relative h-3 overflow-hidden rounded-full" style={{ background: "linear-gradient(90deg,#35C994 0 40%,#F5A640 40% 60%,#F58B5C 60% 80%,#F06464 80% 100%)" }}>
        {pos != null && <span className="absolute top-1/2 h-5 w-1 -translate-y-1/2 rounded bg-white shadow" style={{ left: `calc(${pos}% - 2px)` }} />}
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[10px] text-ink3"><span>0x</span><span>2x</span><span>3x</span><span>4x</span><span>5x+</span></div>
    </div>
  );
}

function Debt({ a, pillar }: { a: AnalysisResult; pillar: RiskCategory }) {
  const c = a.latestRecord, L = a.latest;
  const e = adjustedEbitda(c, a.inputs, true);
  const cover = c.interestExpense && e != null ? e / c.interestExpense : null;
  const dscr = pillar.indicators.find((i) => i.id === "dscr");
  return (
    <>
      <PillarHeader p={pillar} />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Total debt" value={fmtM(c.debt)} /><Stat label="Cash" value={fmtM(c.cash)} /><Stat label="Net debt" value={fmtM(L.netDebt)} />
        <Stat label="Net debt / EBITDA" value={fmtX(e != null && e > 0 ? L.netDebt != null ? L.netDebt / e : null : null)} /><Stat label="Interest cover" value={fmtX(cover, 1)} /><Stat label="Due in 12 months" value={fmtM(c.shortTermDebt)} />
      </div>
      <div className="mb-5 grid gap-5 xl:grid-cols-12">
        <Card className="xl:col-span-7"><CardHead title="Debt, cash and leverage" hint="Dashed lines mark 3x and 4x net debt / EBITDA, the screening thresholds." /><div className="h-[260px]"><DebtChart a={a} /></div></Card>
        <Card className="xl:col-span-5">
          <CardHead title="Debt exposure" hint="Where net debt / EBITDA sits against the indicative screening bands." />
          <LeverageMeter v={e != null && e > 0 && L.netDebt != null ? L.netDebt / e : null} />
          <div className="mt-5 space-y-2 text-[12.5px] text-ink2">
            <div className="flex justify-between"><span>Debt due within 12 months</span><span className="font-mono">{c.shortTermDebt != null && c.debt ? fmtPct(c.shortTermDebt / c.debt, 0) : "not supplied"}</span></div>
            <div className="flex justify-between"><span>Scheduled principal (next 12 months)</span><span className="font-mono">{fmtM(c.principalRepayment)}</span></div>
            <div className="flex justify-between"><span>Debt service coverage</span><span className="font-mono">{dscr?.points == null ? "not assessed" : dscr.actual.split(" ")[0]}</span></div>
          </div>
          <p className="mt-4 text-[11.5px] text-ink3">If repayment schedules or maturities are unavailable the matching indicators are marked not assessed.</p>
        </Card>
      </div>
      <Indicators p={pillar} />
    </>
  );
}

function Liquidity({ a, pillar }: { a: AnalysisResult; pillar: RiskCategory }) {
  const c = a.latestRecord;
  const [s, setS] = useState<StressInput>(DEFAULT_STRESS);
  const e = adjustedEbitda(c, a.inputs, true);
  const r = useMemo(() => runStress(c, e, s), [c, e, s]);
  const cr = pillar.indicators.find((i) => i.id === "liqr");
  const set = (k: keyof StressInput) => (n: number | null) => setS((x) => ({ ...x, [k]: n ?? 0 }));
  const changed = JSON.stringify(s) !== JSON.stringify(DEFAULT_STRESS);
  const rows = [{ name: "EBITDA", base: r.baseEbitda, stressed: r.stressedEbitda }, { name: "Operating cash flow", base: r.baseOcf, stressed: r.stressedOcf }];
  return (
    <>
      <PillarHeader p={pillar} />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Current ratio" value={fmtX(c.reportedCurrentRatio ?? (c.currentAssets != null && c.currentLiabilities ? c.currentAssets / c.currentLiabilities : null))} /><Stat label="Quick ratio" value={fmtX(c.reportedQuickRatio ?? (c.currentAssets != null && c.inventory != null && c.currentLiabilities ? (c.currentAssets - c.inventory) / c.currentLiabilities : null))} /><Stat label="Cash" value={fmtM(c.cash)} /><Stat label="Liquidity rating" value={cr?.level ? levelName(cr.level) : "Not assessed"} />
      </div>
      <div className="mb-5 grid gap-5 xl:grid-cols-12">
        <Card className="xl:col-span-5">
          <CardHead title="Stress assumptions" hint="Change any assumption. These are illustrative scenarios, not forecasts. The score is always judged on the defaults." right={changed ? <button onClick={() => setS(DEFAULT_STRESS)} className="text-[12px] text-accent hover:underline">Reset</button> : undefined} />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <NumInput label="Revenue falls" value={s.revenueDrop} unit="%" onCommit={set("revenueDrop")} />
            <NumInput label="EBITDA margin falls" value={s.marginDrop} unit="pp" onCommit={set("marginDrop")} />
            <NumInput label="Collections delayed" value={s.collectionDelay} unit="days" onCommit={set("collectionDelay")} />
            <NumInput label="Interest rate rises" value={s.interestRise} unit="pp" onCommit={set("interestRise")} />
          </div>
        </Card>
        <Card className="xl:col-span-7"><CardHead title="Base case vs stressed" hint="Illustrative outcome of the four assumptions applied together." /><div className="h-[250px]"><StressChart rows={rows} /></div></Card>
      </div>
      <Card className="mb-5" hover={false}>
        <CardHead title="Stress results" hint="Illustrative scenario outputs, clearly separate from any forecast." />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Stat label="Base-case EBITDA" value={fmtM(r.baseEbitda)} /><Stat label="Stressed EBITDA" value={fmtM(r.stressedEbitda)} tone={r.stressedEbitda != null && r.baseEbitda != null && r.stressedEbitda < r.baseEbitda ? "warn" : undefined} sub={r.stressedEbitda != null && r.baseEbitda ? `${(((r.stressedEbitda - r.baseEbitda) / Math.abs(r.baseEbitda)) * 100).toFixed(1)}%` : undefined} />
          <Stat label="Base-case operating cash flow" value={fmtM(r.baseOcf)} /><Stat label="Stressed operating cash flow" value={fmtM(r.stressedOcf)} tone={r.stressedOcf != null && r.stressedOcf < 0 ? "crit" : undefined} />
          <Stat label="Interest cover: base → stressed" value={`${fmtX(r.baseCover, 1)} → ${fmtX(r.stressedCover, 1)}`} />
          <Stat label="Potential cash shortfall" value={r.shortfall == null ? "—" : fmtM(r.shortfall)} tone={r.shortfall != null && r.shortfall > 0 ? "crit" : "pos"} sub={r.requirement == null ? undefined : `need ${fmtM(r.requirement)}`} />
        </div>
        <p className="mt-3 text-[11.5px] leading-relaxed text-ink3">Stressed OCF = OCF + change in EBITDA − extra working capital from slower collections ({fmtM(r.wcDrag)}) − extra interest ({fmtM(r.extraInterest)}). {r.requirementNote} Tax and management actions are ignored.</p>
      </Card>
      <Indicators p={pillar} />
    </>
  );
}

/* ------------------------------------------------------------------ valuation */

function Valuation({ a }: { a: AnalysisResult }) {
  const { updateInputs } = useApp();
  const i = a.inputs, v = buildValuation(a), r = v.returns;
  return (
    <div className="grid gap-5 xl:grid-cols-12">
      <Card className="xl:col-span-5">
        <CardHead title="Acquisition inputs" hint={`Enter the deal assumptions in ${cur()} millions. Nothing here is estimated for you.`} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <NumInput label="Proposed enterprise value" value={i.enterpriseValue} unit={`${cur()} m`} onCommit={(n) => updateInputs({ enterpriseValue: n })} />
          <NumInput label="Acquisition debt" value={i.acquisitionDebt} unit={`${cur()} m`} onCommit={(n) => updateInputs({ acquisitionDebt: n })} hint="Left blank = enterprise value − equity." />
          <NumInput label="Equity invested" value={i.equityInvested} unit={`${cur()} m`} onCommit={(n) => updateInputs({ equityInvested: n })} />
          <NumInput label="Holding period" value={i.holdYears} unit="years" onCommit={(n) => updateInputs({ holdYears: n })} hint="Default 5." />
          <NumInput label="EBITDA growth" value={i.ebitdaGrowth} unit="% a year" onCommit={(n) => updateInputs({ ebitdaGrowth: n })} hint="Default: historical, capped 0–10%." />
          <NumInput label="Exit multiple" value={i.exitMultiple} unit="x EBITDA" onCommit={(n) => updateInputs({ exitMultiple: n })} hint="Default: entry multiple." />
        </div>
        <p className="mt-4 rounded-xl border border-line bg-bg2 p-3 text-[12px] leading-relaxed text-ink3">The risk score is not turned into an attractiveness score. A risky company can be attractive at the right price; a healthy one can be unattractive if the price is too high. Risks and deal assumptions are shown separately.</p>
      </Card>

      <div className="space-y-5 xl:col-span-7">
        <Card>
          <CardHead title="Entry valuation" hint="Facts from the data and your inputs." />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Stat label="Reported EBITDA" value={fmtM(v.reportedEbitda)} /><Stat label="Adjusted EBITDA" value={fmtM(v.adjustedEbitda)} sub={v.normalisation ? `${fmtM(v.normalisation)} normalisation` : "no verified adjustments"} />
            <Stat label="Entry EV / adj. EBITDA" value={fmtX(v.entryMultiple, 1)} sub={v.reportedMultiple != null && v.reportedMultiple !== v.entryMultiple ? `${fmtX(v.reportedMultiple, 1)} on reported` : undefined} />
            <Stat label="Existing net debt" value={fmtM(v.netDebt)} /><Stat label="Implied equity value" value={fmtM(v.equityValue)} sub="EV − net debt" />
            <Stat label="Acquisition leverage" value={fmtX(v.entryLeverage)} sub={v.debtDerived ? "debt = EV − equity" : undefined} tone={v.entryLeverage != null && v.entryLeverage > 4 ? "crit" : undefined} />
          </div>
          {v.fundingGap != null && Math.abs(v.fundingGap) > 0.05 && <p role="alert" className="mt-3 rounded-xl border border-warn/30 bg-warn/5 p-3 text-[12.5px] text-warn">Sources and uses differ by {fmtM(Math.abs(v.fundingGap))}: debt + equity {v.fundingGap > 0 ? "fall short of" : "exceed"} enterprise value.</p>}
          {v.entryMultiple == null && <p className="mt-3 text-[12.5px] text-ink3">Enter a proposed enterprise value to see the entry multiple.</p>}
        </Card>
        <Card>
          <CardHead title="Value levers" hint="Potential price or cash adjustments from the working-capital findings. Estimates, not guarantees." />
          <div className="grid gap-3 sm:grid-cols-2">
            <Stat label="Working capital above prior-year share" value={v.wcExcess == null ? "—" : fmtM(v.wcExcess)} sub="possible peg / price adjustment" />
            <Stat label="One-off cash from cutting DSO 15 days" value={fmtM(v.cashRelease15)} sub="assumes revenue constant" />
          </div>
        </Card>
        <Card>
          <CardHead title="Illustrative returns" hint="Assumption-driven, not a forecast. Uses today's free cash flow conversion to repay acquisition debt; ignores financing costs and tax." right={<Pill tone="warn">Assumptions</Pill>} />
          {r == null ? <p className="text-[13px] text-ink2">Needs a proposed enterprise value, equity invested and positive adjusted EBITDA.</p> : (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat label="Exit EBITDA" value={fmtM(r.exitEbitda)} sub={`${r.growth.toFixed(1)}% a year · ${r.growthSource}`} /><Stat label="Exit EV" value={fmtM(r.exitEv)} sub={`${fmtX(r.exitMultiple, 1)} · ${r.exitMultipleSource}`} />
                <Stat label="Exit equity" value={fmtM(r.exitEquity)} sub={r.paydown == null ? "debt paydown not modelled (no capex)" : `after ${fmtM(r.paydown)} debt repaid`} /><Stat label="MOIC / IRR" value={`${r.moic.toFixed(2)}x / ${r.irr.toFixed(0)}%`} tone={r.moic < 1 ? "crit" : r.moic >= 2 ? "pos" : undefined} sub={`${r.holdYears}-year hold`} />
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ register */

function Register({ a }: { a: AnalysisResult }) {
  const inds = allIndicators(a.risk);
  return (
    <Card hover={false}>
      <CardHead title="Indicator register" hint="Every indicator with its actual and previous value, the threshold it was judged against, the level and points assigned, and the reason." />
      <div className="-mx-5 overflow-x-auto px-5">
        <table className="w-full min-w-[1180px] border-collapse text-left text-[12px]">
          <thead><tr className="border-b border-line font-mono text-[10px] uppercase tracking-wider text-ink3">{["Indicator", "Actual", "Industry median", "Typical range", "Risk threshold", "Level", "Points", "Explanation"].map((h) => <th key={h} className="px-2 py-2.5 font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {a.risk.categories.map((p) => (
              <Fragment key={p.id}>
                <tr className="bg-bg2"><td colSpan={8} className="px-2 py-2 font-display text-[12.5px] font-medium">{p.name} <span className="font-mono text-[10.5px] text-ink3">· {p.weight} pts weight</span></td></tr>
                {p.indicators.map((i) => (
                  <tr key={i.id} className="border-b border-line align-top">
                    <td className="px-2 py-3 text-ink">{i.name}</td><td className="px-2 py-3 font-mono text-[11px] text-ink2">{i.actual}</td><td className="px-2 py-3 font-mono text-[11px] text-ink3">{i.applicable ? i.bench?.median ?? "—" : "N/A"}</td><td className="px-2 py-3 font-mono text-[11px] text-ink3">{i.bench?.range ?? "—"}</td>
                    <td className="px-2 py-3 text-ink3">{i.applicable ? i.benchmark : "—"}</td><td className="px-2 py-3"><LevelBadge level={i.level} na={!i.applicable} /></td>
                    <td className="px-2 py-3 font-mono tabular-nums">{i.points == null ? "—" : `${i.points}/${i.max}`}</td><td className="px-2 py-3 text-ink2">{i.explanation}</td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-[11.5px] text-ink3">Points = indicator maximum × level share (Low 0% · Moderate 40% · High 70% · Critical 100%). Overall score = points earned ÷ points assessable × 100.</p>
    </Card>
  );
}


/* ------------------------------------------------------------------ thresholds */

const METRICS = Object.keys(METRIC) as BenchMetric[];

function Thresholds({ a }: { a: AnalysisResult }) {
  const { updateInputs } = useApp();
  const { cuts, customised, sources } = resolveThresholds(a.inputs);
  const def = industryById(a.inputs.industry);
  const custom = a.inputs.customBench ?? {};
  const setCuts = (key: string, idx: number, v: number | null) => {
    const cur = [...(a.inputs.thresholds?.[key] ?? cuts[key])];
    if (v == null) return;
    cur[idx] = v;
    updateInputs({ thresholds: { ...(a.inputs.thresholds ?? {}), [key]: cur } });
  };
  const clear = (key: string) => { const t = { ...(a.inputs.thresholds ?? {}) }; delete t[key]; updateInputs({ thresholds: t }); };
  const setBench = (m: BenchMetric, field: "median" | "low" | "high", v: number | null) => {
    const next = { ...custom, [m]: { ...(custom[m] ?? {}), [field]: v } };
    if (next[m].median == null && next[m].low == null && next[m].high == null) delete next[m];
    updateInputs({ customBench: next });
  };
  const order = (d: (typeof THRESHOLD_DEFS)[number], c: number[]) => (d.dir === "min" ? c[0] >= c[1] && c[1] >= c[2] : c[0] <= c[1] && c[1] <= c[2]);
  const tag: Record<string, string> = { default: "generic default", "industry preset": `${def?.name ?? "industry"} preset (proposed)`, "benchmark-derived": "derived from benchmark", "custom override": "your override" };
  return (
    <div className="space-y-5">
      <Card hover={false}>
        <CardHead title={`Industry benchmarks: ${def?.name ?? "none selected"}`} hint="The median, typical range and risk threshold are three different things. The median is the middle of the industry distribution, the typical range is its 25th to 75th percentile, and the risk threshold is where scoring turns a level up. The industry average is never treated as the target." />
        {!def ? <p className="text-[13px] text-ink2">Select an industry in the profile above to load benchmarks.</p> : (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[980px] border-collapse text-left text-[12px]">
              <thead><tr className="border-b border-line font-mono text-[10px] uppercase tracking-wider text-ink3">{["Metric", "Median", "Typical range", "Tier · market · year", "Reliability", "Your benchmark (median / low / high)"].map((h) => <th key={h} className="px-2 py-2.5 font-medium">{h}</th>)}</tr></thead>
              <tbody>
                {METRICS.map((m) => {
                  const base = getBench(def, a.inputs.subIndustry, m, undefined);
                  const eff = getBench(def, a.inputs.subIndustry, m, a.inputs.customBench);
                  const isCustom = eff.status === "custom";
                  const used = Object.entries(INDICATOR_METRIC).some(([, mm]) => mm === m);
                  return (
                    <tr key={m} className="border-b border-line align-top">
                      <td className="px-2 py-3 text-ink">{METRIC[m].label}{!used && <span className="ml-1 text-ink3">(context)</span>}</td>
                      <td className="px-2 py-3 font-mono text-[11.5px]">{eff.status === "unavailable" ? <span className="text-warn">Industry Benchmark Unavailable</span> : fmtBench(eff.median, m)}</td>
                      <td className="px-2 py-3 font-mono text-[11.5px] text-ink2">{eff.status === "unavailable" ? "—" : benchRange(eff, m)}</td>
                      <td className="px-2 py-3 text-[11.5px] text-ink3">{eff.status === "unavailable" ? "Proposed screening threshold" : `${eff.tier} · ${eff.geography} · ${eff.year}`}{eff.status === "sourced" && <div className="mt-0.5">{eff.groups} industry group{eff.groups > 1 ? "s" : ""}, {eff.firms} firms</div>}</td>
                      <td className="px-2 py-3 text-[11.5px] text-ink3">{eff.reliability}{base.url && !isCustom && <a href={base.url} target="_blank" rel="noreferrer" className="mt-0.5 block text-accent hover:underline">Source: Damodaran</a>}</td>
                      <td className="px-2 py-2">
                        <div className="grid grid-cols-3 gap-1.5">
                          {(["median", "low", "high"] as const).map((f) => <NumInput key={f} label={f === "median" ? "Median" : f === "low" ? "Low" : "High"} value={custom[m]?.[f]} onCommit={(n) => setBench(m, f, n)} />)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-4 text-[11.5px] leading-relaxed text-ink3">Sourced figures are medians of US industry-group aggregates from Damodaran Online (NYU Stern, January 2026), computed here; DSO = receivables ÷ sales × 365, DIO and DPO use COGS. Leverage is gross debt incl. leases ÷ EBITDA and coverage is EBIT ÷ interest, so they are not like-for-like with this model&apos;s net-debt and EBITDA ratios. No benchmark is shown where no verified source exists. Entering your own benchmark overrides the sourced one and is marked as user-entered.</p>
      </Card>
      <Card hover={false}>
        <CardHead title="Scoring thresholds" hint="Three cut-offs per indicator: Low / Moderate / High. Anything beyond the last is Critical. These are proposed screening thresholds, not published standards." right={customised.length ? <Pill tone="accent">{customised.length} customised</Pill> : <Pill>No overrides</Pill>} />
        <div className="space-y-3">
          {THRESHOLD_DEFS.map((d) => {
            const c = a.inputs.thresholds?.[d.key] ?? cuts[d.key];
            const isCustom = d.key in (a.inputs.thresholds ?? {});
            const tags = d.dir === "min" ? ["Low ≥", "Moderate ≥", "High ≥"] : ["Low ≤", "Moderate ≤", "High ≤"];
            return (
              <div key={d.key} className="grid items-end gap-3 rounded-xl border border-line bg-bg2 p-3.5 md:grid-cols-[1.2fr_repeat(3,1fr)_auto]">
                <div><div className="text-[13px] font-medium">{d.label}</div><div className="font-mono text-[10.5px] text-ink3">{d.unit} · {d.dir === "min" ? "higher is better" : "lower is better"} · {tag[sources[d.key]]}</div></div>
                {c.map((v, i) => <NumInput key={i} label={tags[i]} value={v} unit={d.unit} onCommit={(n) => setCuts(d.key, i, n)} />)}
                <button onClick={() => clear(d.key)} disabled={!isCustom} className="tap h-11 rounded-xl border border-line px-3 text-[12px] text-ink2 disabled:opacity-30">Reset</button>
                {!order(d, c) && <p role="alert" className="text-[11.5px] text-crit md:col-span-5">Cut-offs must be in order ({d.dir === "min" ? "descending" : "ascending"}); invalid values are ignored.</p>}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[11.5px] text-ink3">Changing the industry resets these to that industry&apos;s proposed thresholds. This app has no user accounts yet, so anyone using this browser session can adjust them; your changes are saved with the company in this browser only.</p>
      </Card>
    </div>
  );
}
