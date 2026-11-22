"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import { AlertTriangle, Info, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Bar as RBar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Waterfall } from "@/components/charts/Waterfall";
import { Button, Card, CardHead, CountNum, Money, PageTitle, Pill, chartTooltip } from "@/components/shared/ui";
import { dayValue } from "@/lib/calculations/wc-release";
import { useApp } from "@/lib/state/store";
import { fmtM, fmtNum, cur } from "@/lib/utilities/format";

/** starting-point targets (days off DSO and DIO). DPO is left alone: stretching suppliers is a choice with its own risk. */
const SCEN = [
  { id: "cons", name: "Conservative", dso: 8, dio: 5, color: "#A2A7B0", note: "Tighter follow-up on overdue accounts and stock" },
  { id: "base", name: "Base", dso: 15, dio: 10, color: "#3988F5", note: "Revised credit terms, collections and purchasing discipline" },
  { id: "opt", name: "Optimistic", dso: 25, dio: 15, color: "#35C994", note: "Full return toward prior-year days" },
];

type Fields = Record<"sales" | "cogs" | "purch" | "dso" | "tDso" | "dio" | "tDio" | "dpo" | "tDpo" | "cash" | "minCash", string>;
const EMPTY: Fields = { sales: "", cogs: "", purch: "", dso: "", tDso: "", dio: "", tDio: "", dpo: "", tDpo: "", cash: "", minCash: "" };
const num = (s: string) => (s.trim() === "" ? NaN : Number(s));
const r1 = (v: number) => String(Math.round(v * 10) / 10);

function NumField({ label, value, onChange, unit, error, hint }: { label: string; value: string; onChange: (v: string) => void; unit: string; error?: string; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-wider text-ink3">{label}</span>
      <span className={clsx("flex h-11 items-center rounded-xl bg-bg2 px-3 transition-colors focus-within:bg-elev", error && "ring-1 ring-crit/70")}>
        <input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-transparent font-mono text-[15px] tabular-nums outline-none" aria-invalid={!!error} />
        <span className="ml-2 whitespace-nowrap font-mono text-[11px] text-ink3">{unit}</span>
      </span>
      {error ? <span role="alert" className="mt-1 block text-[11.5px] text-crit">{error}</span> : hint ? <span className="mt-1 block text-[11px] text-ink3">{hint}</span> : null}
    </label>
  );
}

export default function CashImpact() {
  const { analysis, active } = useApp();
  const [f, setF] = useState<Fields>(EMPTY);
  const [sel, setSel] = useState(1);
  const set = (k: keyof Fields) => (v: string) => { setF((x) => ({ ...x, [k]: v })); if (k.startsWith("t")) setSel(-1); };
  const purchasesProxy = analysis ? analysis.latestRecord.creditPurchases == null : false;

  const reset = () => {
    if (!analysis) { setF(EMPTY); return; }
    const c = analysis.latestRecord, m = analysis.latest;
    const dso = m.dso, dio = m.dio, dpo = m.dpo;
    const t = (v: number | null, cut: number) => (v == null ? "" : String(Math.max(0, Math.round(v - cut))));
    setF({
      sales: (c.creditSales ?? c.revenue) == null ? "" : r1((c.creditSales ?? c.revenue)!),
      cogs: c.cogs == null ? "" : r1(c.cogs),
      purch: (c.creditPurchases ?? c.cogs) == null ? "" : r1((c.creditPurchases ?? c.cogs)!),
      dso: dso == null ? "" : r1(dso), tDso: t(dso, SCEN[1].dso),
      dio: dio == null ? "" : r1(dio), tDio: t(dio, SCEN[1].dio),
      dpo: dpo == null ? "" : r1(dpo), tDpo: dpo == null ? "" : r1(dpo),
      cash: c.cash == null ? "" : r1(c.cash), minCash: analysis.inputs.minOperatingCash == null ? "" : r1(analysis.inputs.minOperatingCash),
    });
    setSel(1);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(reset, [active.id, analysis?.generatedAt]);

  const applyPreset = (i: number) => {
    setSel(i);
    const d = num(f.dso), o = num(f.dio);
    setF((x) => ({ ...x, tDso: isNaN(d) ? x.tDso : String(Math.max(0, Math.round(d - SCEN[i].dso))), tDio: isNaN(o) ? x.tDio : String(Math.max(0, Math.round(o - SCEN[i].dio))), tDpo: x.dpo }));
  };

  // each component stands on its own: a company with no inventory can still get receivables and payables
  const v = (k: keyof Fields) => num(f[k]);
  const pos = (n: number) => !isNaN(n) && n > 0;
  const days = (n: number) => !isNaN(n) && n >= 0 && n <= 365;
  const err = (k: keyof Fields, kind: "money" | "days" | "cash"): string | undefined => {
    const s = f[k].trim();
    if (s === "") return undefined;
    const n = Number(s);
    if (isNaN(n)) return "Enter a number";
    if (kind === "money") return n <= 0 ? "Must be greater than 0" : undefined;
    if (kind === "days") return n < 0 || n > 365 ? "Between 0 and 365" : undefined;
    return n < 0 ? "Cannot be negative" : undefined;
  };
  // an empty target means "no change", so the others can still be explored
  const tgt = (t: keyof Fields, cur: keyof Fields) => (f[t].trim() === "" ? v(cur) : v(t));
  const tDso = tgt("tDso", "dso"), tDio = tgt("tDio", "dio"), tDpo = tgt("tDpo", "dpo");

  const rec = pos(v("sales")) && days(v("dso")) && days(tDso) ? dayValue(v("sales")) * (v("dso") - tDso) : null;
  const inv = pos(v("cogs")) && days(v("dio")) && days(tDio) ? dayValue(v("cogs")) * (v("dio") - tDio) : null;
  const pay = pos(v("purch")) && days(v("dpo")) && days(tDpo) ? dayValue(v("purch")) * (tDpo - v("dpo")) : null;
  const parts = [rec, inv, pay];
  const have = parts.filter((x): x is number => x != null);
  const total = have.length ? have.reduce((s, x) => s + x, 0) : null;
  const excluded = [rec == null && "receivables", inv == null && "inventory", pay == null && "payables"].filter(Boolean) as string[];

  const allDays = rec != null && inv != null && pay != null;
  const ccc = allDays ? { cur: v("dso") + v("dio") - v("dpo"), tgt: tDso + tDio - tDpo } : null;
  const wc = allDays ? {
    cur: dayValue(v("sales")) * v("dso") + dayValue(v("cogs")) * v("dio") - dayValue(v("purch")) * v("dpo"),
    tgt: dayValue(v("sales")) * tDso + dayValue(v("cogs")) * tDio - dayValue(v("purch")) * tDpo,
  } : null;

  // what the release can really be used for: cash must stay at or above the operating minimum
  const cash = v("cash"), minC = v("minCash");
  const gapToMin = !isNaN(cash) && !isNaN(minC) ? Math.max(0, minC - cash) : null;
  const usable = total != null && gapToMin != null ? Math.max(0, total - gapToMin) : null;

  const dpoRise = pay != null ? tDpo - v("dpo") : 0;
  const scen = SCEN.map((s) => {
    const d = v("dso"), o = v("dio");
    const r = pos(v("sales")) && !isNaN(d) ? dayValue(v("sales")) * Math.min(s.dso, d) : null;
    const i = pos(v("cogs")) && !isNaN(o) ? dayValue(v("cogs")) * Math.min(s.dio, o) : null;
    return r == null && i == null ? null : (r ?? 0) + (i ?? 0);
  });

  const steps = useMemo(() => (total == null ? [] : [
    { name: "Receivables (DSO)", value: rec, kind: (rec == null ? "missing" : "delta") as "missing" | "delta" },
    { name: "Inventory (DIO)", value: inv, kind: (inv == null ? "missing" : "delta") as "missing" | "delta" },
    { name: "Payables (DPO)", value: pay, kind: (pay == null ? "missing" : "delta") as "missing" | "delta" },
    { name: "Total release", value: total, kind: "total" as const, color: total >= 0 ? "#3988F5" : "#F06464" },
  ]), [rec, inv, pay, total]);

  const cmp = allDays || (rec != null || inv != null || pay != null)
    ? [{ name: "DSO", current: isNaN(v("dso")) ? null : v("dso"), target: rec == null ? null : tDso }, { name: "DIO", current: isNaN(v("dio")) ? null : v("dio"), target: inv == null ? null : tDio }, { name: "DPO", current: isNaN(v("dpo")) ? null : v("dpo"), target: pay == null ? null : tDpo }]
    : [];

  const comps = [
    { id: "rec", title: "Receivables · DSO", val: rec, color: "#3988F5", formula: `(${fmtNum(v("sales"))} ÷ 365) × (${fmtNum(v("dso"))} − ${fmtNum(tDso)})`, need: "annual credit sales, current and target DSO", base: "credit sales", cur: v("dso"), tgt: tDso, unit: "DSO" },
    { id: "inv", title: "Inventory · DIO", val: inv, color: "#F5A640", formula: `(${fmtNum(v("cogs"))} ÷ 365) × (${fmtNum(v("dio"))} − ${fmtNum(tDio)})`, need: "annual COGS, current and target DIO", base: "COGS", cur: v("dio"), tgt: tDio, unit: "DIO" },
    { id: "pay", title: "Payables · DPO", val: pay, color: "#A78BFA", formula: `(${fmtNum(v("purch"))} ÷ 365) × (${fmtNum(tDpo)} − ${fmtNum(v("dpo"))})`, need: "annual purchases, current and target DPO", base: "purchases", cur: v("dpo"), tgt: tDpo, unit: "DPO" },
  ];

  return (
    <>
      <PageTitle title="Working Capital Cash Release Calculator" sub="Receivables, inventory and payables: how much cash could be released, and what it would cost." right={<div className="flex flex-wrap gap-2"><Button variant="ghost" onClick={reset}><RotateCcw size={14} /> {analysis ? "Reset to company data" : "Clear inputs"}</Button></div>} />

      <div className="grid gap-5 xl:grid-cols-12">
        <Card className="xl:col-span-4">
          <CardHead title="Inputs" hint={analysis ? "Prefilled from the active company's latest year. Edit any value to model your own case; results update immediately." : "No company loaded. Enter your own figures to model a case."} />
          <div className="space-y-5">
            <div className="space-y-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-accent">Annual bases · {cur()} m</div>
              <NumField label={analysis?.latestRecord.creditSales != null ? "Annual credit sales" : "Annual credit sales (revenue if no credit split)"} value={f.sales} onChange={set("sales")} unit={`${cur()} m`} error={err("sales", "money")} />
              <NumField label="Annual COGS" value={f.cogs} onChange={set("cogs")} unit={`${cur()} m`} error={err("cogs", "money")} />
              <NumField label="Annual purchases" value={f.purch} onChange={set("purch")} unit={`${cur()} m`} error={err("purch", "money")} hint={purchasesProxy ? "Assumption: purchases not in the file, so COGS is used as a proxy. Overwrite if you have the figure." : undefined} />
            </div>
            {([
              ["Receivables", "dso", "tDso", "DSO", "#3988F5"],
              ["Inventory", "dio", "tDio", "DIO", "#F5A640"],
              ["Payables", "dpo", "tDpo", "DPO", "#A78BFA"],
            ] as const).map(([name, cur, tgtK, u, col]) => (
              <div key={cur} className="space-y-3">
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider" style={{ color: col }}><span className="h-2 w-2 rounded-full" style={{ background: col }} />{name} · {u}</div>
                <div className="grid grid-cols-2 gap-3">
                  <NumField label={`Current ${u}`} value={f[cur]} onChange={set(cur)} unit="d" error={err(cur, "days")} />
                  <NumField label={`Target ${u}`} value={f[tgtK]} onChange={set(tgtK)} unit="d" error={err(tgtK, "days")} />
                </div>
                <input type="range" min={0} max={Math.max(1, Math.round(Math.max(isNaN(v(cur)) ? 0 : v(cur), isNaN(num(f[tgtK])) ? 0 : num(f[tgtK])) * 1.6) || 100)} step={1} value={isNaN(num(f[tgtK])) ? (isNaN(v(cur)) ? 0 : Math.round(v(cur))) : num(f[tgtK])} onChange={(e) => set(tgtK)(e.target.value)} className="w-full" aria-label={`Target ${u} slider`} />
              </div>
            ))}
            <div className="space-y-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-ink3">Operating constraint · {cur()} m</div>
              <div className="grid grid-cols-2 gap-3">
                <NumField label="Cash today" value={f.cash} onChange={set("cash")} unit="m" error={err("cash", "cash")} />
                <NumField label="Min. operating cash" value={f.minCash} onChange={set("minCash")} unit="m" error={err("minCash", "cash")} />
              </div>
            </div>
          </div>
          <div className="mt-5 rounded-xl border border-line bg-bg2 p-3.5 font-mono text-[11px] leading-relaxed text-ink2">
            Receivables = (Credit sales ÷ 365) × (Current DSO − Target DSO)<br />
            Inventory = (COGS ÷ 365) × (Current DIO − Target DIO)<br />
            Payables = (Purchases ÷ 365) × (Target DPO − Current DPO)<br />
            Total = Receivables + Inventory + Payables
          </div>
        </Card>

        <div className="space-y-5 xl:col-span-8">
          <motion.div initial={{ opacity: 0.6 }} animate={{ opacity: 1 }} className="relative overflow-hidden rounded-card border border-line bg-card p-6 sm:p-8">
            <div className="absolute inset-y-0 left-0 w-1" style={{ background: total != null && total < 0 ? "#F06464" : "#3988F5" }} />
            <div className="flex items-center justify-between"><span className="font-mono text-[11px] uppercase tracking-wider text-ink3">{total != null && total < 0 ? "Additional cash required" : "Total potential cash release"}</span><Pill tone="warn">Not guaranteed</Pill></div>
            <div className="mt-3 font-display text-[44px] font-semibold leading-none tracking-tight sm:text-[60px]">
              {total != null ? <Money value={Math.abs(total)} prefix={total < 0 ? `− ${cur()} ` : `${cur()} `} suffix="m" className={total < 0 ? "text-crit" : undefined} /> : <span className="text-ink3">—</span>}
            </div>
            <p className="mt-2 text-[13px] text-ink2">{total == null ? "Enter the annual bases and current and target days to calculate." : total < 0 ? "The targets absorb more cash than they release." : "One-off cash tied up in working capital that the targets would free, if achieved."}{excluded.length > 0 && total != null ? ` Excludes ${excluded.join(" and ")}: inputs incomplete.` : ""}</p>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Current CCC", ccc ? <CountNum key="a" value={ccc.cur} decimals={1} suffix=" d" /> : "—"],
                ["Target CCC", ccc ? <CountNum key="b" value={ccc.tgt} decimals={1} suffix=" d" /> : "—"],
                ["Current WC need", wc ? fmtM(wc.cur) : "—"],
                ["Target WC need", wc ? fmtM(wc.tgt) : "—"],
              ].map(([l, x]) => <div key={l as string} className="rounded-xl bg-bg2 p-3.5"><div className="font-mono text-[10px] uppercase text-ink3">{l}</div><div className="mt-1 font-display text-[19px] font-semibold">{x}</div></div>)}
            </div>
            {!allDays && total != null && <p className="mt-3 font-mono text-[11px] text-ink3">Cash conversion cycle and working-capital need need all three components.</p>}
          </motion.div>

          <div className="grid gap-4 md:grid-cols-3">
            {comps.map((c) => (
              <Card key={c.id}>
                <div className="flex items-center gap-2 text-[13px] font-medium"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />{c.title}</div>
                <div className={clsx("mt-3 font-display text-[26px] font-semibold tabular-nums", c.val != null && c.val < 0 && "text-crit")}>{c.val == null ? "—" : `${c.val < 0 ? "− " : ""}${cur()} ${fmtNum(Math.abs(c.val))}m`}</div>
                <div className="mt-0.5 font-mono text-[11px] text-ink3">{c.val == null ? `Needs ${c.need}` : c.val < 0 ? "additional cash required" : c.val === 0 ? "no change" : "cash released"}</div>
                {c.val != null && <div className="mt-2 font-mono text-[10.5px] text-ink3">{c.formula}</div>}
                {c.id === "pay" && pay != null && dpoRise > 0 && (
                  <p className={clsx("mt-3 flex gap-2 rounded-lg border p-2.5 text-[11.5px] leading-snug", dpoRise > 15 ? "border-crit/30 bg-crit/5 text-crit" : "border-warn/30 bg-warn/5 text-warn")}><AlertTriangle size={13} className="mt-0.5 shrink-0" />Paying suppliers {fmtNum(dpoRise, 0)} days later can strain supplier relationships, cost early-payment discounts, tighten credit terms or breach contract terms. Check agreed terms first.</p>
                )}
                {c.id === "pay" && pay != null && dpoRise < 0 && <p className="mt-3 text-[11.5px] leading-snug text-ink3">Shorter DPO means paying suppliers faster, which uses cash: shown as additional cash required.</p>}
                {c.id !== "pay" && c.val != null && c.val < 0 && <p className="mt-3 text-[11.5px] leading-snug text-crit">The target {c.unit} is higher than current, so this component absorbs cash.</p>}
              </Card>
            ))}
          </div>

          <Card>
            <CardHead title="Where the cash comes from" hint="Contribution of DSO, DIO and DPO to the total. Red bars are additional cash required, not hidden." />
            {steps.length ? <Waterfall steps={steps} height={280} negLabel="additional cash required" /> : <p className="py-10 text-center text-[13px] text-ink3">Enter the inputs to see the waterfall.</p>}
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHead title="Operating cash constraint" hint="Released cash is only usable above the cash the business needs to operate." />
              {gapToMin == null ? <p className="text-[13px] text-ink3">Enter today&apos;s cash and the minimum operating cash to see how much of the release is usable.</p> : (
                <div className="space-y-2.5 text-[13px]">
                  <div className="flex justify-between"><span className="text-ink2">Cash today</span><span className="font-mono">{fmtM(cash)}</span></div>
                  <div className="flex justify-between"><span className="text-ink2">Minimum operating cash</span><span className="font-mono">{fmtM(minC)}</span></div>
                  <div className={clsx("flex justify-between", gapToMin > 0 && "text-warn")}><span>{gapToMin > 0 ? "Already below the minimum by" : "Headroom above the minimum"}</span><span className="font-mono">{fmtM(gapToMin > 0 ? gapToMin : cash - minC)}</span></div>
                  <div className="flex justify-between border-t border-line pt-2.5 font-medium"><span>Release usable after restoring the minimum</span><span className="font-mono">{usable == null ? "—" : fmtM(usable)}</span></div>
                </div>
              )}
            </Card>
            <Card>
              <CardHead title="Current vs target days" hint="Lower DSO and DIO, and higher DPO, release cash." />
              <div className="h-[170px]">
                <ResponsiveContainer>
                  <BarChart data={cmp} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke="#23262d" vertical={false} />
                    <XAxis dataKey="name" stroke="#707681" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#707681" fontSize={11} tickLine={false} axisLine={false} unit="d" />
                    <Tooltip {...chartTooltip} cursor={{ fill: "#ffffff08" }} formatter={(x: number, n: string) => [`${x.toFixed(1)} days`, n === "current" ? "Current" : "Target"]} />
                    <Legend wrapperStyle={{ fontSize: 11, color: "#A2A7B0" }} formatter={(x) => (x === "current" ? "Current" : "Target")} />
                    <RBar dataKey="current" fill="#707681" radius={[3, 3, 0, 0]} maxBarSize={26} animationDuration={500} />
                    <RBar dataKey="target" fill="#3988F5" radius={[3, 3, 0, 0]} maxBarSize={26} animationDuration={500} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <div>
            <div className="mb-2 font-mono text-[10.5px] uppercase tracking-wider text-ink3">Quick scenarios · DSO and DIO only, DPO unchanged</div>
            <div className="grid gap-4 md:grid-cols-3">
              {SCEN.map((s, i) => (
                <button key={s.id} onClick={() => applyPreset(i)} aria-pressed={sel === i} className={clsx("tap rounded-card border bg-card p-5 text-left", sel === i ? "border-[#4a505c] bg-elev" : "border-line hover:border-[#3a3f49]")}>
                  <div className="flex items-center gap-2 text-[13px] font-medium"><span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />{s.name}</div>
                  <div className="mt-2 font-display text-[22px] font-semibold tabular-nums">{scen[i] == null ? "—" : `${cur()} ${fmtNum(scen[i])}m`}</div>
                  <div className="mt-1 font-mono text-[11px] text-ink3">DSO −{s.dso}d · DIO −{s.dio}d</div>
                  <p className="mt-2 text-[11.5px] leading-snug text-ink3">{s.note}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 rounded-2xl border border-warn/25 bg-warn/5 p-4 text-[12.5px] leading-relaxed text-ink2">
            <Info size={17} className="mt-0.5 shrink-0 text-warn" />
            <div>
              <p className="mb-1.5 font-medium text-ink">Assumptions</p>
              <ul className="list-disc space-y-1 pl-4">
                <li>This is an illustrative working-capital estimate: a one-off release of cash, not guaranteed cash recovery and not additional profit.</li>
                <li>Sales, COGS and purchases are held constant, and customer and supplier mix are unchanged.</li>
                <li>Target days are your assumptions, not benchmarks; achievability depends on customer terms, credit quality, stock mix and supplier agreements.</li>
                {purchasesProxy && <li>Annual purchases default to COGS because the file has no purchases figure.</li>}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
