"use client";

import { Building2, Info } from "lucide-react";
import { useMemo } from "react";
import { Card, CardHead, Pill } from "@/components/shared/ui";
import { INDUSTRIES, industryById } from "@/lib/benchmarks/industries";
import { SOURCE } from "@/lib/benchmarks/resolve";
import { useApp } from "@/lib/state/store";

export const CURRENCIES = ["AED", "USD", "EUR", "GBP", "SAR", "QAR", "KWD", "OMR", "BHD", "EGP", "INR", "JPY", "CNY", "CHF", "Other"];
export const FREQUENCIES = ["Annual", "Half-yearly", "Quarterly", "Monthly"];

const sel = "h-12 w-full rounded-xl bg-bg2 px-3 text-[14px] text-ink outline-none transition-colors hover:bg-elev focus:bg-elev";
const Field = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
  <label className="block">
    <span className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-wider text-ink3">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-[11px] text-ink3">{hint}</span>}
  </label>
);

/** the target company's profile. The industry chosen here drives the benchmarks, thresholds and which indicators apply. */
export function IndustryProfile({ onChanged }: { onChanged?: () => void }) {
  const { active, updateInputs, updateDataset } = useApp();
  const i = active.inputs ?? {};
  const def = industryById(i.industry);
  const period = useMemo(() => { const ys = active.records.map((r) => r.year); return ys.length ? `FY${Math.min(...ys)} to FY${Math.max(...ys)}` : "—"; }, [active.records]);
  const change = (patch: Parameters<typeof updateInputs>[0]) => { updateInputs(patch); onChanged?.(); };
  return (
    <Card hover={false} className="mb-6 !border-accent/30">
      <CardHead icon={<Building2 size={17} className="text-accent" />} title="Target company profile" hint="Choose the target's industry before assessing risk. It selects the benchmarks, changes the scoring thresholds and decides which indicators apply." right={def ? <Pill tone="accent">{def.name}</Pill> : <Pill tone="warn">No industry selected</Pill>} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Field label="Select Target Company Industry">
          <select aria-label="Select Target Company Industry" value={i.industry ?? ""} className={sel} onChange={(e) => change({ industry: e.target.value || undefined, subIndustry: undefined, thresholds: {} })}>
            <option value="">Select industry…</option>
            {INDUSTRIES.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
        <Field label="Sub-industry (optional)" hint={def && def.subs.length ? "A sub-industry uses a narrower benchmark when one exists." : "None available for this selection."}>
          <select aria-label="Sub-industry" value={i.subIndustry ?? ""} disabled={!def || !def.subs.length} className={sel + " disabled:opacity-50"} onChange={(e) => change({ subIndustry: e.target.value || undefined })}>
            <option value="">{def?.subs.length ? "Whole industry" : "—"}</option>
            {def?.subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Company name">
          <input aria-label="Company name" defaultValue={active.name} key={active.id + active.name} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== active.name) updateDataset({ ...active, name: v }); }} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} className={sel} />
        </Field>
        <Field label="Reporting currency" hint={active.fileCurrency && active.fileCurrency !== (i.currency ?? "AED") ? `The file states ${active.fileCurrency}: figures are labelled as selected, not converted.` : "Labels only: no currency conversion is applied."}>
          <select aria-label="Reporting currency" value={i.currency ?? "AED"} className={sel} onChange={(e) => change({ currency: e.target.value })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
        </Field>
        <Field label="Financial reporting period" hint="Read from the uploaded years.">
          <div className={sel + " flex items-center font-mono text-[13px] text-ink2"}>{period}</div>
        </Field>
        <Field label="Reporting frequency" hint="Ratios assume annual statements; other frequencies are annualised by you.">
          <select aria-label="Reporting frequency" value={i.frequency ?? "Annual"} className={sel} onChange={(e) => change({ frequency: e.target.value })}>{FREQUENCIES.map((c) => <option key={c}>{c}</option>)}</select>
        </Field>
      </div>
      <div className="mt-4 flex gap-3 rounded-xl border border-line bg-bg2 p-3.5 text-[12px] leading-relaxed text-ink2">
        <Info size={15} className="mt-0.5 shrink-0 text-accent" />
        <p>{def ? <><b className="text-ink">{def.name}.</b> {def.focus} </> : <>No industry selected, so generic proposed screening thresholds are used and no industry benchmarks are applied. </>}{def && def.groups.length > 0 && <>Benchmarks: {SOURCE.name}, {SOURCE.geography}, {SOURCE.year}, updated {SOURCE.updated}.</>}</p>
      </div>
    </Card>
  );
}
