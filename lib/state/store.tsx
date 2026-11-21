"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AnalysisResult, Dataset, HistoryItem } from "@/types/finance";
import { GULFTECH } from "@/lib/demo-data/gulftech";
import { analyze } from "@/lib/calculations/analyze";
import { analyzeRemote } from "@/lib/api/client";

export type Status = "idle" | "processing" | "done" | "failed";

interface Toast { id: number; text: string; tone: "pos" | "warn" | "crit" | "info" }

interface Ctx {
  datasets: Dataset[];
  active: Dataset;
  setActive: (id: string) => void;
  addDataset: (d: Dataset) => void;
  updateDataset: (d: Dataset) => void;
  deleteDataset: (id: string) => void;
  history: HistoryItem[];
  removeHistory: (id: string) => void;
  clearHistory: () => void;
  analysis: AnalysisResult | null;
  status: Status;
  error: string | null;
  runAnalysis: () => Promise<void>;
  toasts: Toast[];
  toast: (text: string, tone?: Toast["tone"]) => void;
}

const C = createContext<Ctx | null>(null);
export const useApp = () => {
  const v = useContext(C);
  if (!v) throw new Error("useApp outside provider");
  return v;
};

const KEY = "cashtrap-ai.v1";
interface Persisted { uploads: Dataset[]; activeId: string; analysed: string[]; history: HistoryItem[] }

const read = (): Persisted | null => {
  try { const raw = localStorage.getItem(KEY); return raw ? (JSON.parse(raw) as Persisted) : null; } catch { return null; }
};
const write = (p: Persisted) => {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage unavailable or full: history is a convenience */ }
};

const period = (d: Dataset) => {
  const ys = d.records.map((r) => r.year);
  return ys.length ? `FY${Math.min(...ys)}–FY${Math.max(...ys)}` : "—";
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [datasets, setDatasets] = useState<Dataset[]>([GULFTECH]);
  const [activeId, setActiveId] = useState(GULFTECH.id);
  // Demo data is pre-analysed so the dashboard is immediately populated.
  const [results, setResults] = useState<Record<string, AnalysisResult | null>>({ [GULFTECH.id]: analyze(GULFTECH) });
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [status, setStatus] = useState<Status>("done");
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const hydrated = useRef(false);

  // Restore uploads + history from this browser after mount (avoids server/client mismatch).
  useEffect(() => {
    const saved = read();
    if (saved) {
      const uploads = saved.uploads.filter((d) => d.id !== GULFTECH.id);
      const res: Record<string, AnalysisResult | null> = { [GULFTECH.id]: analyze(GULFTECH) };
      for (const d of uploads) res[d.id] = saved.analysed.includes(d.id) ? analyze(d) : null;
      setDatasets([GULFTECH, ...uploads]);
      setResults(res);
      setHistory(saved.history ?? []);
      const id = [GULFTECH, ...uploads].some((d) => d.id === saved.activeId) ? saved.activeId : GULFTECH.id;
      setActiveId(id);
      setStatus(res[id] ? "done" : "idle");
    }
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    write({
      uploads: datasets.filter((d) => d.id !== GULFTECH.id),
      activeId,
      analysed: Object.entries(results).filter(([id, r]) => r && id !== GULFTECH.id).map(([id]) => id),
      history,
    });
  }, [datasets, activeId, results, history]);

  const active = datasets.find((d) => d.id === activeId) ?? datasets[0];

  const toast = useCallback((text: string, tone: Toast["tone"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);

  const setActive = useCallback((id: string) => {
    setActiveId(id);
    setError(null);
    setStatus(results[id] ? "done" : "idle");
  }, [results]);

  const addDataset = useCallback((d: Dataset) => {
    const uploadedAt = d.uploadedAt ?? new Date().toISOString();
    const ds = { ...d, uploadedAt };
    setDatasets((all) => [...all.filter((x) => x.id !== ds.id), ds]);
    setResults((r) => ({ ...r, [ds.id]: null }));
    setHistory((h) => [{ id: ds.id, name: ds.name, fileName: ds.fileName, fileSize: ds.fileSize, uploadedAt, rows: ds.records.length, period: period(ds), status: "active" as const }, ...h.filter((x) => x.id !== ds.id)]);
    setActiveId(ds.id);
    setStatus("idle");
    setError(null);
  }, []);

  const updateDataset = useCallback((d: Dataset) => {
    setDatasets((ds) => ds.map((x) => (x.id === d.id ? d : x)));
    setResults((r) => ({ ...r, [d.id]: d.id === GULFTECH.id ? analyze(d) : null }));
    setStatus(d.id === GULFTECH.id ? "done" : "idle");
  }, []);

  const deleteDataset = useCallback((id: string) => {
    if (id === GULFTECH.id) return; // the built-in demo can't be removed
    setDatasets((ds) => ds.filter((d) => d.id !== id));
    setResults((r) => { const { [id]: _drop, ...rest } = r; void _drop; return rest; });
    setHistory((h) => h.map((x) => (x.id === id ? { ...x, status: "deleted" as const, deletedAt: new Date().toISOString() } : x)));
    setActiveId((cur) => (cur === id ? GULFTECH.id : cur));
    setStatus((s) => (activeId === id ? "done" : s));
    setError(null);
  }, [activeId]);

  const removeHistory = useCallback((id: string) => setHistory((h) => h.filter((x) => x.id !== id)), []);
  const clearHistory = useCallback(() => setHistory((h) => h.filter((x) => x.status === "active")), []);

  const runAnalysis = useCallback(async () => {
    setStatus("processing");
    setError(null);
    try {
      await new Promise((r) => setTimeout(r, 1600)); // lets the processing state be perceived
      const res = await analyzeRemote(active);
      if (!res) throw new Error("At least two years of data are required to compute trends.");
      setResults((r) => ({ ...r, [active.id]: res }));
      setHistory((h) => h.map((x) => (x.id === active.id ? { ...x, analysedAt: new Date().toISOString() } : x)));
      setStatus("done");
      toast("Analysis complete", "pos");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
      setStatus("failed");
      toast("Analysis failed", "crit");
    }
  }, [active, toast]);

  const value = useMemo<Ctx>(
    () => ({ datasets, active, setActive, addDataset, updateDataset, deleteDataset, history, removeHistory, clearHistory, analysis: results[active.id] ?? null, status, error, runAnalysis, toasts, toast }),
    [datasets, active, setActive, addDataset, updateDataset, deleteDataset, history, removeHistory, clearHistory, results, status, error, runAnalysis, toasts, toast]
  );
  return <C.Provider value={value}>{children}</C.Provider>;
}
