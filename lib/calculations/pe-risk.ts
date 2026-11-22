import type { AssessmentInputs, Classification, FinancialRecord, Indicator, Num, RiskCategory, RiskResult, Severity, YearMetrics } from "@/types/finance";
import { DASH, fmtDays, fmtM, fmtPct, fmtX } from "@/lib/utilities/format";
import { DEFAULT_STRESS, runStress } from "./stress";
import { benchmarks, resolveThresholds } from "./thresholds";
import { INDICATOR_METRIC, METRIC, benchRange, fmtBench, resolveIndustry } from "@/lib/benchmarks/resolve";
import type { IndId } from "@/lib/benchmarks/industries";

/**
 * Investment Risk Analysis engine: five pillars, 17 indicators, 100 points.
 * Higher = more identified financial risk. Every indicator is judged against a stated
 * screening threshold; one that can't be computed is "not assessed" (null), never zero.
 */

export const PILLARS = [
  { id: "qoe", name: "Quality of Earnings", weight: 25 },
  { id: "cash", name: "Cash Flow Sustainability", weight: 25 },
  { id: "wc", name: "Working Capital Risk", weight: 20 },
  { id: "debt", name: "Debt and Repayment Risk", weight: 20 },
  { id: "liq", name: "Liquidity and Stress Risk", weight: 10 },
] as const;

/** share of an indicator's maximum awarded at each risk level */
export const LEVEL_SHARE: Record<Severity, number> = { Low: 0, Medium: 0.4, High: 0.7, Critical: 1 };
export const levelName = (s: Severity | null) => (s == null ? "Not Assessed" : s === "Medium" ? "Moderate" : s);

/** an overall score needs at least this share of the 100 points to be assessable */
export const MIN_COVERAGE = 40;

export const classify = (score: number): Classification =>
  score < 25 ? "Low Risk" : score < 50 ? "Moderate Risk" : score < 75 ? "High Risk" : "Critical Risk";

const pillarSeverity = (points: number, max: number): Severity => {
  const r = max ? points / max : 0;
  return r < 0.25 ? "Low" : r < 0.5 ? "Medium" : r < 0.75 ? "High" : "Critical";
};

/** higher is worse; Low below the first cut, then Moderate / High up to and including the next cuts */
const up = (v: number, [a, b, c]: [number, number, number], strictLow = true): Severity =>
  (strictLow ? v < a : v <= a) ? "Low" : v <= b ? "Medium" : v <= c ? "High" : "Critical";
/** lower is worse; Low at or above the first cut */
const down = (v: number, [a, b, c]: [number, number, number]): Severity => (v >= a ? "Low" : v >= b ? "Medium" : v >= c ? "High" : "Critical");
const worst = (...s: Severity[]): Severity => (["Critical", "High", "Medium", "Low"] as Severity[]).find((x) => s.includes(x)) ?? "Low";

type N = Num | undefined;
const pct = (a: N, b: N): Num => (a == null || b == null || b === 0 ? null : ((a - b) / Math.abs(b)) * 100);
const ratio = (a: N, b: N): Num => (a == null || b == null || b === 0 ? null : a / b);
const pp = (v: Num, d = 1) => (v == null ? DASH : `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(d)} pp`);
const sg = (v: Num, d = 1, suf = "") => (v == null ? DASH : `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(d)}${suf}`);
const pc = (v: Num, d = 1) => (v == null ? DASH : `${v.toFixed(d)}%`);

interface Def { id: string; pillar: string; name: string; max: number; questions: string[] }

/** reported EBITDA, plus the adjustment only when it is marked verified (latest year only) */
export function adjustmentAmount(r: FinancialRecord, inputs: AssessmentInputs, latest: boolean): Num {
  return (latest ? inputs.ebitdaAdjustment ?? r.ebitdaAdjustment : r.ebitdaAdjustment) ?? null;
}
export function adjustedEbitda(r: FinancialRecord, inputs: AssessmentInputs, latest: boolean): Num {
  if (r.ebitda == null) return null;
  const adj = adjustmentAmount(r, inputs, latest);
  return inputs.adjustmentStatus === "verified" && adj != null ? r.ebitda + adj : r.ebitda;
}

export function assessRisk(records: FinancialRecord[], metrics: YearMetrics[], inputs: AssessmentInputs = {}): RiskResult {
  const n = records.length;
  const { cuts: T } = resolveThresholds(inputs);
  const ctx = resolveIndustry(inputs);
  const B = benchmarks(T);
  const at = (k: number) => records[n - 1 - k] as FinancialRecord | undefined; // k=0 latest
  const mt = (k: number) => metrics[n - 1 - k] as YearMetrics | undefined;
  const c = at(0)!, p = at(1);
  const mc = mt(0)!, mp = mt(1);
  const eAdj = (k: number) => { const r = at(k); return r ? adjustedEbitda(r, inputs, k === 0) : null; };

  const margin = (k: number): Num => { const r = at(k); return r ? ratio(r.ebitda, r.revenue) : null; };
  const ocfConv = (k: number): Num => { const r = at(k), e = eAdj(k); return r && e != null && e > 0 ? ratio(r.operatingCashFlow, e) : null; };
  const fcf = (k: number): Num => { const r = at(k); return r && r.operatingCashFlow != null && r.capex != null ? r.operatingCashFlow - r.capex : null; };
  const owc = (k: number): Num => { const r = at(k); return r && r.receivables != null && r.inventory != null && r.payables != null ? r.receivables + r.inventory - r.payables : null; };
  const netDebt = (k: number): Num => { const r = at(k); return r && r.debt != null && r.cash != null ? r.debt - r.cash : null; };
  const cover = (k: number): Num => { const r = at(k), e = eAdj(k); return r && r.interestExpense != null && r.interestExpense > 0 && e != null ? e / r.interestExpense : null; };
  const currentRatio = (k: number): Num => { const r = at(k); return r ? r.reportedCurrentRatio ?? ratio(r.currentAssets, r.currentLiabilities) : null; };
  const quickRatio = (k: number): Num => {
    const r = at(k);
    if (!r) return null;
    if (r.reportedQuickRatio != null) return r.reportedQuickRatio;
    return r.currentAssets != null && r.inventory != null && r.currentLiabilities ? (r.currentAssets - r.inventory) / r.currentLiabilities : null;
  };
  const dscr = (k: number): Num => {
    const r = at(k);
    if (!r || r.operatingCashFlow == null || r.interestExpense == null || r.principalRepayment == null) return null;
    const service = r.interestExpense + r.principalRepayment;
    return service > 0 ? (r.operatingCashFlow + r.interestExpense) / service : null; // OCF is after interest paid, so interest is added back
  };

  const out: Indicator[] = [];
  const add = (d: Def, level: Severity | null, actual: string, previous: string, benchmark: string, explanation: string, requires: string[] = []) =>
    out.push({
      id: d.id, pillar: d.pillar, name: d.name, max: d.max, level,
      points: level == null ? null : Math.round(d.max * LEVEL_SHARE[level] * 10) / 10,
      actual, previous, benchmark, explanation, requires, questions: d.questions,
      applicable: true, relevance: ctx.relevance(d.id as IndId), bench: null,
    });
  const na = (d: Def, why: string, requires: string[], benchmark = "—") => add(d, null, DASH, DASH, benchmark, why, requires);

  // ---------------------------------------------------------------- Quality of earnings (25)
  {
    const d: Def = { id: "adj", pillar: "qoe", name: "EBITDA adjustments and unusual earnings", max: 10, questions: ["Provide the bridge from reported to adjusted EBITDA, line by line, with supporting documents.", "Which adjustments are one-off and which have recurred in prior years?", "Who approved each adjustment and has it been reviewed by an independent adviser?"] };
    const adj = adjustmentAmount(c, inputs, true), st = inputs.adjustmentStatus;
    if (adj == null || !st) na(d, "No EBITDA adjustment has been entered. Enter the adjustment and how well it is documented in the Quality of Earnings tab. Adjusted EBITDA is taken as equal to reported EBITDA until then.", ["EBITDA adjustment amount", "Adjustment support status"], "Verified → Low · needs documents → Moderate · unsupported → High · unexplained → Critical");
    else {
      const share = c.ebitda ? (Math.abs(adj) / Math.abs(c.ebitda)) * 100 : null;
      let lv: Severity = st === "verified" ? "Low" : st === "needs-docs" ? "Medium" : st === "unsupported" ? "High" : "Critical";
      if (lv === "Low" && share != null && share > 20) lv = "Medium";
      const label = { verified: "verified", "needs-docs": "needs documentation", unsupported: "unsupported", unexplained: "unexplained" }[st];
      add(d, lv, `${fmtM(adj)} (${pc(share)} of reported EBITDA), ${label}`, DASH, "Support status; a verified adjustment above 20% of EBITDA is still treated as Moderate", `Only adjustments marked verified are added to EBITDA. ${st === "verified" ? "This one is included in adjusted EBITDA." : "This one is not counted in adjusted EBITDA until it is verified."} One-off labels are not assumed legitimate.`);
    }
  }
  {
    const d: Def = { id: "revq", pillar: "qoe", name: "Revenue quality and cash evidence", max: 5, questions: ["Provide receivables ageing and cash received after the year-end for the largest customers.", "Have credit terms or customer mix changed?", "Is any revenue recognised ahead of billing or acceptance?"] };
    const rg = p ? pct(c.revenue, p.revenue) : null, rec = p ? pct(c.receivables, p.receivables) : null;
    if (rg == null || rec == null) na(d, "Needs revenue and receivables for two consecutive years.", ["Revenue (2 years)", "Receivables (2 years)"], "Receivables growth less revenue growth: ≤ 0 pp Low · ≤ 10 Moderate · ≤ 30 High · above Critical");
    else {
      const gap = rec - rg;
      add(d, gap <= 0 ? "Low" : gap <= 10 ? "Medium" : gap <= 30 ? "High" : "Critical", `Revenue ${sg(rg, 1, "%")} vs receivables ${sg(rec, 1, "%")} (${pp(gap)})`, DASH, "Receivables growth less revenue growth: ≤ 0 pp Low · ≤ 10 Moderate · ≤ 30 High · above Critical", gap > 0 ? "Revenue is growing but collections are not keeping pace. The extra sales are sitting in receivables rather than arriving as cash." : "Receivables are not outpacing revenue: growth looks supported by collections.");
    }
  }
  {
    const d: Def = { id: "margin", pillar: "qoe", name: "EBITDA margin deterioration", max: 5, questions: ["What drove the change in EBITDA margin: price, mix, input costs or overheads?", "Is the current margin sustainable?"] };
    const mC = margin(0), mP = margin(1);
    if (mC == null || mP == null) na(d, "Needs revenue and EBITDA for two consecutive years.", ["Revenue", "EBITDA"], B.margin);
    else {
      const dm = (mC - mP) * 100;
      add(d, down(dm, T.margin), `${pc(mC * 100)} (${pp(dm)})`, pc(mP * 100), B.margin, dm < -0.5 ? "EBITDA margin has fallen: profit is growing more slowly than revenue." : "EBITDA margin is stable or improving.");
    }
  }
  {
    const d: Def = { id: "vol", pillar: "qoe", name: "Three-year earnings volatility", max: 5, questions: ["Explain each year in which EBITDA fell.", "How much EBITDA is recurring versus project-based or cyclical?"] };
    if (n < 3) na(d, "Needs at least three years of EBITDA to judge consistency.", ["EBITDA (3 years)"], "Worst YoY fall in the last three periods: none Low · ≤ 10% Moderate · ≤ 25% High · above Critical");
    else {
      const ch: number[] = [];
      for (let k = 0; k < Math.min(3, n - 1); k++) { const g = pct(at(k)!.ebitda, at(k + 1)!.ebitda); if (g != null) ch.push(g); }
      if (ch.length < 2) na(d, "EBITDA is missing for some years.", ["EBITDA (3 years)"]);
      else {
        const fall = Math.min(0, ...ch);
        add(d, fall === 0 ? "Low" : fall >= -10 ? "Medium" : fall >= -25 ? "High" : "Critical", `YoY EBITDA changes ${ch.slice().reverse().map((g) => sg(g, 1, "%")).join(", ")}`, DASH, "Worst YoY fall in the last three periods: none Low · ≤ 10% Moderate · ≤ 25% High · above Critical", fall === 0 ? "EBITDA rose in every recent period." : `EBITDA fell by up to ${Math.abs(fall).toFixed(1)}% in a recent period, an inconsistent earnings pattern.`);
      }
    }
  }

  // ---------------------------------------------------------------- Cash flow sustainability (25)
  {
    const d: Def = { id: "ocf", pillar: "cash", name: "EBITDA-to-operating-cash conversion", max: 10, questions: ["Reconcile EBITDA to operating cash flow for each of the last three years.", "How much of the gap is working capital, tax, interest or one-off items?"] };
    const e = eAdj(0);
    if (e == null || c.operatingCashFlow == null) na(d, "Needs EBITDA and operating cash flow.", ["EBITDA", "Operating cash flow"], B.ocf);
    else if (e <= 0) add(d, "Critical", `EBITDA ${fmtM(e)}, OCF ${fmtM(c.operatingCashFlow)}`, DASH, B.ocf, "EBITDA is not positive, so earnings are not turning into cash by definition.");
    else {
      const v = ocfConv(0)! * 100;
      add(d, down(v, T.ocf), `${pc(v)} (OCF ${fmtM(c.operatingCashFlow)} ÷ EBITDA ${fmtM(e)})`, pc(ocfConv(1) == null ? null : ocfConv(1)! * 100), B.ocf, v >= 80 ? "Most reported EBITDA is converting to operating cash." : "A material share of reported EBITDA is not arriving as operating cash.");
    }
  }
  {
    const d: Def = { id: "fcf", pillar: "cash", name: "Free cash flow conversion", max: 10, questions: ["Split capex into maintenance and growth.", "Is operating cash flow sufficient to fund capex without new borrowing?"] };
    const e = eAdj(0), f = fcf(0);
    if (e == null || f == null) na(d, "Needs operating cash flow and capital expenditure.", ["Capital expenditure"], B.fcf);
    else if (e <= 0) add(d, "Critical", `FCF ${fmtM(f)} on EBITDA ${fmtM(e)}`, DASH, B.fcf, "EBITDA is not positive.");
    else {
      const v = (f / e) * 100;
      let lv = down(v, T.fcf);
      const notes: string[] = [];
      if (c.operatingCashFlow! < c.capex!) notes.push("Operating cash flow does not cover capex.");
      const ds = c.interestExpense != null && c.principalRepayment != null ? c.interestExpense + c.principalRepayment : null;
      if (ds != null && f < ds) { notes.push(`Free cash flow (${fmtM(f)}) is below scheduled debt service (${fmtM(ds)}).`); lv = worst(lv, "High"); }
      const pf = fcf(1), pe = eAdj(1);
      add(d, lv, `${pc(v)} (FCF ${fmtM(f)})`, pf != null && pe ? `${pc((pf / pe) * 100)} (FCF ${fmtM(pf)})` : DASH, B.fcf + ". A positive ratio alone is not treated as low risk.", notes.length ? notes.join(" ") : "Cash left after capex is a healthy share of EBITDA.");
    }
  }
  {
    const d: Def = { id: "cons", pillar: "cash", name: "Historical cash-flow consistency", max: 5, questions: ["Explain the movement in operating cash flow year by year.", "Is EBITDA growth being matched by cash growth, and if not, why?"] };
    if (n < 3 || [0, 1, 2].some((k) => at(k)!.operatingCashFlow == null)) na(d, "Needs operating cash flow for three consecutive years.", ["Operating cash flow (3 years)"], "Count of issues: 0 Low · 1 Moderate · 2–3 High · 4+ Critical");
    else {
      const ks = [2, 1, 0];
      const issues: string[] = [];
      const neg = ks.filter((k) => at(k)!.operatingCashFlow! < 0).length;
      if (neg) issues.push(`${neg} year${neg > 1 ? "s" : ""} of negative operating cash flow`);
      const fs = ks.map(fcf);
      if (fs.every((x) => x != null) && fs[1]! < fs[0]! && fs[2]! < fs[1]!) issues.push("free cash flow fell two years running");
      let noCash = 0;
      for (const k of [1, 0]) { const e0 = at(k + 1)!.ebitda, e1 = at(k)!.ebitda, o0 = at(k + 1)!.operatingCashFlow!, o1 = at(k)!.operatingCashFlow!; if (e0 != null && e1 != null && e1 > e0 && o1 <= o0) noCash++; }
      if (noCash) issues.push(`EBITDA grew without operating cash flow growth in ${noCash} of the last 2 years`);
      const swing = [1, 0].some((k) => { const g = pct(at(k)!.operatingCashFlow, at(k + 1)!.operatingCashFlow); return g != null && Math.abs(g) > 40; });
      if (swing) issues.push("operating cash flow swung by more than 40% in a year");
      const count = (neg > 1 ? 2 : neg) + (issues.length - (neg ? 1 : 0));
      add(d, count === 0 ? "Low" : count === 1 ? "Medium" : count <= 3 ? "High" : "Critical", `OCF ${ks.map((k) => fmtM(at(k)!.operatingCashFlow)).join(" → ")}`, DASH, "Count of issues: 0 Low · 1 Moderate · 2–3 High · 4+ Critical", issues.length ? `Flagged: ${issues.join("; ")}.` : "Operating cash flow is steady and moves with EBITDA.");
    }
  }

  // ---------------------------------------------------------------- Working capital (20)
  const dayChange = (m: "dso" | "dio" | "dpo") => (mc && mp && mc[m] != null && mp[m] != null ? (mc[m] as number) - (mp[m] as number) : null);
  {
    const d: Def = { id: "dso", pillar: "wc", name: "Receivables collection performance", max: 7, questions: ["Provide receivables ageing by customer (30/60/90+ days) and the top-10 balances.", "Have credit terms, customer mix or collection practices changed?", "How much has been collected since the year-end?"] };
    const ch = dayChange("dso");
    if (ch == null) na(d, "Needs receivables (or reported DSO) and sales for two years.", ["Receivables", "Revenue"], B.dso + ". Trend threshold; the level is also judged against the industry benchmark where one exists.");
    else add(d, up(ch, T.dso, false), `${fmtDays(mc.dso)} (${sg(ch, 1, " d")})`, fmtDays(mp!.dso), B.dso + ". Trend threshold; the level is also judged against the industry benchmark where one exists.", ch > 2 ? "Customers are taking longer to pay. Overdue balances can't be seen without ageing data." : "Collection period is stable or improving.");
  }
  {
    const d: Def = { id: "dio", pillar: "wc", name: "Inventory efficiency", max: 5, questions: ["Provide inventory ageing and the provision for slow-moving stock.", "Is stock being built ahead of confirmed orders?", "What are the open purchase commitments?"] };
    const ch = dayChange("dio");
    if (ch == null) na(d, "Needs inventory (or reported DIO) and COGS for two years. Some businesses hold little or no inventory.", ["Inventory", "COGS"], B.dio);
    else {
      const ig = p ? pct(c.inventory, p.inventory) : null, rg = p ? pct(c.revenue, p.revenue) : null;
      add(d, up(ch, T.dio, false), `${fmtDays(mc.dio)} (${sg(ch, 1, " d")})${ig != null && rg != null ? `; inventory ${sg(ig, 1, "%")} vs revenue ${sg(rg, 1, "%")}` : ""}`, fmtDays(mp!.dio), B.dio, ch > 2 ? "Stock is turning more slowly. Slow-moving or obsolete stock can't be confirmed without SKU-level data." : "Inventory turnover is stable or improving.");
    }
  }
  {
    const d: Def = { id: "dpo", pillar: "wc", name: "Payables sustainability", max: 3, questions: ["Are any suppliers being paid late or on revised terms?", "Is supplier financing or reverse factoring in use?"] };
    const ch = dayChange("dpo");
    if (ch == null) na(d, "Needs payables (or reported DPO) and COGS or purchases for two years.", ["Payables", "COGS or purchases"], "Absolute change in DPO: ≤ 5 days Low · ≤ 12 Moderate · ≤ 20 High · above Critical");
    else add(d, up(Math.abs(ch), [5, 12, 20], false), `${fmtDays(mc.dpo)} (${sg(ch, 1, " d")})`, fmtDays(mp!.dpo), "Absolute change in DPO: ≤ 5 days Low · ≤ 12 Moderate · ≤ 20 High · above Critical", ch > 5 ? "Suppliers are being paid more slowly. This can be sustainable financing or a sign of cash pressure; it needs to be told apart." : ch < -5 ? "Suppliers are being paid faster, so less supplier financing is available." : "Payment period is stable.");
  }
  {
    const d: Def = { id: "owc", pillar: "wc", name: "Overall working-capital deterioration", max: 5, questions: ["Is the business consuming cash to grow? Quantify working capital per additional dirham of revenue.", "What is the normal level of working capital needed to run the business?"] };
    const oC = owc(0), oP = owc(1);
    if (oC == null || oP == null || c.revenue == null || p?.revenue == null) na(d, "Needs receivables, inventory and payables for two years.", ["Receivables", "Inventory", "Payables"], "Change in operating working capital as a % of revenue: ≤ +1 pp Low · ≤ +3 Moderate · ≤ +6 High · above Critical");
    else {
      const sC = (oC / c.revenue) * 100, sP = (oP / p.revenue) * 100, dd = sC - sP;
      const dR = c.revenue - p.revenue;
      add(d, up(dd, [1, 3, 6], false), `OWC ${fmtM(oC)} = ${pc(sC)} of revenue (${pp(dd)})`, `${fmtM(oP)} = ${pc(sP)}`, "Change in operating working capital as a % of revenue: ≤ +1 pp Low · ≤ +3 Moderate · ≤ +6 High · above Critical", `Working capital rose ${fmtM(oC - oP)} while revenue rose ${fmtM(dR)}${dR > 0 ? ` (${Math.round(((oC - oP) / dR) * 100)}% absorbed)` : ""}. Scored on cash consumed, not on DSO/DIO again; the cash conversion cycle (${fmtDays(mc.ccc)}) is shown as a cross-check only, so the same deterioration is not penalised twice.`);
    }
  }

  // ---------------------------------------------------------------- Debt and repayment (20)
  {
    const d: Def = { id: "lev", pillar: "debt", name: "Net debt / EBITDA", max: 7, questions: ["Provide the debt schedule: lenders, amounts, rates and maturities.", "What leverage do the covenants allow and what is the headroom?", "Is EBITDA adjusted in the lenders' definitions?"] };
    const nd = netDebt(0), e = eAdj(0);
    if (nd == null || e == null) na(d, "Needs total debt, cash and EBITDA.", ["Total debt", "Cash", "EBITDA"], B.lev);
    else if (nd <= 0) add(d, "Low", `Net cash ${fmtM(-nd)}`, netDebt(1) != null ? `${fmtM(netDebt(1))} net debt` : DASH, B.lev, "Cash exceeds debt.");
    else if (e <= 0) add(d, "Critical", `Net debt ${fmtM(nd)} on EBITDA ${fmtM(e)}`, DASH, B.lev, "EBITDA is not positive, so leverage is not meaningful and is scored at maximum.");
    else { const v = nd / e; const pv = netDebt(1) != null && eAdj(1) ? netDebt(1)! / eAdj(1)! : null; add(d, up(v, T.lev), `${fmtX(v)} (net debt ${fmtM(nd)} ÷ EBITDA ${fmtM(e)})`, fmtX(pv), B.lev + " (proposed screening thresholds, not industry standards)", v < 2 ? "Leverage is comfortable." : "Leverage is meaningful relative to earnings and gets harder to carry if cash conversion is weak."); }
  }
  {
    const d: Def = { id: "int", pillar: "debt", name: "Interest coverage", max: 5, questions: ["What are the interest rates and are they fixed or floating?", "What is the exposure to rate rises on refinancing?"] };
    const v = cover(0);
    if (v == null) na(d, "Needs EBITDA and cash interest expense. Providers sometimes mark coverage “NM/NA” when interest is negligible.", ["Cash interest expense"], B.cover);
    else add(d, down(v, T.cover), `${fmtX(v, 1)} (EBITDA ${fmtM(eAdj(0))} ÷ interest ${fmtM(c.interestExpense)})`, fmtX(cover(1), 1), B.cover, v >= 5 ? "Earnings cover interest many times over." : "Interest takes a large share of earnings.");
  }
  {
    const d: Def = { id: "dscr", pillar: "debt", name: "Debt service coverage ratio", max: 5, questions: ["Provide the scheduled principal repayments for the next three years.", "Is the facility structure amortising or bullet, and what is the refinancing plan?"] };
    const v = dscr(0);
    if (v == null) na(d, "Needs operating cash flow, interest and scheduled principal repayment. Repayment schedules are not in most financial statements.", ["Cash interest expense", "Scheduled principal repayment"], B.dscr);
    else add(d, down(v, T.dscr), `${fmtX(v)} (CFADS ${fmtM(c.operatingCashFlow! + c.interestExpense!)} ÷ debt service ${fmtM(c.interestExpense! + c.principalRepayment!)})`, fmtX(dscr(1)), B.dscr + ". Cash flow available for debt service is operating cash flow with interest added back, as OCF is struck after interest paid.", v >= 1.5 ? "Cash flow comfortably covers interest and principal." : v >= 1 ? "Little headroom between cash flow and debt service." : "Cash flow does not cover scheduled debt service.");
  }
  {
    const d: Def = { id: "mat", pillar: "debt", name: "Debt maturity concentration", max: 3, questions: ["Which facilities fall due in the next 12 months and are they committed for renewal?", "Are working-capital lines being used to fund long-term needs?"] };
    if (c.shortTermDebt == null || c.debt == null || c.debt <= 0) na(d, "Needs the portion of debt due within 12 months.", ["Debt due within 12 months"], "Debt due within 12 months ÷ total debt: < 30% Low · < 50% Moderate · < 70% High · ≥ 70% Critical");
    else { const v = (c.shortTermDebt / c.debt) * 100; const pv = p?.shortTermDebt != null && p.debt ? (p.shortTermDebt / p.debt) * 100 : null; add(d, up(v, [30, 50, 70]), `${pc(v)} (${fmtM(c.shortTermDebt)} of ${fmtM(c.debt)})`, pc(pv), "Debt due within 12 months ÷ total debt: < 30% Low · < 50% Moderate · < 70% High · ≥ 70% Critical", "A high short-term share means heavy refinancing dependence."); }
  }

  // ---------------------------------------------------------------- Liquidity and stress (10)
  const st = c ? runStress(c, eAdj(0), DEFAULT_STRESS) : null;
  {
    const d: Def = { id: "liqr", pillar: "liq", name: "Cash and short-term liquidity adequacy", max: 4, questions: ["What undrawn, committed facilities are available?", "What is the minimum operating cash balance the business needs?"] };
    const cr = currentRatio(0), qr = quickRatio(0);
    if (cr == null && qr == null) na(d, "Needs current assets and current liabilities (or reported current and quick ratios).", ["Current assets", "Current liabilities"], B.liq);
    else {
      const lv = worst(...([cr != null ? down(cr, T.cr) : null, qr != null ? down(qr, T.qr) : null].filter((x) => x) as Severity[]));
      add(d, lv, `Current ${fmtX(cr)} · quick ${fmtX(qr)}`, `Current ${fmtX(currentRatio(1))} · quick ${fmtX(quickRatio(1))}`, B.liq, lv === "Low" ? "Short-term assets comfortably exceed short-term obligations." : "Short-term obligations are large relative to liquid assets.");
    }
  }
  {
    const d: Def = { id: "down", pillar: "liq", name: "Revenue and EBITDA downside scenario", max: 3, questions: ["What is the sensitivity of EBITDA to a 10% revenue fall: how much cost is fixed?", "What management actions are available in a downturn?"] };
    const nd = netDebt(0);
    if (!st || st.stressedEbitda == null || nd == null) na(d, "Needs revenue, EBITDA, debt and cash.", ["Revenue", "EBITDA", "Debt", "Cash"], B.levStress);
    else {
      const lv: Severity = nd <= 0 ? "Low" : st.stressedEbitda <= 0 ? "Critical" : up(nd / st.stressedEbitda, T.lev);
      add(d, lv, `EBITDA ${fmtM(st.baseEbitda)} → ${fmtM(st.stressedEbitda)}; leverage ${nd <= 0 ? "net cash" : st.stressedNetDebtToEbitda == null ? DASH : fmtX(st.stressedNetDebtToEbitda)}`, DASH, B.levStress, "Illustrative scenario, not a forecast.");
    }
  }
  {
    const d: Def = { id: "res", pillar: "liq", name: "Cash-flow resilience under stress", max: 3, questions: ["How quickly could working capital be released if collections slowed?", "What covenant or facility triggers would a downturn activate?"] };
    if (!st || st.stressedOcf == null || st.requirement == null || c.cash == null) na(d, "Needs operating cash flow, capex or scheduled principal, EBITDA and cash.", ["Capital expenditure", "Cash"], "Shortfall after stress (capex + principal − stressed OCF): none Low · covered 1.5x by cash Moderate · covered by cash High · otherwise Critical");
    else {
      const sf = st.shortfall ?? 0;
      const lv: Severity = sf === 0 ? "Low" : c.cash >= 1.5 * sf ? "Medium" : c.cash >= sf ? "High" : "Critical";
      add(d, lv, `Stressed OCF ${fmtM(st.stressedOcf)} vs need ${fmtM(st.requirement)}; shortfall ${fmtM(sf)}`, DASH, "Shortfall after stress (capex + principal − stressed OCF): none Low · covered 1.5x by cash Moderate · covered by cash High · otherwise Critical", `All four default scenarios applied together. ${st.requirementNote} Illustrative, not a forecast.`);
    }
  }

  // ---------------------------------------------------------------- industry layer
  // 1) not-applicable indicators leave the score; 2) a company's level is also judged against the industry benchmark
  // (worst of trend and benchmark); 3) low-relevance indicators are capped at Moderate; 4) benchmark context is attached.
  const setLevel = (i: Indicator, lv: Severity | null) => { i.level = lv; i.points = lv == null ? null : Math.round(i.max * LEVEL_SHARE[lv] * 10) / 10; };
  const byId = (id: string) => out.find((x) => x.id === id)!;
  const vsBench = (id: "dso" | "dio" | "dpo" | "margin") => {
    const i = byId(id);
    if (i.relevance === "na") return;
    const m = INDICATOR_METRIC[id]!;
    const b = ctx.bench(m);
    const v = id === "margin" ? (margin(0) == null ? null : margin(0)! * 100) : mc?.[id] ?? null;
    if (v == null || b.status === "unavailable") return;
    let lv: Severity | null = null;
    if (id === "margin") { if (b.low != null) lv = v >= b.low ? "Low" : v >= 0.5 * b.low && v >= 0 ? "Medium" : "High"; }
    else if (id === "dpo") { if (b.high != null) lv = v > 1.5 * b.high ? "Medium" : "Low"; }
    else if (b.high != null) lv = v <= b.high ? "Low" : v <= 1.25 * b.high ? "Medium" : v <= 1.5 * b.high ? "High" : "Critical";
    if (lv == null) return;
    const cmp = `${METRIC[m].label} ${fmtBench(v, m)} against a ${ctx.name} median of ${fmtBench(b.median, m)} (typical range ${benchRange(b, m)}).`;
    if (i.level == null) { setLevel(i, lv); i.actual = fmtBench(v, m); i.explanation = `Assessed on the industry benchmark alone (no prior year to measure a trend). ${cmp}`; i.requires = []; }
    else { const w = worst(i.level, lv); if (w !== i.level) { setLevel(i, w); i.explanation += ` Raised to ${levelName(w)} because the level is outside the industry benchmark. ${cmp}`; } else i.explanation += ` ${cmp}`; }
  };
  (["dso", "dio", "dpo", "margin"] as const).forEach(vsBench);
  { // the cash conversion cycle is a diagnostic only: shown against its benchmark on the working-capital indicator, never scored
    const b = ctx.bench("ccc"), o = byId("owc");
    if (b.status !== "unavailable" && mc?.ccc != null && o.relevance !== "na") o.explanation += ` Cash conversion cycle ${fmtBench(mc.ccc, "ccc")} versus an industry median of ${fmtBench(b.median, "ccc")} (diagnostic only, not scored).`;
  }
  for (const i of out) {
    if (i.relevance === "na") {
      i.applicable = false; i.level = null; i.points = null; i.actual = DASH; i.previous = DASH; i.requires = [];
      i.explanation = `Not Applicable to ${ctx.name}. ${ctx.def?.focus ?? ""}`.trim();
    } else if (i.relevance === "low" && i.level && (i.level === "High" || i.level === "Critical")) {
      setLevel(i, "Medium"); i.explanation += ` Capped at Moderate: this indicator has low relevance for ${ctx.name}.`;
    }
    const m = INDICATOR_METRIC[i.id as IndId];
    if (i.applicable) {
      const b = m ? ctx.bench(m) : null;
      i.bench = b && b.status !== "unavailable"
        ? { metric: METRIC[m!].label, median: fmtBench(b.median, m!), range: benchRange(b, m!), threshold: i.benchmark, source: b.source, tier: b.tier, reliability: b.reliability, geography: b.geography, year: `${b.year}, updated ${b.updated}`, status: b.status as "sourced" | "custom", note: b.note, url: b.url }
        : { metric: m ? METRIC[m].label : i.name, median: "Industry Benchmark Unavailable", range: "—", threshold: i.benchmark, source: "None. Scored on a proposed screening threshold, not an industry average.", tier: "Proposed screening threshold", reliability: "Proposed screening threshold", geography: "n/a", year: "n/a", status: "unavailable", note: "No verified benchmark exists for this indicator in the supported sources. You can enter your own under Thresholds." };
    }
  }

  // ---------------------------------------------------------------- roll-up
  const categories: RiskCategory[] = PILLARS.map((pl) => {
    const inds = out.filter((i) => i.pillar === pl.id);
    const assessed = inds.filter((i) => i.points != null);
    const max = assessed.reduce((s, i) => s + i.max, 0);
    const points = assessed.length ? Math.round(assessed.reduce((s, i) => s + (i.points ?? 0), 0) * 10) / 10 : null;
    const top = [...assessed].sort((a, b) => (b.points ?? 0) / b.max - (a.points ?? 0) / a.max || b.max - a.max)[0];
    return {
      id: pl.id, name: pl.name, weight: pl.weight, max, points,
      severity: points == null ? "Low" : pillarSeverity(points, max),
      prev: top?.previous ?? DASH, curr: top?.actual ?? DASH,
      evidence: top ? `${top.name}: ${top.actual}` : `${assessed.length} of ${inds.length} indicators could be assessed.`,
      explanation: assessed.length ? `${assessed.length} of ${inds.filter((i) => i.applicable).length} applicable indicators assessed (${max} of ${inds.filter((i) => i.applicable).reduce((t, i) => t + i.max, 0)} applicable points).` : inds.every((i) => !i.applicable) ? `No indicator in this pillar applies to ${ctx.name}.` : "No indicator in this pillar could be assessed from the supplied data.",
      questions: [...assessed].filter((i) => (i.points ?? 0) > 0).sort((a, b) => (b.points ?? 0) / b.max - (a.points ?? 0) / a.max).flatMap((i) => i.questions).slice(0, 4),
      indicators: inds,
    };
  });

  const assessedInds = out.filter((i) => i.points != null);
  const rawPoints = Math.round(assessedInds.reduce((s, i) => s + (i.points ?? 0), 0) * 10) / 10;
  const maxEvaluated = assessedInds.reduce((s, i) => s + i.max, 0);
  const applicableMax = out.filter((i) => i.applicable).reduce((s, i) => s + i.max, 0);
  const coverage = applicableMax ? Math.round((maxEvaluated / applicableMax) * 100) : 0;
  const insufficient = coverage < MIN_COVERAGE || maxEvaluated === 0;
  const score = insufficient ? null : Math.round((rawPoints / maxEvaluated) * 100);

  const warnings: string[] = [];
  for (const i of out) if (i.points == null && i.applicable) warnings.push(`${i.name} not assessed: needs ${i.requires.join(" and ").toLowerCase()}.`);
  if (!ctx.selected) warnings.push("No industry selected: generic proposed screening thresholds are used and no industry benchmarks are applied.");
  if (out.some((i) => !i.applicable)) warnings.push(`${out.filter((i) => !i.applicable).length} indicator(s) are Not Applicable to ${ctx.name} and are excluded from the score.`);
  if (c.ebitda != null && (inputs.adjustmentStatus !== "verified" || adjustmentAmount(c, inputs, true) == null)) warnings.push("Adjusted EBITDA equals reported EBITDA: no verified adjustments have been entered.");
  if (metrics.some((m) => m.approximate)) warnings.push("The earliest year uses closing balances only for working-capital days.");

  // confidence is about the evidence behind the score, not about how risky the company is
  const reasons = [`${coverage}% of the applicable model could be assessed`, ctx.selected ? `industry: ${ctx.name}` : "no industry selected (generic thresholds)", `${n} annual period${n === 1 ? "" : "s"} of history`];
  const approx = metrics.some((m) => m.approximate);
  if (approx) reasons.push("earliest-year working-capital days use closing balances only");
  if (inputs.adjustmentStatus !== "verified") reasons.push("EBITDA adjustments are not verified");
  const confLevel: "High" | "Medium" | "Low" = insufficient ? "Low" : maxEvaluated >= 85 && n >= 3 && !approx ? "High" : maxEvaluated >= 60 ? "Medium" : "Low";

  return {
    score, rawPoints, maxEvaluated, insufficient, confidence: { level: confLevel, reasons },
    classification: score == null ? "Insufficient Data" : classify(score),
    evaluated: assessedInds.length, total: out.filter((i) => i.applicable).length, coverage,
    notApplicable: out.filter((i) => !i.applicable).length,
    industry: { name: ctx.name, sub: ctx.subName, selected: ctx.selected, focus: ctx.def?.focus ?? "No industry selected: generic proposed screening thresholds are in use." },
    categories, warnings,
  };
}

/** flat list of every indicator, for tables and heatmaps */
export const allIndicators = (r: RiskResult): Indicator[] => r.categories.flatMap((c) => c.indicators);
