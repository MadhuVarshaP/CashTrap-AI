"use client";

import { cur } from "@/lib/utilities/format";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, ChevronDown, FileDown, FileText, Loader2, Printer, RefreshCw, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { RiskGauge } from "@/components/charts/RiskGauge";
import { WithAnalysis } from "@/components/shared/Guard";
import { Button, Card, PageTitle } from "@/components/shared/ui";
import { buildReport, type Tag } from "@/lib/calculations/narrative";
import { useAutoCollapse } from "@/lib/utilities/useAutoCollapse";
import { downloadReportPdf } from "@/lib/utilities/pdf";
import { useApp } from "@/lib/state/store";
import type { AnalysisResult } from "@/types/finance";

export default function Report() {
  return <WithAnalysis>{(a) => <Page a={a} />}</WithAnalysis>;
}

const TAGS: Record<Tag, { label: string; cls: string }> = {
  fact: { label: "Fact", cls: "border-accent/30 bg-accent/10 text-accent" },
  estimate: { label: "Estimate", cls: "border-pos/30 bg-pos/10 text-pos" },
  assumption: { label: "Assumption", cls: "border-warn/30 bg-warn/10 text-warn" },
  missing: { label: "Missing data", cls: "border-crit/30 bg-crit/10 text-crit" },
  hypothesis: { label: "Interpretation", cls: "border-ai/30 bg-ai/10 text-ai" },
};

function Page({ a }: { a: AnalysisResult }) {
  const { active, toast } = useApp();
  const [phase, setPhase] = useState<"idle" | "gen" | "done">("idle");
  const [stamp, setStamp] = useState<Date | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const base = useMemo(() => buildReport(a), [a]);
  const secs = base;

  const [pdfBusy, setPdfBusy] = useState(false);
  useAutoCollapse(open.size > 0, () => setOpen(new Set()));
  const complete = a.risk.coverage;

  const generate = () => {
    setPhase("gen");
    setTimeout(() => { setPhase("done"); setStamp(new Date()); setOpen(new Set()); toast("Report generated", "pos"); }, 2000);
  };
  const toggle = (id: string) => setOpen((o) => { const n = new Set(o); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const jump = (id: string) => { setOpen((o) => new Set(o).add(id)); setTimeout(() => document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60); };
  const pdf = async () => {
    setPdfBusy(true);
    try {
      await downloadReportPdf({
        company: active.name, period: `FY${a.records[0].year}-FY${a.latestRecord.year}`,
        generated: (stamp ?? new Date()).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }),
        score: a.risk.score == null ? "Insufficient data" : `${a.risk.score}/100 (${a.risk.classification})`,
        coverage: `${a.risk.coverage}%`, confidence: a.risk.confidence.level,
      }, secs, `${active.name.replace(/\W+/g, "-")}-due-diligence.pdf`);
      toast("PDF downloaded", "pos");
    } catch { toast("Couldn't build the PDF", "crit"); } finally { setPdfBusy(false); }
  };

  return (
    <>
      <PageTitle title="Due Diligence Report" sub="An investment-ready write-up, built only from calculated figures." right={
        phase === "done" && (
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={generate}><RefreshCw size={14} /> Regenerate</Button>
            <Button variant="ghost" onClick={() => window.print()}><Printer size={14} /> Print</Button>
            <Button onClick={pdf} disabled={pdfBusy}>{pdfBusy ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />} Download PDF</Button>
          </div>
        )
      } />

      <AnimatePresence mode="wait">
        {phase !== "done" ? (
          <motion.div key="pre" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Card className="mx-auto max-w-2xl text-center" hover={false}>
              <span className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-ai/30 bg-ai/10 text-ai">{phase === "gen" ? <Loader2 className="animate-spin" /> : <FileText />}</span>
              <h2 className="font-display text-xl font-semibold">{phase === "gen" ? "Composing report…" : `Report for ${active.name}`}</h2>
              <p className="mx-auto mt-2 max-w-md text-[13.5px] text-ink2">Six sections, each answering an investor question, drawn only from the uploaded data, the calculated outputs and the selected industry's benchmarks. Calculated findings (Fact, Estimate) are labelled apart from assumptions and interpretations. </p>
              {phase === "gen" ? (
                <ul className="mx-auto mt-5 max-w-xs space-y-1.5 text-left font-mono text-[11.5px] text-ink2">
                  {["Collecting calculated metrics", "Ranking risks by materiality", `Quantifying impact in ${cur()}`, "Labelling facts, estimates and hypotheses"].map((t, i) => <motion.li key={t} initial={{ opacity: 0.2 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.45 }} className="flex gap-2"><BadgeCheck size={14} className="text-ai" />{t}</motion.li>)}
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
                  
                  <h2 className="font-display text-[24px] font-semibold">{active.name}</h2>
                  <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11.5px] text-ink2">
                    <span><span className="text-ink3">PERIOD </span>FY{a.records[0].year}–FY{a.latestRecord.year}</span>
                    <span><span className="text-ink3">GENERATED </span>{stamp?.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span>
                    <span><span className="text-ink3">MODEL COVERAGE </span>{complete}%</span>
                    <span><span className="text-ink3">CONFIDENCE </span>{a.risk.confidence.level}</span>
                  </div>
                </div>
                <div className="flex items-center gap-5 rounded-2xl border border-line bg-bg2 p-4">
                  <div className="w-[150px]"><RiskGauge risk={a.risk} size={150} /></div>
                  <div className="max-w-[240px] text-[12.5px] leading-relaxed text-ink2"><div className="mb-1 font-display text-[15px] font-semibold text-ink">{a.risk.classification}</div>{a.risk.evaluated} of {a.risk.total} indicators assessed · {a.risk.coverage}% of the model.</div>
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
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3 print:hidden">
                  <div className="flex flex-wrap gap-2">{(Object.keys(TAGS) as Tag[]).map((t) => <span key={t} className={clsx("rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider", TAGS[t].cls)}>{TAGS[t].label}</span>)}</div>
                  <button className="text-[12px] text-accent" onClick={() => setOpen(open.size === secs.length ? new Set() : new Set(secs.map((s) => s.id)))}>{open.size === secs.length ? "Collapse all" : "Expand all"}</button>
                </div>
                <div className="space-y-3">
                  {secs.map((s, i) => (
                    <section key={s.id} id={`sec-${s.id}`} className={clsx("scroll-mt-24 overflow-hidden rounded-card border bg-card", open.has(s.id) ? "border-line2" : "border-line")}>
                      <button onClick={() => toggle(s.id)} aria-expanded={open.has(s.id)} className="flex w-full items-center gap-4 p-5 text-left">
                        <span className="font-mono text-[12px] text-ink3">{String(i + 1).padStart(2, "0")}</span>
                        <span className="min-w-0 flex-1"><span className="block font-display text-[16px] font-medium">{s.title}</span><span className="mt-0.5 block text-[12.5px] text-ink3">{s.question}</span></span>
                        <ChevronDown size={18} className={clsx("text-ink3 transition-transform print:hidden", open.has(s.id) && "rotate-180")} />
                      </button>
                      <div className={clsx("space-y-3 border-t border-line p-5", !open.has(s.id) && "hidden print:block")}>
                        <ul className="space-y-2.5">
                          {s.items.map((it, k) => (
                            <li key={k} className="grid grid-cols-[84px_1fr] items-start gap-3 text-[13px] leading-relaxed sm:grid-cols-[96px_1fr]">
                              <span className={clsx("mt-0.5 rounded-md border px-1.5 py-0.5 text-center font-mono text-[9.5px] uppercase tracking-wider", TAGS[it.tag].cls)}>{TAGS[it.tag].label}</span>
                              <span className={it.tag === "fact" ? "text-ink" : "text-ink2"}>{it.text}</span>
                            </li>
                          ))}
                        </ul>
                        {s.flags && s.flags.length > 0 && (
                          <div className="space-y-3">
                            {s.flags.map((fl, n) => (
                              <div key={fl.title} className="rounded-xl border border-line bg-bg2 p-4">
                                <div className="mb-3 flex items-center justify-between gap-3"><span className="font-display text-[14px] font-medium"><span className="mr-2 font-mono text-[11px] text-ink3">{n + 1}.</span>{fl.title}</span><span className={clsx("rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase", fl.level === "Critical" ? "border-crit/30 bg-crit/10 text-crit" : "border-warn/30 bg-warn/10 text-warn")}>{fl.level}</span></div>
                                <dl className="grid gap-3 text-[12.5px] leading-relaxed md:grid-cols-2">
                                  {([["What the indicator shows", fl.shows], ["Why it matters to a PE investor", fl.matters], ["Potential financial implication", fl.implication], ["What to investigate", fl.investigate.join(" · ")]] as const).map(([k, t]) => <div key={k}><dt className="font-mono text-[10px] uppercase tracking-wider text-ink3">{k}</dt><dd className="mt-1 text-ink2">{t}</dd></div>)}
                                </dl>
                              </div>
                            ))}
                          </div>
                        )}

                      </div>
                    </section>
                  ))}
                </div>
                <p className="mt-5 text-[11.5px] leading-relaxed text-ink3">Decision support only. This report presents the financial evidence and its investment implications; it does not recommend buying or rejecting the company, which is for the investor to decide, and it does not replace professional due diligence.</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
