"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useApp } from "@/lib/state/store";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { Header } from "./Header";
import { MobileNav, Sidebar, SubNav } from "./Sidebar";

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { notices, popups, dismissPopup } = useApp();
  const tone = { pos: "border-pos/40 text-pos", warn: "border-warn/40 text-warn", crit: "border-crit/50 text-crit", info: "border-line text-ink2" };
  const bar = { pos: "bg-pos", warn: "bg-warn", crit: "bg-crit", info: "bg-accent" };
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <motion.main key={path} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }} className="mx-auto w-full max-w-[1440px] flex-1 px-4 pb-28 pt-6 sm:px-8 sm:pt-8 lg:pb-12 print:max-w-none print:p-0">
          <SubNav />
          {children}
        </motion.main>
      </div>
      <MobileNav />
      <ChatWidget />
      <div className="pointer-events-none fixed inset-x-4 top-[76px] z-[70] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6 sm:top-[84px] print:hidden" aria-live="polite" role="status">
        <AnimatePresence>
          {popups.map((id) => notices.find((n) => n.id === id)).filter((n) => !!n).map((n) => (
            <motion.div key={n!.id} layout initial={{ opacity: 0, x: 40, scale: 0.97 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 40 }} transition={{ type: "spring", stiffness: 380, damping: 32 }} className={`pointer-events-auto relative w-full overflow-hidden rounded-xl border bg-elev shadow-2xl sm:w-[340px] ${tone[n!.tone]}`}>
              <button onClick={() => { if (n!.href) router.push(n!.href); dismissPopup(n!.id); }} className="block w-full px-4 py-3 pr-10 text-left">
                <span className="block text-[13px] font-medium text-ink">{n!.title}</span>
                {n!.body && <span className="mt-0.5 block text-[12px] leading-snug text-ink2">{n!.body}</span>}
              </button>
              <button onClick={() => dismissPopup(n!.id)} aria-label="Dismiss" className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-md text-ink3 hover:bg-card hover:text-ink"><X size={14} /></button>
              <motion.span className={`absolute bottom-0 left-0 h-0.5 ${bar[n!.tone]}`} initial={{ width: "100%" }} animate={{ width: 0 }} transition={{ duration: 6, ease: "linear" }} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
