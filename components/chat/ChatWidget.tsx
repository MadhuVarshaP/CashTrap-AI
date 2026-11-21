"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Send, Sparkles, X } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { buildContext } from "@/lib/chat/context";
import { localAnswer, suggestions } from "@/lib/chat/local";
import { useApp } from "@/lib/state/store";

interface Msg { role: "user" | "assistant"; content: string }

/** **bold** and line breaks only: answers are our own text, so no HTML is ever injected */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) => (part.startsWith("**") ? <strong key={j} className="font-semibold text-ink">{part.slice(2, -2)}</strong> : <Fragment key={j}>{part.replace(/\*([^*]+)\*/g, "$1")}</Fragment>))}
        </Fragment>
      ))}
    </>
  );
}

export function ChatWidget() {
  const { active, analysis } = useApp();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [llm, setLlm] = useState<boolean | null>(null); // null = unknown until first reply
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, busy, open]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content: q }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    let reply: string | null = null;
    if (llm !== false) {
      try {
        const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next, context: buildContext(active.name, analysis) }) });
        if (res.ok) { reply = ((await res.json()) as { reply: string }).reply; setLlm(true); }
        else if (res.status === 501) setLlm(false);
      } catch { /* offline or no route: fall back */ }
    }
    if (!reply) { await new Promise((r) => setTimeout(r, 450)); reply = localAnswer(q, active.name, analysis); }
    setMsgs((m) => [...m, { role: "assistant", content: reply! }]);
    setBusy(false);
  }

  return (
    <div className="print:hidden">
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.97 }} transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="fixed inset-x-3 bottom-[148px] z-[65] flex h-[min(560px,calc(100dvh-240px))] flex-col overflow-hidden rounded-2xl border border-line bg-elev shadow-2xl sm:inset-x-auto sm:right-6 sm:w-[390px] lg:bottom-24" role="dialog" aria-label="CashTrap assistant">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ai/15 text-ai"><Sparkles size={16} /></span>
                <div className="min-w-0">
                  <div className="font-display text-[14px] font-semibold">CashTrap Assistant</div>
                  <div className="truncate font-mono text-[10px] text-ink3">{analysis ? `Grounded in ${active.name}` : "No analysis yet"}{llm === true ? " · AI" : llm === false ? " · built-in" : ""}</div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close chat" className="grid h-8 w-8 place-items-center rounded-lg text-ink3 hover:bg-card hover:text-ink"><X size={16} /></button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {msgs.length === 0 && (
                <div>
                  <p className="text-[13px] leading-relaxed text-ink2">Ask about <span className="text-ink">{active.name}</span>: the risk score, red flags, working-capital days, cash conversion or how anything is calculated.</p>
                  <div className="mt-3 flex flex-wrap gap-2">{suggestions(analysis).map((s) => <button key={s} onClick={() => send(s)} className="rounded-full border border-line bg-card px-3 py-1.5 text-left text-[12px] text-ink2 hover:border-accent hover:text-ink">{s}</button>)}</div>
                </div>
              )}
              {msgs.map((m, i) => (
                <div key={i} className={clsx("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div className={clsx("max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed", m.role === "user" ? "rounded-br-md bg-accent text-white" : "rounded-bl-md border border-line bg-card text-ink2")}>{m.role === "user" ? m.content : <Rich text={m.content} />}</div>
                </div>
              ))}
              {busy && <div className="flex gap-1 pl-1" aria-label="Typing">{[0, 1, 2].map((i) => <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-ink3" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }} />)}</div>}
              <div ref={end} />
            </div>
            {msgs.length > 0 && (
              <div className="flex gap-2 overflow-x-auto border-t border-line px-3 py-2.5 [scrollbar-width:thin]" aria-label="Suggested questions">
                {suggestions(analysis).map((s) => <button key={s} onClick={() => send(s)} disabled={busy} className="shrink-0 whitespace-nowrap rounded-full border border-line bg-card px-3 py-1.5 text-[12px] text-ink2 hover:border-accent hover:text-ink disabled:opacity-50">{s}</button>)}
              </div>
            )}
            <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-center gap-2 border-t border-line p-3">
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about this company…" maxLength={400} className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-bg2 px-3 text-[13px] outline-none placeholder:text-ink3 focus:border-accent" />
              <button type="submit" disabled={!input.trim() || busy} aria-label="Send" className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-white disabled:opacity-40"><Send size={16} /></button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
      <button onClick={() => setOpen(!open)} aria-label={open ? "Close assistant" : "Open assistant"} aria-expanded={open}
        className="fixed bottom-[88px] right-4 z-[65] grid h-12 w-12 place-items-center rounded-full bg-accent text-white shadow-xl shadow-accent/30 transition-transform hover:scale-105 sm:right-6 lg:bottom-6">
        {open ? <X size={20} /> : <Bot size={22} />}
      </button>
    </div>
  );
}
