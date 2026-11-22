import type { Num } from "@/types/finance";

export const DASH = "—";

/** reporting currency label for the active company (set by the app store); monetary figures are shown in millions of it */
let CUR = "AED";
export const setCurrency = (c?: string) => { CUR = c || "AED"; };
export const cur = () => CUR;

/** scales AED millions so very large companies stay readable: 10,000m → bn, 1,000,000m → tn */
export const scaleM = (v: number, d = 1): { n: string; unit: string } => {
  const a = Math.abs(v);
  const [x, unit, dd] = a >= 1_000_000 ? [v / 1_000_000, "tn", 2] : a >= 10_000 ? [v / 1_000, "bn", 1] : [v, "m", d];
  return { n: x.toLocaleString("en-US", { minimumFractionDigits: dd as number, maximumFractionDigits: dd as number }), unit };
};

export const fmtM = (v: Num | undefined, d = 1): string => {
  if (v == null || !isFinite(v)) return DASH;
  const { n, unit } = scaleM(v, d);
  return `${CUR} ${n}${unit}`;
};

export const fmtNum = (v: Num | undefined, d = 1): string =>
  v == null || !isFinite(v) ? DASH : v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

export const fmtPct = (ratio: Num | undefined, d = 1): string =>
  ratio == null || !isFinite(ratio) ? DASH : `${(ratio * 100).toFixed(d)}%`;

export const fmtDays = (v: Num | undefined, d = 1): string => (v == null || !isFinite(v) ? DASH : `${v.toFixed(d)} d`);

export const fmtX = (v: Num | undefined, d = 2): string => (v == null || !isFinite(v) ? DASH : `${v.toFixed(d)}x`);

export const signed = (v: Num | undefined, d = 1, suffix = ""): string =>
  v == null || !isFinite(v) ? DASH : `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(d)}${suffix}`;

export const growth = (cur: Num, prev: Num): Num =>
  cur == null || prev == null || prev === 0 ? null : (cur - prev) / Math.abs(prev);
