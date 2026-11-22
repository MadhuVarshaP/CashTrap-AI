"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import type { FinancialRecord } from "@/types/finance";
import { parseFinancialFile, type ParseMeta } from "@/lib/utilities/parse";

type S = { kind: "idle" } | { kind: "reading"; name: string; pct: number } | { kind: "ok"; name: string; warnings: string[]; notes: string[] } | { kind: "error"; errors: string[] };

export function Dropzone({ onParsed, onError }: { onParsed: (r: FinancialRecord[], file: File, meta?: ParseMeta, warnings?: string[]) => void; onError?: (errors: string[], file: File) => void }) {
  const [s, setS] = useState<S>({ kind: "idle" });
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function handle(file?: File) {
    if (!file) return;
    setS({ kind: "reading", name: file.name, pct: 10 });
    const t = setInterval(() => setS((p) => (p.kind === "reading" ? { ...p, pct: Math.min(90, p.pct + 18) } : p)), 90);
    const res = await parseFinancialFile(file);
    clearInterval(t);
    if (res.errors.length) { onError?.(res.errors, file); return setS({ kind: "error", errors: res.errors.slice(0, 5) }); }
    setS({ kind: "ok", name: file.name, warnings: res.warnings.slice(0, 6), notes: res.notes ?? [] });
    onParsed(res.records, file, res.meta, res.warnings);
  }

  // `contents` lets the drop square and the result box be separate cells of the parent grid, so the result can span the full row
  return (
    <div className="contents">
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); handle(e.dataTransfer.files[0]); }}
        onClick={() => input.current?.click()}
        role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && input.current?.click()}
        className={clsx("flex aspect-square min-h-[230px] w-full cursor-pointer md:col-start-1 md:row-start-1 flex-col items-center justify-center rounded-2xl border border-dashed px-5 py-5 text-center transition-colors", over ? "border-accent bg-accent/[0.06]" : "border-line2 bg-bg2 hover:border-ink3")}
      >
        <input ref={input} type="file" accept=".csv,.xlsx,.xls" hidden onChange={(e) => { handle(e.target.files?.[0]); e.target.value = ""; }} />
        <AnimatePresence mode="wait">
          {s.kind === "reading" ? (
            <motion.div key="r" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-xs">
              <Loader2 className="mx-auto mb-3 animate-spin text-accent" />
              <div className="mb-2 truncate text-[13px]">{s.name}</div>
              <div className="h-1.5 rounded-full bg-elev"><motion.div className="h-full rounded-full bg-accent" animate={{ width: `${s.pct}%` }} /></div>
              <div className="mt-2 font-mono text-[11px] text-ink3">Parsing & validating…</div>
            </motion.div>
          ) : (
            <motion.div key="i" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-elev text-accent"><UploadCloud size={22} /></span>
              <div className="text-[14px] font-medium">Drop a financial statement file here</div>
              <div className="mt-1 text-[12.5px] text-ink2">or click to browse</div>
              <div className="mt-3 flex flex-wrap justify-center items-center justify-center gap-2 font-mono text-[10.5px] text-ink3"><FileSpreadsheet size={13} /> .xlsx · .csv · max 5 MB · min. 2 years</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {s.kind === "ok" && (
        <div className="rounded-xl border border-pos/30 bg-pos/5 p-3.5 text-[12.5px] md:col-span-2 md:row-start-2">
          <div className="flex items-center gap-2 text-pos"><CheckCircle2 size={15} /> {s.name} validated</div>
          {s.notes.map((n) => <div key={n} className="mt-1.5 text-ink2">{n}</div>)}
          {s.warnings.map((w) => <div key={w} className="mt-1.5 flex gap-2 text-warn"><AlertTriangle size={13} className="mt-0.5 shrink-0" />{w}</div>)}
        </div>
      )}
      {s.kind === "error" && (
        <div role="alert" className="rounded-xl border border-crit/30 bg-crit/5 p-3.5 text-[12.5px] text-crit md:col-span-2 md:row-start-2">
          {s.errors.map((e) => <div key={e} className="flex gap-2"><AlertTriangle size={13} className="mt-0.5 shrink-0" />{e}</div>)}
        </div>
      )}
    </div>
  );
}
