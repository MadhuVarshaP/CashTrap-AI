import type { AssessmentInputs } from "@/types/finance";
import { DAMODARAN } from "./damodaran";
import { industryById, type IndId, type IndustryDef, type Relevance } from "./industries";

export type BenchMetric = "ebitdaMargin" | "debtEbitda" | "intCover" | "dso" | "dio" | "dpo" | "ccc";

export const METRIC: Record<BenchMetric, { label: string; unit: string; dp: number }> = {
  ebitdaMargin: { label: "EBITDA margin", unit: "%", dp: 1 },
  debtEbitda: { label: "Debt / EBITDA (gross, incl. leases)", unit: "x", dp: 1 },
  intCover: { label: "Interest coverage (EBIT ÷ interest)", unit: "x", dp: 1 },
  dso: { label: "DSO", unit: " d", dp: 0 },
  dio: { label: "DIO", unit: " d", dp: 0 },
  dpo: { label: "DPO", unit: " d", dp: 0 },
  ccc: { label: "Cash conversion cycle", unit: " d", dp: 0 },
};

/** which benchmark metric each risk indicator is compared with (none = no reliable free source) */
export const INDICATOR_METRIC: Partial<Record<IndId, BenchMetric>> = { margin: "ebitdaMargin", dso: "dso", dio: "dio", dpo: "dpo", owc: "ccc", lev: "debtEbitda", int: "intCover" };

export const SOURCE = {
  name: "Damodaran Online (NYU Stern), industry datasets: margin, wcdata, dbtfund",
  url: "https://pages.stern.nyu.edu/~adamodar/New_Home_Page/data.html",
  geography: "United States (listed companies)",
  year: "Data to FY2025",
  updated: "7 Jan 2026",
};

export interface BenchInfo {
  status: "sourced" | "custom" | "unavailable" | "na";
  metric?: BenchMetric;
  /** the middle of the distribution: a median of industry-group values, not an average */
  median: number | null;
  /** typical operating range: 25th to 75th percentile of group values. Not the same as a risk threshold. */
  low: number | null;
  high: number | null;
  groups: number;
  firms: number;
  /** hierarchy level the figure came from */
  tier: string;
  geography: string;
  year: string;
  updated: string;
  source: string;
  url?: string;
  reliability: string;
  note: string;
}

const UNAVAILABLE: BenchInfo = { status: "unavailable", median: null, low: null, high: null, groups: 0, firms: 0, tier: "Proposed screening threshold", geography: "n/a", year: "n/a", updated: "n/a", source: "None: Industry Benchmark Unavailable", reliability: "Proposed screening threshold", note: "No verified benchmark. Scoring uses the proposed screening thresholds shown, which are not industry averages." };

const q = (a: number[], p: number) => {
  const s = [...a].sort((x, y) => x - y);
  const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
};

export function getBench(def: IndustryDef | undefined, subId: string | undefined, metric: BenchMetric, custom?: AssessmentInputs["customBench"]): BenchInfo {
  const c = custom?.[metric];
  if (c && (c.median != null || c.low != null || c.high != null)) {
    return { status: "custom", metric, median: c.median ?? null, low: c.low ?? null, high: c.high ?? null, groups: 0, firms: 0, tier: "User-entered benchmark", geography: "As entered", year: "As entered", updated: "As entered", source: "Entered by the user", reliability: "User-entered: not independently verified", note: "A benchmark you entered; it overrides the sourced figure." };
  }
  if (!def || !def.groups.length) return UNAVAILABLE;
  const sub = def.subs.find((s) => s.id === subId);
  const pick = (groups: string[]) => groups.map((g) => ({ g, r: DAMODARAN[g] })).filter((x) => x.r && x.r[metric] != null && (metric !== "ebitdaMargin" || x.r[metric]! > -50));
  let rows = sub ? pick(sub.groups) : [];
  let tier = "Sub-industry";
  if (!rows.length) { rows = pick(def.groups); tier = "Main industry"; }
  if (!rows.length) return UNAVAILABLE;
  const vals = rows.map((x) => x.r[metric] as number);
  const firms = rows.reduce((s, x) => s + x.r.n, 0);
  const few = vals.length < 3;
  return {
    status: "sourced", metric, median: q(vals, 0.5), low: few ? Math.min(...vals) : q(vals, 0.25), high: few ? Math.max(...vals) : q(vals, 0.75),
    groups: vals.length, firms, tier, ...{ geography: SOURCE.geography, year: SOURCE.year, updated: SOURCE.updated, url: SOURCE.url },
    source: SOURCE.name,
    reliability: vals.length >= 4 && firms >= 100 ? "Moderate: several industry groups, US listed companies" : "Limited: few industry groups or firms",
    note: `${few ? "Range is min–max" : "Range is the 25th–75th percentile"} of ${vals.length} industry group${vals.length > 1 ? "s" : ""} (${rows.map((x) => x.g).join(", ")}; ${firms} firms). A median of group aggregates, built from large US listed companies: smaller or regional targets may differ.`,
  };
}

export const fmtBench = (v: number | null, m: BenchMetric) => (v == null ? "—" : `${v.toFixed(METRIC[m].dp)}${METRIC[m].unit}`);
export const benchRange = (b: BenchInfo, m: BenchMetric) => (b.low == null && b.high == null ? "—" : `${fmtBench(b.low, m)} to ${fmtBench(b.high, m)}`);

export interface IndustryContext {
  def: IndustryDef | undefined;
  selected: boolean;
  name: string;
  subName?: string;
  relevance: (id: IndId) => Relevance;
  bench: (m: BenchMetric) => BenchInfo;
}

export function resolveIndustry(inputs: AssessmentInputs): IndustryContext {
  const def = industryById(inputs.industry);
  const sub = def?.subs.find((s) => s.id === inputs.subIndustry);
  return {
    def, selected: !!def, name: def?.name ?? "No industry selected", subName: sub?.name,
    relevance: (id) => def?.relevance[id] ?? "standard",
    bench: (m) => getBench(def, inputs.subIndustry, m, inputs.customBench),
  };
}
