import type { FinancialRecord, Num } from "@/types/finance";

export interface StressInput {
  /** % fall in revenue */
  revenueDrop: number;
  /** percentage-point fall in EBITDA margin */
  marginDrop: number;
  /** extra days customers take to pay */
  collectionDelay: number;
  /** percentage-point rise in the interest rate on debt */
  interestRise: number;
}

/** the four illustrative scenarios from the brief; the score is always judged on these defaults */
export const DEFAULT_STRESS: StressInput = { revenueDrop: 10, marginDrop: 3, collectionDelay: 15, interestRise: 2 };

export interface StressResult {
  baseEbitda: Num;
  stressedEbitda: Num;
  baseOcf: Num;
  stressedOcf: Num;
  baseCover: Num;
  stressedCover: Num;
  wcDrag: Num;
  extraInterest: Num;
  stressedNetDebtToEbitda: Num;
  /** cash needed for capex and scheduled principal, and what of that the stressed operating cash flow can't fund */
  requirement: Num;
  shortfall: Num;
  /** what the requirement covers, so the figure is never read as more than it is */
  requirementNote: string;
}

const sub = (a: Num, b: Num): Num => (a == null || b == null ? null : a - b);

/**
 * Illustrative downside, not a forecast.
 *   stressed EBITDA = stressed revenue x (margin - margin drop)
 *   stressed OCF    = OCF + change in EBITDA - extra working capital from slower collections - extra interest
 * `ebitda` is the (adjusted, if verified) EBITDA the caller scores on.
 */
export function runStress(r: FinancialRecord, ebitda: Num, s: StressInput): StressResult {
  const rev = r.revenue;
  const sRev = rev == null ? null : rev * (1 - s.revenueDrop / 100);
  const margin = rev != null && rev > 0 && ebitda != null ? ebitda / rev : null;
  const sE = sRev != null && margin != null ? sRev * (margin - s.marginDrop / 100) : null;
  const salesBase = r.creditSales != null && rev ? r.creditSales * ((sRev ?? 0) / rev) : sRev;
  const wcDrag = salesBase == null ? null : (salesBase / 365) * s.collectionDelay;
  const extraInterest = r.debt == null ? null : (r.debt * s.interestRise) / 100;
  const dE = sub(sE, ebitda);
  const sOcf = r.operatingCashFlow != null && dE != null && wcDrag != null ? r.operatingCashFlow + dE - wcDrag - (extraInterest ?? 0) : null;
  const interest = r.interestExpense;
  const netDebt = r.debt != null && r.cash != null ? r.debt - r.cash : null;
  const parts = [r.capex != null ? "capex" : null, r.principalRepayment != null ? "scheduled principal" : null].filter(Boolean);
  const requirement = r.capex == null && r.principalRepayment == null ? null : (r.capex ?? 0) + (r.principalRepayment ?? 0);
  return {
    baseEbitda: ebitda,
    stressedEbitda: sE,
    baseOcf: r.operatingCashFlow,
    stressedOcf: sOcf,
    baseCover: interest != null && interest > 0 && ebitda != null ? ebitda / interest : null,
    stressedCover: interest != null && sE != null ? (interest + (extraInterest ?? 0)) > 0 ? sE / (interest + (extraInterest ?? 0)) : null : null,
    wcDrag,
    extraInterest,
    stressedNetDebtToEbitda: netDebt != null && sE != null && sE > 0 ? netDebt / sE : null,
    requirement,
    shortfall: requirement != null && sOcf != null ? Math.max(0, requirement - sOcf) : null,
    requirementNote: parts.length ? `Requirement covers ${parts.join(" + ")} only.` : "Neither capex nor scheduled principal was supplied, so no requirement could be set.",
  };
}
