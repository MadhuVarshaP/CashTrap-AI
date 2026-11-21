"use client";

import { scaleM } from "@/lib/utilities/format";
import clsx from "clsx";
import { Info } from "lucide-react";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import type { Severity } from "@/types/finance";
import { useCountUp } from "@/lib/utilities/useCountUp";

export const SEV: Record<Severity, { text: string; bg: string; bar: string; hex: string }> = {
  Low: { text: "text-pos", bg: "bg-pos/10 border-pos/25", bar: "bg-pos", hex: "#35C994" },
  Medium: { text: "text-warn", bg: "bg-warn/10 border-warn/25", bar: "bg-warn", hex: "#F5A640" },
  High: { text: "text-crit", bg: "bg-crit/10 border-crit/25", bar: "bg-crit", hex: "#F06464" },
  Critical: { text: "text-crit", bg: "bg-crit/15 border-crit/40", bar: "bg-crit", hex: "#F06464" },
};

export function Card({ className, children, hover = true }: { className?: string; children: ReactNode; hover?: boolean }) {
  return (
    <div className={clsx("rounded-card border border-line bg-card p-5 sm:p-6", hover && "transition-colors duration-200 hover:border-[#3a3f49]", className)}>
      {children}
    </div>
  );
}

export function CardHead({ title, hint, right, icon }: { title: string; hint?: string; right?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        {icon}
        <h3 className="font-display text-[15px] font-medium text-ink">{title}</h3>
        {hint && <Term tip={hint} />}
      </div>
      {right}
    </div>
  );
}

export function Term({ tip }: { tip: string }) {
  return (
    <span className="group relative inline-flex" tabIndex={0}>
      <Info size={13} className="cursor-help text-ink3 transition-colors group-hover:text-ink2" aria-label={tip} />
      <span role="tooltip" className="pointer-events-none absolute left-1/2 top-full z-40 mt-2 hidden w-56 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-lg border border-line bg-elev p-2.5 text-[11.5px] font-normal leading-snug text-ink2 shadow-xl group-hover:block group-focus:block">
        {tip}
      </span>
    </span>
  );
}

export function SeverityBadge({ s, label }: { s: Severity; label?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider", SEV[s].bg, SEV[s].text)}>
      <span className={clsx("h-1.5 w-1.5 rounded-full", SEV[s].bar)} />
      {label ?? s}
    </span>
  );
}

export function Pill({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "accent" | "ai" | "pos" | "warn" | "crit"; className?: string }) {
  const t = { neutral: "border-line text-ink2 bg-elev", accent: "border-accent/30 text-accent bg-accent/10", ai: "border-ai/30 text-ai bg-ai/10", pos: "border-pos/30 text-pos bg-pos/10", warn: "border-warn/30 text-warn bg-warn/10", crit: "border-crit/30 text-crit bg-crit/10" }[tone];
  return <span className={clsx("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-wider", t, className)}>{children}</span>;
}

export function Button({ variant = "primary", className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "ai" }) {
  const v = {
    primary: "bg-accent text-white hover:bg-[#4d97ff] disabled:bg-elev disabled:text-ink3",
    ghost: "border border-line bg-elev text-ink hover:border-[#3f4551] disabled:text-ink3",
    ai: "border border-ai/40 bg-ai/10 text-ai hover:bg-ai/20",
  }[variant];
  return <button {...p} className={clsx("inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 text-[13px] font-medium transition-colors disabled:cursor-not-allowed sm:min-h-[40px]", v, className)} />;
}

export function PageTitle({ title, sub, right }: { title: string; sub: string; right?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <h1 className="font-display text-[26px] font-semibold leading-tight tracking-tight text-ink sm:text-[32px]">{title}</h1>
        <p className="mt-1.5 max-w-2xl text-[14px] text-ink2">{sub}</p>
      </div>
      {right}
    </div>
  );
}

export function Money({ value, decimals = 1, prefix = "AED ", suffix = "m", className }: { value: number | null; decimals?: number; prefix?: string; suffix?: string; className?: string }) {
  const v = useCountUp(value ?? 0);
  if (value == null) return <span className={className}>—</span>;
  const sc = suffix === "m" ? scaleM(v, decimals) : { n: v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }), unit: suffix };
  return <span className={clsx("tabular-nums", className)}>{prefix}{sc.n}{sc.unit}</span>;
}

export function CountNum({ value, decimals = 0, suffix = "", className }: { value: number; decimals?: number; suffix?: string; className?: string }) {
  const v = useCountUp(value);
  return <span className={clsx("tabular-nums", className)}>{v.toFixed(decimals)}{suffix}</span>;
}

export function Spark({ data, color }: { data: number[]; color: string }) {
  const d = data.map((v, i) => ({ i, v }));
  const id = `sp${color.slice(1)}${data.join("").length}`;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={d} margin={{ top: 4, bottom: 0, left: 0, right: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.6} fill={`url(#${id})`} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function Bar({ value, max, color, className }: { value: number; max: number; color: string; className?: string }) {
  return (
    <div className={clsx("h-2 overflow-hidden rounded-full bg-elev", className)}>
      <motion.div className="h-full rounded-full" style={{ background: color }} initial={{ width: 0 }} animate={{ width: `${Math.min(100, (value / max) * 100)}%` }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} />
    </div>
  );
}

export const chartTooltip = {
  contentStyle: { background: "#1D2026", border: "1px solid #292D35", borderRadius: 12, fontSize: 12, color: "#F5F6F8", boxShadow: "0 12px 32px rgba(0,0,0,.5)" },
  labelStyle: { color: "#A2A7B0", fontFamily: "var(--font-mono)", fontSize: 11 },
  itemStyle: { padding: 0 },
  cursor: { stroke: "#3a3f49", strokeWidth: 1 },
};

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <Card className="mx-auto mt-10 max-w-xl text-center" hover={false}>
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-[14px] text-ink2">{body}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </Card>
  );
}

export const Skeleton = ({ className }: { className?: string }) => <div className={clsx("animate-pulse rounded-xl bg-elev", className)} />;
