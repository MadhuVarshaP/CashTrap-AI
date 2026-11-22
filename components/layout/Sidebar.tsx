"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import { ChevronDown, ChevronsLeft, ChevronsRight, HelpCircle } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoMark, Wordmark } from "./Logo";
import { GROUPS, groupFor } from "./nav";

export function Sidebar() {
  const path = usePathname();
  const [open, setOpen] = useState(true);
  const current = groupFor(path)?.id;
  const [openGroup, setOpenGroup] = useState<string | null>(current ?? "overview");
  useEffect(() => { if (current) setOpenGroup(current); }, [current]);
  return (
    <aside className={clsx("sticky top-0 z-30 hidden h-screen shrink-0 flex-col border-r border-line bg-bg2 py-5 transition-[width] duration-300 lg:flex print:hidden", open ? "w-[260px] px-4" : "w-[84px] items-center px-3")}>
      <Link href="/company-analysis" className={clsx("mb-8 flex items-center gap-3", !open && "justify-center")} aria-label="CashCop AI home">
        <LogoMark size={32} />
        {open && <Wordmark />}
      </Link>
      <nav className="flex w-full flex-1 flex-col gap-1.5 overflow-y-auto" aria-label="Primary">
        {GROUPS.map((g) => {
          const active = current === g.id;
          const expanded = open && openGroup === g.id;
          return (
            <div key={g.id}>
              <Link href={g.href} title={g.label} onClick={(e) => { if (open) { if (openGroup === g.id && active) e.preventDefault(); setOpenGroup(openGroup === g.id && active ? null : g.id); } }} aria-expanded={open ? expanded : undefined}
                className={clsx("group relative flex h-11 items-center gap-3 rounded-xl text-[13px] transition-colors", open ? "px-3" : "justify-center", active ? "text-ink" : "text-ink3 hover:bg-card hover:text-ink2")}>
                {active && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-xl border border-line bg-elev" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
                {active && <motion.span layoutId="nav-bar" className="absolute -left-3 top-2.5 h-6 w-[3px] rounded-r bg-accent" />}
                <g.icon size={19} className={clsx("relative shrink-0", active && "text-accent")} />
                {open && <span className="relative flex-1 truncate font-medium">{g.label}</span>}
                {open && <ChevronDown size={15} className={clsx("relative text-ink3 transition-transform", expanded && "rotate-180")} />}
              </Link>
              {expanded && (
                <ul className="mb-1 ml-[22px] mt-1 space-y-0.5 border-l border-line pl-3">
                  {g.items.map((it) => {
                    const on = path === it.href.split("#")[0] && !it.href.includes("#");
                    return (
                      <li key={it.label}>
                        <Link href={it.href} className={clsx("block rounded-lg px-2.5 py-1.5 text-[12.5px] transition-colors", on ? "bg-elev text-ink" : "text-ink3 hover:bg-card hover:text-ink2")}>{it.label}</Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>
      <div className="flex w-full flex-col gap-1.5">
        <Link href="/methodology" title="Help" className={clsx("flex h-11 items-center gap-3 rounded-xl text-[13px] text-ink3 hover:bg-card hover:text-ink2", open ? "px-3" : "justify-center")}>
          <HelpCircle size={19} />{open && "Help & methodology"}
        </Link>
        <button onClick={() => setOpen(!open)} aria-label={open ? "Collapse sidebar" : "Expand sidebar"} className={clsx("flex h-11 items-center gap-3 rounded-xl text-[13px] text-ink3 hover:bg-card hover:text-ink2", open ? "px-3" : "justify-center")}>
          {open ? <ChevronsLeft size={19} /> : <ChevronsRight size={19} />}{open && "Collapse"}
        </button>
      </div>
    </aside>
  );
}

/** tabs for the modules inside the current category: the same navigation on every screen size */
export function SubNav() {
  const path = usePathname();
  const g = groupFor(path);
  if (!g || g.tabs.length < 2) return null;
  return (
    <div role="tablist" aria-label={g.label} className="print:hidden -mx-4 mb-6 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <span className="mr-1 hidden shrink-0 items-center font-mono text-[10px] uppercase tracking-wider text-ink3 sm:flex">{g.label}</span>
      {g.tabs.map((t) => {
        const on = path === t.href;
        return <Link key={t.href} href={t.href} role="tab" aria-selected={on} className={clsx("tap shrink-0 rounded-xl border px-4 py-2 text-[12.5px]", on ? "border-accent/50 bg-accent/10 text-ink" : "border-line bg-card text-ink2 hover:text-ink")}>{t.label}</Link>;
      })}
    </div>
  );
}

export function MobileNav() {
  const path = usePathname();
  const current = groupFor(path)?.id;
  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-line bg-bg2/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden print:hidden">
      {GROUPS.map((g) => {
        const active = current === g.id;
        return (
          <Link key={g.id} href={g.href} className={clsx("flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 text-center text-[9.5px] leading-tight", active ? "text-accent" : "text-ink3")}>
            <g.icon size={19} />
            {g.label.replace("Investment ", "Inv. ")}
          </Link>
        );
      })}
    </nav>
  );
}
