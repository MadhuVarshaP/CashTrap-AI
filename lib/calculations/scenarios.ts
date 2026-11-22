import type { AnalysisResult, Num } from "@/types/finance";
import { adjustedEbitda } from "./pe-risk";

/**
 * Acquisition stress testing. Scenario analysis only: every output is hypothetical, computed from the latest
 * actual year and the assumptions below, and is never a forecast.
 */
export interface Case {
  /** % fall in revenue */
  revenueDrop: number;
  /** percentage-point fall in EBITDA margin */
  marginDrop: number;
  /** extra days customers take to pay */
  dsoIncrease: number;
  /** extra days stock is held */
  dioIncrease: number;
  /** percentage-point rise in the interest rate on all debt */
  interestRise: number;
  /** extra debt drawn, AED m */
  extraBorrowing: number;
}

export const BASE_CASE: Case = { revenueDrop: 0, marginDrop: 0, dsoIncrease: 0, dioIncrease: 0, interestRise: 0, extraBorrowing: 0 };
/** proposed screening scenarios: starting points to edit, not market forecasts */
export const DOWNSIDE_CASE: Case = { revenueDrop: 10, marginDrop: 3, dsoIncrease: 10, dioIncrease: 5, interestRise: 1, extraBorrowing: 0 };
export const SEVERE_CASE: Case = { revenueDrop: 25, marginDrop: 6, dsoIncrease: 25, dioIncrease: 15, interestRise: 3, extraBorrowing: 0 };

export interface Outcome {
  revenue: Num; ebitda: Num; adjustedEbitda: Num;
  ocf: Num; fcf: Num;
  interest: Num; interestCover: Num;
  netDebt: Num; netDebtToEbitda: Num;
  dscr: Num;
  /** cash needed for capex + scheduled principal that operating cash flow does not cover */
  shortfall: Num;
  /** the part of that shortfall left after the cash balance and any extra borrowing */
  uncovered: Num;
  /** operating cash flow lost to slower collections and stock, and to extra interest */
  wcDrag: Num; extraInterest: Num;
  notes: string[];
}

const pos = (v: Num) => (v == null ? null : Math.max(0, v));

export function runCase(a: AnalysisResult, k: Case): Outcome {
  const c = a.latestRecord;
  const rev = c.revenue, ebitda = c.ebitda;
  const adj = adjustedEbitda(c, a.inputs, true);
  const adjDelta = adj != null && ebitda != null ? adj - ebitda : 0;
  const notes: string[] = [];

  const sRev = rev == null ? null : rev * (1 - k.revenueDrop / 100);
  const margin = rev && rev > 0 && ebitda != null ? ebitda / rev : null;
  const sE = sRev != null && margin != null ? sRev * (margin - k.marginDrop / 100) : null;
  const sAdj = sE == null ? null : sE + adjDelta;

  const salesBase = c.creditSales != null && rev ? c.creditSales * ((sRev ?? 0) / rev) : sRev;
  const cogsBase = c.cogs != null && rev ? c.cogs * ((sRev ?? 0) / rev) : null;
  const wcDrag = salesBase == null && cogsBase == null ? null : ((salesBase ?? 0) / 365) * k.dsoIncrease + ((cogsBase ?? 0) / 365) * k.dioIncrease;
  if (k.dioIncrease && cogsBase == null) notes.push("COGS not supplied: the inventory-days effect is excluded.");

  // interest: existing interest + the rate rise on all debt + interest on new borrowing at the current effective rate
  const debt = c.debt;
  const effRate = c.interestExpense != null && debt ? c.interestExpense / debt : null;
  const rise = debt == null ? null : ((debt + k.extraBorrowing) * k.interestRise) / 100;
  const newCost = k.extraBorrowing > 0 ? (effRate == null ? null : k.extraBorrowing * effRate) : 0;
  if (k.extraBorrowing > 0 && newCost == null) notes.push("Existing interest or debt not supplied, so interest on the additional borrowing is excluded.");
  const interest = c.interestExpense == null ? null : c.interestExpense + (rise ?? 0) + (newCost ?? 0);
  const extraInterest = interest == null || c.interestExpense == null ? null : interest - c.interestExpense;

  const dE = sE != null && ebitda != null ? sE - ebitda : null;
  const ocf = c.operatingCashFlow != null && dE != null && wcDrag != null ? c.operatingCashFlow + dE - wcDrag - (extraInterest ?? 0) : null;
  const fcf = ocf != null && c.capex != null ? ocf - c.capex : null;

  const nd = debt != null && c.cash != null ? debt - c.cash + k.extraBorrowing : null;
  const principal = c.principalRepayment ?? null;
  const need = c.capex == null && principal == null ? null : (c.capex ?? 0) + (principal ?? 0);
  const shortfall = need != null && ocf != null ? pos(need - ocf) : null;
  const free = Math.max(0, (c.cash ?? 0) + k.extraBorrowing - (a.inputs.minOperatingCash ?? 0));
  if (need == null) notes.push("Neither capex nor scheduled principal supplied: no cash shortfall can be measured.");

  return {
    revenue: sRev, ebitda: sE, adjustedEbitda: sAdj, ocf, fcf,
    interest, interestCover: interest != null && interest > 0 && sAdj != null ? sAdj / interest : null,
    netDebt: nd, netDebtToEbitda: nd != null && sAdj != null && sAdj > 0 ? (nd <= 0 ? 0 : nd / sAdj) : null,
    dscr: ocf != null && interest != null && principal != null && interest + principal > 0 ? (ocf + interest) / (interest + principal) : null,
    shortfall, uncovered: shortfall == null ? null : pos(shortfall - free),
    wcDrag, extraInterest, notes,
  };
}

export const CASE_NAMES = ["Base case", "Downside case", "Severe stress case"] as const;
