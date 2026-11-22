import type { AssessmentInputs } from "@/types/finance";
import { resolveIndustry } from "@/lib/benchmarks/resolve";

/**
 * Proposed screening thresholds for the risk indicators. They are starting points the investor can change,
 * NOT published industry benchmarks: the presets only shift the cut-offs to what is commonly tolerated in that
 * kind of business, and every indicator shows the threshold it was judged against.
 */
export type Cuts = [number, number, number];

export interface ThresholdDef {
  key: string;
  label: string;
  unit: string;
  /** "higher is better" cuts read ≥ Low, ≥ Moderate, ≥ High; "lower is better" cuts read ≤ (or <) */
  dir: "min" | "max";
  defaults: Cuts;
}

export const THRESHOLD_DEFS: ThresholdDef[] = [
  { key: "ocf", label: "EBITDA-to-operating-cash conversion", unit: "%", dir: "min", defaults: [80, 50, 20] },
  { key: "fcf", label: "Free cash flow conversion", unit: "%", dir: "min", defaults: [50, 25, 0] },
  { key: "margin", label: "EBITDA margin change", unit: "pp", dir: "min", defaults: [-0.5, -2, -5] },
  { key: "dso", label: "Rise in DSO", unit: "days", dir: "max", defaults: [2, 7, 15] },
  { key: "dio", label: "Rise in DIO", unit: "days", dir: "max", defaults: [2, 7, 15] },
  { key: "lev", label: "Net debt / adjusted EBITDA", unit: "x", dir: "max", defaults: [2, 3, 4] },
  { key: "cover", label: "Interest coverage", unit: "x", dir: "min", defaults: [5, 3, 1.5] },
  { key: "dscr", label: "Debt service coverage", unit: "x", dir: "min", defaults: [1.5, 1.2, 1.0] },
  { key: "cr", label: "Current ratio", unit: "x", dir: "min", defaults: [1.5, 1.1, 0.8] },
  { key: "qr", label: "Quick ratio", unit: "x", dir: "min", defaults: [1.0, 0.7, 0.5] },
];

export type CutSource = "default" | "industry preset" | "benchmark-derived" | "custom override";
export type ResolvedCuts = Record<string, Cuts>;

const r1 = (v: number) => Math.round(v * 10) / 10;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * defaults → the industry's proposed screening preset → cut-offs derived from a verified (or user-entered) benchmark
 * → the investor's own overrides. Leverage and interest cover follow the industry benchmark when one exists.
 */
export function resolveThresholds(inputs: AssessmentInputs): { industry: string; cuts: ResolvedCuts; customised: string[]; sources: Record<string, CutSource> } {
  const ctx = resolveIndustry(inputs);
  const preset = ctx.def?.cuts ?? {};
  const cuts: ResolvedCuts = {};
  const sources: Record<string, CutSource> = {};
  const customised: string[] = [];
  const lev = ctx.bench("debtEbitda"), cov = ctx.bench("intCover");
  for (const d of THRESHOLD_DEFS) {
    let c: Cuts = (preset[d.key] ?? d.defaults) as Cuts;
    let src: CutSource = preset[d.key] ? "industry preset" : "default";
    if (d.key === "lev" && lev.median != null) { const m = clamp(lev.median, 1.5, 4); c = [r1(m), r1(m + 1), r1(m + 2)]; src = "benchmark-derived"; }
    if (d.key === "cover" && cov.median != null) { const m = clamp(cov.median, 3, 8); c = [r1(m), r1(m * 0.6), r1(m * 0.3)]; src = "benchmark-derived"; }
    const o = inputs.thresholds?.[d.key];
    const valid = o && o.length === 3 && o.every((x) => Number.isFinite(x)) && (d.dir === "min" ? o[0] >= o[1] && o[1] >= o[2] : o[0] <= o[1] && o[1] <= o[2]);
    if (valid) { customised.push(d.key); c = o as Cuts; src = "custom override"; }
    cuts[d.key] = c; sources[d.key] = src;
  }
  return { industry: ctx.name, cuts, customised, sources };
}

const n = (v: number) => String(v).replace("-", "−");

/** human-readable threshold text for each adjustable indicator, generated from the cuts actually in force */
export function benchmarks(c: ResolvedCuts) {
  const sgn = (v: number) => (v > 0 ? `+${v}` : n(v));
  return {
    ocf: `OCF ÷ adjusted EBITDA: ≥ ${c.ocf[0]}% Low · ≥ ${c.ocf[1]}% Moderate · ≥ ${c.ocf[2]}% High · below or negative Critical`,
    fcf: `FCF ÷ adjusted EBITDA: ≥ ${c.fcf[0]}% Low · ≥ ${c.fcf[1]}% Moderate · ≥ ${c.fcf[2]}% High · below Critical`,
    margin: `Change in margin: ≥ ${n(c.margin[0])} pp Low · ≥ ${n(c.margin[1])} Moderate · ≥ ${n(c.margin[2])} High · below Critical`,
    dso: `Change in DSO: ≤ ${sgn(c.dso[0])} days Low · ≤ ${sgn(c.dso[1])} Moderate · ≤ ${sgn(c.dso[2])} High · above Critical`,
    dio: `Change in DIO: ≤ ${sgn(c.dio[0])} days Low · ≤ ${sgn(c.dio[1])} Moderate · ≤ ${sgn(c.dio[2])} High · above Critical`,
    lev: `Net debt ÷ adjusted EBITDA: < ${c.lev[0]}x Low · ${c.lev[0]}–${c.lev[1]}x Moderate · ${c.lev[1]}–${c.lev[2]}x High · above ${c.lev[2]}x Critical`,
    levStress: `Net debt ÷ stressed EBITDA (revenue −10%, margin −3 pp): < ${c.lev[0]}x Low · ≤ ${c.lev[1]}x Moderate · ≤ ${c.lev[2]}x High · above or EBITDA ≤ 0 Critical`,
    cover: `EBITDA ÷ cash interest: ≥ ${c.cover[0]}x Low · ≥ ${c.cover[1]}x Moderate · ≥ ${c.cover[2]}x High · below Critical`,
    dscr: `(OCF + interest) ÷ (interest + scheduled principal): ≥ ${c.dscr[0]}x Low · ≥ ${c.dscr[1]}x Moderate · ≥ ${c.dscr[2]}x High · below Critical`,
    liq: `Current ratio: ≥ ${c.cr[0]} Low · ≥ ${c.cr[1]} Moderate · ≥ ${c.cr[2]} High · below Critical. Quick ratio: ≥ ${c.qr[0]} · ≥ ${c.qr[1]} · ≥ ${c.qr[2]} · below. Worse of the two applies.`,
  };
}
