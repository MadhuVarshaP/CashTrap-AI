"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { Calculator, Check, ChevronLeft, ChevronRight, FileInput, FileText, Gauge, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { Card, CardHead, PageTitle, Pill } from "@/components/shared/ui";

const FLOW = [
  { i: FileInput, t: "Ingest", d: "CSV / Excel statements, validated and unit-normalised.", more: "What happens to your file", points: ["Reads flat tables, Income Statement + Balance Sheet workbooks and S&P Capital IQ exports.", "Matches columns and rows by name; units (AED, thousands, millions) are normalised to AED millions.", "Blank or non-numeric cells become “missing”, never zero, and are listed on screen.", "At least two years are required; five MB maximum."], out: "Validated records + a data-quality report" },
  { i: Calculator, t: "Calculate", d: "DSO · DIO · DPO · CCC, cash conversion, leverage.", more: "What is computed", points: ["Average-balance DSO, DIO and DPO, and the cash conversion cycle.", "EBITDA-to-cash conversion, free cash flow, net debt and net debt / EBITDA.", "Interest cover, debt service cover, liquidity ratios and operating working capital.", "Every figure is traceable to the formulas in the calculation reference."], out: "Per-year metrics, all in AED millions" },
  { i: Gauge, t: "Score", d: "Five pillars, 18 indicators → 0–100 screening score.", more: "How the score is built", points: ["Five weighted pillars: earnings quality, cash flow, working capital, debt, liquidity.", "Each indicator is rated Low, Moderate, High or Critical against a stated threshold.", "Indicators without data are not assessed; they never count as zero risk.", "Score = points earned ÷ points assessable, with coverage always shown."], out: "Score /100, pillar points and coverage" },
  { i: ShieldAlert, t: "Detect", d: "Seven anomaly rules with evidence.", more: "What is flagged", points: ["Receivables or inventory growing faster than revenue.", "EBITDA rising while operating cash flow falls.", "Rising DSO, DIO or cash conversion cycle, and high net debt / EBITDA.", "Each alert shows previous vs current values and what to investigate, never a claim of fraud."], out: "Ranked alerts with severity and evidence" },
  { i: FileText, t: "Explain", d: "Narrative uses engine figures only.", more: "How findings are written", points: ["Text is built only from calculated figures; nothing is invented.", "Facts, estimates, assumptions, missing data and hypotheses are labelled separately.", "Risks are ordered by materiality and sized in AED wherever the data allows.", "No buy or reject recommendation is ever made."], out: "Investment findings and the due diligence report" },
];

function HowItWorks() {
  const [step, setStep] = useState(0);
  const f = FLOW[step];
  const go = (n: number) => setStep((n + FLOW.length) % FLOW.length);
  return (
    <div>
      <div role="tablist" aria-label="Analysis steps" className="relative grid gap-2 md:grid-cols-5 md:gap-3" onKeyDown={(e) => { if (e.key === "ArrowRight") go(step + 1); if (e.key === "ArrowLeft") go(step - 1); }}>
        {/* connector behind the steps (desktop) */}
        <div aria-hidden className="absolute left-[10%] right-[10%] top-[34px] hidden h-px bg-line md:block">
          <motion.div className="h-full bg-accent" initial={false} animate={{ width: `${(step / (FLOW.length - 1)) * 100}%` }} transition={{ type: "spring", stiffness: 160, damping: 24 }} />
        </div>
        {FLOW.map((x, n) => {
          const done = n < step, on = n === step;
          return (
            <button key={x.t} role="tab" aria-selected={on} tabIndex={on ? 0 : -1} onClick={() => setStep(n)} className={clsx("tap group relative flex items-center gap-3 rounded-2xl border p-3.5 text-left md:flex-col md:gap-0 md:p-4 md:text-center", on ? "border-accent/60 bg-accent/[0.08] shadow-[0_10px_30px_-14px_rgba(57,136,245,.8)]" : "border-line bg-bg2 hover:border-[#3f4551]")}>
              <span className={clsx("relative z-10 grid h-11 w-11 shrink-0 place-items-center rounded-xl border transition-colors md:mb-3", on ? "border-accent bg-accent text-white" : done ? "border-accent/40 bg-accent/15 text-accent" : "border-line bg-elev text-ink2 group-hover:text-accent")}>
                {done ? <Check size={18} /> : <x.i size={18} />}
              </span>
              <span className="min-w-0 flex-1 md:flex-none">
                <span className="block font-mono text-[10px] uppercase tracking-wider text-ink3">Step 0{n + 1}</span>
                <span className="block text-[14px] font-medium">{x.t}</span>
                <span className="mt-1 hidden text-[11.5px] leading-snug text-ink3 md:block">{x.d}</span>
              </span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} role="tabpanel" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }} className="mt-4 grid gap-5 rounded-2xl border border-line bg-bg2 p-5 md:grid-cols-[1fr_260px] md:p-6">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-accent">{f.more}</div>
            <p className="mt-1 text-[12.5px] text-ink3 md:hidden">{f.d}</p>
            <ul className="mt-3 space-y-2.5">{f.points.map((t) => <li key={t} className="flex gap-2.5 text-[13px] leading-relaxed text-ink2"><Check size={14} className="mt-1 shrink-0 text-accent" />{t}</li>)}</ul>
          </div>
          <div className="flex flex-col justify-between gap-4 rounded-xl border border-line bg-card p-4">
            <div><div className="font-mono text-[10px] uppercase tracking-wider text-ink3">Produces</div><p className="mt-1.5 text-[13.5px] font-medium leading-snug">{f.out}</p></div>
            <div className="flex items-center justify-between gap-2">
              <button onClick={() => go(step - 1)} aria-label="Previous step" className="tap grid h-9 w-9 place-items-center rounded-lg border border-line text-ink2 hover:border-accent/50 hover:text-ink"><ChevronLeft size={16} /></button>
              <div className="flex gap-1.5" aria-hidden>{FLOW.map((_, n) => <span key={n} className={clsx("h-1.5 rounded-full transition-all", n === step ? "w-5 bg-accent" : "w-1.5 bg-line")} />)}</div>
              <button onClick={() => go(step + 1)} aria-label="Next step" className="tap grid h-9 w-9 place-items-center rounded-lg border border-line text-ink2 hover:border-accent/50 hover:text-ink"><ChevronRight size={16} /></button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

const METRICS = [
  ["DSO", "Average Receivables ÷ Revenue × 365", "Days to collect from customers"],
  ["DIO", "Average Inventory ÷ COGS × 365", "Days stock is held"],
  ["DPO", "Average Payables ÷ COGS × 365", "Days taken to pay suppliers"],
  ["CCC", "DSO + DIO − DPO", "Days cash is tied up in operations"],
  ["Cash conversion", "Operating Cash Flow ÷ EBITDA", "Share of profit turned into cash"],
  ["Net debt / EBITDA", "(Debt − Cash) ÷ EBITDA", "Leverage versus earnings"],
];

const MODEL: [string, number, string][] = [
  ["Quality of Earnings", 25, "Reliability and sustainability of reported EBITDA"],
  ["· EBITDA adjustments", 10, "Verified → Low · needs documents → Moderate · unsupported → High · unexplained → Critical"],
  ["· Revenue quality vs cash", 5, "Receivables growth − revenue growth: ≤0 → Low · ≤10pp → Mod · ≤30pp → High · above → Critical"],
  ["· EBITDA margin", 5, "Change ≥ −0.5pp → Low · ≥ −2 → Mod · ≥ −5 → High · below → Critical"],
  ["· Earnings volatility", 5, "Worst YoY EBITDA fall in 3 periods: none → Low · ≤10% → Mod · ≤25% → High · above → Critical"],
  ["Cash Flow Sustainability", 25, "How well earnings become cash"],
  ["· OCF ÷ adjusted EBITDA", 10, "≥80% → Low · 50–80% → Mod · 20–50% → High · <20% or negative → Critical"],
  ["· FCF ÷ adjusted EBITDA", 10, "≥50% → Low · 25–50% → Mod · 0–25% → High · negative → Critical"],
  ["· Cash-flow consistency", 5, "Issues counted over 3 years: 0 → Low · 1 → Mod · 2–3 → High · 4+ → Critical"],
  ["Working Capital Risk", 20, "Cash trapped in operations (CCC is a cross-check, not scored again)"],
  ["· Receivables (DSO)", 7, "Change ≤+2d → Low · ≤+7 → Mod · ≤+15 → High · above → Critical"],
  ["· Inventory (DIO)", 5, "Change ≤+2d → Low · ≤+7 → Mod · ≤+15 → High · above → Critical"],
  ["· Payables (DPO)", 3, "|Change| ≤5d → Low · ≤12 → Mod · ≤20 → High · above → Critical"],
  ["· Operating WC / revenue", 5, "Change ≤+1pp → Low · ≤+3 → Mod · ≤+6 → High · above → Critical"],
  ["Debt and Repayment Risk", 20, "Ability to meet financial obligations"],
  ["· Net debt / EBITDA", 7, "<2x → Low · 2–3x → Mod · 3–4x → High · >4x → Critical"],
  ["· Interest coverage", 5, "≥5x → Low · ≥3x → Mod · ≥1.5x → High · below → Critical"],
  ["· Debt service coverage", 5, "≥1.5x → Low · ≥1.2x → Mod · ≥1.0x → High · below → Critical"],
  ["· Debt maturity", 3, "Due in 12m: <30% → Low · <50% → Mod · <70% → High · ≥70% → Critical"],
  ["Liquidity and Stress Risk", 10, "Resilience to adverse events"],
  ["· Liquidity adequacy", 4, "Current ratio ≥1.5 / quick ≥1.0 → Low; worse of the two applies"],
  ["· Downside scenario", 3, "Net debt ÷ stressed EBITDA (revenue −10%, margin −3pp)"],
  ["· Cash-flow resilience", 3, "Shortfall after four stresses, covered by cash? none → Low · 1.5x → Mod · 1x → High · else Critical"],
];

const BANDS = [
  ["0–24", "Low Risk", "#35C994", 25],
  ["25–49", "Moderate Risk", "#F5A640", 25],
  ["50–74", "High Risk", "#F06464", 25],
  ["75–100", "Critical Risk", "#F06464", 25],
] as const;

export default function Methodology() {
  return (
    <>
      <PageTitle title="Methodology" sub="How CashCop AI turns financial statements into a transparent, auditable screening view." right={<Pill tone="ai">Decision support · not a verdict</Pill>} />
      <div className="grid gap-5 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHead title="The problem" />
          <p className="font-display text-[24px] font-semibold leading-snug tracking-tight sm:text-[30px]">Profit is an opinion. <span className="text-ink2">Cash is a fact.</span></p>
          <p className="mt-4 max-w-2xl text-[14px] leading-relaxed text-ink2">A business can report rising EBITDA while customers pay later, stock piles up and operating cash flow falls. Acquirers who only read the income statement can overpay for earnings that never turn into cash. CashCop AI surfaces these <em>cash traps</em> early, so the investment team knows where to dig.</p>
        </Card>
        <Card className="xl:col-span-5">
          <CardHead title="What it is, and isn't" />
          <ul className="space-y-2.5 text-[13px] text-ink2">
            {["Screens financial statements for working-capital and cash-conversion risk", "Shows its workings: every score traces to a visible figure", "Never states that a signal proves fraud, bad debt or poor management", "Does not recommend investing or rejecting a company"].map((t, i) => <li key={t} className="flex gap-2.5"><span className={i < 2 ? "text-pos" : "text-warn"}>{i < 2 ? "✓" : "!"}</span>{t}</li>)}
          </ul>
        </Card>

        <Card className="xl:col-span-12">
          <CardHead title="How analysis works" />
          <HowItWorks />
        </Card>

        <Card className="xl:col-span-7">
          <CardHead title="Working-capital metrics" hint="Average opening and closing balances are used when a prior year exists; otherwise closing balances are used and labelled approximate." />
          <div className="overflow-hidden rounded-xl border border-line">
            {METRICS.map(([n, f, d]) => (
              <div key={n} className="grid gap-1 border-b border-line bg-bg2 px-4 py-3 last:border-0 sm:grid-cols-[130px_1fr_1fr] sm:gap-4">
                <span className="font-display text-[13.5px] font-medium">{n}</span><span className="font-mono text-[11.5px] text-accent">{f}</span><span className="text-[12px] text-ink3">{d}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 grid grid-cols-3 items-center gap-2 text-center font-mono text-[12px]">
            <div className="rounded-xl border border-line bg-bg2 p-3"><div className="text-ink3">DSO + DIO</div><div className="mt-1 text-[#3988F5]">cash out →</div></div>
            <div className="text-ink3">− DPO =</div>
            <div className="rounded-xl border border-accent/30 bg-accent/10 p-3 text-ink">Cash conversion cycle</div>
          </div>
        </Card>

        <Card className="xl:col-span-5">
          <CardHead title="Risk classification" />
          <div className="flex h-3 overflow-hidden rounded-full">{BANDS.map(([, , c], i) => <div key={i} className="flex-1" style={{ background: c, opacity: 0.35 + i * 0.22 }} />)}</div>
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">{BANDS.map(([r, l, c]) => <div key={r}><div className="font-mono text-[11px] text-ink2">{r}</div><div className="text-[11px]" style={{ color: c }}>{l.replace(" Risk", "")}</div></div>)}</div>
          <p className="mt-5 text-[12.5px] leading-relaxed text-ink2">Missing data is never scored as zero. Score = points earned ÷ points assessable × 100, over the indicators the data supports. If less than 40% of the 100 points can be assessed the result reads <span className="text-ink">Insufficient data</span>.</p>
        </Card>

        <Card className="xl:col-span-12">
          <CardHead title="Risk-scoring model · 5 pillars · 100 points" hint="Indicative screening thresholds, not universal industry standards. Level share of an indicator's maximum: Low 0% · Moderate 40% · High 70% · Critical 100%." />
          <div className="space-y-2.5">
            {MODEL.map(([n, pts, rule]) => (
              <div key={n} className={`grid items-center gap-2 rounded-xl border p-3.5 md:grid-cols-[230px_1fr_120px] md:gap-5 ${n.startsWith("·") ? "ml-0 border-line bg-bg2 md:ml-6" : "border-[#3f4551] bg-elev"}`}>
                <span className="text-[13.5px] font-medium">{n}</span>
                <span className="font-mono text-[11.5px] text-ink2">{rule}</span>
                <div className="flex items-center gap-2 md:justify-end"><div className="h-1.5 flex-1 rounded-full bg-elev md:hidden"><div className="h-full rounded-full bg-accent" style={{ width: `${pts * 4}%` }} /></div><span className="font-mono text-[12px] text-accent">{pts} pts · {pts}%</span></div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="xl:col-span-6">
          <CardHead title="AI explanation methodology" />
          <ul className="space-y-2.5 text-[13px] leading-relaxed text-ink2">
            {["Narratives use only figures produced by the calculation engine.", "The AI never recalculates or invents data.", "Verified evidence and possible explanations are displayed separately.", "Missing information is called out, never filled in.", "No AI key is configured in this prototype, so reports use clearly labelled deterministic templates."].map((t) => <li key={t} className="flex gap-2.5"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ai" />{t}</li>)}
          </ul>
        </Card>
        <Card className="xl:col-span-6 !border-warn/25">
          <CardHead title="Data limitations & disclaimers" />
          <ul className="space-y-2.5 text-[13px] leading-relaxed text-ink2">
            {["Annual, year-end data can hide intra-year swings and seasonality.", "Credit sales and purchases are approximated by revenue and COGS when not supplied.", "First-year working-capital metrics use closing balances only.", "Thresholds are illustrative screening bands, not a definitive investment decision.", "The demo company, GulfTech Manufacturing LLC, and all its figures are synthetic.", "This tool supports, and does not replace, professional due diligence."].map((t) => <li key={t} className="flex gap-2.5"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-warn" />{t}</li>)}
          </ul>
        </Card>
      </div>
    </>
  );
}
