import type { AnalysisResult } from "@/types/finance";
import { cashRelease } from "@/lib/calculations/metrics";
import { fmtDays, fmtM, fmtPct, fmtX } from "@/lib/utilities/format";

export const SUGGESTIONS = ["Why is the risk score what it is?", "What are the biggest red flags?", "Explain DSO, DIO and DPO", "How much cash could we release?", "How are the weights split?", "How do I upload a file?"];

const has = (q: string, ...w: string[]) => w.some((x) => q.includes(x));
const sev = { Critical: "🔴", High: "🟠", Medium: "🟡", Low: "🟢" } as const;

/**
 * Rule-based answers grounded in the active analysis. No network, no key:
 * every number comes from the calculation engine, so it matches the dashboard.
 */
export function localAnswer(question: string, name: string, a: AnalysisResult | null): string {
  const q = question.toLowerCase();

  if (has(q, "upload", "file", "import", "csv", "xlsx", "excel", "format"))
    return "Go to **Company Analysis** and drop a file in the upload box. Accepted: a flat table (Year, Revenue, COGS, EBITDA, Receivables, Inventory, Payables, Operating_Cash_Flow, Cash, Debt), a workbook with *Income Statement* + *Balance Sheet* sheets, or an **S&P Capital IQ Financial Highlights** export. Max 5 MB, at least two years. Then press **Run analysis**.";
  if (has(q, "weight", "split", "100 pt", "points"))
    return "The 100 points are split unequally by how much each signal says about cash risk: **Profit-to-cash 25**, **Receivables 20**, **EBITDA vs OCF divergence 20**, **Inventory 15**, **Cash conversion cycle 10**, **Leverage 10**. They sum to 100, so points = %. If an indicator can't be computed, the rest are rescaled to 100%. Full detail is in *Methodology* and docs/CALCULATIONS.md.";
  if (has(q, "dso", "dio", "dpo", "ccc", "days", "cycle", "working capital")) {
    const base = "**DSO** = avg receivables ÷ credit sales × 365 (how long customers take to pay). **DIO** = avg inventory ÷ COGS × 365 (how long stock sits). **DPO** = avg payables ÷ COGS × 365 (how long you take to pay suppliers). **CCC** = DSO + DIO − DPO: the days cash is tied up.";
    return a ? `${base}\n\nFor **${name}** (FY${a.latest.year}): DSO ${fmtDays(a.latest.dso)}, DIO ${fmtDays(a.latest.dio)}, DPO ${fmtDays(a.latest.dpo)}, CCC ${fmtDays(a.latest.ccc)}.` : base;
  }
  if (!a) return `I can answer questions about the active company, **${name}**, once it has been analysed. Open **Company Analysis**, upload or pick data, and press **Run analysis**. I can also explain the methodology or the upload formats.`;

  const L = a.latest, P = a.previous, rk = a.risk;

  if (has(q, "release", "unlock", "free up", "cash trapped", "target dso", "calculator")) {
    const base = a.latestRecord.creditSales ?? a.latestRecord.revenue;
    if (L.dso == null || base == null) return "I can't size the release because DSO or sales is missing for the latest year.";
    const rel = cashRelease(base, L.dso, Math.max(0, L.dso - 15));
    return `Cutting DSO by 15 days (${fmtDays(L.dso)} → ${fmtDays(L.dso - 15)}) would release about **${fmtM(rel)}** of cash: (sales ÷ 365) × days saved. Try other targets in **Cash Impact Calculator**.`;
  }
  if (has(q, "alert", "flag", "warning", "signal", "concern", "worry")) {
    if (!a.alerts.length) return `No alerts triggered for ${name}. Metrics are within the screening thresholds.`;
    return `**${a.alerts.length} signal${a.alerts.length > 1 ? "s" : ""} for ${name}:**\n` + a.alerts.slice(0, 6).map((x) => `${sev[x.severity]} **${x.name}**: ${x.evidence}`).join("\n") + "\n\nOpen **Investment Assessment** for the diligence questions behind each.";
  }
  if (has(q, "leverage", "debt", "net debt", "borrow"))
    return `Net debt is **${fmtM(L.netDebt)}**, i.e. **${fmtX(L.netDebtToEbitda)}** EBITDA (debt ${fmtM(a.latestRecord.debt)}, cash ${fmtM(a.latestRecord.cash)}). ${L.netDebtToEbitda != null && L.netDebtToEbitda > 3 ? "Above 3x is a stretched balance sheet." : L.netDebtToEbitda != null && L.netDebtToEbitda < 0 ? "Net cash position." : "Within a typical range."}`;
  if (has(q, "conversion", "ocf", "operating cash", "ebitda", "profit to cash", "profit-to-cash"))
    return `Cash conversion (OCF ÷ EBITDA) is **${fmtPct(L.cashConversion)}** in FY${L.year}${P ? ` versus ${fmtPct(P.cashConversion)} in FY${P.year}` : ""}. EBITDA ${fmtM(a.latestRecord.ebitda)}, operating cash flow ${fmtM(a.latestRecord.operatingCashFlow)}. Below ~70% means profit isn't turning into cash.`;
  if (has(q, "missing", "data quality", "complete"))
    return a.missingFields.length ? `Missing values: ${a.missingFields.slice(0, 10).join(", ")}. Dependent indicators are marked unavailable (never treated as zero).` : "No missing fields in the supplied data.";
  if (has(q, "recommend", "invest", "should", "verdict", "decision", "conclusion"))
    return `${name} screens as **${rk.classification}**${rk.score != null ? ` (${Math.round(rk.score)}/100)` : ""}. ${rk.classification === "High Risk" || rk.classification === "Critical Risk" ? "I'd hold the investment decision until the flagged items are explained (ageing, stock, collections)." : "No major cash trap shows up in the numbers, but confirm with detailed diligence."} This is a screening aid, not investment advice. See **Due Diligence Report** for the full write-up.`;
  if (has(q, "why", "score", "risk", "rating", "classif", "breakdown", "driver")) {
    const top = [...rk.categories].filter((c) => c.points != null).sort((x, y) => (y.points ?? 0) / y.max - (x.points ?? 0) / x.max).slice(0, 3);
    return `**${name}: ${rk.score == null ? "insufficient data" : `${Math.round(rk.score)}/100, ${rk.classification}`}** (${rk.evaluated} of ${rk.total} indicators evaluated${a.previousScore != null ? `; previously ${Math.round(a.previousScore)}` : ""}).\nBiggest drivers:\n` + top.map((c) => `• **${c.name}** ${c.points}/${c.max} (${c.severity}): ${c.evidence}`).join("\n");
  }
  if (has(q, "revenue", "sales", "growth", "margin"))
    return `FY${L.year} revenue is **${fmtM(a.latestRecord.revenue)}**${P && a.previousRecord?.revenue ? `, vs ${fmtM(a.previousRecord.revenue)} in FY${P.year}` : ""}. EBITDA margin ${fmtPct(L.ebitdaMargin)}.`;
  if (/\b(hi|hello|hey|help)\b|what can/.test(q))
    return `Hi! I can explain **${name}**'s risk score, red flags, DSO/DIO/DPO, cash conversion, leverage and cash release, plus the methodology and upload formats. Pick a suggestion below or just ask.`;

  return `I'm not sure about that one. Try asking about the **risk score**, **red flags**, **DSO/DIO/DPO**, **cash conversion**, **leverage**, **cash release**, **weights** or **uploading a file**.`;
}
