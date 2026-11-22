"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowUpDown, CheckCircle2, Download, History, Loader2, Play, Search, Database, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { IndustryProfile, type ProfileDraft } from "@/components/risk/IndustryProfile";
import { Dropzone } from "@/components/shared/Dropzone";
import { Bar, Button, Card, CardHead, Pill } from "@/components/shared/ui";
import { analyze } from "@/lib/calculations/analyze";
import { useApp } from "@/lib/state/store";
import { REQUIRED_COLUMNS, SAMPLE_CSV, dataQuality } from "@/lib/utilities/parse";
import { missingFieldReport, validateRecords } from "@/lib/utilities/validate";
import type { FieldKey, FinancialRecord } from "@/types/finance";

const BASE_COLS: { key: keyof FinancialRecord; label: string }[] = [
  { key: "year", label: "Year" }, { key: "revenue", label: "Revenue" }, { key: "cogs", label: "COGS" }, { key: "ebitda", label: "EBITDA" },
  { key: "receivables", label: "Receivables" }, { key: "inventory", label: "Inventory" }, { key: "payables", label: "Payables" },
  { key: "operatingCashFlow", label: "Op. Cash Flow" }, { key: "cash", label: "Cash" }, { key: "debt", label: "Debt" },
];
const OPT_COLS: { key: keyof FinancialRecord; label: string }[] = [
  { key: "ebitdaAdjustment", label: "EBITDA Adj." }, { key: "capex", label: "Capex" }, { key: "cashTaxes", label: "Cash Taxes" }, { key: "interestExpense", label: "Cash Interest" },
  { key: "principalRepayment", label: "Sched. Principal" }, { key: "shortTermDebt", label: "Debt < 12m" }, { key: "currentAssets", label: "Current Assets" }, { key: "currentLiabilities", label: "Current Liab." },
  { key: "creditSales", label: "Credit Sales" }, { key: "creditPurchases", label: "Purchases" },
];
const COLS = [...BASE_COLS, ...OPT_COLS];
const unitsFor = (c: string) => [{ label: c, v: 1 }, { label: `${c} thousands`, v: 1_000 }, { label: `${c} millions`, v: 1_000_000 }];

export default function CompanyAnalysis() {
  const { active, hasCompany, loadDemo, datasets, notify, addDataset, updateDataset, setActive, deleteDataset, history, removeHistory, clearHistory, runAnalysis, status, error, analysis, toast } = useApp();
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [q, setQ] = useState("");
  // chosen before the file is read; applied to the company the moment it is uploaded
  const [draft, setDraft] = useState<ProfileDraft>({ currency: "AED", frequency: "Annual" });
  const [sort, setSort] = useState<{ k: keyof FinancialRecord; dir: 1 | -1 }>({ k: "year", dir: 1 });
  const dq = dataQuality(active.records);

  const rows = useMemo(() => {
    const f = active.records.filter((r) => !q || Object.values(r).some((v) => String(v ?? "missing").toLowerCase().includes(q.toLowerCase())));
    return [...f].sort((a, b) => ((a[sort.k] ?? -Infinity) > (b[sort.k] ?? -Infinity) ? 1 : -1) * sort.dir);
  }, [active.records, q, sort]);

  const edit = (year: number, key: FieldKey, raw: string) => {
    const v = raw.trim() === "" ? null : Number(raw);
    if (v != null && !Number.isFinite(v)) return;
    updateDataset({ ...active, records: active.records.map((r) => (r.year !== year ? r : { ...r, [key]: v, ...(key === "receivables" ? { reportedDso: null } : key === "inventory" ? { reportedDio: null } : key === "payables" ? { reportedDpo: null } : {}) })) });
  };

  // which fields are empty, in which years, and what that switches off: computed with the same engine the Run button uses
  const preview = useMemo(() => analyze(active), [active]);
  const label = (k: string) => COLS.find((c) => c.key === k)?.label ?? k;
  const gaps = Object.entries(dq.missing.reduce<Record<string, number[]>>((m, x) => ((m[x.field] ??= []).push(x.year), m), {}));
  const off = preview?.risk.categories.flatMap((c) => c.indicators).filter((i) => i.points == null && i.applicable) ?? [];
  const baseIssues = useMemo(() => validateRecords(active.records), [active.records]);
  const fieldReport = useMemo(() => missingFieldReport(active.records), [active.records]);
  const issues = [...baseIssues, ...(active.fileCurrency && active.inputs?.currency && active.fileCurrency !== active.inputs.currency ? [{ level: "warning" as const, text: `Currency inconsistency: the file states ${active.fileCurrency} but the reporting currency is set to ${active.inputs.currency}. Figures are not converted.` }] : [])];
  const errs = issues.filter((i) => i.level === "error");
  const warnings: string[] = [];
  if (active.records[0] && !active.records[0].opening && active.records[0].reportedDso == null) warnings.push("First-year DSO/DIO/DPO use closing balances only unless opening balances were supplied.");
  const ready = active.records.length >= 2 && errs.length === 0;

  return (
    <>

      <IndustryProfile draft={hasCompany ? undefined : { value: draft, set: setDraft }} />
      <div className="grid gap-5 xl:grid-cols-12">
        <Card className={hasCompany ? "xl:col-span-7" : "xl:col-span-12"}>
          <CardHead title="Upload financial records" hint="Columns are matched by name; common aliases (Sales, OCF, Total Debt…) are recognised. Blank cells are treated as missing, never zero." />
          <Dropzone onError={(errs, file) => notify({ title: `Couldn't read ${file.name}`, body: errs[0], tone: "crit" })} onParsed={(records, file, meta, warns) => {
            addDataset({ id: `upload-${Date.now()}`, name: draft.name || (meta?.name ?? file.name.replace(/\.[^.]+$/, "")), industry: "Uploaded company", synthetic: !!meta?.synthetic, records, unitMultiplier: meta?.unitMultiplier ?? 1_000_000, fileName: file.name, fileSize: file.size, fileCurrency: meta?.currency, inputs: { industry: draft.industry, subIndustry: draft.subIndustry, currency: draft.currency ?? meta?.currency ?? "AED", frequency: draft.frequency ?? "Annual" } });
            notify({ title: `Uploaded ${meta?.name ?? file.name}`, body: `${records.length} years loaded${warns?.length ? ` · ${warns.length} data warning${warns.length > 1 ? "s" : ""}` : ""}. Run the analysis next.`, tone: warns?.length ? "warn" : "pos", href: "/company-analysis" });
          }} />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="ghost" onClick={() => { loadDemo(); toast("Loaded the GulfTech sample company", "info"); }}><Database size={15} /> Explore with GulfTech Demo Data</Button>
            <a download="cashcop-ai-template.csv" href={`data:text/csv;charset=utf-8,${encodeURIComponent(SAMPLE_CSV)}`} className="inline-flex items-center gap-2 text-[12.5px] text-ink2 hover:text-ink"><Download size={14} /> Download CSV template</a>
          </div>
          <div className="mt-5 border-t border-line pt-4">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-ink3">Required columns (three or more years recommended)</div>
            <div className="flex flex-wrap gap-1.5">{REQUIRED_COLUMNS.map((c) => <span key={c} className="rounded-md border border-line bg-bg2 px-2 py-1 font-mono text-[10.5px] text-ink2">{c}</span>)}</div>
            <div className="mb-2 mt-4 font-mono text-[10px] uppercase tracking-wider text-ink3">Optional columns: unlock the bridge, coverage and liquidity checks</div>
            <div className="flex flex-wrap gap-1.5">{["EBITDA_Adjustments", "Capex", "Cash_Taxes", "Cash_Interest", "Current_Assets", "Current_Liabilities", "Scheduled_Principal", "Annual_Purchases", "Credit_Sales"].map((c) => <span key={c} className="rounded-md border border-dashed border-line px-2 py-1 font-mono text-[10.5px] text-ink3">{c}</span>)}</div>
          </div>
        </Card>

        {hasCompany && <div className="space-y-5 xl:col-span-5">
          <Card>
            <CardHead title="Data quality" right={<Pill tone={ready && !dq.missing.length ? "pos" : ready ? "warn" : "crit"}>{ready ? (dq.missing.length ? "Ready · with gaps" : "Ready") : "Not ready"}</Pill>} />
            <div className="grid grid-cols-3 gap-3">
              {[["Records", String(dq.count)], ["Missing", String(dq.missing.length)], ["Complete", `${(dq.completeness * 100).toFixed(0)}%`]].map(([l, v]) => (
                <div key={l} className="rounded-xl border border-line bg-bg2 p-3"><div className="font-mono text-[10px] uppercase text-ink3">{l}</div><div className="mt-1 font-display text-[24px] font-semibold tabular-nums">{v}</div></div>
              ))}
            </div>
            <Bar value={dq.completeness * 100} max={100} color={dq.completeness === 1 ? "#10B981" : "#F59E0B"} className="mt-4" />
            <ul className="mt-4 space-y-2">
              {issues.filter((i) => i.level === "error").map((i) => <li key={i.text} className="flex gap-2 text-[12.5px] text-crit"><AlertTriangle size={14} className="mt-0.5 shrink-0" />{i.text}</li>)}
              {issues.filter((i) => i.level === "warning").map((i) => <li key={i.text} className="flex gap-2 text-[12.5px] text-warn"><AlertTriangle size={14} className="mt-0.5 shrink-0" />{i.text}</li>)}
              {warnings.map((w) => <li key={w} className="flex gap-2 text-[12.5px] text-warn"><AlertTriangle size={14} className="mt-0.5 shrink-0" />{w}</li>)}
              {warnings.length === 0 && issues.length === 0 && <li className="flex gap-2 text-[12.5px] text-pos"><CheckCircle2 size={14} className="mt-0.5 shrink-0" />No validation warnings.</li>}
            </ul>
            {errs.length > 0 && <p role="alert" className="mt-3 rounded-xl border border-crit/30 bg-crit/5 p-3 text-[12.5px] text-crit">The analysis can&apos;t run until these errors are fixed. Correct the values in the table below (or the file&apos;s units) and they re-validate immediately.</p>}
            <div className="mt-4 rounded-xl border border-line bg-bg2 p-3.5 text-[12.5px]">
              <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-ink3">Field coverage</div>
              <div className="space-y-2.5">
                {fieldReport.map((g) => (
                  <div key={g.group}>
                    <div className="mb-1 text-[11.5px] text-ink2">{g.group}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {g.present.map((n) => <span key={n} className="rounded-md border border-pos/25 bg-pos/5 px-1.5 py-0.5 font-mono text-[10px] text-pos">{n}</span>)}
                      {g.partial.map((n) => <span key={n} className="rounded-md border border-warn/30 bg-warn/5 px-1.5 py-0.5 font-mono text-[10px] text-warn">{n} · some years</span>)}
                      {g.missing.map((n) => <span key={n} className="rounded-md border border-line px-1.5 py-0.5 font-mono text-[10px] text-ink3">{n} · not supplied</span>)}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2.5 text-[11px] text-ink3">Anything not supplied stays “not supplied”: it is never replaced with zero, and the indicators that need it read Not Assessed.</p>
            </div>
            {gaps.length > 0 && (
              <div className="mt-4 rounded-xl border border-warn/25 bg-warn/5 p-3.5 text-[12.5px]">
                <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-warn">Effect of the missing data</div>
                <p className="text-ink2">
                  {!preview ? "At least two years are needed before analysis can run."
                    : preview.risk.insufficient ? <span className="text-crit">Analysis will run but the score will read “Insufficient data”: only {preview.risk.coverage}% of the 100-point model can be assessed and at least 40% is needed.</span>
                    : <>You can still run the analysis. <span className="text-ink">{preview.risk.evaluated} of {preview.risk.total}</span> risk indicators ({preview.risk.coverage}% of the model) can be assessed{off.length ? `; not assessed: ${off.slice(0, 5).map((c) => c.name).join(", ")}${off.length > 5 ? ` and ${off.length - 5} more` : ""}` : ""}. The score uses only the indicators that can be assessed.</>}
                </p>
                <p className="mt-2 text-ink3">Fill a value in the table below (click “missing”) to switch an indicator back on.</p>
              </div>
            )}
            {(!active.synthetic || active.fileName) && (
              <label className="mt-4 flex items-center justify-between gap-3 text-[12.5px] text-ink2">Values are in
                <select value={active.unitMultiplier} onChange={(e) => updateDataset({ ...active, unitMultiplier: Number(e.target.value) })} className="rounded-lg border border-line bg-elev px-2.5 py-2 text-ink">
                  {unitsFor(active.inputs?.currency ?? "AED").map((u) => <option key={u.v} value={u.v}>{u.label}</option>)}
                </select>
              </label>
            )}
          </Card>

          <Card>
            <CardHead title="Run analysis" />
            <AnimatePresence mode="wait">
              <motion.div key={status} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {status === "processing" && (
                  <div>
                    <div className="mb-3 flex items-center gap-2 text-[13px]"><Loader2 size={16} className="animate-spin text-accent" /> Processing…</div>
                    {["Validating records", "Computing DSO · DIO · DPO · CCC", "Scoring weighted risk model", "Detecting anomalies"].map((t, i) => (
                      <motion.div key={t} initial={{ opacity: 0.2 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.38 }} className="flex items-center gap-2 py-1 font-mono text-[11.5px] text-ink2"><span className="h-1.5 w-1.5 rounded-full bg-accent" />{t}</motion.div>
                    ))}
                  </div>
                )}
                {status === "failed" && <div role="alert" className="mb-3 rounded-xl border border-crit/30 bg-crit/5 p-3 text-[12.5px] text-crit">{error}</div>}
                {status === "done" && analysis && <div className="mb-3 flex items-center gap-2 text-[13px] text-pos"><CheckCircle2 size={16} /> Analysis complete · {analysis.risk.classification}</div>}
                {status === "idle" && <p className="mb-3 text-[12.5px] text-ink2">Inspect the records, then analyse. Results appear across the dashboard, assessment and report.</p>}
              </motion.div>
            </AnimatePresence>
            <div className="flex flex-wrap gap-3">
              <Button onClick={runAnalysis} disabled={!ready || status === "processing"} className="w-full sm:w-auto"><Play size={15} /> {status === "done" ? "Re-analyse Financials" : status === "failed" ? "Retry Analysis" : "Analyse Financials"}</Button>
              {status === "done" && <Link href="/overview"><Button variant="ghost">View dashboard</Button></Link>}
            </div>
          </Card>
        </div>}

        {hasCompany && <Card className="xl:col-span-12 !px-0 !pb-2">
          <div className="px-5 sm:px-6"><CardHead title="Financial records" hint="Click a value to edit it. Edits re-validate immediately; uploaded companies need re-analysis afterwards." right={
            <div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink3" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" aria-label="Search records" className="h-10 w-40 rounded-xl bg-bg2 pl-9 pr-3 text-[12.5px] outline-none transition-colors placeholder:text-ink3 focus:bg-elev sm:w-56" /></div>
          } /></div>
          {/* desktop / tablet table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1700px] text-[12.5px]">
              <thead><tr className="border-y border-line bg-bg2">
                {COLS.map((c) => (
                  <th key={c.key} className="px-4 py-3 text-left font-mono text-[10.5px] font-medium uppercase tracking-wider text-ink3 first:pl-6">
                    <button onClick={() => setSort({ k: c.key, dir: sort.k === c.key ? (-sort.dir as 1 | -1) : 1 })} className="inline-flex items-center gap-1 hover:text-ink2">{c.label}<ArrowUpDown size={11} /></button>
                  </th>
                ))}
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.year} className="border-b border-line/60 hover:bg-bg2/60">
                    {COLS.map((c) => (
                      <td key={c.key} className="px-4 py-1.5 font-mono first:pl-6">
                        {c.key === "year" ? <span className="text-ink">{r.year}</span> : (
                          <input defaultValue={r[c.key] == null ? "" : String(r[c.key])} key={`${r.year}${c.key}${r[c.key]}`} onBlur={(e) => e.target.value !== String(r[c.key] ?? "") && edit(r.year, c.key as FieldKey, e.target.value)} placeholder="missing" aria-label={`${c.label} ${r.year}`} className={clsx("h-9 w-full min-w-[80px] rounded-lg bg-transparent px-2 tabular-nums outline-none transition-colors hover:bg-bg2 focus:bg-elev", r[c.key] == null ? "placeholder:text-warn" : "text-ink")} />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={COLS.length} className="px-6 py-8 text-center text-ink3">No matching records.</td></tr>}
              </tbody>
            </table>
          </div>
          {/* mobile cards */}
          <div className="space-y-3 px-4 md:hidden">
            {rows.map((r) => (
              <div key={r.year} className="rounded-xl border border-line bg-bg2 p-4">
                <div className="mb-3 font-display text-[18px] font-semibold">FY{r.year}</div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                  {BASE_COLS.slice(1).map((c) => <div key={c.key}><dt className="font-mono text-[10px] uppercase text-ink3">{c.label}</dt><dd className={clsx("font-mono text-[13px] tabular-nums", r[c.key] == null && "text-warn")}>{r[c.key] == null ? "missing" : String(r[c.key])}</dd></div>)}
                </dl>
              </div>
            ))}
          </div>
        </Card>}

        <Card className="xl:col-span-12">
          <CardHead icon={<History size={17} className="text-ink3" />} title="Upload history" hint="A log of every file uploaded in this browser. Deleting a company removes its data but keeps the log entry." right={
            history.some((h) => h.status === "deleted") ? <button onClick={() => { clearHistory(); toast("Cleared deleted entries"); }} className="text-[12px] text-ink3 hover:text-ink">Clear deleted</button> : undefined
          } />
          {history.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-ink3">No uploads yet. Files you upload will be listed here.</p>
          ) : (
            <ul className="divide-y divide-line/60">
              {history.map((h) => {
                const live = datasets.find((d) => d.id === h.id);
                const isActive = live && live.id === active.id;
                return (
                  <li key={h.id} className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={clsx("truncate text-[14px] font-medium", h.status === "deleted" && "text-ink3 line-through")}>{h.name}</span>
                        {isActive && <Pill tone="accent">Active</Pill>}
                        {h.status === "deleted" && <Pill tone="crit">Deleted</Pill>}
                        {h.analysedAt && h.status === "active" && <Pill tone="pos">Analysed</Pill>}
                      </div>
                      <div className="mt-1 font-mono text-[11px] text-ink3">
                        {h.fileName ?? "—"}{h.fileSize ? ` · ${(h.fileSize / 1024).toFixed(0)} KB` : ""} · {h.period} · {h.rows} yrs · uploaded {new Date(h.uploadedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                        {h.deletedAt && ` · deleted ${new Date(h.deletedAt).toLocaleDateString("en-GB", { dateStyle: "medium" })}`}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {live && !isActive && <Button variant="ghost" className="!min-h-[36px]" onClick={() => { setActive(h.id); toast(`Switched to ${h.name}`); }}>Open</Button>}
                      {live && (confirmDel === h.id ? (
                        <>
                          <Button className="!min-h-[36px] !bg-crit hover:!bg-crit/90" onClick={() => { deleteDataset(h.id); setConfirmDel(null); toast(`Deleted ${h.name}`, "warn"); }}>Confirm delete</Button>
                          <Button variant="ghost" className="!min-h-[36px]" onClick={() => setConfirmDel(null)}>Cancel</Button>
                        </>
                      ) : <Button variant="ghost" className="!min-h-[36px] !text-crit" onClick={() => setConfirmDel(h.id)}><Trash2 size={14} /> Delete</Button>)}
                      {!live && <Button variant="ghost" className="!min-h-[36px]" onClick={() => removeHistory(h.id)}>Remove entry</Button>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

      </div>
    </>
  );
}
