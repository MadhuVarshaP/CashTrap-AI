"use client";

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartTooltip } from "@/components/shared/ui";
import { fmtM, scaleM, cur } from "@/lib/utilities/format";

export interface Step {
  name: string;
  value: number | null;
  /** total = an absolute level; delta = a movement from the running level; missing = not supplied (drawn as a gap) */
  kind: "total" | "delta" | "missing";
  /** colour override for a total bar */
  color?: string;
}

const POS = "#35C994", NEG = "#F06464", TOTAL = "#3988F5", MISS = "#3a3f49";
const axisM = (v: number) => { const { n, unit } = scaleM(v, 0); return `${n}${unit}`; };

/** floating-bar waterfall; negative and zero-crossing movements are drawn as they are, never hidden */
export function Waterfall({ steps, height = 300, negLabel = "reduces cash" }: { steps: Step[]; height?: number; negLabel?: string }) {
  let run = 0;
  const data = steps.map((s) => {
    if (s.kind === "missing" || s.value == null) return { name: s.name, range: [run, run] as [number, number], color: MISS, text: "n/s", tip: "Not supplied" , missing: true };
    if (s.kind === "total") { run = s.value; return { name: s.name, range: [Math.min(0, s.value), Math.max(0, s.value)] as [number, number], color: s.color ?? TOTAL, text: fmtM(s.value, 0), tip: fmtM(s.value), missing: false }; }
    const from = run; run += s.value;
    return { name: s.name, range: [Math.min(from, run), Math.max(from, run)] as [number, number], color: s.value >= 0 ? POS : NEG, text: `${s.value >= 0 ? "+" : "−"}${fmtM(Math.abs(s.value), 0).replace(`${cur()} `, "")}`, tip: `${s.value >= 0 ? "+" : "−"}${fmtM(Math.abs(s.value))}${s.value < 0 ? ` (${negLabel})` : ""}`, missing: false };
  });
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 22, right: 6, left: -6, bottom: 0 }}>
          <CartesianGrid stroke="#23262d" vertical={false} />
          <XAxis dataKey="name" stroke="#707681" fontSize={10.5} tickLine={false} axisLine={false} interval={0} />
          <YAxis stroke="#707681" fontSize={11} tickLine={false} axisLine={false} width={46} tickFormatter={axisM} />
          <ReferenceLine y={0} stroke="#3a3f49" />
          <Tooltip {...chartTooltip} cursor={{ fill: "#ffffff08" }} formatter={(_v: unknown, _n: unknown, p: { payload?: { tip?: string } }) => [p.payload?.tip ?? "", ""]} separator="" />
          <Bar dataKey="range" radius={3} maxBarSize={54} animationDuration={600}
            label={({ x, y, width, index }: { x: number; y: number; width: number; index: number }) => (
              <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={10.5} fill="#A2A7B0" fontFamily="var(--font-mono, monospace)">{data[index]?.text}</text>
            )}>
            {data.map((d, i) => <Cell key={i} fill={d.color} fillOpacity={d.missing ? 0.5 : 1} stroke={d.missing ? "#707681" : undefined} strokeDasharray={d.missing ? "3 3" : undefined} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
