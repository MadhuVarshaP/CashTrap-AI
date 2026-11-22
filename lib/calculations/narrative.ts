import type { AnalysisResult, Severity } from "@/types/finance";
import { fmtDays, fmtM, fmtPct, fmtX, growth, cur } from "@/lib/utilities/format";
import { cashRelease } from "./metrics";
import { buildFindings } from "./findings";
import { adjustedEbitda, allIndicators, levelName } from "./pe-risk";
import { buildBridge } from "./cashbridge";
import { BASE_CASE, DOWNSIDE_CASE, SEVERE_CASE, runCase } from "./scenarios";
import { dayValue, potentialRelease } from "./wc-release";
import { impact as sizeImpact, WHY } from "./findings";
import { resolveIndustry, fmtBench, benchRange, METRIC, type BenchMetric } from "@/lib/benchmarks/resolve";
import { scenarioReturns } from "./valuation";
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
  /** structured red flags (section 6) */
  flags?: RedFlag[];
}
export interface RedFlag {
  title: string;
  level: string;
  shows: string;
  matters: string;
  implication: string;
  investigate: string[];
}

const f = (text: string): ReportItem => ({ tag: "fact", text });
const est = (text: string): ReportItem => ({ tag: "estimate", text });
const asm = (text: string): ReportItem => ({ tag: "assumption", text });
const miss = (text: string): ReportItem => ({ tag: "missing", text });
const hyp = (text: string): ReportItem => ({ tag: "hypothesis", text });
const pctS = (g: number | null) => (g == null ? "n/a" : `${g >= 0 ? "+" : ""}${(g * 100).toFixed(1)}%`);

/**
 * Six-section investor report. Every section carries at least three substantive lines. Rules it follows: each statement
 * traces to uploaded data or a calculated output; the selected industry's benchmark is named wherever one exists and
 * "Industry Benchmark Unavailable" is stated where it does not; calculated findings (Fact, Estimate) stay apart from
 * assumptions and interpretations; no buy or reject recommendation.
 */
export function buildReport(a: AnalysisResult): ReportSection[] {
  const { risk, latest: m, previous: pm, latestRecord: c, previousRecord: p } = a;
  const ctx = resolveIndustry(a.inputs);
  const inds = allIndicators(risk);
  const ind = (id: string) => inds.find((i) => i.id === id)!;
  const findings = buildFindings(a, 3);
  const v = buildValuation(a);
  const rg = growth(c.revenue, p?.revenue ?? null), eg = growth(c.ebitda, p?.ebitda ?? null), og = growth(c.operatingCashFlow, p?.operatingCashFlow ?? null);
  const sales = c.creditSales ?? c.revenue;
  const e = adjustedEbitda(c, a.inputs, true);
  const fcf = c.operatingCashFlow != null && c.capex != null ? c.operatingCashFlow - c.capex : null;
  const flagged = inds.filter((i) => i.level === "High" || i.level === "Critical").sort((x, y) => (y.points ?? 0) - (x.points ?? 0));
  const lvl = (i: { level: Severity | null; points: number | null; max: number }) => `${levelName(i.level)}, ${i.points}/${i.max} pts`;
  const line = (i: ReturnType<typeof ind>) => i.applicable ? (i.points != null ? f(`${i.name}: ${i.actual} (${lvl(i)}). ${i.explanation}`) : miss(`${i.name}: Not Assessed. Needs ${i.requires.join(" and ").toLowerCase()}.`)) : miss(`${i.name}: Not Applicable to ${ctx.name}; excluded from the score.`);
  const bridge = buildBridge(a).find((b) => b.year === c.year);
  const lev = m.netDebt != null && e != null && e > 0 ? m.netDebt / e : null;

  /** company value against the selected industry's benchmark, or an honest statement that there is none */
  const vs = (metric: BenchMetric, value: number | null, label?: string): ReportItem => {
    const name = label ?? METRIC[metric].label;
    if (value == null) return miss(`${name}: company value not available, so no industry comparison can be made.`);
    if (!ctx.selected) return miss(`${name} is ${fmtBench(value, metric)}. No industry is selected, so there is no benchmark to compare it with.`);
    const b = ctx.bench(metric);
    if (b.status === "unavailable" || b.median == null) return miss(`${name} is ${fmtBench(value, metric)}. Industry Benchmark Unavailable for ${ctx.name}; the score uses a proposed screening threshold instead.`);
    const pos = b.low != null && value < b.low ? "below" : b.high != null && value > b.high ? "above" : "within";
    return f(`${name} is ${fmtBench(value, metric)} against a ${ctx.name} median of ${fmtBench(b.median, metric)} (typical range ${benchRange(b, metric)}): ${pos} the typical range. ${b.status === "custom" ? "Benchmark entered by the user." : `${b.tier} benchmark, ${b.geography}, ${b.year}; ${b.reliability}.`}`);
  };

  // ---- 1 executive investment assessment
  const s1: ReportItem[] = [
    f(risk.score == null ? `No overall score is shown: only ${risk.coverage}% of the applicable model could be assessed. ${risk.industry.focus}` : `Investment Risk Index ${risk.score}/100, classified ${risk.classification}, assessed on ${risk.coverage}% of the model that applies to ${ctx.name} (${risk.evaluated} of ${risk.total} applicable indicators${risk.notApplicable ? `; ${risk.notApplicable} not applicable` : ""}). Confidence in the score is ${risk.confidence.level}: ${risk.confidence.reasons.join("; ")}.`),
    ctx.selected ? f(`Industry basis: ${ctx.name}${ctx.subName ? ` (${ctx.subName})` : ""}. ${risk.industry.focus}`) : asm("No industry was selected, so generic proposed screening thresholds were applied and no industry comparison is possible."),
    vs("ebitdaMargin", m.ebitdaMargin == null ? null : m.ebitdaMargin * 100, "EBITDA margin"),
    f(`FY${c.year}: revenue ${fmtM(c.revenue)} (${pctS(rg)}), EBITDA ${fmtM(c.ebitda)} (${pctS(eg)}), operating cash flow ${fmtM(c.operatingCashFlow)} (${pctS(og)}). ${e != null && c.operatingCashFlow != null && e > 0 ? `Operating cash flow was ${fmtPct(c.operatingCashFlow / e, 0)} of adjusted EBITDA.` : ""}`),
    f(m.netDebt != null ? (m.netDebt <= 0 ? `Net cash position of ${fmtM(-m.netDebt)}.` : `Net debt ${fmtM(m.netDebt)}${lev != null ? `, ${fmtX(lev)} adjusted EBITDA` : ""}.`) : "Net debt could not be computed from the supplied data."),
    ...(findings.length ? [f(`Most important concerns, largest first: ${findings.map((x) => x.title.toLowerCase()).join("; ")}.`), ...findings.map((x) => x.impact ? est(`${x.title}: ${x.impact}.`) : f(`${x.title}: ${x.evidence}.`))] : [f("No applicable indicator scored risk points on the data supplied.")]),
    asm("Investment risk and investment attractiveness are separate questions. The score is not a probability of failure, and this report makes no buy or reject recommendation."),
    ...(risk.coverage < 100 ? [miss(`${100 - risk.coverage}% of the applicable model could not be assessed because data was not supplied; the score is incomplete.`)] : []),
  ];

  // ---- 2 quality of earnings and cash flow
  const adjSt = a.inputs.adjustmentStatus;
  const s2: ReportItem[] = [
    f(`Revenue ${fmtM(p?.revenue)} → ${fmtM(c.revenue)} (${pctS(rg)}); reported EBITDA ${fmtM(p?.ebitda)} → ${fmtM(c.ebitda)} (${pctS(eg)}); EBITDA margin ${fmtPct(pm?.ebitdaMargin ?? null)} → ${fmtPct(m.ebitdaMargin)}.`),
    ...(adjSt && a.inputs.ebitdaAdjustment != null ? [f(`EBITDA adjustment of ${fmtM(a.inputs.ebitdaAdjustment)} entered as “${adjSt.replace("-", " ")}”. ${adjSt === "verified" ? `Adjusted EBITDA is ${fmtM(v.adjustedEbitda)} versus reported ${fmtM(v.reportedEbitda)}.` : "It is not counted: adjusted EBITDA equals reported EBITDA until it is verified."}`)] : [miss("No EBITDA adjustments entered: adjusted EBITDA is taken as reported EBITDA, and unsupported one-offs cannot be assessed.")]),
    e != null && c.operatingCashFlow != null ? f(e > 0 ? `EBITDA-to-operating-cash conversion is ${fmtPct(c.operatingCashFlow / e, 0)}: ${fmtM(e - c.operatingCashFlow)} of adjusted EBITDA did not arrive as operating cash. ${ind("ocf").bench?.status === "unavailable" ? "Industry Benchmark Unavailable for cash conversion; it is scored on a proposed screening threshold (" + ind("ocf").benchmark + ")." : ""}` : "EBITDA is not positive, so cash conversion is not meaningful.") : miss("Cash conversion could not be computed."),
    ...(fcf != null ? [f(`Free cash flow is ${fmtM(fcf)} after capex of ${fmtM(c.capex)}${fcf < 0 ? ": operating cash flow does not cover capex, so the business is consuming cash after investment" : ""}.`)] : [miss("Capital expenditure not supplied: free cash flow cannot be computed.")]),
    ...(bridge && bridge.gap != null ? [f(`EBITDA-to-cash bridge FY${bridge.year}: the ${fmtM(bridge.gap)} cash gap splits into working-capital movement ${fmtM(bridge.wcIncrease)}, cash taxes ${bridge.taxes == null ? "not supplied" : fmtM(bridge.taxes)}, cash interest ${bridge.interest == null ? "not supplied" : fmtM(bridge.interest)} and other ${fmtM(bridge.drivers[3].value)}. Only the working-capital line is working capital.`)] : []),
    ...["adj", "revq", "margin", "vol", "ocf", "fcf", "cons"].map(ind).filter((i) => i.applicable && i.points != null && i.points > 0).map(line),
    ...((ind("revq").points ?? 0) > 0 ? [hyp("Interpretation, not a calculated finding: revenue growth that is not collected may reflect looser credit terms, customer concentration or revenue recognised ahead of billing.")] : []),
  ];

  // ---- 3 working capital and cash release
  const tied = (d: number | null | undefined, base: number | null | undefined) => (d != null && base != null ? (d * base) / 365 : null);
  const dsoTie = tied(m.dso != null && pm?.dso != null ? m.dso - pm.dso : null, sales), dioTie = tied(m.dio != null && pm?.dio != null ? m.dio - pm.dio : null, c.cogs);
  const rel = potentialRelease(a);
  const s3: ReportItem[] = [
    f(`Days: DSO ${fmtDays(pm?.dso ?? null)} → ${fmtDays(m.dso)}; DIO ${fmtDays(pm?.dio ?? null)} → ${fmtDays(m.dio)}; DPO ${fmtDays(pm?.dpo ?? null)} → ${fmtDays(m.dpo)}; cash conversion cycle ${fmtDays(pm?.ccc ?? null)} → ${fmtDays(m.ccc)}.`),
    vs("dso", m.dso, "DSO"),
    ctx.relevance("dio") === "na" ? miss(`Inventory days (DIO) are Not Applicable to ${ctx.name}.`) : vs("dio", m.dio, "DIO"),
    vs("dpo", m.dpo, "DPO"),
    vs("ccc", m.ccc, "Cash conversion cycle (diagnostic, not scored)"),
    ...["dso", "dio", "dpo", "owc"].map(ind).filter((i) => i.applicable && i.points != null && (i.points ?? 0) > 0).map(line),
    ...(dsoTie != null && dsoTie > 0 ? [est(`Slower collections tie up about ${fmtM(dsoTie)} more cash than at last year's DSO.`)] : []),
    ...(dioTie != null && dioTie > 0 ? [est(`Slower stock turnover ties up about ${fmtM(dioTie)} more cash than at last year's DIO.`)] : []),
    ...(rel.total != null && rel.total > 0 ? [est(`Returning DSO and DIO to FY${p?.year} levels would release about ${fmtM(rel.total)} (receivables ${fmtM(rel.receivables)}, inventory ${fmtM(rel.inventory)}). One-off cash, not guaranteed.`)] : []),
    ...(sales != null && m.dso != null ? [est(`Cutting DSO by 15 days would release about ${fmtM(dayValue(sales) * Math.min(15, m.dso))}; each day of DSO is worth ${fmtM(dayValue(sales), 2)}.`)] : []),
    ...(v.wcExcess != null && v.wcExcess > 0 ? [est(`Working capital is ${fmtM(v.wcExcess)} above last year's share of revenue: a possible normalised-working-capital (peg) discussion in the purchase agreement.`)] : []),
    asm("Operational constraints: releases hold revenue and purchases constant, are one-off, and depend on customer terms, credit quality, stock mix and supplier agreements. Stretching payables can strain supplier relationships and is shown as an option, not a recommendation."),
    ...(c.creditPurchases == null ? [asm("Annual purchases were not supplied, so DPO is measured on COGS.")] : []),
  ];

  // ---- 4 debt, liquidity and financial risk
  const s4: ReportItem[] = [
    f(c.debt != null && c.cash != null ? `Total debt ${fmtM(c.debt)}, cash ${fmtM(c.cash)}, net debt ${fmtM(c.debt - c.cash)}${lev != null ? `: ${fmtX(lev)} adjusted EBITDA` : ""}.` : "Debt and cash were not both supplied, so net debt cannot be computed."),
    ctx.relevance("lev") === "na" ? miss(`Net debt / EBITDA is Not Applicable to ${ctx.name}.`) : vs("debtEbitda", lev, "Net debt / adjusted EBITDA (the benchmark is gross debt incl. leases, so this comparison is conservative)"),
    ctx.relevance("int") === "na" ? miss(`Interest coverage is Not Applicable to ${ctx.name}.`) : vs("intCover", c.interestExpense && c.interestExpense > 0 && e != null ? e / c.interestExpense : null, "Interest coverage on EBITDA (the benchmark is EBIT-based, so the company figure runs higher)"),
    ...["lev", "int", "dscr", "mat", "liqr"].map(ind).filter((i) => i.applicable).map(line),
    ...(v.postLeverage != null ? [f(`Post-deal: net debt ${fmtM(v.postNetDebt)} (existing net debt + proposed acquisition debt − cash used) is ${fmtX(v.postLeverage)} adjusted EBITDA.`)] : [miss("No acquisition financing entered, so post-deal leverage is unavailable.")]),
    ...(c.principalRepayment == null ? [miss("Scheduled principal repayment not supplied: debt service coverage and maturity risk are limited.")] : []),
  ];

  // ---- 5 stress and valuation
  const base = runCase(a, BASE_CASE), down = runCase(a, DOWNSIDE_CASE), sev = runCase(a, SEVERE_CASE);
  const fx = (o: typeof base) => `adjusted EBITDA ${fmtM(o.adjustedEbitda)}, operating cash flow ${fmtM(o.ocf)}, free cash flow ${fmtM(o.fcf)}, interest cover ${fmtX(o.interestCover, 1)}, net debt/EBITDA ${fmtX(o.netDebtToEbitda)}, DSCR ${fmtX(o.dscr)}, cash shortfall ${o.shortfall == null ? "—" : o.shortfall === 0 ? "none" : fmtM(o.shortfall)}`;
  const vr = v.returns;
  const rDown = vr ? scenarioReturns(a, vr.growth - 5, vr.holdYears, Math.max(0.5, vr.exitMultiple - 1), "scenario") : null;
  const rUp = vr ? scenarioReturns(a, vr.growth + 3, vr.holdYears, vr.exitMultiple + 1, "scenario") : null;
  const s5: ReportItem[] = [
    asm("Scenario analysis only: hypothetical results built on the latest actual year, not forecasts. Assumptions are editable on the Stress Testing page."),
    est(`Base case (FY${c.year} held constant): ${fx(base)}.`),
    est(`Downside case (revenue −${DOWNSIDE_CASE.revenueDrop}%, margin −${DOWNSIDE_CASE.marginDrop} pp, DSO +${DOWNSIDE_CASE.dsoIncrease}d, DIO +${DOWNSIDE_CASE.dioIncrease}d, rates +${DOWNSIDE_CASE.interestRise} pp): ${fx(down)}.`),
    est(`Severe stress case (revenue −${SEVERE_CASE.revenueDrop}%, margin −${SEVERE_CASE.marginDrop} pp, DSO +${SEVERE_CASE.dsoIncrease}d, DIO +${SEVERE_CASE.dioIncrease}d, rates +${SEVERE_CASE.interestRise} pp): ${fx(sev)}.`),
    ...(sev.shortfall != null && sev.shortfall > 0 ? [est(`Under the severe case operating cash flow falls short of capex and scheduled principal by ${fmtM(sev.shortfall)}${sev.uncovered != null && sev.uncovered > 0 ? `, ${fmtM(sev.uncovered)} of it not covered by cash on hand` : ""}: external funding would be needed.`)] : []),
    ...(v.enterpriseValue != null ? [f(`Proposed enterprise value ${fmtM(v.enterpriseValue)} = ${fmtX(v.entryMultiple, 1)} adjusted EBITDA; implied equity value ${fmtM(v.equityValue)} after existing net debt of ${fmtM(v.netDebt)}.`)] : [miss("No enterprise value or entry multiple entered, so entry valuation is unavailable.")]),
    ...(vr ? [asm(`Illustrative base return: ${vr.holdYears}-year hold, EBITDA growth ${vr.growth.toFixed(1)}% a year, exit at ${fmtX(vr.exitMultiple, 1)} gives ${vr.moic.toFixed(2)}x MOIC and ${vr.irr.toFixed(0)}% IRR. Downside (growth −5 pp, exit −1.0x): ${rDown ? `${rDown.moic.toFixed(2)}x / ${rDown.irr.toFixed(0)}%` : "n/a"}; upside (growth +3 pp, exit +1.0x): ${rUp ? `${rUp.moic.toFixed(2)}x / ${rUp.irr.toFixed(0)}%` : "n/a"}. Not a forecast; ignores financing costs and tax.`)] : [miss("Returns need an enterprise value, equity invested and positive adjusted EBITDA.")]),
    ...[...new Set([...down.notes, ...sev.notes])].map((n) => miss(n)),
  ];

  // ---- 6 red flags and actions
  const flags: RedFlag[] = flagged.slice(0, 6).map((i) => ({
    title: i.name,
    level: levelName(i.level),
    shows: `${i.actual}${i.previous !== "—" ? ` (prior: ${i.previous})` : ""}. ${i.explanation}${i.bench && i.bench.status !== "unavailable" ? ` Industry median ${i.bench.median}, typical range ${i.bench.range}.` : ""}`,
    matters: WHY[i.id]?.why ?? "Weakens the reliability of the earnings or cash flow being acquired.",
    implication: sizeImpact(a, i.id) ?? `Cannot be sized in ${cur()} from the supplied data.`,
    investigate: [...(WHY[i.id]?.verify ?? []), ...i.questions.slice(0, 1)],
  }));
  const qs = [...flagged.flatMap((i) => i.questions), ...risk.categories.flatMap((k) => k.questions)].filter((q, k, arr) => arr.indexOf(q) === k).slice(0, 8);
  const unass = inds.filter((i) => i.applicable && i.points == null);
  const s6: ReportItem[] = [
    flags.length ? f(`${flagged.length} applicable indicator${flagged.length > 1 ? "s are" : " is"} rated High or Critical; the ${flags.length} largest are set out below with what each shows, why it matters, its potential financial implication and what to verify.`) : f("No applicable indicator is rated High or Critical on the data supplied."),
    hyp("Interpretation, not a calculated finding: every flagged item is a potential risk to investigate. None proves fraud, poor management or bad debt."),
    ...unass.map((i) => miss(`${i.name}: Not Assessed. Needs ${i.requires.join(" and ").toLowerCase()}. Obtain this before relying on the score.`)),
    ...(a.inputs.adjustmentStatus !== "verified" ? [miss("EBITDA adjustments are not verified, so adjusted EBITDA may differ from the figure a buyer would underwrite.")] : []),
    miss(`Only ${a.records.length} annual period${a.records.length === 1 ? "" : "s"} and year-end balances: no quarterly, seasonal or intra-year data, and customer concentration, contract terms and one-off items cannot be assessed from statements alone.`),
    asm("Recommended due diligence actions follow the order of risk points; the questions below ask for evidence and do not presume a finding."),
  ];

  return [
    { id: "summary", title: "Executive Investment Assessment", question: "Is the target financially healthy relative to its industry, and what matters most?", items: s1 },
    { id: "earnings", title: "Quality of Earnings and Cash Flow", question: "Are reported earnings supported by actual cash generation?", items: s2, questions: risk.categories[0].questions },
    { id: "wc", title: "Working Capital and Cash Release Opportunities", question: "Where is cash trapped, and how much could potentially be released?", items: s3, questions: risk.categories[2].questions },
    { id: "debt", title: "Debt, Liquidity and Financial Risk", question: "Can the company carry its debt and meet short-term obligations?", items: s4, questions: [...risk.categories[3].questions, ...risk.categories[4].questions].slice(0, 4) },
    { id: "stress", title: "Acquisition Stress Test and Valuation", question: "How resilient is the company under stress, and what does the price imply?", items: s5 },
    { id: "flags", title: "Critical Red Flags and Recommended Due Diligence Actions", question: "What should be verified before committing capital?", items: s6, flags, questions: qs },
  ];
}
