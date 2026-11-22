"use client";

import clsx from "clsx";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Tilt } from "@/components/shared/Tilt";
import type { LucideIcon } from "lucide-react";
import { Card, CountNum, Money, Spark, TINT, Term, type Tint } from "@/components/shared/ui";

const CHIP: Record<Tint, string> = { blue: "from-[#3B6CFF] to-[#7FA0FF]", violet: "from-[#8B5CF6] to-[#B59CFF]", mint: "from-[#10B981] to-[#5EE0B5]", amber: "from-[#F59E0B] to-[#FFC65C]", rose: "from-[#F43F5E] to-[#FF8DA1]" };

export interface Kpi {
  label: string;
  tip: string;
  value: number | null;
  kind: "money" | "pct" | "x" | "score";
  change: string;
  tone: "pos" | "neg" | "neutral";
  trend: number[];
  icon?: LucideIcon;
  hue?: Tint;
}

export function KpiCard({ k, big }: { k: Kpi; big?: boolean }) {
  const color = k.tone === "pos" ? "#10B981" : k.tone === "neg" ? "#F43F5E" : "#8B5CF6";
  const Icon = k.tone === "pos" ? ArrowUpRight : k.tone === "neg" ? ArrowDownRight : Minus;
  return (
    <Tilt max={5} className="h-full rounded-card [perspective:900px]">
    <Card hover={false} tint={k.hue} className={clsx("flex h-full flex-col justify-between", big ? "min-h-[190px]" : "min-h-[168px]")}>
      <div>
        <div className="flex items-center gap-2.5 text-[12.5px] font-medium text-ink2">{k.icon && <span className={clsx("grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br text-white shadow-[0_8px_16px_-8px_rgba(60,60,200,.55)]", CHIP[k.hue ?? "blue"])}><k.icon size={18} /></span>}{k.label}<Term tip={k.tip} /></div>
        <div className={clsx("mt-2 font-display font-semibold tracking-tight", big ? "text-[38px]" : "text-[30px]")}>
          {k.value == null ? "—" : k.kind === "money" ? <Money value={k.value} /> : k.kind === "pct" ? <CountNum value={k.value * 100} decimals={1} suffix="%" /> : k.kind === "score" ? <CountNum value={k.value} decimals={0} suffix="/100" /> : <CountNum value={k.value} decimals={2} suffix="x" />}
        </div>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <span className="inline-flex min-w-0 items-start gap-1 font-mono text-[11px] leading-snug" style={{ color }}><Icon size={14} className="mt-px shrink-0" /><span className="min-w-0">{k.change}</span></span>
        {k.trend.length > 1 && <div className="h-9 w-20 shrink-0"><Spark data={k.trend.filter((v) => v != null)} color={color} /></div>}
      </div>
    </Card>
    </Tilt>
  );
}
