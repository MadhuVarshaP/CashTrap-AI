import { NextResponse } from "next/server";

/**
 * Optional LLM-backed answers. Set ANTHROPIC_API_KEY (server-side only) to enable;
 * without it this returns 501 and the browser falls back to the built-in answers.
 */
export const runtime = "nodejs";

const SYSTEM = `You are CashTrap AI's assistant, helping a private-equity analyst read a company's cash-conversion and working-capital risk.
Answer only from the company context supplied. Quote its numbers exactly. If something isn't in the context, say so instead of guessing.
Be concise (under 150 words), plain language, no investment advice. Use **bold** sparingly and short bullet lines starting with "•".`;

interface Msg { role: "user" | "assistant"; content: string }

export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: "LLM not configured" }, { status: 501 });

  let body: { messages?: Msg[]; context?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  const messages = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 1500) }));
  if (!messages.length || messages[messages.length - 1].role !== "user") return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
      max_tokens: 500,
      system: `${SYSTEM}\n\nCompany context:\n${String(body.context ?? "").slice(0, 4000)}`,
      messages,
    }),
  }).catch(() => null);
  if (!res || !res.ok) return NextResponse.json({ error: "Upstream error" }, { status: 502 });
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const reply = data.content?.filter((c) => c.type === "text").map((c) => c.text).join("").trim();
  return reply ? NextResponse.json({ reply }) : NextResponse.json({ error: "Empty reply" }, { status: 502 });
}
