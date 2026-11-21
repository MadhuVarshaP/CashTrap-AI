import type { AnalysisResult } from "@/types/finance";
import { fmtDays, fmtM, fmtPct, fmtX } from "@/lib/utilities/format";

/** Compact, plain-text summary of the active company's analysis. Shared by the built-in answers and the optional LLM route. */
export function buildContext(name: string, a: AnalysisResult | null): string {
  if (!a) return `Active company: ${name}. No analysis has been run yet.`;
  const L = a.latest, P = a.previous, r = a.latestRecord;
  const lines = [
    `Company: ${name}. Figures in AED millions. Latest year FY${L.year}${P ? `, prior FY${P.year}` : ""}.`,
    `Risk score: ${a.risk.score == null ? "insufficient data" : `${Math.round(a.risk.score)}/100 (${a.risk.classification})`}; ${a.risk.evaluated}/${a.risk.total} indicators evaluated.`,
    `Latest: revenue ${fmtM(r.revenue)}, EBITDA ${fmtM(r.ebitda)}, operating cash flow ${fmtM(r.operatingCashFlow)}, cash ${fmtM(r.cash)}, debt ${fmtM(r.debt)}.`,
    `DSO ${fmtDays(L.dso)} (prior ${fmtDays(P?.dso ?? null)}); DIO ${fmtDays(L.dio)} (prior ${fmtDays(P?.dio ?? null)}); DPO ${fmtDays(L.dpo)} (prior ${fmtDays(P?.dpo ?? null)}); CCC ${fmtDays(L.ccc)} (prior ${fmtDays(P?.ccc ?? null)}).`,
    `Cash conversion (OCF/EBITDA) ${fmtPct(L.cashConversion)} (prior ${fmtPct(P?.cashConversion ?? null)}); net debt ${fmtM(L.netDebt)}; net debt/EBITDA ${fmtX(L.netDebtToEbitda)}.`,
    "Risk breakdown: " + a.risk.categories.map((c) => `${c.name} ${c.points == null ? "n/a" : `${c.points}/${c.max}`} (${c.severity})`).join("; ") + ".",
    a.alerts.length ? "Alerts: " + a.alerts.map((x) => `${x.severity} - ${x.name} (${x.evidence})`).join("; ") + "." : "No alerts triggered.",
    a.missingFields.length ? `Missing fields: ${a.missingFields.slice(0, 12).join(", ")}.` : "No missing fields.",
  ];
  return lines.join("\n");
}
