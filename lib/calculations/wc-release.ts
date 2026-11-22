import type { AnalysisResult, Num } from "@/types/finance";

/**
 * Working-capital cash release across all three components. Money in AED millions, days as days.
 *   Receivables = (Credit sales / 365) x (Current DSO - Target DSO)
 *   Inventory   = (COGS / 365)         x (Current DIO - Target DIO)
 *   Payables    = (Purchases / 365)    x (Target DPO - Current DPO)
 * A negative component is additional cash required, and is kept as such.
 */
export interface WcInput {
  creditSales: number; cogs: number; purchases: number;
  dso: number; targetDso: number;
  dio: number; targetDio: number;
  dpo: number; targetDpo: number;
}

export interface WcRelease {
  receivables: number; inventory: number; payables: number; total: number;
  currentCcc: number; targetCcc: number;
  /** trade working capital tied up = receivables + inventory - payables, implied by the days */
  currentWc: number; targetWc: number;
}

export const dayValue = (base: number) => base / 365;

export function wcRelease(i: WcInput): WcRelease {
  const receivables = dayValue(i.creditSales) * (i.dso - i.targetDso);
  const inventory = dayValue(i.cogs) * (i.dio - i.targetDio);
  const payables = dayValue(i.purchases) * (i.targetDpo - i.dpo);
  const wc = (dso: number, dio: number, dpo: number) => dayValue(i.creditSales) * dso + dayValue(i.cogs) * dio - dayValue(i.purchases) * dpo;
  return {
    receivables, inventory, payables, total: receivables + inventory + payables,
    currentCcc: i.dso + i.dio - i.dpo, targetCcc: i.targetDso + i.targetDio - i.targetDpo,
    currentWc: wc(i.dso, i.dio, i.dpo), targetWc: wc(i.targetDso, i.targetDio, i.targetDpo),
  };
}

export interface PotentialRelease {
  receivables: Num; inventory: Num; total: Num;
  /** what the figure assumes, in words */
  basis: string;
}

/**
 * The evidence-based release shown on the dashboard: only the DSO and DIO deterioration since the prior year is
 * reversed (the company's own history is the benchmark). DPO is left alone because stretching suppliers is a
 * choice with its own risks, not a finding. Not guaranteed cash.
 */
export function potentialRelease(a: AnalysisResult): PotentialRelease {
  const { latest: m, previous: pm, latestRecord: c } = a;
  const sales = c.creditSales ?? c.revenue;
  const rec = pm && m.dso != null && pm.dso != null && sales != null ? Math.max(0, dayValue(sales) * (m.dso - pm.dso)) : null;
  const inv = pm && m.dio != null && pm.dio != null && c.cogs != null ? Math.max(0, dayValue(c.cogs) * (m.dio - pm.dio)) : null;
  const total = rec == null && inv == null ? null : (rec ?? 0) + (inv ?? 0);
  return { receivables: rec, inventory: inv, total, basis: `DSO and DIO returning to FY${a.previousRecord?.year ?? "—"} levels; DPO unchanged` };
}
