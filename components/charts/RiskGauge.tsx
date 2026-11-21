"use client";

import { motion } from "framer-motion";
import type { RiskResult } from "@/types/finance";
import { CountNum } from "@/components/shared/ui";

export const riskColor = (score: number | null) => (score == null ? "#707681" : score < 25 ? "#35C994" : score < 50 ? "#F5A640" : "#F06464");

/** 270° arc gauge with threshold ticks at 25 / 50 / 75. */
export function RiskGauge({ risk, size = 220 }: { risk: RiskResult; size?: number }) {
  const r = 84, c = 2 * Math.PI * r, arc = c * 0.75;
  const k = size / 220; // text scales with the gauge so small gauges don't overflow
  const score = risk.score;
  const color = riskColor(score);
  const tick = (v: number) => {
    const a = (135 + 270 * (v / 100)) * (Math.PI / 180);
    const f = (n: number) => Math.round(n * 100) / 100;
    return { x1: f(100 + (r - 11) * Math.cos(a)), y1: f(100 + (r - 11) * Math.sin(a)), x2: f(100 + (r + 11) * Math.cos(a)), y2: f(100 + (r + 11) * Math.sin(a)) };
  };
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg viewBox="0 0 200 200" className="h-full w-full" role="img" aria-label={`Risk score ${score ?? "insufficient data"} out of 100`}>
        <circle cx="100" cy="100" r={r} fill="none" stroke="#22252c" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${arc} ${c}`} transform="rotate(135 100 100)" />
        {score != null && (
          <motion.circle cx="100" cy="100" r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" transform="rotate(135 100 100)" strokeDasharray={`${arc} ${c}`} initial={{ strokeDashoffset: arc }} animate={{ strokeDashoffset: arc * (1 - score / 100) }} transition={{ duration: 1.3, ease: [0.22, 1, 0.36, 1] }} />
        )}
        {[25, 50, 75].map((t) => <line key={t} {...tick(t)} stroke="#0A0B0D" strokeWidth="2.5" />)}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {score == null ? (
          <span className="px-4 text-center font-display font-semibold text-ink2" style={{ fontSize: Math.max(11, 18 * k) }}>Insufficient data</span>
        ) : (
          <>
            <CountNum value={score} className="font-display font-semibold leading-none" style={{ fontSize: 56 * k }} />
            <span className="font-mono text-ink3" style={{ fontSize: Math.max(8, 11 * k), marginTop: 4 * k }}>/ 100</span>
          </>
        )}
        <span className="rounded-full border font-mono uppercase tracking-wider" style={{ color, borderColor: color + "55", background: color + "14", marginTop: 8 * k, padding: `${2 * k}px ${10 * k}px`, fontSize: Math.max(7.5, 10 * k) }}>{size >= 150 ? risk.classification : risk.classification.replace(" Risk", "")}</span>
      </div>
    </div>
  );
}
