"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { Calculator, Check, ChevronDown, ChevronLeft, ChevronRight, FileInput, FileText, Gauge, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { Card, CardHead, PageTitle, Pill } from "@/components/shared/ui";
import { useAutoCollapse } from "@/lib/utilities/useAutoCollapse";

const FLOW = [
  { i: FileInput, t: "Ingest", d: "CSV / Excel statements, validated and unit-normalised.", more: "What happens to your file", points: ["Reads flat tables, Income Statement + Balance Sheet workbooks and S&P Capital IQ exports.", "Matches columns and rows by name; units (AED, thousands, millions) are normalised to AED millions.", "Blank or non-numeric cells become “missing”, never zero, and are listed on screen.", "At least two years are required; five MB maximum."], out: "Validated records + a data-quality report" },
  { i: Calculator, t: "Calculate", d: "DSO · DIO · DPO · CCC, cash conversion, leverage.", more: "What is computed", points: ["Average-balance DSO, DIO and DPO, and the cash conversion cycle.", "EBITDA-to-cash conversion, free cash flow, net debt and net debt / EBITDA.", "Interest cover, debt service cover, liquidity ratios and operating working capital.", "Every figure is traceable to the formulas in the calculation reference."], out: "Per-year metrics, all in AED millions" },
  { i: Gauge, t: "Score", d: "Five pillars, 18 indicators → 0–100 screening score.", more: "How the score is built", points: ["Five weighted pillars: earnings quality, cash flow, working capital, debt, liquidity.", "Each indicator is rated Low, Moderate, High or Critical against a stated threshold.", "Indicators without data are not assessed; they never count as zero risk.", "Score = points earned ÷ points assessable, with coverage always shown."], out: "Score /100, pillar points and coverage" },
  { i: ShieldAlert, t: "Detect", d: "Seven anomaly rules with evidence.", more: "What is flagged", points: ["Receivables or inventory growing faster than revenue.", "EBITDA rising while operating cash flow falls.", "Rising DSO, DIO or cash conversion cycle, and high net debt / EBITDA.", "Each alert shows previous vs current values and what to investigate, never a claim of fraud."], out: "Ranked alerts with severity and evidence" },
  { i: FileText, t: "Explain", d: "Narrative uses engine figures only.", more: "How findings are written", points: ["Text is built only from calculated figures; nothing is invented.", "Facts, estimates, assumptions, missing data and hypotheses are labelled separately.", "Risks are ordered by materiality and sized in AED wherever the data allows.", "No buy or reject recommendation is ever made."], out: "Investment findings and the due diligence report" },
];

const ROW = 88; // px height of each step row: the connector is drawn from the first node's centre to the last, so it always meets the nodes

function HowItWorks() {
  const [step, setStep] = useState(0);
  const f = FLOW[step];
  const go = (n: number) => setStep((n + FLOW.length) % FLOW.length);
  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <ol role="tablist" aria-label="Analysis steps" className="relative" style={{ height: ROW * FLOW.length }} onKeyDown={(e) => { if (e.key === "ArrowDown" || e.key === "ArrowRight") go(step + 1); if (e.key === "ArrowUp" || e.key === "ArrowLeft") go(step - 1); }}>
        {/* connector: from the centre of the first node to the centre of the last, filled up to the active step */}
        <span aria-hidden className="absolute left-[27px] w-0.5 rounded-full bg-line" style={{ top: ROW / 2, height: ROW * (FLOW.length - 1) }} />
        <motion.span aria-hidden className="absolute left-[27px] w-0.5 rounded-full bg-gradient-to-b from-accent to-ai" initial={false} animate={{ height: ROW * step }} transition={{ type: "spring", stiffness: 170, damping: 26 }} style={{ top: ROW / 2 }} />
        {FLOW.map((x, n) => {
          const done = n < step, on = n === step;
          return (
            <li key={x.t} style={{ height: ROW }}>
              <button role="tab" aria-selected={on} tabIndex={on ? 0 : -1} onClick={() => setStep(n)} className="tap group flex h-full w-full items-center gap-4 rounded-2xl pr-3 text-left">
                <span className={clsx("relative z-10 grid h-14 w-14 shrink-0 place-items-center rounded-2xl border-2 bg-card transition-all duration-300", on ? "border-accent bg-gradient-to-br from-accent to-ai text-white shadow-lift" : done ? "border-accent/50 bg-accent/10 text-accent" : "border-line text-ink3 group-hover:border-line2")}>
                  {done ? <Check size={20} /> : <x.i size={20} />}
                </span>
                <span className="min-w-0">
                  <span className="block font-mono text-[10px] uppercase tracking-wider text-ink3">Step 0{n + 1}</span>
                  <span className={clsx("block text-[15px] font-medium", on ? "text-ink" : "text-ink2")}>{x.t}</span>
                  <span className="block truncate text-[11.5px] text-ink3">{x.d}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <AnimatePresence mode="wait">
        <motion.div key={step} role="tabpanel" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.22 }} className="flex flex-col justify-between gap-6 rounded-2xl border border-line bg-gradient-to-br from-[#EEF3FF] via-white to-[#F3EEFF] p-6 shadow-card">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-accent to-ai text-white"><f.i size={20} /></span>
              <div><div className="font-mono text-[10px] uppercase tracking-wider text-accent">{f.more}</div><div className="font-display text-[20px] font-semibold">{f.t}</div></div>
            </div>
            <ul className="mt-5 space-y-3">{f.points.map((t) => <li key={t} className="flex gap-2.5 text-[13.5px] leading-relaxed text-ink2"><Check size={15} className="mt-1 shrink-0 text-accent" />{t}</li>)}</ul>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-card p-4">
            <div className="min-w-0"><div className="font-mono text-[10px] uppercase tracking-wider text-ink3">Produces</div><p className="mt-1 text-[13.5px] font-medium leading-snug">{f.out}</p></div>
            <div className="flex items-center gap-3">
              <button onClick={() => go(step - 1)} aria-label="Previous step" className="tap grid h-9 w-9 place-items-center rounded-lg border border-line text-ink2 hover:border-accent/50 hover:text-ink"><ChevronLeft size={16} /></button>
              <div className="flex gap-1.5" aria-hidden>{FLOW.map((_, n) => <span key={n} className={clsx("h-1.5 rounded-full transition-all", n === step ? "w-5 bg-accent" : "w-1.5 bg-line2")} />)}</div>
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

/** the five pillars, collapsed to start; opening one shows its indicators and thresholds */
function ScoringModel() {
  const pillars = MODEL.reduce<{ name: string; pts: number; desc: string; items: [string, number, string][] }[]>((acc, [n, pts, rule]) => {
    if (n.startsWith("·")) acc[acc.length - 1].items.push([n.replace(/^·\s*/, ""), pts, rule]);
    else acc.push({ name: n, pts, desc: rule, items: [] });
    return acc;
  }, []);
  const [open, setOpen] = useState<string | null>(null);
  useAutoCollapse(open !== null, () => setOpen(null));
  const hues = ["from-[#3B6CFF] to-[#7FA0FF]", "from-[#10B981] to-[#5EE0B5]", "from-[#F59E0B] to-[#FFC65C]", "from-[#F43F5E] to-[#FF8DA1]", "from-[#8B5CF6] to-[#B59CFF]"];
  return (
    <div className="space-y-3">
      {pillars.map((p, k) => {
        const on = open === p.name;
        return (
          <div key={p.name} className={clsx("overflow-hidden rounded-2xl border bg-card transition-shadow", on ? "border-line2 shadow-lift" : "border-line shadow-card")}>
            <button onClick={() => setOpen(on ? null : p.name)} aria-expanded={on} className="flex w-full items-center gap-4 p-4 text-left sm:p-5">
              <span className={clsx("grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br font-display text-[15px] font-semibold text-white", hues[k])}>{p.pts}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[15px] font-medium">{p.name}</span>
                <span className="block text-[12.5px] text-ink3">{p.desc}</span>
              </span>
              <span className="hidden w-40 sm:block"><span className="block h-1.5 rounded-full bg-elev"><span className={clsx("block h-full rounded-full bg-gradient-to-r", hues[k])} style={{ width: `${p.pts * 4}%` }} /></span><span className="mt-1 block text-right font-mono text-[10px] text-ink3">{p.pts} of 100 pts · {p.items.length} indicators</span></span>
              <ChevronDown size={17} className={clsx("shrink-0 text-ink3 transition-transform", on && "rotate-180")} />
            </button>
            <AnimatePresence initial={false}>
              {on && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="space-y-2 border-t border-line bg-bg2 p-4 sm:p-5">
                    {p.items.map(([n, pts, rule]) => (
                      <div key={n} className="grid items-center gap-1.5 rounded-xl border border-line bg-card p-3.5 md:grid-cols-[220px_1fr_70px] md:gap-5">
                        <span className="text-[13px] font-medium">{n}</span>
                        <span className="font-mono text-[11.5px] leading-relaxed text-ink2">{rule}</span>
                        <span className="font-mono text-[13px] font-semibold md:text-right">{pts}<span className="text-[10.5px] font-normal text-ink3"> pts</span></span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

const BANDS = [
  ["0–24", "Low Risk", "#10B981", 25],
  ["25–49", "Moderate Risk", "#F59E0B", 25],
  ["50–74", "High Risk", "#F43F5E", 25],
  ["75–100", "Critical Risk", "#F43F5E", 25],
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
            <div className="rounded-xl border border-line bg-bg2 p-3"><div className="text-ink3">DSO + DIO</div><div className="mt-1 text-[#3B6CFF]">cash out →</div></div>
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
          <CardHead title="Risk-scoring model · 5 pillars · 100 points" hint="Indicative screening thresholds, not universal industry standards. Level share of an indicator's maximum: Low 0% · Moderate 40% · High 70% · Critical 100%. The selected industry shifts these thresholds." />
          <ScoringModel />
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
            {["Annual, year-end data can hide intra-year swings and seasonality.", "Credit sales and purchases are approximated by revenue and COGS when not supplied.", "First-year working-capital metrics use closing balances only.", "Thresholds are illustrative screening bands, not a definitive investment decision.", "This tool supports, and does not replace, professional due diligence."].map((t) => <li key={t} className="flex gap-2.5"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-warn" />{t}</li>)}
          </ul>
        </Card>
      </div>
    </>
  );
}
