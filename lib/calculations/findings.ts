import type { AnalysisResult, Indicator } from "@/types/finance";
import { fmtM, fmtPct, fmtX } from "@/lib/utilities/format";
import { allIndicators } from "./pe-risk";
import { buildValuation } from "./valuation";

export interface Finding {
  id: string;
  title: string;
  level: Indicator["level"];
  points: number;
  max: number;
  /** actual figures from the engine */
  evidence: string;
  why: string;
  /** AED / % impact where it can be sized from the data; null when it can't */
  impact: string | null;
  verify: string[];
  questions: string[];
}

const WHY: Record<string, { why: string; verify: string[] }> = {
  adj: { why: "Adjusted EBITDA sets the price. Every unsupported dirham of adjustment is multiplied by the entry multiple.", verify: ["Adjustment bridge with source documents", "Prior-year adjustments to test recurrence", "Independent quality-of-earnings review"] },
  revq: { why: "Revenue that isn't collected inflates growth without adding cash and may carry credit-loss risk.", verify: ["Receivables ageing by customer", "Post year-end cash receipts", "Credit notes and disputed invoices"] },
  margin: { why: "A shrinking margin means each dirham of revenue produces less profit, which lowers the value of the earnings being bought.", verify: ["Margin bridge by product and customer", "Input-cost and pricing history"] },
  vol: { why: "Unstable earnings make the EBITDA being capitalised less reliable.", verify: ["Monthly EBITDA for three years", "One-off and project items by year"] },
  ocf: { why: "EBITDA that doesn't convert to cash can't service debt, fund capex or pay returns.", verify: ["EBITDA-to-cash reconciliation", "Working-capital movements by line"] },
  fcf: { why: "Free cash flow is what's left for lenders and equity after the business reinvests.", verify: ["Capex split: maintenance versus growth", "Committed capex for the next two years"] },
  cons: { why: "Cash flow that is erratic or doesn't follow EBITDA signals low-quality earnings or timing games.", verify: ["Quarterly cash flow for three years", "Year-end working-capital behaviour"] },
  dso: { why: "Slower collections lock cash up in customers' hands and raise bad-debt exposure.", verify: ["Receivables ageing report", "Top-10 customer balances and credit limits", "Collections after year-end"] },
  dio: { why: "Rising stock days can hide slow-moving or obsolete items that later need write-downs.", verify: ["SKU-level inventory ageing", "Provision policy and write-off history", "Open purchase commitments"] },
  dpo: { why: "Stretching suppliers props up cash flow temporarily; it can reverse and strain supply.", verify: ["Payables ageing", "Supplier terms and any financing programmes"] },
  owc: { why: "If growth consumes more working capital than it earns, the business needs funding as it expands.", verify: ["Monthly working-capital trend", "Normalised working-capital level for the SPA peg"] },
  lev: { why: "Leverage narrows the room for error; acquisition debt will add to it.", verify: ["Debt schedule and covenants", "Pro-forma leverage after the deal"] },
  int: { why: "Thin interest cover leaves little protection if earnings dip or rates rise.", verify: ["Rate terms: fixed or floating", "Hedging in place"] },
  dscr: { why: "If cash flow can't cover scheduled repayments, the company must refinance or draw on cash.", verify: ["Repayment schedule for three years", "Refinancing plans"] },
  mat: { why: "Debt falling due soon creates refinancing risk at an inconvenient time.", verify: ["Facility maturity ladder", "Evidence of renewal intentions from lenders"] },
  liqr: { why: "Low liquid assets relative to short-term obligations leave little buffer.", verify: ["Committed undrawn facilities", "Minimum operating cash requirement"] },
  down: { why: "Shows how quickly leverage deteriorates if sales and margins fall.", verify: ["Fixed versus variable cost split", "Covenant levels at stressed EBITDA"] },
  res: { why: "A stress shortfall means the business would need external funding to keep investing and repaying debt.", verify: ["Liquidity forecast under downside", "Facility headroom"] },
};

/** size the issue in AED where the data allows; never invent a figure */
function impact(a: AnalysisResult, id: string): string | null {
  const c = a.latestRecord, p = a.previousRecord, L = a.latest, P = a.previous;
  const sales = c.creditSales ?? c.revenue;
  switch (id) {
    case "ocf": case "fcf": return c.ebitda != null && c.operatingCashFlow != null ? `${fmtM(c.ebitda - c.operatingCashFlow)} of FY${c.year} EBITDA (${fmtPct((c.ebitda - c.operatingCashFlow) / c.ebitda, 0)}) did not reach operating cash flow` : null;
    case "dso": return L.dso != null && P?.dso != null && sales != null ? `About ${fmtM(((L.dso - P.dso) * sales) / 365)} more cash is tied up than at last year's collection speed` : null;
    case "dio": return L.dio != null && P?.dio != null && c.cogs != null ? `About ${fmtM(((L.dio - P.dio) * c.cogs) / 365)} more cash is tied up in stock than at last year's turnover` : null;
    case "revq": return p && c.receivables != null && p.receivables != null && c.revenue != null && p.revenue ? `Receivables rose ${fmtM(c.receivables - p.receivables)} against a revenue rise of ${fmtM(c.revenue - p.revenue)}` : null;
    case "owc": return p && c.receivables != null && c.inventory != null && c.payables != null && p.receivables != null && p.inventory != null && p.payables != null ? `Operating working capital absorbed ${fmtM(c.receivables + c.inventory - c.payables - (p.receivables + p.inventory - p.payables))} in the year` : null;
    case "margin": return p && c.revenue && p.revenue && c.ebitda != null && p.ebitda != null ? `At last year's margin FY${c.year} EBITDA would be ${fmtM((p.ebitda / p.revenue) * c.revenue)} instead of ${fmtM(c.ebitda)}` : null;
    case "lev": return a.latest.netDebt != null && c.ebitda != null && c.ebitda > 0 ? `Net debt ${fmtM(a.latest.netDebt)}; at 3.0x EBITDA the company could carry ${fmtM(3 * c.ebitda)}` : null;
    case "mat": return c.shortTermDebt != null ? `${fmtM(c.shortTermDebt)} falls due within 12 months` : null;
    case "res": case "down": { const v = a.risk.categories.flatMap((k) => k.indicators).find((i) => i.id === "res"); return v?.points != null && v.actual !== "—" ? v.actual : null; }
    case "adj": { const v = buildValuation(a); return a.inputs.ebitdaAdjustment != null ? `${fmtM(a.inputs.ebitdaAdjustment)} of EBITDA${v.entryMultiple != null ? `, about ${fmtM(a.inputs.ebitdaAdjustment * v.entryMultiple)} of enterprise value at ${fmtX(v.entryMultiple, 1)}` : ""}` : null; }
    default: return null;
  }
}

/** the most financially significant risks first (by points scored), each tied to figures */
export function buildFindings(a: AnalysisResult, limit = 3): Finding[] {
  // two indicators that size the same issue (e.g. OCF and FCF conversion) shouldn't take two of the three slots
  const seen = new Set<string>();
  return allIndicators(a.risk)
    .filter((i) => i.points != null && i.points > 0)
    .sort((x, y) => (y.points ?? 0) - (x.points ?? 0) || (y.points! / y.max) - (x.points! / x.max))
    .filter((i) => { const k = impact(a, i.id); if (k && seen.has(k)) return false; if (k) seen.add(k); return true; })
    .slice(0, limit)
    .map((i) => ({
      id: i.id, title: i.name, level: i.level, points: i.points!, max: i.max,
      evidence: `${i.actual}${i.previous !== "—" ? ` (prior: ${i.previous})` : ""}`,
      why: WHY[i.id]?.why ?? i.explanation,
      impact: impact(a, i.id),
      verify: WHY[i.id]?.verify ?? [],
      questions: i.questions,
    }));
}

