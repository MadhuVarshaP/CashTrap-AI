"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { useAutoCollapse } from "@/lib/utilities/useAutoCollapse";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import { Bar, Card, CardHead, chartTooltip } from "@/components/shared/ui";
import type { RiskCategory, RiskResult } from "@/types/finance";
import { LEVEL_HEX, LevelBadge } from "./parts";

const short: Record<string, string> = { qoe: "Earnings quality", cash: "Cash flow", wc: "Working capital", debt: "Debt & repayment", liq: "Liquidity & stress" };

/** radar of the five pillars: each spoke is risk points earned as a % of the points that could be assessed */
export function PillarRadar({ risk }: { risk: RiskResult }) {
  const data = risk.categories.map((p) => ({ name: short[p.id] ?? p.name, risk: p.points == null || !p.max ? 0 : Math.round((p.points / p.max) * 100), na: p.points == null }));
  return (
    <div className="h-[300px]">
      <ResponsiveContainer>
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="var(--c-line)" />
          <PolarAngleAxis dataKey="name" tick={{ fill: "var(--c-tick)", fontSize: 11 }} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Tooltip {...chartTooltip} formatter={(v: number, _n: string, p: { payload?: { na?: boolean } }) => [p.payload?.na ? "Not Assessed" : `${v}% of assessable points`, "Risk"]} />
          <Radar dataKey="risk" stroke="#3B6CFF" fill="#3B6CFF" fillOpacity={0.28} strokeWidth={2} animationDuration={700} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** one pillar: score, classification, what drives it, the indicators behind it and why the score was given */
function PillarCard({ p, open, onToggle }: { p: RiskCategory; open: boolean; onToggle: () => void }) {
  const assessed = p.indicators.filter((i) => i.points != null);
  const applicable = p.indicators.filter((i) => i.applicable);
  const drivers = [...assessed].filter((i) => (i.points ?? 0) > 0).sort((x, y) => (y.points ?? 0) / y.max - (x.points ?? 0) / x.max).slice(0, 2);
  const na = p.points == null;
  const col = na ? "var(--c-muted)" : LEVEL_HEX[p.severity];
  return (
    <div className={clsx("overflow-hidden rounded-2xl border bg-bg2", open ? "border-line2" : "border-line")}>
      <button onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 p-4 text-left">
        <span className="h-10 w-1 shrink-0 rounded-full" style={{ background: col }} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2"><span className="font-display text-[14px] font-medium">{p.name}</span><LevelBadge level={na ? null : p.severity} /></span>
          <span className="mt-1.5 block"><Bar value={p.points ?? 0} max={p.max || 1} color={col} className="h-1.5" /></span>
        </span>
        <span className="shrink-0 text-right font-display text-[20px] font-semibold tabular-nums">{na ? "—" : p.points}<span className="text-[11px] text-ink3">{na ? "" : `/${p.max}`}</span></span>
        <ChevronDown size={16} className={clsx("shrink-0 text-ink3 transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="space-y-3.5 border-t border-line p-4">
              <div>
                <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-ink3">Why this score</div>
                <p className="text-[12.5px] leading-relaxed text-ink2">
                  {na ? p.explanation : drivers.length ? `${p.explanation} Points come mainly from ${drivers.map((d) => d.name.toLowerCase()).join(" and ")}.` : `${p.explanation} No indicator scored risk points.`}
                </p>
              </div>
              {drivers.length > 0 && (
                <div>
                  <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-ink3">Key contributing factors</div>
                  <ul className="space-y-1.5">{drivers.map((d) => <li key={d.id} className="flex gap-2 text-[12px] leading-snug"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full" style={{ background: col }} /><span><span className="text-ink">{d.name}</span> <span className="font-mono text-ink3">· {d.actual}</span></span></li>)}</ul>
                </div>
              )}
              <div>
                <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-ink3">Indicators ({assessed.length} of {applicable.length} applicable assessed)</div>
                <div className="space-y-1.5">
                  {p.indicators.map((i) => (
                    <div key={i.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 rounded-lg bg-card px-3 py-2 text-[12px]">
                      <span className="truncate text-ink2">{i.name}</span>
                      <span className="flex items-center gap-2"><span className="hidden font-mono text-[10.5px] text-ink3 sm:inline">{i.points == null ? "" : `${i.points}/${i.max}`}</span><LevelBadge level={i.level} na={!i.applicable} /></span>
                      <span className="col-span-2 truncate font-mono text-[10.5px] text-ink3">{!i.applicable ? "Not Applicable to this industry" : i.points == null ? `Not Assessed: needs ${i.requires.join(" + ").toLowerCase()}` : i.actual}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function PillarSection({ risk }: { risk: RiskResult }) {
  const worst = [...risk.categories].filter((p) => p.points != null && p.max).sort((a, b) => b.points! / b.max - a.points! / a.max)[0];
  const [openId, setOpenId] = useState<string | null>(null);
  useAutoCollapse(openId !== null, () => setOpenId(null));
  return (
    <div className="grid gap-5 xl:col-span-12 xl:grid-cols-12">
      <Card tint="blue" className="xl:col-span-5">
        <CardHead title="Financial health: five risk pillars" hint="Each spoke is the share of that pillar's assessable points that scored as risk. Further out = more risk. Not Assessed pillars sit at the centre." />
        <PillarRadar risk={risk} />
        <p className="mt-2 font-mono text-[10.5px] text-ink3">WEIGHTS 25 · 25 · 20 · 20 · 10 · COVERAGE {risk.coverage}% · CONFIDENCE {risk.confidence.level.toUpperCase()}</p>
      </Card>
      <Card className="xl:col-span-7">
        <CardHead title="Risk pillars" hint={worst && worst.points! > 0 ? `Largest share of risk: ${worst.name}. Open a pillar for factors, indicators and the reason for its score.` : "Open a pillar for factors, indicators and the reason for its score."} />
        <div className="space-y-2.5">{risk.categories.map((p) => <PillarCard key={p.id} p={p} open={openId === p.id} onToggle={() => setOpenId(openId === p.id ? null : p.id)} />)}</div>
      </Card>
    </div>
  );
}
