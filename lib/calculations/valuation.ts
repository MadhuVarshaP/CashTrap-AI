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
  returns: Returns | null;
}

export interface Returns {
  holdYears: number;
  growth: number; // % a year
  growthSource: "entered" | "historical (capped 0-10%)";
  exitMultiple: number;
  exitMultipleSource: "entered" | "entry multiple";
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
  const ev = i.enterpriseValue ?? null;
  const eq = i.equityInvested ?? null;
  const entered = i.acquisitionDebt ?? null;
  const debtDerived = entered == null && ev != null && eq != null;
  const acqDebt = entered ?? (debtDerived ? ev! - eq! : null);
  const nd = c.debt != null && c.cash != null ? c.debt - c.cash : null;

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

  return {
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
