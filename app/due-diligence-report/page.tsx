"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, ChevronDown, Download, FileText, Lightbulb, Loader2, Printer, RefreshCw, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { RiskGauge } from "@/components/charts/RiskGauge";
import { WithAnalysis } from "@/components/shared/Guard";
import { Button, Card, PageTitle, Pill } from "@/components/shared/ui";
import { buildReport, type ReportSection } from "@/lib/calculations/narrative";
import { useApp } from "@/lib/state/store";
import type { AnalysisResult } from "@/types/finance";

export default function Report() {
  return <WithAnalysis>{(a) => <Page a={a} />}</WithAnalysis>;
}

function toMarkdown(name: string, secs: ReportSection[]) {
  return [`# Due Diligence Report: ${name}`, "_Illustrative decision-support output generated from deterministic calculations. Not investment advice._", ""]
    .concat(secs.flatMap((s, i) => [`## ${i + 1}. ${s.title}`, ...s.evidence.map((e) => `- [Verified] ${e}`), ...s.explanations.map((e) => `- [Possible explanation] ${e}`), ...(s.questions ?? []).map((q) => `- [Question] ${q}`), ""]))
    .join("\n");
}

function Page({ a }: { a: AnalysisResult }) {
  const { active, toast } = useApp();
  const [phase, setPhase] = useState<"idle" | "gen" | "done">("idle");
  const [stamp, setStamp] = useState<Date | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set(["summary"]));
  const secs = useMemo(() => buildReport(a), [a]);
  const complete = Math.round((a.risk.evaluated / a.risk.total) * 100);

  const generate = () => {
    setPhase("gen");
    setTimeout(() => { setPhase("done"); setStamp(new Date()); setOpen(new Set(["summary"])); toast("Report generated", "pos"); }, 2000);
  };
  const toggle = (id: string) => setOpen((o) => { const n = new Set(o); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const jump = (id: string) => { setOpen((o) => new Set(o).add(id)); setTimeout(() => document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60); };
  const download = () => {
    const url = URL.createObjectURL(new Blob([toMarkdown(active.name, secs)], { type: "text/markdown" }));
    const el = document.createElement("a"); el.href = url; el.download = `${active.name.replace(/\W+/g, "-")}-due-diligence.md`; el.click(); URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageTitle title="Due Diligence Report" sub="An investment-ready write-up, built only from calculated figures." right={
        phase === "done" && (
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={generate}><RefreshCw size={14} /> Regenerate</Button>
            <Button variant="ghost" onClick={download}><Download size={14} /> Markdown</Button>
            <Button onClick={() => window.print()}><Printer size={14} /> Print / Save PDF</Button>
          </div>
        )
      } />

      <AnimatePresence mode="wait">
        {phase !== "done" ? (
          <motion.div key="pre" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Card className="mx-auto max-w-2xl text-center" hover={false}>
              <span className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-ai/30 bg-ai/10 text-ai">{phase === "gen" ? <Loader2 className="animate-spin" /> : <FileText />}</span>
              <h2 className="font-display text-xl font-semibold">{phase === "gen" ? "Composing report…" : `Report for ${active.name}`}</h2>
              <p className="mx-auto mt-2 max-w-md text-[13.5px] text-ink2">11 sections drawn from the calculated metrics and detected alerts. Verified evidence is kept separate from possible explanations.</p>
              {phase === "gen" ? (
                <ul className="mx-auto mt-5 max-w-xs space-y-1.5 text-left font-mono text-[11.5px] text-ink2">
                  {["Collecting calculated metrics", "Ordering findings by severity", "Separating evidence from hypotheses", "Listing data limitations"].map((t, i) => <motion.li key={t} initial={{ opacity: 0.2 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.45 }} className="flex gap-2"><BadgeCheck size={14} className="text-ai" />{t}</motion.li>)}
                </ul>
              ) : <Button variant="ai" className="mt-6" onClick={generate}><Sparkles size={15} /> Generate report</Button>}
              <p className="mt-5 font-mono text-[10.5px] text-ink3">AI model not configured · output uses deterministic templates.</p>
            </Card>
          </motion.div>
        ) : (
          <motion.div key="doc" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="print-doc">
            {/* report header */}
            <Card className="mb-5" hover={false}>
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  {/* <div className="mb-2 flex flex-wrap gap-2"><Pill tone="ai"><Sparkles size={11} /> Deterministic demo report</Pill>{active.synthetic && <Pill tone="warn">Synthetic data</Pill>}</div> */}
                  <h2 className="font-display text-[24px] font-semibold">{active.name}</h2>
                  <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11.5px] text-ink2">
                    <span><span className="text-ink3">PERIOD </span>FY{a.records[0].year}–FY{a.latestRecord.year}</span>
                    <span><span className="text-ink3">GENERATED </span>{stamp?.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span>
                    <span><span className="text-ink3">COMPLETENESS </span>{complete}%</span>
                  </div>
                </div>
                <div className="flex items-center gap-5 rounded-2xl border border-line bg-bg2 p-4">
                  <div className="w-[120px]"><RiskGauge risk={a.risk} size={120} /></div>
                  <div className="max-w-[240px] text-[12.5px] leading-relaxed text-ink2"><div className="mb-1 font-display text-[15px] font-semibold text-ink">{a.risk.classification}</div>{a.alerts.length} signals detected · {a.risk.evaluated}/{a.risk.total} indicators evaluated.</div>
                </div>
              </div>
            </Card>

            <div className="grid gap-5 lg:grid-cols-[250px_1fr]">
              <nav aria-label="Report sections" className="print-hide hidden lg:block">
                <div className="sticky top-24 rounded-card border border-line bg-card p-3">
                  <div className="px-2 pb-2 font-mono text-[10px] uppercase tracking-wider text-ink3">Sections</div>
                  {secs.map((s, i) => <button key={s.id} onClick={() => jump(s.id)} className="flex w-full gap-2.5 rounded-lg px-2 py-2 text-left text-[12.5px] text-ink2 hover:bg-elev hover:text-ink"><span className="font-mono text-[10.5px] text-ink3">{String(i + 1).padStart(2, "0")}</span>{s.title}</button>)}
                </div>
              </nav>

              <div>
                <div className="print-hide mb-4 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden">
                  {secs.map((s, i) => <button key={s.id} onClick={() => jump(s.id)} className="shrink-0 rounded-full border border-line bg-card px-3 py-2 font-mono text-[11px] text-ink2">{i + 1}. {s.title.split(" ").slice(0, 2).join(" ")}</button>)}
                </div>
                <div className="mb-3 flex items-center justify-between print:hidden">
                  <div className="flex flex-wrap gap-4 font-mono text-[10.5px] text-ink3"><span className="flex items-center gap-1.5"><BadgeCheck size={13} className="text-accent" /> VERIFIED EVIDENCE</span><span className="flex items-center gap-1.5"><Lightbulb size={13} className="text-ai" /> POSSIBLE EXPLANATION</span></div>
                  <button className="text-[12px] text-accent" onClick={() => setOpen(open.size === secs.length ? new Set() : new Set(secs.map((s) => s.id)))}>{open.size === secs.length ? "Collapse all" : "Expand all"}</button>
                </div>
                <div className="space-y-3">
                  {secs.map((s, i) => (
                    <section key={s.id} id={`sec-${s.id}`} className={clsx("scroll-mt-24 overflow-hidden rounded-card border bg-card", open.has(s.id) ? "border-[#3f4551]" : "border-line")}>
                      <button onClick={() => toggle(s.id)} aria-expanded={open.has(s.id)} className="flex w-full items-center gap-4 p-5 text-left">
                        <span className="font-mono text-[12px] text-ink3">{String(i + 1).padStart(2, "0")}</span>
                        <span className="flex-1 font-display text-[16px] font-medium">{s.title}</span>
                        <ChevronDown size={18} className={clsx("text-ink3 transition-transform print:hidden", open.has(s.id) && "rotate-180")} />
                      </button>
                      <div className={clsx("space-y-3 border-t border-line p-5", !open.has(s.id) && "hidden print:block")}>
                        {s.evidence.length > 0 && (
                          <div className="rounded-xl border border-accent/20 bg-accent/[0.04] p-4">
                            <div className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-accent"><BadgeCheck size={13} /> Verified evidence · from calculation engine</div>
                            <ul className="space-y-1.5 font-mono text-[12px] leading-relaxed text-ink">{s.evidence.map((e) => <li key={e}>{e}</li>)}</ul>
                          </div>
                        )}
                        {s.explanations.length > 0 && (
                          <div className="rounded-xl border border-ai/20 bg-ai/[0.04] p-4">
                            <div className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-ai"><Lightbulb size={13} /> Possible explanations · unverified</div>
                            <ul className="space-y-1.5 text-[13px] leading-relaxed text-ink2">{s.explanations.map((e) => <li key={e}>{e}</li>)}</ul>
                          </div>
                        )}
                        {s.questions && s.questions.length > 0 && (
                          <div className="rounded-xl border border-line bg-bg2 p-4">
                            <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-ink3">Questions for management</div>
                            <ol className="list-decimal space-y-1.5 pl-5 text-[13px] text-ink2">{s.questions.map((q) => <li key={q}>{q}</li>)}</ol>
                          </div>
                        )}
                      </div>
                    </section>
                  ))}
                </div>
                <p className="mt-5 text-[11.5px] leading-relaxed text-ink3">Decision support only. This report does not recommend investing in or rejecting the company, and does not replace professional due diligence. {active.synthetic && "All figures are synthetic."}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
