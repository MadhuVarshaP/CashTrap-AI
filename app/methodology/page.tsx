"use client";

import { ArrowRight, Calculator, FileInput, FileText, Gauge, ShieldAlert } from "lucide-react";
import { Card, CardHead, PageTitle, Pill } from "@/components/shared/ui";

const FLOW = [
  { i: FileInput, t: "Ingest", d: "CSV / Excel statements, validated and unit-normalised." },
  { i: Calculator, t: "Calculate", d: "DSO · DIO · DPO · CCC, cash conversion, leverage." },
  { i: Gauge, t: "Score", d: "Five pillars, 18 indicators → 0–100 screening score." },
  { i: ShieldAlert, t: "Detect", d: "Seven anomaly rules with evidence." },
  { i: FileText, t: "Explain", d: "Narrative uses engine figures only." },
];

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
      <PageTitle title="Methodology" sub="How CashTrap AI turns financial statements into a transparent, auditable screening view." right={<Pill tone="ai">Decision support · not a verdict</Pill>} />
      <div className="grid gap-5 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHead title="The problem" />
          <p className="font-display text-[24px] font-semibold leading-snug tracking-tight sm:text-[30px]">Profit is an opinion. <span className="text-ink2">Cash is a fact.</span></p>
          <p className="mt-4 max-w-2xl text-[14px] leading-relaxed text-ink2">A business can report rising EBITDA while customers pay later, stock piles up and operating cash flow falls. Acquirers who only read the income statement can overpay for earnings that never turn into cash. CashTrap AI surfaces these <em>cash traps</em> early, so the investment team knows where to dig.</p>
        </Card>
        <Card className="xl:col-span-5">
          <CardHead title="What it is, and isn't" />
          <ul className="space-y-2.5 text-[13px] text-ink2">
            {["Screens financial statements for working-capital and cash-conversion risk", "Shows its workings: every score traces to a visible figure", "Never states that a signal proves fraud, bad debt or poor management", "Does not recommend investing or rejecting a company"].map((t, i) => <li key={t} className="flex gap-2.5"><span className={i < 2 ? "text-pos" : "text-warn"}>{i < 2 ? "✓" : "!"}</span>{t}</li>)}
          </ul>
        </Card>

        <Card className="xl:col-span-12">
          <CardHead title="How analysis works" />
          <div className="grid gap-3 md:grid-cols-5">
            {FLOW.map((f, i) => (
              <div key={f.t} className="relative rounded-2xl border border-line bg-bg2 p-4">
                <div className="mb-3 flex items-center justify-between"><span className="grid h-9 w-9 place-items-center rounded-xl bg-elev text-accent"><f.i size={17} /></span><span className="font-mono text-[11px] text-ink3">0{i + 1}</span></div>
                <div className="text-[14px] font-medium">{f.t}</div>
                <p className="mt-1 text-[12px] leading-snug text-ink3">{f.d}</p>
                {i < FLOW.length - 1 && <ArrowRight size={14} className="absolute -right-2.5 top-1/2 z-10 hidden -translate-y-1/2 text-ink3 md:block" />}
              </div>
            ))}
          </div>
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
