import type { AnalysisResult, Severity } from "@/types/finance";
import { fmtDays, fmtM, fmtPct, fmtX, growth } from "@/lib/utilities/format";
import { cashRelease } from "./metrics";
import { buildFindings } from "./findings";
import { adjustedEbitda, allIndicators, levelName } from "./pe-risk";
import { buildValuation } from "./valuation";

/** Deterministic narrative. Uses only figures from the calculation engine; no model call. */
export function buildExecutiveInsight(a: AnalysisResult) {
  const { risk, latest: m, previous: pm, latestRecord: c, previousRecord: p } = a;
  const headline =
    risk.score == null
      ? "There is not enough available data to produce an overall score. Add the missing fields to complete the assessment."
      : `Screening indicates ${risk.classification.toLowerCase()} (${risk.score}/100). ${
          m.cashConversion != null ? `Operating cash flow converted ${fmtPct(m.cashConversion, 0)} of EBITDA` : "Cash conversion could not be computed"
        }${a.alerts[0] ? `, and the most significant signal is: ${a.alerts[0].name.toLowerCase()}.` : "."}`;
  const points: string[] = [];
  const eg = growth(c.ebitda, p?.ebitda ?? null), og = growth(c.operatingCashFlow, p?.operatingCashFlow ?? null);
  if (eg != null && og != null) points.push(`EBITDA ${eg >= 0 ? "rose" : "fell"} ${Math.abs(eg * 100).toFixed(1)}% while operating cash flow ${og >= 0 ? "rose" : "fell"} ${Math.abs(og * 100).toFixed(1)}%.`);
  if (pm && m.dso != null && pm.dso != null) points.push(`DSO moved from ${fmtDays(pm.dso)} to ${fmtDays(m.dso)}; DIO from ${fmtDays(pm.dio)} to ${fmtDays(m.dio)}.`);
  if (pm && m.ccc != null && pm.ccc != null) points.push(`Cash conversion cycle: ${fmtDays(pm.ccc)} → ${fmtDays(m.ccc)}.`);
  if (m.netDebtToEbitda != null) points.push(`Net debt is ${fmtM(m.netDebt)} (${fmtX(m.netDebtToEbitda)} EBITDA).`);
  if (risk.coverage < 100) points.push(`Only ${risk.coverage}% of the risk model could be assessed (${risk.evaluated} of ${risk.total} indicators); read the score as incomplete.`);
  return { headline, points };
}

/** how well-founded a statement is: the report never mixes these up */
export type Tag = "fact" | "estimate" | "assumption" | "missing" | "hypothesis";
export interface ReportItem { tag: Tag; text: string }
export interface ReportSection {
  id: string;
  title: string;
  /** the investor question the section answers */
  question: string;
  items: ReportItem[];
  questions?: string[];
}

const f = (text: string): ReportItem => ({ tag: "fact", text });
const est = (text: string): ReportItem => ({ tag: "estimate", text });
const asm = (text: string): ReportItem => ({ tag: "assumption", text });
const miss = (text: string): ReportItem => ({ tag: "missing", text });
const hyp = (text: string): ReportItem => ({ tag: "hypothesis", text });
const pctS = (g: number | null) => (g == null ? "n/a" : `${g >= 0 ? "+" : ""}${(g * 100).toFixed(1)}%`);

/**
 * Six-section investor report. Rules it follows: evidence before conclusions, material risks first,
 * impact quantified where the data allows, facts kept apart from estimates / assumptions / hypotheses,
 * and no buy or reject recommendation.
 */
export function buildReport(a: AnalysisResult): ReportSection[] {
  const { risk, latest: m, previous: pm, latestRecord: c, previousRecord: p } = a;
  const inds = allIndicators(risk);
  const ind = (id: string) => inds.find((i) => i.id === id)!;
  const findings = buildFindings(a, 3);
  const v = buildValuation(a);
  const rg = growth(c.revenue, p?.revenue ?? null), eg = growth(c.ebitda, p?.ebitda ?? null), og = growth(c.operatingCashFlow, p?.operatingCashFlow ?? null);
  const sales = c.creditSales ?? c.revenue;
  const e = adjustedEbitda(c, a.inputs, true);
  const fcf = c.operatingCashFlow != null && c.capex != null ? c.operatingCashFlow - c.capex : null;
  const flagged = inds.filter((i) => i.level === "High" || i.level === "Critical").sort((x, y) => (y.points ?? 0) - (x.points ?? 0));
  const strong = inds.filter((i) => i.level === "Low" && i.points === 0 && ["lev", "int", "liqr", "ocf", "margin", "vol", "dscr"].includes(i.id));
  const lvl = (i: { level: Severity | null; points: number | null; max: number }) => `${levelName(i.level)}, ${i.points}/${i.max} pts`;

  // ---- 1 executive summary
  const s1: ReportItem[] = [
    f(risk.score == null ? `Overall screening score not available: only ${risk.coverage}% of the model could be assessed.` : `Screening score ${risk.score}/100 (${risk.classification}), assessed on ${risk.coverage}% of the 100-point model (${risk.evaluated} of ${risk.total} indicators).`),
    f(`FY${c.year}: revenue ${fmtM(c.revenue)} (${pctS(rg)}), EBITDA ${fmtM(c.ebitda)} (${pctS(eg)}), operating cash flow ${fmtM(c.operatingCashFlow)} (${pctS(og)}).`),
    f(m.netDebt != null ? (m.netDebt <= 0 ? `Net cash position of ${fmtM(-m.netDebt)}.` : `Net debt ${fmtM(m.netDebt)}${m.netDebtToEbitda != null ? `, ${fmtX(m.netDebtToEbitda)} EBITDA` : ""}.`) : "Net debt could not be computed."),
    ...(strong.length ? [f(`Low-risk on the evidence: ${strong.slice(0, 4).map((i) => `${i.name} — ${i.actual}`).join("; ")}.`)] : []),
    ...(findings.length ? [f(`Most material risks, largest first: ${findings.map((x) => x.title.toLowerCase()).join("; ")}.`), ...findings.map((x) => x.impact ? est(`${x.title}: ${x.impact}.`) : f(`${x.title}: ${x.evidence}.`))] : [f("No indicator scored risk points on the data supplied.")]),
    ...(risk.coverage < 100 ? [miss(`${100 - risk.coverage}% of the model could not be assessed because data was not supplied; the score is incomplete.`)] : []),
    ...(findings.length && m.ccc != null && pm?.ccc != null && m.ccc > pm.ccc ? [hyp("The pattern is consistent with growth being funded by working capital rather than cash generation. This is a hypothesis for the team to test, not a conclusion.")] : []),
  ];

  // ---- 2 earnings quality
  const qoe = risk.categories[0];
  const s2: ReportItem[] = [
    f(`Revenue ${fmtM(p?.revenue)} → ${fmtM(c.revenue)} (${pctS(rg)}); EBITDA ${fmtM(p?.ebitda)} → ${fmtM(c.ebitda)} (${pctS(eg)}); EBITDA margin ${fmtPct(pm?.ebitdaMargin ?? null)} → ${fmtPct(m.ebitdaMargin)}.`),
    ...qoe.indicators.filter((i) => i.points != null).sort((x, y) => (y.points ?? 0) - (x.points ?? 0)).map((i) => f(`${i.name}: ${i.actual} (${lvl(i)}).`)),
    ...(a.inputs.ebitdaAdjustment != null && a.inputs.adjustmentStatus ? [f(`EBITDA adjustment of ${fmtM(a.inputs.ebitdaAdjustment)} entered as “${a.inputs.adjustmentStatus.replace("-", " ")}”. Adjusted EBITDA ${fmtM(v.adjustedEbitda)} versus reported ${fmtM(v.reportedEbitda)}.`)] : [miss("No EBITDA adjustments entered: adjusted EBITDA is taken as reported EBITDA. Unsupported one-offs can't be assessed.")]),
    ...(ind("revq").points != null && (ind("revq").points ?? 0) > 0 ? [hyp("Revenue growth that is not collected may reflect looser credit terms, customer concentration or revenue recognised ahead of billing. None of these is confirmed.")] : []),
    ...(ind("margin").points != null && (ind("margin").points ?? 0) > 0 ? [hyp("Margin erosion may come from pricing, mix or input costs; the data supplied does not say which.")] : []),
  ];

  // ---- 3 cash flow & working capital
  const tied = (d: number | null | undefined, base: number | null | undefined) => (d != null && base != null ? (d * base) / 365 : null);
  const dsoTie = tied(m.dso != null && pm?.dso != null ? m.dso - pm.dso : null, sales), dioTie = tied(m.dio != null && pm?.dio != null ? m.dio - pm.dio : null, c.cogs), dpoTie = tied(m.dpo != null && pm?.dpo != null ? m.dpo - pm.dpo : null, c.cogs);
  const s3: ReportItem[] = [
    f(e != null && c.operatingCashFlow != null ? `Operating cash flow was ${e > 0 ? fmtPct(c.operatingCashFlow / e, 0) : "n/m"} of EBITDA: ${fmtM(e - c.operatingCashFlow)} of EBITDA did not arrive as operating cash.` : "Cash conversion could not be computed."),
    ...(fcf != null ? [f(`Free cash flow ${fmtM(fcf)} after capex of ${fmtM(c.capex)}${fcf < 0 ? ": operating cash flow does not cover capex" : ""}.`)] : [miss("Capital expenditure not supplied: free cash flow can't be computed.")]),
    f(`Days: DSO ${fmtDays(pm?.dso ?? null)} → ${fmtDays(m.dso)}; DIO ${fmtDays(pm?.dio ?? null)} → ${fmtDays(m.dio)}; DPO ${fmtDays(pm?.dpo ?? null)} → ${fmtDays(m.dpo)}; cash conversion cycle ${fmtDays(pm?.ccc ?? null)} → ${fmtDays(m.ccc)}.`),
    ...(dsoTie != null && dsoTie > 0 ? [est(`Slower collections tie up about ${fmtM(dsoTie)} more cash than at last year's DSO.`)] : []),
    ...(dioTie != null && dioTie > 0 ? [est(`Slower stock turnover ties up about ${fmtM(dioTie)} more cash than at last year's DIO.`)] : []),
    ...(dpoTie != null && dpoTie < 0 ? [est(`Faster supplier payment uses about ${fmtM(-dpoTie)} more cash than at last year's DPO.`)] : []),
    ...[ind("owc"), ind("dso"), ind("dio"), ind("dpo")].filter((i) => i.points != null).map((i) => f(`${i.name}: ${i.actual} (${lvl(i)}).`)),
    ...(ind("owc").points == null ? [miss("Operating working capital needs receivables, inventory and payables; the cash it absorbs can't be measured.")] : []),
    ...(ind("res").points != null ? [est(`Stress case (revenue −10%, margin −3 pp, collections +15 days, interest +2 pp): ${ind("res").actual}. Illustrative, not a forecast.`)] : []),
    ...(a.records.length < 4 ? [miss("Annual year-end balances can hide intra-year swings; monthly working capital would show seasonality.")] : []),
  ];

  // ---- 4 cash release
  const base = sales, d0 = m.dso;
  const s4: ReportItem[] = [
    ...(base != null && d0 != null
      ? [
          ...[["Conservative", 8], ["Base", 15], ["Optimistic", 25]].map(([n, cut]) => est(`${n}: cutting DSO by ${cut} days (${fmtDays(d0)} → ${fmtDays(Math.max(0, d0 - (cut as number)))}) would release about ${fmtM(cashRelease(base, d0, Math.max(0, d0 - (cut as number))))}.`)),
          ...(dsoTie != null && dsoTie > 0 ? [est(`Returning DSO to last year's level (${fmtDays(pm?.dso ?? null)}) would release about ${fmtM(dsoTie)}.`)] : []),
        ]
      : [miss("Cash release needs sales and DSO.")]),
    ...(dioTie != null && dioTie > 0 ? [est(`Returning inventory days to last year's level would release about ${fmtM(dioTie)}.`)] : []),
    ...(v.wcExcess != null && v.wcExcess > 0 ? [est(`Working capital is ${fmtM(v.wcExcess)} higher than at last year's share of revenue: a possible normalised-working-capital (peg) discussion in the purchase agreement.`)] : []),
    asm("Releases are one-off, not recurring cash flow, and assume revenue stays constant. They are not guaranteed: achievability depends on customer terms, credit quality and stock mix."),
    hyp("Collections discipline and revised credit terms could be a post-deal value-creation lever, if the drivers of the slowdown are fixable."),
  ];

  // ---- 5 valuation & returns
  const s5: ReportItem[] = a.inputs.enterpriseValue == null
    ? [miss("No valuation inputs entered. Add the proposed enterprise value, equity and debt in Investment Risk Analysis → Valuation to see the entry multiple and returns."), f(`Adjusted EBITDA ${fmtM(v.adjustedEbitda)}; net debt ${fmtM(v.netDebt)}.`), asm("The risk score is deliberately not converted into an attractiveness score: price decides whether a risky company is attractive.")]
    : [
        f(`Proposed enterprise value ${fmtM(a.inputs.enterpriseValue)} = ${fmtX(v.entryMultiple, 1)} adjusted EBITDA${v.reportedMultiple != null && v.reportedMultiple !== v.entryMultiple ? ` (${fmtX(v.reportedMultiple, 1)} on reported)` : ""}.`),
        f(`Implied equity value ${fmtM(v.equityValue)} (enterprise value less net debt ${fmtM(v.netDebt)}).`),
        ...(v.normalisation ? [est(`Verified adjustments change EBITDA by ${fmtM(v.normalisation)}.`)] : [asm("Adjusted EBITDA equals reported EBITDA: no verified adjustments were entered.")]),
        ...(v.entryLeverage != null ? [f(`Acquisition debt ${fmtM(v.acquisitionDebt)}${v.debtDerived ? " (derived as EV − equity)" : ""} = ${fmtX(v.entryLeverage)} adjusted EBITDA.`)] : []),
        ...(v.fundingGap != null && Math.abs(v.fundingGap) > 0.05 ? [f(`Sources and uses differ by ${fmtM(Math.abs(v.fundingGap))}.`)] : []),
        ...(v.returns ? [asm(`Illustrative return: ${v.returns.holdYears}-year hold, EBITDA ${v.returns.growth.toFixed(1)}% a year (${v.returns.growthSource}), exit at ${fmtX(v.returns.exitMultiple, 1)} (${v.returns.exitMultipleSource}) gives ${v.returns.moic.toFixed(2)}x MOIC and ${v.returns.irr.toFixed(0)}% IRR. Not a forecast; ignores financing costs and tax.`)] : [miss("Returns need enterprise value, equity invested and positive adjusted EBITDA.")]),
        ...(risk.score != null && risk.score >= 50 ? [hyp("If the flagged cash-conversion issues are real, EBITDA-based pricing may overstate cash-generative capacity; a price or structure discussion could follow. To be tested, not concluded.")] : []),
      ];

  // ---- 6 risks & priorities
  const s6: ReportItem[] = [
    ...(flagged.length ? flagged.slice(0, 6).map((i, n) => f(`${n + 1}. ${i.name} — ${i.actual} (${lvl(i)}).`)) : [f("No indicator is rated High or Critical on the data supplied.")]),
    ...flagged.slice(0, 3).map((i) => asm(`Verify ${i.name}: ${(findings.find((x) => x.id === i.id)?.verify ?? i.questions.slice(0, 2)).join("; ")}.`)),
    ...inds.filter((i) => i.points == null).map((i) => miss(`${i.name} not assessed: needs ${i.requires.join(" and ").toLowerCase()}.`)),
    miss(`Only ${a.records.length} annual periods and year-end balances: no quarterly, seasonal or intra-year data.`),
    hyp("Every flagged item is a potential risk to investigate. None proves fraud, poor management or bad debt."),
  ];
  const qs = flagged.flatMap((i) => i.questions).filter((q, k, arr) => arr.indexOf(q) === k).slice(0, 8);

  return [
    { id: "summary", title: "Executive Investment Summary", question: "Financial health: Is the company financially stable?", items: s1 },
    { id: "earnings", title: "Financial Performance & Earnings Quality", question: "Earnings quality: Are reported profits sustainable?", items: s2, questions: qoe.questions },
    { id: "cash", title: "Cash Flow & Working Capital Analysis", question: "Cash position: Where is the company's cash getting trapped?", items: s3, questions: [...risk.categories[1].questions, ...risk.categories[2].questions].slice(0, 5) },
    { id: "release", title: "Cash Release & Value Creation Opportunities", question: "Value creation: How much cash could potentially be unlocked?", items: s4 },
    { id: "valuation", title: "Valuation & Investment Returns", question: "Investment attractiveness: Does the valuation justify the expected returns?", items: s5 },
    { id: "risks", title: "Investment Risks & Due Diligence Priorities", question: "Risk exposure: What should investors investigate before acquiring the company?", items: s6, questions: qs },
  ];
}
