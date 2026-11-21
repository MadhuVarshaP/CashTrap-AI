"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AnalysisResult, Dataset, HistoryItem } from "@/types/finance";
import { GULFTECH } from "@/lib/demo-data/gulftech";
import { analyze } from "@/lib/calculations/analyze";
import { analyzeRemote } from "@/lib/api/client";

export type Status = "idle" | "processing" | "done" | "failed";

export type Tone = "pos" | "warn" | "crit" | "info";
export interface Notice { id: string; tone: Tone; title: string; body?: string; at: string; read: boolean; href?: string }
export type NoticeInput = Pick<Notice, "title"> & Partial<Pick<Notice, "tone" | "body" | "href">>;

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
  /** persistent feed behind the bell */
  notices: Notice[];
  /** ids currently shown as popups */
  popups: string[];
  notify: (n: NoticeInput) => void;
  toast: (text: string, tone?: Tone) => void;
  dismissPopup: (id: string) => void;
  markAllRead: () => void;
  clearNotices: () => void;
  desktop: "unsupported" | "default" | "granted" | "denied";
  enableDesktop: () => Promise<void>;
}

const C = createContext<Ctx | null>(null);
export const useApp = () => {
  const v = useContext(C);
  if (!v) throw new Error("useApp outside provider");
  return v;
};

const KEY = "cashtrap-ai.v1";
interface Persisted { uploads: Dataset[]; activeId: string; analysed: string[]; history: HistoryItem[]; notices?: Notice[] }

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
  const [notices, setNotices] = useState<Notice[]>([]);
  const [popups, setPopups] = useState<string[]>([]);
  const [desktop, setDesktop] = useState<Ctx["desktop"]>("unsupported");
  // state, not a ref: the save effect must wait for the restored data to be applied, or it overwrites storage with the empty defaults
  const [hydrated, setHydrated] = useState(false);

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
      setNotices(saved.notices ?? []);
      const id = [GULFTECH, ...uploads].some((d) => d.id === saved.activeId) ? saved.activeId : GULFTECH.id;
      setActiveId(id);
      setStatus(res[id] ? "done" : "idle");
    }
    if (typeof Notification !== "undefined") setDesktop(Notification.permission);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    write({
      uploads: datasets.filter((d) => d.id !== GULFTECH.id),
      activeId,
      analysed: Object.entries(results).filter(([id, r]) => r && id !== GULFTECH.id).map(([id]) => id),
      history,
      notices: notices.slice(0, 40),
    });
  }, [hydrated, datasets, activeId, results, history, notices]);

  const active = datasets.find((d) => d.id === activeId) ?? datasets[0];

  const dismissPopup = useCallback((id: string) => setPopups((p) => p.filter((x) => x !== id)), []);

  /** adds to the bell feed, pops up immediately, and (if allowed and the tab is hidden) raises a desktop notification */
  const notify = useCallback((n: NoticeInput) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const notice: Notice = { id, tone: n.tone ?? "info", title: n.title, body: n.body, href: n.href, at: new Date().toISOString(), read: false };
    setNotices((all) => [notice, ...all].slice(0, 40));
    setPopups((p) => [...p, id].slice(-4));
    setTimeout(() => setPopups((p) => p.filter((x) => x !== id)), 6000);
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) new Notification(`CashTrap AI · ${n.title}`, { body: n.body, tag: id });
    } catch { /* desktop notifications are optional */ }
  }, []);
  const toast = useCallback((text: string, tone: Tone = "info") => notify({ title: text, tone }), [notify]);
  const markAllRead = useCallback(() => setNotices((all) => all.map((n) => ({ ...n, read: true }))), []);
  const clearNotices = useCallback(() => { setNotices([]); setPopups([]); }, []);
  const enableDesktop = useCallback(async () => {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setDesktop(p);
    if (p === "granted") notify({ title: "Desktop notifications on", body: "You'll be alerted here even when this tab is in the background.", tone: "pos" });
  }, [notify]);

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
      const sc = res.risk.score;
      notify({ title: `Analysis complete · ${active.name}`, body: sc == null ? "Not enough data to score. Check the missing fields." : `Risk score ${Math.round(sc)}/100 — ${res.risk.classification}`, tone: sc == null ? "warn" : sc >= 75 ? "crit" : sc >= 50 ? "warn" : "pos", href: "/investment-assessment" });
      res.alerts.filter((a) => a.severity === "Critical" || a.severity === "High").slice(0, 3).forEach((a, i) => setTimeout(() => notify({ title: `${a.severity} signal · ${a.name}`, body: a.evidence, tone: a.severity === "Critical" ? "crit" : "warn", href: "/investment-assessment" }), 500 * (i + 1)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
      setStatus("failed");
      toast("Analysis failed", "crit");
    }
  }, [active, toast, notify]);

  const value = useMemo<Ctx>(
    () => ({ datasets, active, setActive, addDataset, updateDataset, deleteDataset, history, removeHistory, clearHistory, analysis: results[active.id] ?? null, status, error, runAnalysis, notices, popups, notify, toast, dismissPopup, markAllRead, clearNotices, desktop, enableDesktop }),
    [datasets, active, setActive, addDataset, updateDataset, deleteDataset, history, removeHistory, clearHistory, results, status, error, runAnalysis, notices, popups, notify, toast, dismissPopup, markAllRead, clearNotices, desktop, enableDesktop]
  );
  return <C.Provider value={value}>{children}</C.Provider>;
}
