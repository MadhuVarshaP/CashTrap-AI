import type { Num } from "@/types/finance";

export const DASH = "—";

export const fmtM = (v: Num, d = 1): string =>
  v == null || !isFinite(v) ? DASH : `AED ${v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })}m`;

export const fmtNum = (v: Num, d = 1): string =>
  v == null || !isFinite(v) ? DASH : v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

export const fmtPct = (ratio: Num, d = 1): string =>
  ratio == null || !isFinite(ratio) ? DASH : `${(ratio * 100).toFixed(d)}%`;

export const fmtDays = (v: Num, d = 1): string => (v == null || !isFinite(v) ? DASH : `${v.toFixed(d)} d`);

export const fmtX = (v: Num, d = 2): string => (v == null || !isFinite(v) ? DASH : `${v.toFixed(d)}x`);

export const signed = (v: Num, d = 1, suffix = ""): string =>
  v == null || !isFinite(v) ? DASH : `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(d)}${suffix}`;

export const growth = (cur: Num, prev: Num): Num =>
  cur == null || prev == null || prev === 0 ? null : (cur - prev) / Math.abs(prev);
