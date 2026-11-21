import type { AnalysisResult } from "@/types/finance";
import { fmtDays, fmtM, fmtPct, fmtX, growth } from "@/lib/utilities/format";
import { cashRelease } from "./metrics";

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
  if (risk.evaluated < risk.total) points.push(`Only ${risk.evaluated} of ${risk.total} indicators could be evaluated; the score is normalised and should be read as incomplete.`);
  return { headline, points };
}

export interface ReportSection {
  id: string;
  title: string;
  evidence: string[];     // verified, from the calculation engine
  explanations: string[]; // possible explanations, not verified
  questions?: string[];
}

export function buildReport(a: AnalysisResult, targetDsoDays = 15): ReportSection[] {
  const { risk, latest: m, previous: pm, latestRecord: c, previousRecord: p, alerts } = a;
  const rg = growth(c.revenue, p?.revenue ?? null);
  const recG = growth(c.receivables, p?.receivables ?? null), invG = growth(c.inventory, p?.inventory ?? null);
  const eg = growth(c.ebitda, p?.ebitda ?? null), og = growth(c.operatingCashFlow, p?.operatingCashFlow ?? null);
  const salesBase = c.creditSales ?? c.revenue; // same base DSO was measured on
  const rel = salesBase != null && m.dso != null ? cashRelease(salesBase, m.dso, Math.max(0, m.dso - targetDsoDays)) : null;
  const gaps = [...a.missingFields];
  const pctS = (g: number | null) => (g == null ? "n/a" : `${g >= 0 ? "+" : ""}${(g * 100).toFixed(1)}%`);

  return [
    { id: "summary", title: "Executive Investment Risk Summary",
      evidence: [`Screening score: ${risk.score ?? "n/a"}/100 (${risk.classification}); ${risk.evaluated}/${risk.total} indicators evaluated.`, ...alerts.slice(0, 3).map((x) => `${x.name} — ${x.evidence}`)],
      explanations: ["The pattern is consistent with growth being funded by working capital rather than by cash generation. This is a hypothesis for the investment team to test, not a conclusion."] },
    { id: "score", title: "Overall Risk Score and Classification",
      evidence: risk.categories.map((x) => `${x.name}: ${x.points == null ? "not evaluated" : `${x.points}/${x.max}`}`),
      explanations: ["Thresholds are illustrative screening bands (0–24 Low, 25–49 Moderate, 50–74 High, 75–100 Critical), not industry standards."] },
    { id: "findings", title: "Key Financial Findings",
      evidence: alerts.length ? alerts.map((x) => `[${x.severity}] ${x.name}: ${x.evidence}`) : ["No automated signals were triggered."],
      explanations: ["Each finding is a potential risk requiring investigation. None proves fraud, poor management or bad debt."] },
    { id: "wc", title: "Receivables and Inventory Analysis",
      evidence: [`Receivables ${fmtM(p?.receivables ?? null)} → ${fmtM(c.receivables)} (${pctS(recG)}) vs revenue ${pctS(rg)}.`, `Inventory ${fmtM(p?.inventory ?? null)} → ${fmtM(c.inventory)} (${pctS(invG)}).`, `DSO ${fmtDays(pm?.dso ?? null)} → ${fmtDays(m.dso)}; DIO ${fmtDays(pm?.dio ?? null)} → ${fmtDays(m.dio)}.`],
      explanations: ["Slower collections, looser credit terms, concentration in a few customers, or stock built ahead of expected demand could each contribute.", "Slow-moving or obsolete inventory would imply possible write-downs."],
      questions: risk.categories.filter((x) => x.id === "receivables" || x.id === "inventory").flatMap((x) => x.questions) },
    { id: "pcf", title: "Profitability versus Cash Flow Analysis",
      evidence: [`EBITDA ${fmtM(p?.ebitda ?? null)} → ${fmtM(c.ebitda)} (${pctS(eg)}).`, `Operating cash flow ${fmtM(p?.operatingCashFlow ?? null)} → ${fmtM(c.operatingCashFlow)} (${pctS(og)}).`, `Cash conversion ${fmtPct(pm?.cashConversion ?? null)} → ${fmtPct(m.cashConversion)}.`],
      explanations: ["Working-capital absorption is the most direct explanation, but revenue recognition timing, capitalised costs or one-off items should be ruled out."],
      questions: risk.categories.filter((x) => x.id === "conversion" || x.id === "divergence").flatMap((x) => x.questions) },
    { id: "leverage", title: "Leverage Analysis",
      evidence: [`Debt ${fmtM(c.debt)}, cash ${fmtM(c.cash)}, net debt ${fmtM(m.netDebt)}.`, `Net debt / EBITDA ${fmtX(pm?.netDebtToEbitda ?? null)} → ${fmtX(m.netDebtToEbitda)}.`],
      explanations: ["Leverage that looks moderate on EBITDA may be heavier when measured against operating cash flow."],
      questions: risk.categories.find((x) => x.id === "leverage")?.questions },
    { id: "release", title: "Potential Cash Release Opportunities",
      evidence: rel == null ? ["Cash release cannot be estimated without revenue and DSO."] : [`Reducing DSO by ${targetDsoDays} days (${fmtDays(m.dso)} → ${fmtDays((m.dso as number) - targetDsoDays)}) would illustratively release about ${fmtM(rel)}.`],
      explanations: ["This is an illustrative working-capital estimate, not guaranteed cash recovery or additional profit. Achievability depends on customer terms and credit quality."] },
    { id: "implications", title: "Potential Investment Implications",
      evidence: [`Cash conversion of ${fmtPct(m.cashConversion, 0)} may reduce funds available for debt service or capex.`],
      explanations: ["Valuation based on EBITDA multiples may overstate cash-generative capacity.", "A normalised working-capital target in any purchase agreement could be a negotiation point.", "Post-deal, working-capital improvement might be a value-creation lever, if the underlying drivers are fixable."] },
    { id: "limits", title: "Missing Information and Data Limitations",
      evidence: [gaps.length ? `Missing fields: ${gaps.join(", ")}.` : "No missing fields in the supplied data.", a.metrics.some((x) => x.approximate) ? "Earliest-year working-capital metrics use closing balances only and are approximate." : "Average balances were used throughout.", `${a.records.length} annual periods analysed; no quarterly or seasonal data.`],
      explanations: ["Year-end balances can hide intra-year swings. Credit sales and purchases were not supplied, so revenue and COGS were used as proxies."] },
    { id: "questions", title: "Questions to Ask Company Management",
      evidence: [], explanations: [], questions: Array.from(new Set(alerts.flatMap((x) => x.investigate.map((i) => `Please provide / explain: ${i}.`)))).slice(0, 10) },
    { id: "rec", title: "Due Diligence Recommendation",
      evidence: [`Overall screening result: ${risk.classification}.`],
      explanations: ["This report is decision support for the investment team. It neither recommends investing nor rejecting the company. Prioritise a detailed working-capital and quality-of-earnings review before proceeding."] },
  ];
}
