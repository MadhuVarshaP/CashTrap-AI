import type { AnalysisResult, Dataset, FieldKey, FinancialRecord } from "@/types/finance";
import { computeMetrics } from "./metrics";
import { scoreRisk } from "./risk";
import { detectAlerts } from "./alerts";

const FIELDS: FieldKey[] = ["revenue", "cogs", "ebitda", "receivables", "inventory", "payables", "operatingCashFlow", "cash", "debt"];

export function scaleRecords(rs: FinancialRecord[], multiplier: number): FinancialRecord[] {
  const k = multiplier / 1_000_000;
  return [...rs]
    .sort((a, b) => a.year - b.year)
    .map((r) => {
      const o = { ...r };
      for (const f of FIELDS) o[f] = r[f] == null ? null : r[f]! * k;
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
  const prior = n >= 3 ? scoreRisk({ cur: metrics[n - 2], prev: metrics[n - 3], curR: records[n - 2], prevR: records[n - 3] }) : null;
  return {
    records, metrics, latest, previous, latestRecord, previousRecord,
    risk: scoreRisk({ cur: latest, prev: previous, curR: latestRecord, prevR: previousRecord }),
    previousScore: prior?.score ?? null,
    alerts: detectAlerts(latest, previous, latestRecord, previousRecord),
    missingFields,
    generatedAt: new Date().toISOString(),
  };
}
