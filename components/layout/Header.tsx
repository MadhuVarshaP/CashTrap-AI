"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, BellRing, Building2, ChevronDown, Search, Trash2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/state/store";
import { Pill } from "@/components/shared/ui";
import { LogoMark } from "./Logo";
import { NAV } from "./nav";

function useOutside(fn: () => void) {
  const r = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => r.current && !r.current.contains(e.target as Node) && fn();
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  });
  return r;
}

export function Header() {
  const path = usePathname();
  const router = useRouter();
  const { datasets, active, hasCompany, setActive, deleteDataset, analysis, toast, notices, markAllRead, clearNotices, desktop, enableDesktop } = useApp();
  const [confirm, setConfirm] = useState<string | null>(null);
  const [sel, setSel] = useState(false);
  const [cmd, setCmd] = useState(false);
  const [bell, setBell] = useState(false);
  const selRef = useOutside(() => setSel(false));
  const bellRef = useOutside(() => setBell(false));
  const page = NAV.find((n) => path.startsWith(n.href));

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCmd((c) => !c); }
      if (e.key === "Escape") setCmd(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const unread = notices.filter((n) => !n.read).length;
  const dot = { pos: "bg-pos", warn: "bg-warn", crit: "bg-crit", info: "bg-accent" };
  const ago = (iso: string) => { const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000); return m < 1 ? "now" : m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`; };

  return (
    <>
      <header className="sticky top-0 z-30 flex h-[64px] items-center justify-between gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur sm:h-[72px] sm:px-8 print:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <span className="lg:hidden"><LogoMark size={26} /></span>
          <div className="min-w-0">
            <div className="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-ink3 sm:block">CashCop AI /</div>
            <div className="truncate font-display text-[15px] font-semibold sm:text-[17px]">{page?.label ?? "CashCop AI"}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {/* {active.synthetic && <Pill tone="warn" className="hidden md:inline-flex">● Demo data · synthetic</Pill>} */}
          <div ref={selRef} className="relative">
            <button onClick={() => setSel(!sel)} className="flex h-10 items-center gap-2 rounded-xl border border-line bg-card px-3 text-[12.5px] hover:border-[#3f4551]" aria-haspopup="listbox" aria-expanded={sel}>
              <Building2 size={15} className="text-ink3" />
              <span className={clsx("hidden max-w-[150px] truncate sm:inline", !hasCompany && "text-ink3")}>{hasCompany ? active.name : "No company"}</span>
              <ChevronDown size={14} className="text-ink3" />
            </button>
            <AnimatePresence>
              {sel && (
                <motion.ul initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="absolute right-0 top-12 z-50 w-72 rounded-2xl border border-line bg-elev p-1.5 shadow-2xl" role="listbox">
                  {datasets.length === 0 && <li className="px-3 py-2.5 text-[12.5px] text-ink3">No company yet. Upload financial statements to begin.</li>}
                  {datasets.map((d) => (
                    <li key={d.id}>
                      {confirm === d.id ? (
                        <div className="rounded-xl bg-crit/10 p-3 text-[12.5px]">
                          <p className="mb-2 text-ink">Delete <span className="font-medium">{d.name}</span>? Its data is removed from this browser. A record stays in upload history.</p>
                          <div className="flex gap-2">
                            <button onClick={() => { deleteDataset(d.id); setConfirm(null); setSel(false); toast(`Deleted ${d.name}`, "warn"); }} className="min-h-[36px] flex-1 rounded-lg bg-crit px-3 font-medium text-white">Delete</button>
                            <button onClick={() => setConfirm(null)} className="min-h-[36px] flex-1 rounded-lg border border-line px-3 text-ink2 hover:bg-card">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className={clsx("flex items-center gap-1 rounded-xl hover:bg-card", d.id === active.id && "bg-card")}>
                          <button onClick={() => { setActive(d.id); setSel(false); toast(`Switched to ${d.name}`); }} className={clsx("flex min-w-0 flex-1 items-center rounded-xl px-3 py-2.5 text-left text-[13px]", d.id === active.id ? "text-ink" : "text-ink2")}>
                            <span className="min-w-0 truncate">{d.name}</span>
                          </button>
                          {(
                            <button onClick={() => setConfirm(d.id)} aria-label={`Delete ${d.name}`} title="Delete this company" className="mr-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink3 hover:bg-crit/10 hover:text-crit"><Trash2 size={15} /></button>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                  <li><button onClick={() => { router.push("/company-analysis"); setSel(false); }} className="w-full rounded-xl px-3 py-2.5 text-left text-[12.5px] text-accent hover:bg-card">+ Upload a company…</button></li>
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
          <button onClick={() => setCmd(true)} className="hidden h-10 items-center gap-2 rounded-xl border border-line bg-card px-3 text-[12.5px] text-ink3 hover:border-[#3f4551] md:flex" aria-label="Search">
            <Search size={15} /> Search <kbd className="rounded border border-line px-1.5 font-mono text-[10px]">⌘K</kbd>
          </button>
          <button onClick={() => setCmd(true)} className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-card text-ink2 md:hidden" aria-label="Search"><Search size={16} /></button>
          <div ref={bellRef} className="relative">
            <button onClick={() => { setBell(!bell); if (!bell) setTimeout(markAllRead, 1200); }} className="relative grid h-10 w-10 place-items-center rounded-xl border border-line bg-card text-ink2 hover:border-[#3f4551]" aria-label="Notifications">
              <Bell size={16} />
              {unread > 0 && <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-crit px-1 font-mono text-[10px] font-semibold text-white">{unread > 9 ? "9+" : unread}</span>}
            </button>
            <AnimatePresence>
              {bell && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute right-0 top-12 z-50 w-[min(340px,calc(100vw-2rem))] rounded-2xl border border-line bg-elev p-2 shadow-2xl">
                  <div className="mb-1 flex items-center justify-between px-2 pt-1">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-ink3">Notifications</span>
                    {notices.length > 0 && <button onClick={clearNotices} className="text-[11px] text-ink3 hover:text-ink">Clear all</button>}
                  </div>
                  <div className="max-h-[360px] overflow-y-auto">
                    {notices.length === 0 && <p className="px-2 py-4 text-[13px] text-ink2">Nothing yet. Upload a file or run an analysis and updates appear here as they happen.</p>}
                    {notices.map((n) => (
                      <button key={n.id} onClick={() => { if (n.href) router.push(n.href); setBell(false); }} className="flex w-full gap-2.5 rounded-lg px-2 py-2.5 text-left hover:bg-card">
                        <span className={clsx("mt-1.5 h-2 w-2 shrink-0 rounded-full", dot[n.tone])} />
                        <span className="min-w-0 flex-1"><span className="block truncate text-[12.5px] text-ink">{n.title}</span>{n.body && <span className="block text-[11.5px] leading-snug text-ink2">{n.body}</span>}</span>
                        <span className="shrink-0 font-mono text-[10px] text-ink3">{ago(n.at)}</span>
                      </button>
                    ))}
                  </div>
                  {desktop === "default" && <button onClick={enableDesktop} className="mt-1 flex w-full items-center gap-2 rounded-lg border border-line px-3 py-2 text-left text-[12px] text-ink2 hover:bg-card"><BellRing size={14} className="text-accent" /> Also alert me on my desktop when this tab is in the background</button>}
                  {desktop === "denied" && <p className="px-2 pt-1 text-[11px] text-ink3">Desktop alerts are blocked in your browser settings.</p>}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {/* <div className="hidden h-10 w-10 place-items-center rounded-xl bg-elev font-display text-[13px] font-semibold text-ink2 sm:grid" aria-label="Profile">MV</div> */}
        </div>
      </header>
      {active.synthetic && <div className="border-b border-warn/20 bg-warn/5 px-4 py-1.5 text-center font-mono text-[10px] uppercase tracking-wider text-warn md:hidden print:hidden">Demo data · all figures synthetic</div>}
      <AnimatePresence>
        {cmd && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] grid place-items-start bg-black/60 p-4 pt-24 backdrop-blur-sm print:hidden" onClick={() => setCmd(false)}>
            <CommandPalette onDone={() => setCmd(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function CommandPalette({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const items = NAV.filter((n) => n.label.toLowerCase().includes(q.toLowerCase()));
  return (
    <motion.div initial={{ y: -10, scale: 0.98 }} animate={{ y: 0, scale: 1 }} onClick={(e) => e.stopPropagation()} className="mx-auto w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-elev shadow-2xl">
      <div className="flex items-center gap-3 border-b border-line px-4"><Search size={16} className="text-ink3" /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && items[0]) { router.push(items[0].href); onDone(); } }} placeholder="Jump to a page…" className="h-14 w-full bg-transparent text-[14px] outline-none placeholder:text-ink3" /></div>
      <ul className="p-2">
        {items.map((n) => (
          <li key={n.href}><button onClick={() => { router.push(n.href); onDone(); }} className={clsx("flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[13.5px] hover:bg-card")}><n.icon size={16} className="text-ink3" />{n.label}</button></li>
        ))}
        {items.length === 0 && <li className="px-3 py-4 text-[13px] text-ink3">No matches.</li>}
      </ul>
    </motion.div>
  );
}
