import type { AnalysisResult, AssessmentInputs, FinancialRecord, Num } from "@/types/finance";
import { adjustedEbitda, adjustmentAmount } from "./pe-risk";

/**
 * EBITDA-to-cash bridge, one column per year that has a prior year (working-capital movement needs both balances).
 *
 *   Reported EBITDA + verified adjustments = Adjusted EBITDA
 *   - increase in operating working capital - cash taxes - cash interest - capex ± other cash adjustments = Free cash flow
 *
 * "Other" is whatever reconciles the supplied components to reported operating cash flow, so Free cash flow equals
 * operating cash flow less capex. It includes any component that was not supplied. The gap between Adjusted EBITDA and OCF is split into the
 * working-capital movement, taxes and interest where the file gives them; whatever is left is "other / unexplained"
 * and is never labelled as working capital. A missing component is "not supplied" and is excluded, not set to zero.
 */
export interface BridgeYear {
  year: number;
  reported: Num;
  adjustment: Num; // amount that is counted (verified only)
  adjusted: Num;
  wcIncrease: Num; // positive = cash absorbed
  taxes: Num;
  interest: Num;
  capex: Num;
  /** ± the residual that reconciles the steps to reported operating cash flow (includes anything not supplied) */
  other: Num;
  /** operating cash flow less capex */
  fcf: Num;
  ocf: Num;
  conversion: Num; // OCF / adjusted EBITDA, as a ratio
  gap: Num; // adjusted EBITDA - OCF
  drivers: GapDriver[];
  /** components not supplied for this year: the bridge is partial when this is non-empty */
  missing: string[];
  taxesSource: "file" | "investor input" | null;
}

export interface GapDriver { id: "wc" | "tax" | "interest" | "other"; label: string; value: Num; note: string }

const owc = (r: FinancialRecord): Num => (r.receivables != null && r.inventory != null && r.payables != null ? r.receivables + r.inventory - r.payables : null);

export function buildBridge(a: AnalysisResult): BridgeYear[] {
  const inputs: AssessmentInputs = a.inputs;
  const n = a.records.length;
  return a.records.map((r, i): BridgeYear | null => {
    if (i === 0) return null;
    const latest = i === n - 1;
    const p = a.records[i - 1];
    const adjusted = adjustedEbitda(r, inputs, latest);
    const amt = adjustmentAmount(r, inputs, latest);
    const counted = adjusted != null && r.ebitda != null ? adjusted - r.ebitda : null;
    const o1 = owc(r), o0 = owc(p);
    const wcIncrease = o1 != null && o0 != null ? o1 - o0 : null;
    // the file's cash taxes win; an investor-entered figure applies to the latest year only and is labelled as such
    const taxes = r.cashTaxes ?? (latest ? inputs.cashTaxes ?? null : null);
    const taxesSource = r.cashTaxes != null ? "file" : latest && inputs.cashTaxes != null ? "investor input" : null;
    const capex = r.capex ?? null;
    const ocf = r.operatingCashFlow;
    const missing: string[] = [];
    if (wcIncrease == null) missing.push("working-capital movement");
    if (taxes == null) missing.push("cash taxes");
    if (capex == null) missing.push("capital expenditure");
    if (r.interestExpense == null) missing.push("cash interest");

    const interest = r.interestExpense ?? null;
    const gap = adjusted != null && ocf != null ? adjusted - ocf : null;
    const otherStep = adjusted != null && ocf != null ? ocf - (adjusted - (wcIncrease ?? 0) - (taxes ?? 0) - (interest ?? 0)) : null;
    const known = (wcIncrease ?? 0) + (taxes ?? 0) + (interest ?? 0);
    const other = gap == null ? null : gap - known;
    const unsupplied = [wcIncrease == null && "working capital", taxes == null && "taxes", interest == null && "interest"].filter(Boolean) as string[];
    const drivers: GapDriver[] = [
      { id: "wc", label: "Working-capital movement", value: wcIncrease, note: wcIncrease == null ? "Needs receivables, inventory and payables for two years." : "Increase in receivables + inventory − payables." },
      { id: "tax", label: "Cash taxes", value: taxes, note: taxes == null ? "Not supplied." : `Taxes actually paid (${taxesSource}).` },
      { id: "interest", label: "Cash interest", value: interest, note: interest == null ? "Not supplied." : "Interest paid, which reported operating cash flow normally sits after." },
      { id: "other", label: unsupplied.length ? "Other and unexplained (incl. items not supplied)" : "Other and unexplained", value: other, note: unsupplied.length ? `Residual. Includes ${unsupplied.join(", ")} because they were not supplied, so it overstates true "other".` : "Residual after working capital, taxes and interest: provisions, non-cash items, other receivables and payables." },
    ];
    return {
      year: r.year, reported: r.ebitda, adjustment: counted ?? (amt != null && inputs.adjustmentStatus !== "verified" ? 0 : null), adjusted,
      wcIncrease, taxes, interest, capex, other: otherStep, ocf,
      fcf: ocf != null && capex != null ? ocf - capex : null,
      conversion: adjusted != null && adjusted > 0 && ocf != null ? ocf / adjusted : null,
      gap, drivers, missing, taxesSource,
    };
  }).filter((x): x is BridgeYear => x != null);
}

export interface WaterfallStep { name: string; value: number | null; kind: "total" | "delta" | "missing" }

/** waterfall steps for one year; a component that wasn't supplied is shown as a labelled gap, not a zero bar */
export function bridgeSteps(b: BridgeYear): WaterfallStep[] {
  const d = (name: string, v: Num, sign: 1 | -1): WaterfallStep => (v == null ? { name, value: null, kind: "missing" } : { name, value: sign * v, kind: "delta" });
  return [
    { name: "Reported", value: b.reported, kind: "total" },
    { name: "Adjustments", value: b.adjustment ?? 0, kind: "delta" },
    { name: "Adjusted", value: b.adjusted, kind: "total" },
    d("Working cap.", b.wcIncrease, -1),
    d("Cash taxes", b.taxes, -1),
    d("Cash interest", b.interest, -1),
    d("Capex", b.capex, -1),
    { name: "Other", value: b.other, kind: b.other == null ? "missing" : "delta" },
    { name: "Free cash flow", value: b.fcf, kind: "total" },
  ];
}
