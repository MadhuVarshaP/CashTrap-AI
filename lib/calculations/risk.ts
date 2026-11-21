import type { Classification, FinancialRecord, Num, RiskCategory, RiskResult, Severity, YearMetrics } from "@/types/finance";
import { DASH, fmtDays, fmtPct, fmtX, fmtM, growth } from "@/lib/utilities/format";

export const MIN_INDICATORS = 4;

export const severityFor = (points: number, max: number): Severity => {
  const r = points / max;
  if (r === 0) return "Low";
  if (r < 0.5) return "Medium";
  if (r < 0.8) return "High";
  return "Critical";
};

export const classify = (score: number): Classification =>
  score < 25 ? "Low Risk" : score < 50 ? "Moderate Risk" : score < 75 ? "High Risk" : "Critical Risk";

const bucket = (delta: number, [a, b, c]: [number, number, number]) => (delta <= 0 ? 0 : delta <= 10 ? a : delta <= 20 ? b : c);

interface In {
  cur: YearMetrics;
  prev: YearMetrics | null;
  curR: FinancialRecord;
  prevR: FinancialRecord | null;
}

type Partial_ = Pick<RiskCategory, "points" | "prev" | "curr" | "evidence">;

function delta(a: Num, b: Num): Num {
  return a == null || b == null ? null : a - b;
}

const deltaCat = (
  label: string,
  metric: "dso" | "dio" | "ccc",
  pts: [number, number, number],
  { cur, prev }: In
): Partial_ => {
  const d = prev ? delta(cur[metric], prev[metric]) : null;
  if (d == null) return { points: null, prev: fmtDays(prev?.[metric] ?? null), curr: fmtDays(cur[metric]), evidence: `${label} could not be compared across two periods.` };
  return {
    points: d < 1 ? 0 : bucket(d, pts),
    prev: fmtDays(prev![metric]),
    curr: fmtDays(cur[metric]),
    evidence: `${label} ${d > 0 ? "rose" : "moved"} ${d >= 0 ? "+" : "−"}${Math.abs(d).toFixed(1)} days (${fmtDays(prev![metric])} → ${fmtDays(cur[metric])}).`,
  };
};

export function scoreRisk(i: In): RiskResult {
  const { cur, prev, curR, prevR } = i;

  const rec = deltaCat("DSO", "dso", [5, 10, 20], i);
  const inv = deltaCat("DIO", "dio", [5, 10, 15], i);
  const ccc = deltaCat("Cash conversion cycle", "ccc", [3, 6, 10], i);

  const cc = cur.cashConversion;
  const conv: Partial_ =
    cc == null
      ? { points: null, prev: fmtPct(prev?.cashConversion ?? null), curr: DASH, evidence: "Cash conversion needs positive EBITDA and operating cash flow." }
      : {
          points: cc >= 0.8 ? 0 : cc >= 0.5 ? 10 : cc >= 0.2 ? 20 : 25,
          prev: fmtPct(prev?.cashConversion ?? null),
          curr: fmtPct(cc),
          evidence: `Operating cash flow was ${fmtPct(cc)} of EBITDA (${fmtM(curR.operatingCashFlow)} vs ${fmtM(curR.ebitda)}).`,
        };

  const eg = growth(curR.ebitda, prevR?.ebitda ?? null);
  const og = growth(curR.operatingCashFlow, prevR?.operatingCashFlow ?? null);
  let div: Partial_;
  if (eg == null || og == null) {
    div = { points: null, prev: DASH, curr: DASH, evidence: "EBITDA and operating cash flow are needed for two periods." };
  } else {
    const pts = eg > 0.1 && og < -0.1 ? 20 : eg < 0 || og < 0 ? 10 : 0;
    div = {
      points: pts,
      prev: `EBITDA ${fmtM(prevR!.ebitda)} · OCF ${fmtM(prevR!.operatingCashFlow)}`,
      curr: `EBITDA ${fmtM(curR.ebitda)} · OCF ${fmtM(curR.operatingCashFlow)}`,
      evidence: `EBITDA ${fmtSigned(eg)} while operating cash flow ${fmtSigned(og)}.`,
    };
  }

  const lv = cur.netDebtToEbitda;
  const lever: Partial_ =
    lv != null
      ? { points: lv < 2 ? 0 : lv <= 3 ? 3 : lv <= 4 ? 7 : 10, prev: fmtX(prev?.netDebtToEbitda ?? null), curr: fmtX(lv), evidence: `Net debt of ${fmtM(cur.netDebt)} is ${fmtX(lv)} EBITDA.` }
      : cur.netDebt != null && curR.ebitda != null && curR.ebitda <= 0 && cur.netDebt > 0
        ? { points: 10, prev: fmtX(prev?.netDebtToEbitda ?? null), curr: "n.m.", evidence: `EBITDA is non-positive while net debt is ${fmtM(cur.netDebt)}; the ratio is not meaningful and is scored at maximum.` }
        : { points: null, prev: DASH, curr: DASH, evidence: "Debt, cash and EBITDA are required." };

  const defs: Array<[string, string, number, Partial_, string, string[]]> = [
    ["receivables", "Receivables Risk", 20, rec, "Rising DSO means customers are taking longer to pay, tying up cash and raising collectability questions.", ["Provide the ageing of receivables by customer and bucket.", "Have credit terms or customer mix changed?", "What provisions and write-offs were booked?"]],
    ["inventory", "Inventory Risk", 15, inv, "Rising DIO means stock is sitting longer, which may signal slow-moving or obsolete inventory.", ["Provide inventory ageing and obsolescence reserves.", "Is stock build intentional (pre-orders, price hedging)?", "What is the raw / WIP / finished goods split?"]],
    ["conversion", "Profit-to-Cash Conversion", 25, conv, "Low conversion means reported EBITDA is not turning into cash. Cash, not EBITDA, services debt.", ["Reconcile EBITDA to operating cash flow in detail.", "Which working-capital lines absorbed cash?", "Are there one-off cash items?"]],
    ["divergence", "EBITDA vs Operating Cash Flow", 20, div, "Improving profit alongside falling cash flow is a classic earnings-quality red flag worth investigating.", ["Review revenue recognition and cut-off policies.", "Were costs capitalised or deferred?", "Any change in factoring or supplier financing?"]],
    ["ccc", "Cash Conversion Cycle", 10, ccc, "A lengthening cycle means more working capital is needed to fund each unit of revenue.", ["Break the change into DSO, DIO and DPO drivers.", "Are suppliers being paid faster?", "What is the seasonal peak working-capital need?"]],
    ["leverage", "Leverage Risk", 10, lever, "Higher net debt relative to EBITDA reduces resilience, particularly when cash generation is weak.", ["Provide the debt maturity schedule and covenants.", "What is the headroom on financial covenants?", "Is EBITDA adjusted in lender definitions?"]],
  ];

  const categories: RiskCategory[] = defs.map(([id, name, max, p, explanation, questions]) => ({
    id, name, max, explanation, questions,
    ...p,
    severity: p.points == null ? "Low" : severityFor(p.points, max),
  }));

  const ev = categories.filter((c) => c.points != null);
  const rawPoints = ev.reduce((s, c) => s + (c.points as number), 0);
  const maxEvaluated = ev.reduce((s, c) => s + c.max, 0);
  const insufficient = ev.length < MIN_INDICATORS;
  const score = insufficient ? null : Math.round((rawPoints / maxEvaluated) * 100);
  return {
    score, rawPoints, maxEvaluated, insufficient,
    classification: score == null ? "Insufficient Data" : classify(score),
    evaluated: ev.length, total: categories.length, categories,
  };
}

function fmtSigned(g: number) {
  return `${g >= 0 ? "rose" : "fell"} ${Math.abs(g * 100).toFixed(1)}%`;
}
