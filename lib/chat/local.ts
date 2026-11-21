import type { AnalysisResult } from "@/types/finance";
import { cashRelease } from "@/lib/calculations/metrics";
import { allIndicators } from "@/lib/calculations/pe-risk";
import { fmtDays, fmtM, fmtPct, fmtX, growth } from "@/lib/utilities/format";

export const suggestions = (a: AnalysisResult | null) => [
  "Is this investment worth it?",
  `Why is the risk score ${a?.risk.score != null ? Math.round(a.risk.score) : "what it is"}?`,
  "Which signals are the same?",
  "Is the DSO increase a concern?",
  "Is the DIO increase a concern?",
  "What does the cash conversion cycle mean?",
  "How much cash could be released?",
  "How would that change leverage?",
  "What should we ask management?",
  "What information is missing?",
];

const has = (q: string, ...w: string[]) => w.some((x) => q.includes(x));
const sev = { Critical: "🔴", High: "🟠", Medium: "🟡", Low: "🟢" } as const;


const pct = (g: number | null) => (g == null ? "n/a" : `${g >= 0 ? "+" : ""}${(g * 100).toFixed(1)}%`);
const NEED = "Needs a completed analysis. Open **Company Analysis**, pick data and press **Run analysis**.";
const SCEN = [{ name: "Conservative", cut: 8 }, { name: "Base", cut: 15 }, { name: "Optimistic", cut: 25 }];
/** which risk indicator (and so which weight) each signal belongs to */
const SIGNAL_INDICATOR: Record<string, string> = { "rec-vs-rev": "revq", "dso-up": "dso", "inv-vs-rev": "dio", "dio-up": "dio", "ebitda-ocf": "ocf", "ccc-up": "owc", leverage: "lev" };
const SIGNALS = [
  { id: "rec-vs-rev", name: "Receivables growing faster than revenue", group: "Receivables" }, { id: "dso-up", name: "DSO is increasing", group: "Receivables" },
  { id: "inv-vs-rev", name: "Inventory growing faster than revenue", group: "Inventory" }, { id: "dio-up", name: "DIO is increasing", group: "Inventory" },
  { id: "ebitda-ocf", name: "EBITDA rising while operating cash flow declines", group: "Profit-to-cash" }, { id: "ccc-up", name: "Cash conversion cycle is lengthening", group: "Profit-to-cash" }, { id: "leverage", name: "High net debt relative to EBITDA", group: "Profit-to-cash" },
];

/** the ten suggested questions, each answered from the engine's own numbers; null = not a chip question */
function chipAnswer(q: string, name: string, a: AnalysisResult | null): string | null {
  const w = (re: RegExp) => re.test(q);
  const isChip = w(/worth it|should we invest|good investment/) || w(/why is the (risk )?score/) || w(/signals are the same|same signals/) || w(/(dso|dio).*(concern|increase)/) || w(/cash conversion (cycle|ccc)|what does the (ccc|cash conversion)/) || w(/(how much )?cash.*released?/) || w(/change leverage|affect leverage/) || w(/ask (the )?management|management question/) || w(/information.*missing|missing information|what.*missing/);
  if (!isChip) return null;
  if (!a) return NEED;
  const { risk: rk, latest: L, previous: P, latestRecord: c, previousRecord: pr } = a;
  const rg = growth(c.revenue, pr?.revenue ?? null);
  const sc = rk.score == null ? "insufficient data" : `${Math.round(rk.score)}/100 (${rk.classification})`;
  const INDS = allIndicators(rk);
  const weightOf = (alertId: string) => INDS.find((k) => k.id === SIGNAL_INDICATOR[alertId])?.max ?? 0;
  const ranked = INDS.filter((x) => x.points != null).sort((x, y) => (y.points ?? 0) - (x.points ?? 0) || (y.points! / y.max) - (x.points! / x.max));

  if (w(/worth it|should we invest|good investment/)) {
    const verify = [...a.alerts].sort((x, y) => weightOf(y.id) - weightOf(x.id)).flatMap((x) => x.investigate).filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 3);
    return `I can't tell you whether ${name} is worth it. This tool screens cash-conversion risk and is **not a verdict**; price, strategy, growth and management are outside it.\n\n**Score:** ${sc}.\n**Top three drivers:**\n` + ranked.slice(0, 3).map((x) => `• **${x.name}** ${x.points}/${x.max} (${x.level})`).join("\n") + `\n\n**Verify first:**\n` + (verify.length ? verify.map((v) => `• ${v}`).join("\n") : "• No signals fired: confirm the data with a quality-of-earnings review.");
  }
  if (w(/why is the (risk )?score/)) {
    return `**${name}: ${sc}.** Points earned against each indicator's maximum:\n` + rk.categories.map((p) => `**${p.name}** (${p.weight} pts weight): ${p.points == null ? "not assessed" : `${p.points}/${p.max}`}\n` + p.indicators.map((x) => `   • ${x.name}: ${x.points == null ? "not assessed" : `${x.points}/${x.max}`}`).join("\n")).join("\n") + `\n\nTotal ${rk.rawPoints}/${rk.maxEvaluated} assessable points${rk.maxEvaluated < 100 ? ` (${rk.coverage}% of the model had data)` : ""}. Bands: 0–24 Low, 25–49 Moderate, 50–74 High, 75–100 Critical.`;
  }
  if (w(/signals are the same|same signals/)) {
    const on = new Set(a.alerts.map((x) => x.id));
    const line = (g: string) => SIGNALS.filter((x) => x.group === g).map((x) => `${on.has(x.id) ? "🔴" : "⚪"} ${x.name}`).join("\n");
    return `Several of the seven signals are the same problem seen through different measures, so they shouldn't be counted as independent evidence. 🔴 = triggered for ${name}, ⚪ = not triggered.\n\n**Receivables**\n${line("Receivables")}\n\n**Inventory**\n${line("Inventory")}\n\n**Profit-to-cash**\n${line("Profit-to-cash")}\n\n${a.alerts.length} of 7 triggered.`;
  }
  if (w(/dso/)) {
    const rec = growth(c.receivables, pr?.receivables ?? null), d = L.dso != null && P?.dso != null ? L.dso - P.dso : null;
    const verdict = d == null ? "Can't judge: DSO is missing for one of the years." : rec != null && rg != null && rec > rg ? "**Yes, worth a look**: receivables are growing faster than revenue, so collections are slowing." : "Less concerning: receivables are not outpacing revenue.";
    return `DSO went ${fmtDays(P?.dso ?? null)} → ${fmtDays(L.dso)}${d != null ? ` (${d >= 0 ? "+" : ""}${d.toFixed(1)} days)` : ""}.\nRevenue ${pct(rg)} vs receivables ${pct(rec)}.\n${verdict}\n\n**Ageing data to request:** receivables ageing by customer (30/60/90+ days), top-10 customer balances, credit-term changes, cash received after year-end, disputed or credit-noted invoices.`;
  }
  if (w(/dio/)) {
    const inv = growth(c.inventory, pr?.inventory ?? null), d = L.dio != null && P?.dio != null ? L.dio - P.dio : null;
    const verdict = d == null ? "Can't judge: DIO is missing for one of the years (some businesses carry no inventory)." : inv != null && rg != null && inv > rg ? "**Yes, worth a look**: stock is growing faster than revenue, so it is turning more slowly." : "Less concerning: inventory is not outpacing revenue.";
    return `DIO went ${fmtDays(P?.dio ?? null)} → ${fmtDays(L.dio)}${d != null ? ` (${d >= 0 ? "+" : ""}${d.toFixed(1)} days)` : ""}.\nRevenue ${pct(rg)} vs inventory ${pct(inv)}.\n${verdict}\n\n**Ageing data to request:** inventory ageing by product line, provisions and write-down history, sell-through rates, open purchase commitments.`;
  }
  if (w(/cash conversion|ccc/)) {
    const d = (x: number | null, y: number | null | undefined) => (x != null && y != null ? ` (${x - y >= 0 ? "+" : ""}${(x - y).toFixed(1)} d)` : "");
    return `**CCC = DSO + DIO − DPO** — the days cash is tied up between paying suppliers and collecting from customers.\n\nFY${L.year}: ${fmtDays(L.dso)} + ${fmtDays(L.dio)} − ${fmtDays(L.dpo)} = **${fmtDays(L.ccc)}**${L.ccc == null ? ". DPO or another input is missing, so CCC can't be computed" : ""}.\nChange vs FY${P?.year ?? "—"} (${fmtDays(P?.ccc ?? null)}): ${L.ccc != null && P?.ccc != null ? `${L.ccc - P.ccc >= 0 ? "+" : ""}${(L.ccc - P.ccc).toFixed(1)} days` : "n/a"}.\nComponents: DSO${d(L.dso, P?.dso)}, DIO${d(L.dio, P?.dio)}, DPO${d(L.dpo, P?.dpo)}.`;
  }
  if (w(/cash.*released?/)) {
    const base = c.creditSales ?? c.revenue;
    if (L.dso == null || base == null) return "I can't size the release because DSO or sales is missing for the latest year.";
    return `Cutting DSO from ${fmtDays(L.dso)} releases cash = (sales ÷ 365) × days saved, on ${c.creditSales != null ? "credit sales" : "revenue"} of ${fmtM(base)}:\n` + SCEN.map((x) => `• **${x.name}** (−${x.cut} days → ${fmtDays(Math.max(0, L.dso! - x.cut))}): **${fmtM(cashRelease(base, L.dso!, Math.max(0, L.dso! - x.cut)))}**`).join("\n") + `\n\n**Caveat:** this is a one-off release, not recurring cash flow, and it assumes revenue stays constant. It is illustrative, not guaranteed: it depends on customer terms and credit quality.`;
  }
  if (w(/leverage/)) {
    const base = c.creditSales ?? c.revenue;
    if (L.dso == null || base == null || L.netDebt == null || c.ebitda == null || c.ebitda <= 0) return "I can't compute the leverage effect: it needs DSO, sales, net debt and positive EBITDA for the latest year.";
    return `Now: net debt ${fmtM(L.netDebt)}, EBITDA ${fmtM(c.ebitda)} → **${fmtX(L.netDebtToEbitda)}**.\n\nNew net debt / EBITDA if the release repays debt:\n` + SCEN.map((x) => { const r = cashRelease(base, L.dso!, Math.max(0, L.dso! - x.cut)); return `• **${x.name}:** (${fmtM(L.netDebt)} − ${fmtM(r)}) ÷ ${fmtM(c.ebitda)} = **${fmtX((L.netDebt! - r) / c.ebitda!)}**`; }).join("\n") + `\n\n**Assumption:** the whole one-off release is used to repay debt, with EBITDA and everything else unchanged.`;
  }
  if (w(/management/)) {
    const wt = weightOf;
    const items = [...a.alerts].sort((x, y) => wt(y.id) - wt(x.id)).flatMap((x) => x.investigate.map((i) => ({ i, id: x.id }))).filter((v, k, arr) => arr.findIndex((o) => o.i === v.i) === k).slice(0, 3);
    if (!items.length) return "No signals fired, so there are no targeted questions. Ask for a standard working-capital and quality-of-earnings walk-through.";
    return "First three questions, ranked by the weight of the indicator behind them:\n" + items.map((x, n) => `${n + 1}. **Please provide / explain: ${x.i}** (${INDS.find((k) => k.id === SIGNAL_INDICATOR[x.id])?.name}, ${wt(x.id)} pts)`).join("\n") + "\n\nThe full list is in section 9 of the **Due Diligence Report**.";
  }
  // missing information
  return `**Data gaps:** ${a.missingFields.length ? a.missingFields.slice(0, 12).join(", ") + (a.missingFields.length > 12 ? ` and ${a.missingFields.length - 12} more` : "") : "none in the supplied fields"}. Dependent indicators are marked unavailable, never zero${rk.evaluated < rk.total ? ` (${rk.total - rk.evaluated} of ${rk.total} indicators couldn't be scored)` : ""}.\n\n**Limits of annual, year-end figures:**\n• ${a.records.length} annual periods; no quarterly or seasonal data.\n• Year-end balances can hide intra-year swings.\n• ${a.metrics.some((x) => x.approximate) ? "The earliest year uses closing balances only (approximate)." : "Average balances were used throughout."}\n• ${c.creditSales == null ? "Credit sales/purchases weren't supplied, so revenue and COGS are proxies." : "Credit sales/purchases were supplied and used."}`;
}

/**
 * Rule-based answers grounded in the active analysis. No network, no key:
 * every number comes from the calculation engine, so it matches the dashboard.
 */
export function localAnswer(question: string, name: string, a: AnalysisResult | null): string {
  const q = question.toLowerCase();
  const chipped = chipAnswer(q, name, a);
  if (chipped) return chipped;

  if (has(q, "upload", "file", "import", "csv", "xlsx", "excel", "format"))
    return "Go to **Company Analysis** and drop a file in the upload box. Accepted: a flat table (Year, Revenue, COGS, EBITDA, Receivables, Inventory, Payables, Operating_Cash_Flow, Cash, Debt), a workbook with *Income Statement* + *Balance Sheet* sheets, or an **S&P Capital IQ Financial Highlights** export. Max 5 MB, at least two years. Then press **Run analysis**.";
  if (has(q, "weight", "split", "100 pt", "points"))
    return "The 100 points sit across five pillars: **Quality of Earnings 25**, **Cash Flow Sustainability 25**, **Working Capital 20**, **Debt and Repayment 20**, **Liquidity and Stress 10**. Each pillar splits into indicators (18 in total) with their own maximums, e.g. EBITDA-to-cash conversion 10, receivables 7, net debt/EBITDA 7. An indicator without data is **not assessed** (never zero) and the score is points earned ÷ points assessable. Detail is in the *Indicator register* tab and docs/CALCULATIONS.md.";
  if (has(q, "dso", "dio", "dpo", "ccc", "days", "cycle", "working capital")) {
    const base = "**DSO** = avg receivables ÷ credit sales × 365 (how long customers take to pay). **DIO** = avg inventory ÷ COGS × 365 (how long stock sits). **DPO** = avg payables ÷ COGS × 365 (how long you take to pay suppliers). **CCC** = DSO + DIO − DPO: the days cash is tied up.";
    return a ? `${base}\n\nFor **${name}** (FY${a.latest.year}): DSO ${fmtDays(a.latest.dso)}, DIO ${fmtDays(a.latest.dio)}, DPO ${fmtDays(a.latest.dpo)}, CCC ${fmtDays(a.latest.ccc)}.` : base;
  }
  if (!a) return `I can answer questions about the active company, **${name}**, once it has been analysed. Open **Company Analysis**, upload or pick data, and press **Run analysis**. I can also explain the methodology or the upload formats.`;

  const L = a.latest, P = a.previous, rk = a.risk;

  if (has(q, "release", "unlock", "free up", "cash trapped", "target dso", "calculator")) {
    const base = a.latestRecord.creditSales ?? a.latestRecord.revenue;
    if (L.dso == null || base == null) return "I can't size the release because DSO or sales is missing for the latest year.";
    const rel = cashRelease(base, L.dso, Math.max(0, L.dso - 15));
    return `Cutting DSO by 15 days (${fmtDays(L.dso)} → ${fmtDays(L.dso - 15)}) would release about **${fmtM(rel)}** of cash: (sales ÷ 365) × days saved. Try other targets in **Cash Impact Calculator**.`;
  }
  if (has(q, "alert", "flag", "warning", "signal", "concern", "worry")) {
    if (!a.alerts.length) return `No alerts triggered for ${name}. Metrics are within the screening thresholds.`;
    return `**${a.alerts.length} signal${a.alerts.length > 1 ? "s" : ""} for ${name}:**\n` + a.alerts.slice(0, 6).map((x) => `${sev[x.severity]} **${x.name}**: ${x.evidence}`).join("\n") + "\n\nOpen **Investment Assessment** for the diligence questions behind each.";
  }
  if (has(q, "leverage", "debt", "net debt", "borrow"))
    return `Net debt is **${fmtM(L.netDebt)}**, i.e. **${fmtX(L.netDebtToEbitda)}** EBITDA (debt ${fmtM(a.latestRecord.debt)}, cash ${fmtM(a.latestRecord.cash)}). ${L.netDebtToEbitda != null && L.netDebtToEbitda > 3 ? "Above 3x is a stretched balance sheet." : L.netDebtToEbitda != null && L.netDebtToEbitda < 0 ? "Net cash position." : "Within a typical range."}`;
  if (has(q, "conversion", "ocf", "operating cash", "ebitda", "profit to cash", "profit-to-cash"))
    return `Cash conversion (OCF ÷ EBITDA) is **${fmtPct(L.cashConversion)}** in FY${L.year}${P ? ` versus ${fmtPct(P.cashConversion)} in FY${P.year}` : ""}. EBITDA ${fmtM(a.latestRecord.ebitda)}, operating cash flow ${fmtM(a.latestRecord.operatingCashFlow)}. Below ~70% means profit isn't turning into cash.`;
  if (has(q, "missing", "data quality", "complete"))
    return a.missingFields.length ? `Missing values: ${a.missingFields.slice(0, 10).join(", ")}. Dependent indicators are marked unavailable (never treated as zero).` : "No missing fields in the supplied data.";
  if (has(q, "recommend", "invest", "should", "verdict", "decision", "conclusion"))
    return `${name} screens as **${rk.classification}**${rk.score != null ? ` (${Math.round(rk.score)}/100)` : ""}. ${rk.classification === "High Risk" || rk.classification === "Critical Risk" ? "I'd hold the investment decision until the flagged items are explained (ageing, stock, collections)." : "No major cash trap shows up in the numbers, but confirm with detailed diligence."} This is a screening aid, not investment advice. See **Due Diligence Report** for the full write-up.`;
  if (has(q, "why", "score", "risk", "rating", "classif", "breakdown", "driver")) {
    const top = allIndicators(rk).filter((x) => x.points != null).sort((x, y) => (y.points ?? 0) - (x.points ?? 0)).slice(0, 3);
    return `**${name}: ${rk.score == null ? "insufficient data" : `${Math.round(rk.score)}/100, ${rk.classification}`}** (${rk.evaluated} of ${rk.total} indicators assessed, ${rk.coverage}% of the model${a.previousScore != null ? `; previously ${Math.round(a.previousScore)}` : ""}).\nBiggest drivers:\n` + top.map((c) => `• **${c.name}** ${c.points}/${c.max} (${c.level}): ${c.actual}`).join("\n");
  }
  if (has(q, "revenue", "sales", "growth", "margin"))
    return `FY${L.year} revenue is **${fmtM(a.latestRecord.revenue)}**${P && a.previousRecord?.revenue ? `, vs ${fmtM(a.previousRecord.revenue)} in FY${P.year}` : ""}. EBITDA margin ${fmtPct(L.ebitdaMargin)}.`;
  if (/\b(hi|hello|hey|help)\b|what can/.test(q))
    return `Hi! I can explain **${name}**'s risk score, red flags, DSO/DIO/DPO, cash conversion, leverage and cash release, plus the methodology and upload formats. Pick a suggestion below or just ask.`;

  return `I'm not sure about that one. Try asking about the **risk score**, **red flags**, **DSO/DIO/DPO**, **cash conversion**, **leverage**, **cash release**, **weights** or **uploading a file**.`;
}
