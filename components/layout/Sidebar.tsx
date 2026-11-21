"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import { ChevronsLeft, ChevronsRight, HelpCircle } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LogoMark, Wordmark } from "./Logo";
import { NAV } from "./nav";

export function Sidebar() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <aside className={clsx("sticky top-0 z-30 hidden h-screen shrink-0 flex-col border-r border-line bg-bg2 py-5 transition-[width] duration-300 lg:flex print:hidden", open ? "w-[232px] px-4" : "w-[84px] items-center px-3")}>
      <Link href="/company-analysis" className={clsx("mb-8 flex items-center gap-3", !open && "justify-center")} aria-label="CashCop AI home">
        <LogoMark size={32} />
        {open && <Wordmark />}
      </Link>
      <nav className="flex w-full flex-1 flex-col gap-1.5" aria-label="Primary">
        {NAV.map((n) => {
          const active = path.startsWith(n.href);
          return (
            <Link key={n.href} href={n.href} title={n.label} className={clsx("group relative flex h-11 items-center gap-3 rounded-xl text-[13px] transition-colors", open ? "px-3" : "justify-center", active ? "text-ink" : "text-ink3 hover:bg-card hover:text-ink2")}>
              {active && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-xl border border-line bg-elev" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
              {active && <motion.span layoutId="nav-bar" className="absolute -left-3 top-2.5 h-6 w-[3px] rounded-r bg-accent" />}
              <n.icon size={19} className={clsx("relative", active && "text-accent")} />
              {open && <span className="relative truncate">{n.label}</span>}
            </Link>
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

export function MobileNav() {
  const path = usePathname();
  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-line bg-bg2/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden print:hidden">
      {NAV.map((n) => {
        const active = path.startsWith(n.href);
        return (
          <Link key={n.href} href={n.href} className={clsx("flex min-h-[56px] flex-col items-center justify-center gap-1 text-[9.5px]", active ? "text-accent" : "text-ink3")}>
            <n.icon size={19} />
            {n.short}
          </Link>
        );
      })}
    </nav>
  );
}
