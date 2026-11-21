"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useApp } from "@/lib/state/store";
import { Header } from "./Header";
import { MobileNav, Sidebar } from "./Sidebar";

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { toasts } = useApp();
  const tone = { pos: "border-pos/40 text-pos", warn: "border-warn/40 text-warn", crit: "border-crit/40 text-crit", info: "border-line text-ink" };
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <motion.main key={path} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }} className="mx-auto w-full max-w-[1440px] flex-1 px-4 pb-28 pt-6 sm:px-8 sm:pt-8 lg:pb-12 print:max-w-none print:p-0">
          {children}
        </motion.main>
      </div>
      <MobileNav />
      <div className="pointer-events-none fixed bottom-24 right-4 z-[70] flex flex-col gap-2 lg:bottom-6 print:hidden" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div key={t.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className={`rounded-xl border bg-elev px-4 py-2.5 text-[13px] shadow-xl ${tone[t.tone]}`}>{t.text}</motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
