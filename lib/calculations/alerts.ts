import type { Alert, FinancialRecord, Severity, YearMetrics } from "@/types/finance";
import { fmtDays, fmtM, fmtPct, fmtX, growth } from "@/lib/utilities/format";

const order: Record<Severity, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
const daysSev = (d: number): Severity => (d > 35 ? "Critical" : d > 20 ? "High" : d > 10 ? "Medium" : "Low");
const gapSev = (pp: number): Severity => (pp > 30 ? "Critical" : pp > 15 ? "High" : pp > 5 ? "Medium" : "Low");

export function detectAlerts(cur: YearMetrics, prev: YearMetrics | null, c: FinancialRecord, p: FinancialRecord | null): Alert[] {
  const out: Alert[] = [];
  if (!p || !prev) return out;
  const rg = growth(c.revenue, p.revenue);

  const recG = growth(c.receivables, p.receivables);
  if (recG != null && rg != null && recG > rg && recG > 0) {
    out.push({
      id: "rec-vs-rev", name: "Receivables growing faster than revenue", severity: gapSev((recG - rg) * 100),
      evidence: `Receivables ${recG >= 0 ? "+" : ""}${(recG * 100).toFixed(1)}% vs revenue ${(rg * 100).toFixed(1)}%.`,
      previous: fmtM(p.receivables), current: fmtM(c.receivables),
      why: "Sales may be recognised faster than cash is collected, or customers are stretching payment terms. It does not prove bad debt.",
      investigate: ["Receivables ageing by customer", "Credit-term changes", "Subsequent cash receipts"],
    });
  }
  const invG = growth(c.inventory, p.inventory);
  if (invG != null && rg != null && invG > rg && invG > 0) {
    out.push({
      id: "inv-vs-rev", name: "Inventory growing faster than revenue", severity: gapSev((invG - rg) * 100),
      evidence: `Inventory +${(invG * 100).toFixed(1)}% vs revenue ${(rg * 100).toFixed(1)}%.`,
      previous: fmtM(p.inventory), current: fmtM(c.inventory),
      why: "Stock building faster than sales can indicate weakening demand, over-purchasing or slow-moving items.",
      investigate: ["Inventory ageing and provisions", "Purchase commitments", "Sell-through rates by product line"],
    });
  }
  const eg = growth(c.ebitda, p.ebitda), og = growth(c.operatingCashFlow, p.operatingCashFlow);
  if (eg != null && og != null && eg > 0 && og < 0) {
    out.push({
      id: "ebitda-ocf", name: "EBITDA rising while operating cash flow declines",
      severity: eg > 0.1 && og < -0.1 ? "Critical" : "High",
      evidence: `EBITDA +${(eg * 100).toFixed(1)}% while operating cash flow ${(og * 100).toFixed(1)}%.`,
      previous: `${fmtM(p.ebitda)} / ${fmtM(p.operatingCashFlow)}`, current: `${fmtM(c.ebitda)} / ${fmtM(c.operatingCashFlow)}`,
      why: "Profit that is not converting to cash can reflect working-capital absorption, aggressive accounting or timing effects.",
      investigate: ["EBITDA-to-cash reconciliation", "Revenue recognition policy", "Capitalised costs"],
    });
  }
  const trio: Array<[keyof YearMetrics, string, string, string, string[]]> = [
    ["dso", "DSO is increasing", "Customers are taking longer to pay.", "dso", ["Customer concentration", "Disputed invoices", "Collection process changes"]],
    ["dio", "DIO is increasing", "Inventory is turning more slowly.", "dio", ["Stock ageing", "Production planning", "Write-down history"]],
    ["ccc", "Cash conversion cycle is lengthening", "More cash is being tied up for each dirham of revenue.", "ccc", ["DSO / DIO / DPO drivers", "Supplier terms", "Seasonality"]],
  ];
  for (const [k, name, why, , inv] of trio) {
    const a = cur[k] as number | null, b = prev[k] as number | null;
    if (a != null && b != null && a - b >= 1) {
      out.push({ id: `${k}-up`, name, severity: daysSev(a - b), evidence: `${k.toUpperCase()} +${(a - b).toFixed(1)} days.`, previous: fmtDays(b), current: fmtDays(a), why, investigate: inv });
    }
  }
  if (cur.netDebtToEbitda != null && cur.netDebtToEbitda >= 2) {
    const v = cur.netDebtToEbitda;
    out.push({
      id: "leverage", name: "High net debt relative to EBITDA", severity: v > 4 ? "Critical" : v > 3 ? "High" : "Medium",
      evidence: `Net debt / EBITDA of ${fmtX(v)} with cash conversion of ${fmtPct(cur.cashConversion)}.`,
      previous: fmtX(prev.netDebtToEbitda), current: fmtX(v),
      why: "Leverage is more demanding when cash generation is weak, because debt service depends on cash rather than EBITDA.",
      investigate: ["Debt maturity profile", "Covenant headroom", "Off-balance-sheet obligations"],
    });
  }
  return out.sort((a, b) => order[a.severity] - order[b.severity]);
}
