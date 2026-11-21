"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { AnalysisResult, Dataset } from "@/types/finance";
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

export function AppProvider({ children }: { children: ReactNode }) {
  const [datasets, setDatasets] = useState<Dataset[]>([GULFTECH]);
  const [activeId, setActiveId] = useState(GULFTECH.id);
  // Demo data is pre-analysed so the dashboard is immediately populated.
  const [results, setResults] = useState<Record<string, AnalysisResult | null>>({ [GULFTECH.id]: analyze(GULFTECH) });
  const [status, setStatus] = useState<Status>("done");
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

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
    setDatasets((ds) => [...ds.filter((x) => x.id !== d.id), d]);
    setResults((r) => ({ ...r, [d.id]: null }));
    setActiveId(d.id);
    setStatus("idle");
    setError(null);
  }, []);

  const updateDataset = useCallback((d: Dataset) => {
    setDatasets((ds) => ds.map((x) => (x.id === d.id ? d : x)));
    setResults((r) => ({ ...r, [d.id]: d.id === GULFTECH.id ? analyze(d) : null }));
    setStatus(d.id === GULFTECH.id ? "done" : "idle");
  }, []);

  const runAnalysis = useCallback(async () => {
    setStatus("processing");
    setError(null);
    try {
      await new Promise((r) => setTimeout(r, 1600)); // lets the processing state be perceived
      const res = await analyzeRemote(active);
      if (!res) throw new Error("At least two years of data are required to compute trends.");
      setResults((r) => ({ ...r, [active.id]: res }));
      setStatus("done");
      toast("Analysis complete", "pos");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
      setStatus("failed");
      toast("Analysis failed", "crit");
    }
  }, [active, toast]);

  const value = useMemo<Ctx>(
    () => ({ datasets, active, setActive, addDataset, updateDataset, analysis: results[active.id] ?? null, status, error, runAnalysis, toasts, toast }),
    [datasets, active, setActive, addDataset, updateDataset, results, status, error, runAnalysis, toasts, toast]
  );
  return <C.Provider value={value}>{children}</C.Provider>;
}
