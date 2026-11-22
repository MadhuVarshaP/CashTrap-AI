"use client";

import clsx from "clsx";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Tilt } from "@/components/shared/Tilt";
import { Card, CountNum, Money, Spark, Term } from "@/components/shared/ui";

export interface Kpi {
  label: string;
  tip: string;
  value: number | null;
  kind: "money" | "pct" | "x" | "score";
  change: string;
  tone: "pos" | "neg" | "neutral";
  trend: number[];
}

export function KpiCard({ k, big }: { k: Kpi; big?: boolean }) {
  const color = k.tone === "pos" ? "#35C994" : k.tone === "neg" ? "#F06464" : "var(--c-axis)";
  const Icon = k.tone === "pos" ? ArrowUpRight : k.tone === "neg" ? ArrowDownRight : Minus;
  return (
    <Tilt max={5} className="h-full rounded-card [perspective:900px]">
    <Card hover={false} className={clsx("flex h-full flex-col justify-between", big ? "min-h-[190px]" : "min-h-[168px]")}>
      <div>
        <div className="flex items-center gap-1.5 text-[12px] text-ink2">{k.label}<Term tip={k.tip} /></div>
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
