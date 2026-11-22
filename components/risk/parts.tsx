"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, CircleSlash } from "lucide-react";
import { useEffect, useState } from "react";
import { SEV } from "@/components/shared/ui";
import { useAutoCollapse } from "@/lib/utilities/useAutoCollapse";
import { levelName } from "@/lib/calculations/pe-risk";
import type { Indicator, Severity } from "@/types/finance";

export const LEVEL_HEX: Record<Severity, string> = { Low: "#35C994", Medium: "#F5A640", High: "#F58B5C", Critical: "#F06464" };

export function LevelBadge({ level, className, na }: { level: Severity | null; className?: string; na?: boolean }) {
  if (na) return <span className={clsx("inline-flex items-center gap-1.5 rounded-full border border-dashed border-line px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink3", className)}><CircleSlash size={10} />Not applicable</span>;
  if (level == null) return <span className={clsx("inline-flex items-center gap-1.5 rounded-full border border-line bg-elev px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink3", className)}><CircleSlash size={10} />Not assessed</span>;
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider", SEV[level].bg, SEV[level].text, className)}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: LEVEL_HEX[level] }} />{levelName(level)}
    </span>
  );
}

/** one scored indicator: value, prior value, the threshold it was judged against, points and the reasoning */
export function IndicatorCard({ i, defaultOpen = false }: { i: Indicator; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  useAutoCollapse(open, () => setOpen(false));
  return (
    <div className={clsx("overflow-hidden rounded-2xl border bg-card", open ? "border-[#3f4551]" : "border-line")}>
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-start gap-3 p-4 text-left sm:items-center sm:gap-4 sm:p-5">
        <span className="mt-1 h-9 w-1 shrink-0 rounded-full sm:mt-0" style={{ background: i.level ? LEVEL_HEX[i.level] : "#3a3f49" }} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2"><span className="font-display text-[14.5px] font-medium">{i.name}</span><LevelBadge level={i.level} na={!i.applicable} />{i.relevance === "core" && i.applicable && <span className="rounded-full border border-accent/30 bg-accent/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-accent">core here</span>}{i.relevance === "low" && i.applicable && <span className="rounded-full border border-line px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-ink3">low relevance</span>}</span>
          <span className="mt-1 block truncate font-mono text-[11.5px] text-ink3">{!i.applicable ? "Not Applicable to the selected industry" : i.points == null ? "Not Assessed: data missing" : i.actual}</span>
        </span>
        <span className="shrink-0 text-right font-display text-[22px] font-semibold tabular-nums">{i.points == null ? "—" : i.points}<span className="text-[12px] text-ink3">/{i.max}</span></span>
        <ChevronDown size={17} className={clsx("mt-1 shrink-0 text-ink3 transition-transform sm:mt-0", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="space-y-4 border-t border-line p-4 sm:p-5">
              <div className="grid gap-2.5 sm:grid-cols-2">
                {[["Actual value", i.actual], ["Previous year", i.previous]].map(([l, v]) => (
                  <div key={l} className="rounded-xl bg-bg2 p-3"><div className="font-mono text-[10px] uppercase tracking-wider text-ink3">{l}</div><div className="mt-1 text-[12.5px] leading-snug text-ink">{v}</div></div>
                ))}
              </div>
              {i.bench && (
                <div className="rounded-xl border border-line bg-bg2 p-3.5">
                  <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2"><span className="font-mono text-[10px] uppercase tracking-wider text-ink3">Industry benchmark · {i.bench.metric}</span><span className={clsx("rounded-full border px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-wider", i.bench.status === "sourced" ? "border-pos/30 bg-pos/10 text-pos" : i.bench.status === "custom" ? "border-accent/30 bg-accent/10 text-accent" : "border-warn/30 bg-warn/10 text-warn")}>{i.bench.status === "sourced" ? "Sourced" : i.bench.status === "custom" ? "User-entered" : "Screening threshold only"}</span></div>
                  <div className="grid gap-2.5 sm:grid-cols-3">
                    {[["Industry median", i.bench.median], ["Typical range (25th–75th pct)", i.bench.range], ["Risk threshold used", i.bench.threshold]].map(([l, v]) => <div key={l}><div className="font-mono text-[9.5px] uppercase tracking-wider text-ink3">{l}</div><div className="mt-0.5 text-[12px] leading-snug text-ink">{v}</div></div>)}
                  </div>
                  <p className="mt-3 text-[11px] leading-relaxed text-ink3">{i.bench.status === "unavailable" ? i.bench.note : <>{i.bench.tier} · {i.bench.geography} · {i.bench.year} · {i.bench.reliability}. Source: {i.bench.url ? <a href={i.bench.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">{i.bench.source}</a> : i.bench.source}. {i.bench.note}</>}</p>
                </div>
              )}
              <p className="text-[13px] leading-relaxed text-ink2">{i.explanation}</p>
              {i.requires.length > 0 && i.points == null && <p className="rounded-xl border border-warn/25 bg-warn/5 p-3 text-[12.5px] text-warn">Needs: {i.requires.join(", ")}.</p>}
              {i.points != null && i.points > 0 && (
                <div>
                  <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-ink3">Questions to ask management</div>
                  <ul className="space-y-1.5">{i.questions.map((q) => <li key={q} className="flex gap-2 text-[12.5px] text-ink2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />{q}</li>)}</ul>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** numeric input that commits on blur/enter so typing doesn't recompute on every keystroke */
export function NumInput({ label, value, unit, onCommit, hint, step = "any" }: { label: string; value: number | null | undefined; unit?: string; onCommit: (v: number | null) => void; hint?: string; step?: string }) {
  const [txt, setTxt] = useState(value == null ? "" : String(value));
  useEffect(() => setTxt(value == null ? "" : String(value)), [value]);
  const commit = () => {
    if (txt.trim() === "") return value == null ? undefined : onCommit(null);
    const n = Number(txt.replace(/,/g, ""));
    if (Number.isFinite(n) && n !== value) onCommit(n);
    else setTxt(value == null ? "" : String(value));
  };
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-wider text-ink3">{label}</span>
      <span className="flex h-11 items-center rounded-xl bg-bg2 px-3 transition-colors focus-within:bg-elev">
        <input inputMode="decimal" step={step} value={txt} onChange={(e) => setTxt(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} className="w-full bg-transparent font-mono text-[15px] tabular-nums outline-none placeholder:text-ink3" placeholder="not entered" />
        {unit && <span className="ml-2 whitespace-nowrap font-mono text-[11px] text-ink3">{unit}</span>}
      </span>
      {hint && <span className="mt-1 block text-[11.5px] text-ink3">{hint}</span>}
    </label>
  );
}

export const Stat = ({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "crit" | "pos" | "warn" }) => (
  <div className="rounded-xl border border-line bg-bg2 p-3.5">
    <div className="font-mono text-[10px] uppercase tracking-wider text-ink3">{label}</div>
    <div className={clsx("mt-1 font-display text-[20px] font-semibold tabular-nums", tone === "crit" && "text-crit", tone === "pos" && "text-pos", tone === "warn" && "text-warn")}>{value}</div>
    {sub && <div className="mt-0.5 font-mono text-[10.5px] text-ink3">{sub}</div>}
  </div>
);
