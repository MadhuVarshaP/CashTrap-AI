import type { FinancialRecord } from "@/types/finance";

export interface DataIssue { level: "error" | "warning" | "info"; text: string }

/** every field the platform can use, grouped by what it switches on (label is what the user sees) */
export const FIELD_GROUPS: { group: string; fields: { key: keyof FinancialRecord; label: string }[] }[] = [
  { group: "Core", fields: [
    { key: "revenue", label: "Revenue" }, { key: "cogs", label: "COGS" }, { key: "ebitda", label: "EBITDA" },
    { key: "receivables", label: "Accounts receivable" }, { key: "inventory", label: "Inventory" }, { key: "payables", label: "Accounts payable" },
    { key: "operatingCashFlow", label: "Operating cash flow" }, { key: "cash", label: "Cash balance" }, { key: "debt", label: "Total debt" },
  ] },
  { group: "Cash bridge, coverage and liquidity", fields: [
    { key: "capex", label: "Capital expenditure" }, { key: "cashTaxes", label: "Cash taxes paid" }, { key: "interestExpense", label: "Cash interest expense" },
    { key: "principalRepayment", label: "Scheduled principal repayment" }, { key: "shortTermDebt", label: "Debt due within 12 months" },
    { key: "currentAssets", label: "Current assets" }, { key: "currentLiabilities", label: "Current liabilities" },
  ] },
  { group: "Earnings quality and days", fields: [
    { key: "ebitdaAdjustment", label: "EBITDA adjustments" }, { key: "creditSales", label: "Credit sales" }, { key: "creditPurchases", label: "Annual / credit purchases" },
  ] },
];

/**
 * Checks run on the figures as supplied (before unit scaling and before any calculation).
 * Nothing is repaired or defaulted: a problem is reported and the affected indicator stays "not assessed".
 */
export function validateRecords(records: FinancialRecord[]): DataIssue[] {
  const out: DataIssue[] = [];
  const rs = [...records].sort((a, b) => a.year - b.year);
  if (!rs.length) return [{ level: "error", text: "No records." }];
  if (rs.length < 2) out.push({ level: "error", text: "At least two years are needed to assess trends." });
  else if (rs.length < 3) out.push({ level: "warning", text: "Fewer than three years: volatility and consistency indicators can't be assessed." });

  // reporting periods
  for (let i = 1; i < rs.length; i++) {
    const gap = rs[i].year - rs[i - 1].year;
    if (gap !== 1) out.push({ level: "warning", text: `Reporting periods are not consecutive: FY${rs[i - 1].year} is followed by FY${rs[i].year}. Year-on-year comparisons across the gap are not like for like.` });
  }

  for (const r of rs) {
    const y = `FY${r.year}`;
    const neg = (["revenue", "cogs", "receivables", "inventory", "payables", "debt", "cash"] as const).filter((f) => r[f] != null && (r[f] as number) < 0);
    if (neg.length) out.push({ level: "error", text: `${y}: negative ${neg.join(", ")}. These should not be negative; check the sign convention.` });
    if (r.capex != null && r.capex < 0) out.push({ level: "warning", text: `${y}: capital expenditure is negative; it is expected as a positive cash outflow.` });
    if (r.revenue === 0) out.push({ level: "error", text: `${y}: revenue is zero, so margins and days can't be calculated.` });
    if (r.revenue != null && r.ebitda != null && r.revenue > 0) {
      if (r.ebitda > r.revenue) out.push({ level: "error", text: `${y}: EBITDA exceeds revenue. This usually means a unit or column mix-up.` });
      else if (r.ebitda / r.revenue > 0.6) out.push({ level: "warning", text: `${y}: EBITDA margin above 60%, which is unusual outside royalty-type businesses; confirm it.` });
    }
    if (r.revenue != null && r.cogs != null && r.cogs > r.revenue * 1.2) out.push({ level: "warning", text: `${y}: COGS is more than 120% of revenue; confirm units and whether COGS includes other costs.` });
    if (r.revenue != null && r.receivables != null && r.revenue > 0 && r.receivables > r.revenue) out.push({ level: "warning", text: `${y}: receivables exceed a full year of revenue (DSO over 365 days). Check the figures and units.` });
    if (r.currentAssets != null && r.currentAssets > 0) {
      const parts = (r.receivables ?? 0) + (r.inventory ?? 0) + (r.cash ?? 0);
      if (parts > r.currentAssets * 1.001) out.push({ level: "error", text: `${y}: receivables + inventory + cash exceed total current assets. The balance sheet figures are inconsistent.` });
    }
    if (r.shortTermDebt != null && r.debt != null && r.shortTermDebt > r.debt * 1.001) out.push({ level: "error", text: `${y}: debt due within 12 months exceeds total debt.` });
    if (r.ebitda != null && r.ebitda <= 0) out.push({ level: "warning", text: `${y}: EBITDA is not positive, so conversion and leverage ratios are not meaningful for that year.` });
  }

  // unit consistency: a sudden 20x or 1000x jump between years almost always means a unit change, not growth
  for (let i = 1; i < rs.length; i++) {
    const a = rs[i - 1].revenue, b = rs[i].revenue;
    if (a && b && a > 0 && b > 0) {
      const f = b / a;
      if (f > 20 || f < 1 / 20) out.push({ level: "error", text: `Revenue changes ${f > 1 ? f.toFixed(0) + "×" : (1 / f).toFixed(0) + "× down"} between FY${rs[i - 1].year} and FY${rs[i].year}. The years may be in different units (e.g. thousands vs millions).` });
    }
  }
  return out;
}

/** optional fields absent from the whole file, grouped, so the user sees what each gap switches off */
export function missingFieldReport(records: FinancialRecord[]) {
  return FIELD_GROUPS.map((g) => ({
    group: g.group,
    missing: g.fields.filter((f) => records.every((r) => r[f.key] == null)).map((f) => f.label),
    partial: g.fields.filter((f) => records.some((r) => r[f.key] != null) && records.some((r) => r[f.key] == null)).map((f) => f.label),
    present: g.fields.filter((f) => records.every((r) => r[f.key] != null)).map((f) => f.label),
  }));
}
