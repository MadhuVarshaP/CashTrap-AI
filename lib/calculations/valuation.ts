import type { AnalysisResult, Num } from "@/types/finance";
import { adjustedEbitda } from "./pe-risk";
import { cashRelease } from "./metrics";

/**
 * Acquisition valuation view. Deliberately separate from the risk score:
 * a risky company can be attractive at the right price, and a healthy one unattractive at the wrong price.
 */
export interface Valuation {
  reportedEbitda: Num;
  adjustedEbitda: Num;
  /** adjusted less reported EBITDA (verified adjustments only) */
  normalisation: Num;
  entryMultiple: Num; // EV / adjusted EBITDA
  reportedMultiple: Num; // EV / reported EBITDA
  netDebt: Num;
  equityValue: Num; // EV - net debt
  acquisitionDebt: Num;
  /** true when acquisition debt was derived as EV - equity rather than entered */
  debtDerived: boolean;
  entryLeverage: Num; // acquisition debt / adjusted EBITDA
  fundingGap: Num; // EV - (acquisition debt + equity); non-zero means sources and uses don't match
  /** working capital absorbed beyond the prior-year share of revenue: a possible price/peg adjustment */
  wcExcess: Num;
  /** one-off cash from cutting DSO by 15 days */
  cashRelease15: Num;
  /** existing net debt + new acquisition debt - cash the deal can use */
  postNetDebt: Num;
  postLeverage: Num; // post-acquisition net debt / adjusted EBITDA
  /** enterprise value less acquisition debt: the equity cheque the structure implies */
  equityRequirement: Num;
  availableCash: Num;
  /** EV was derived from an entered entry multiple rather than typed in */
  evDerived: boolean;
  enterpriseValue: Num;
  returns: Returns | null;
}

export interface Returns {
  holdYears: number;
  growth: number; // % a year
  growthSource: string;
  exitMultiple: number;
  exitMultipleSource: string;
  exitEbitda: number;
  exitEv: number;
  paydown: Num; // cumulative acquisition debt repaid from free cash flow, null when capex unknown
  exitNetDebt: number;
  exitEquity: number;
  moic: number;
  irr: number; // %
}

export function buildValuation(a: AnalysisResult): Valuation {
  const i = a.inputs, c = a.latestRecord, p = a.previousRecord;
  const rep = c.ebitda ?? null;
  const adj = adjustedEbitda(c, i, true);
  const evEntered = i.enterpriseValue ?? null;
  const evDerived = evEntered == null && i.entryMultiple != null && adj != null && adj > 0;
  const ev = evEntered ?? (evDerived ? i.entryMultiple! * adj! : null);
  const eq = i.equityInvested ?? null;
  const entered = i.acquisitionDebt ?? null;
  const debtDerived = entered == null && ev != null && eq != null;
  const acqDebt = entered ?? (debtDerived ? ev! - eq! : null);
  const nd = i.existingNetDebt ?? (c.debt != null && c.cash != null ? c.debt - c.cash : null);

  const owcPct = (r: typeof c | null) => (r && r.receivables != null && r.inventory != null && r.payables != null && r.revenue ? (r.receivables + r.inventory - r.payables) / r.revenue : null);
  const wcNow = owcPct(c), wcPrev = owcPct(p);
  const salesBase = c.creditSales ?? c.revenue;

  let returns: Returns | null = null;
  if (ev != null && eq != null && eq > 0 && adj != null && adj > 0 && acqDebt != null) {
    const hist = a.records.length >= 2 && a.records[0].ebitda != null && a.records[0].ebitda > 0 && c.ebitda != null
      ? (Math.pow(c.ebitda / a.records[0].ebitda, 1 / (a.records.length - 1)) - 1) * 100 : null;
    const g = i.ebitdaGrowth ?? Math.min(10, Math.max(0, hist ?? 0));
    const H = i.holdYears ?? 5;
    const entry = ev / adj;
    const xm = i.exitMultiple ?? entry;
    const fcfConv = c.operatingCashFlow != null && c.capex != null ? (c.operatingCashFlow - c.capex) / adj : null;
    let pay: number | null = null;
    if (fcfConv != null) { pay = 0; for (let t = 1; t <= H; t++) pay += Math.max(0, adj * Math.pow(1 + g / 100, t) * fcfConv); }
    const exitE = adj * Math.pow(1 + g / 100, H);
    const exitEv = exitE * xm;
    const exitNd = acqDebt - (pay ?? 0);
    const exitEq = exitEv - exitNd;
    const moic = exitEq / eq;
    returns = {
      holdYears: H, growth: g, growthSource: i.ebitdaGrowth != null ? "entered" : "historical (capped 0-10%)",
      exitMultiple: xm, exitMultipleSource: i.exitMultiple != null ? "entered" : "entry multiple",
      exitEbitda: exitE, exitEv, paydown: pay, exitNetDebt: exitNd, exitEquity: exitEq, moic,
      irr: moic > 0 ? (Math.pow(moic, 1 / H) - 1) * 100 : -100,
    };
  }

  const cashUsed = i.availableCash ?? null;
  const post = nd != null && acqDebt != null ? nd + acqDebt - (cashUsed ?? 0) : null;
  return {
    postNetDebt: post, postLeverage: post != null && adj != null && adj > 0 ? post / adj : null,
    equityRequirement: ev != null && acqDebt != null ? ev - acqDebt : null,
    availableCash: cashUsed, evDerived, enterpriseValue: ev,
    reportedEbitda: rep, adjustedEbitda: adj,
    normalisation: rep != null && adj != null ? adj - rep : null,
    entryMultiple: ev != null && adj != null && adj > 0 ? ev / adj : null,
    reportedMultiple: ev != null && rep != null && rep > 0 ? ev / rep : null,
    netDebt: nd,
    equityValue: ev != null && nd != null ? ev - nd : null,
    acquisitionDebt: acqDebt, debtDerived,
    entryLeverage: acqDebt != null && adj != null && adj > 0 ? acqDebt / adj : null,
    fundingGap: ev != null && acqDebt != null && eq != null ? ev - acqDebt - eq : null,
    wcExcess: wcNow != null && wcPrev != null && c.revenue != null ? Math.max(0, (wcNow - wcPrev) * c.revenue) : null,
    cashRelease15: salesBase != null && a.latest.dso != null ? cashRelease(salesBase, a.latest.dso, Math.max(0, a.latest.dso - 15)) : null,
    returns,
  };
}

/** the same returns arithmetic for any growth / exit-multiple / hold combination (used for the base, downside and upside cases) */
export function scenarioReturns(a: AnalysisResult, g: number, H: number, xm: number, label: string): Returns | null {
  const v = buildValuation(a), c = a.latestRecord;
  const eq = a.inputs.equityInvested, adj = v.adjustedEbitda, acq = v.acquisitionDebt;
  if (v.enterpriseValue == null || eq == null || eq <= 0 || adj == null || adj <= 0 || acq == null || H <= 0) return null;
  const fcfConv = c.operatingCashFlow != null && c.capex != null ? (c.operatingCashFlow - c.capex) / adj : null;
  let pay: number | null = null;
  if (fcfConv != null) { pay = 0; for (let t = 1; t <= H; t++) pay += Math.max(0, adj * Math.pow(1 + g / 100, t) * fcfConv); }
  const exitE = adj * Math.pow(1 + g / 100, H), exitEv = exitE * xm, exitNd = acq - (pay ?? 0), exitEq = exitEv - exitNd, moic = exitEq / eq;
  return { holdYears: H, growth: g, growthSource: label, exitMultiple: xm, exitMultipleSource: label, exitEbitda: exitE, exitEv, paydown: pay, exitNetDebt: exitNd, exitEquity: exitEq, moic, irr: moic > 0 ? (Math.pow(moic, 1 / H) - 1) * 100 : -100 };
}
