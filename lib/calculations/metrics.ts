import type { FinancialRecord, Num, YearMetrics } from "@/types/finance";

const div = (a: Num, b: Num): Num => (a == null || b == null || b === 0 ? null : a / b);
const avg = (cur: Num, prev: Num | undefined): Num => (cur == null ? null : prev == null ? cur : (cur + prev) / 2);

/**
 * Computes working-capital and cash metrics per year.
 * Average opening/closing balances are used where the prior year exists; otherwise
 * closing balances are used and the year is flagged `approximate`.
 * Missing inputs yield null, never zero.
 */
export function computeMetrics(records: FinancialRecord[]): YearMetrics[] {
  const rs = [...records].sort((a, b) => a.year - b.year);
  return rs.map((r, i) => {
    const p = i > 0 ? rs[i - 1] : undefined;
    const open = (f: "receivables" | "inventory" | "payables"): Num => (p ? p[f] : r.opening?.[f] ?? null);
    // credit sales / credit purchases are preferred over revenue / COGS when supplied
    // provider-reported days (S&P Capital IQ) take precedence: their balances are not in the file
    const dso = r.reportedDso ?? mul(div(avg(r.receivables, open("receivables")), r.creditSales ?? r.revenue), 365);
    const dio = r.reportedDio ?? mul(div(avg(r.inventory, open("inventory")), r.cogs), 365);
    const dpo = r.reportedDpo ?? mul(div(avg(r.payables, open("payables")), r.creditPurchases ?? r.cogs), 365);
    const reported = r.reportedDso != null || r.reportedDio != null;
    const ccc = dso != null && dio != null && dpo != null ? dso + dio - dpo : null;
    const netDebt = r.debt != null && r.cash != null ? r.debt - r.cash : null;
    return {
      year: r.year,
      dso,
      dio,
      dpo,
      ccc,
      cashConversion: r.ebitda != null && r.ebitda > 0 ? div(r.operatingCashFlow, r.ebitda) : null,
      ebitdaMargin: div(r.ebitda, r.revenue),
      netDebt,
      netDebtToEbitda: netDebt != null && r.ebitda != null && r.ebitda > 0 ? netDebt / r.ebitda : null,
      approximate: !p && !r.opening && !reported,
    };
  });
}

const mul = (v: Num, k: number): Num => (v == null ? null : v * k);

/** Potential Cash Release = (Annual Revenue / 365) × (Current DSO − Target DSO) */
export const cashRelease = (revenue: number, currentDso: number, targetDso: number): number =>
  (revenue / 365) * (currentDso - targetDso);
