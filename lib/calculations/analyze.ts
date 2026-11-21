import type { AnalysisResult, Dataset, FieldKey, FinancialRecord } from "@/types/finance";
import { computeMetrics } from "./metrics";
import { assessRisk } from "./pe-risk";
import { detectAlerts } from "./alerts";

const FIELDS: FieldKey[] = ["revenue", "cogs", "ebitda", "receivables", "inventory", "payables", "operatingCashFlow", "cash", "debt"];

const MONEY_OPTIONAL = ["capex", "interestExpense", "currentAssets", "currentLiabilities", "principalRepayment", "shortTermDebt"] as const;

export function scaleRecords(rs: FinancialRecord[], multiplier: number): FinancialRecord[] {
  const k = multiplier / 1_000_000;
  return [...rs]
    .sort((a, b) => a.year - b.year)
    .map((r) => {
      const o = { ...r };
      for (const f of FIELDS) o[f] = r[f] == null ? null : r[f]! * k;
      const sc = (v: number | null | undefined) => (v == null ? null : v * k);
      if (r.creditSales !== undefined) o.creditSales = sc(r.creditSales);
      if (r.creditPurchases !== undefined) o.creditPurchases = sc(r.creditPurchases);
      for (const f of MONEY_OPTIONAL) if (r[f] !== undefined) o[f] = sc(r[f] as number | null);
      if (r.opening) o.opening = { receivables: sc(r.opening.receivables), inventory: sc(r.opening.inventory), payables: sc(r.opening.payables) };
      return o;
    });
}

/** Pure, synchronous analysis. Mirrors the future POST /analyze contract. */
export function analyze(ds: Dataset): AnalysisResult | null {
  const records = scaleRecords(ds.records, ds.unitMultiplier);
  if (records.length < 2) return null;
  const metrics = computeMetrics(records);
  const n = records.length;
  const latest = metrics[n - 1], previous = metrics[n - 2];
  const latestRecord = records[n - 1], previousRecord = records[n - 2];
  const missingFields = records.flatMap((r) => FIELDS.filter((f) => r[f] == null).map((f) => `${f} (${r.year})`));
  const inputs = ds.inputs ?? {};
  // prior-year score on the same rules, without this year's adjustment input (which applies to the latest year only)
  const prior = n >= 3 ? assessRisk(records.slice(0, -1), metrics.slice(0, -1), {}) : null;
  return {
    records, metrics, latest, previous, latestRecord, previousRecord,
    risk: assessRisk(records, metrics, inputs),
    inputs,
    previousScore: prior?.score ?? null,
    alerts: detectAlerts(latest, previous, latestRecord, previousRecord),
    missingFields,
    generatedAt: new Date().toISOString(),
  };
}
