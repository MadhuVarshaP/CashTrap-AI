# CashTrap AI — Find the cash traps before you invest.

AI-assisted financial due diligence for private equity. CashTrap AI looks past reported
profitability to show how efficiently a business actually turns profit into cash, and
surfaces working-capital "cash traps" before capital is committed.

> The bundled demo company, **GulfTech Manufacturing LLC**, and all of its figures are **synthetic**.
> The scoring model is an illustrative screening methodology, not an investment decision.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start   # production
npm run lint       # type-check (tsc --noEmit)
```

Configuration lives in environment variables: copy `.env.example` to `.env.local`. Nothing is required to run the demo.
Optional: set `NEXT_PUBLIC_API_URL` to route analysis through a FastAPI backend (see below).

> `NEXT_PUBLIC_*` variables are exposed to the browser. **Never put secrets (e.g. AI API keys) in them.**
> Secrets belong in the backend's own environment, never in this repo.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | **Next.js 14** (App Router) · **React 18** · **TypeScript** (strict) |
| Styling | **Tailwind CSS 3** with design tokens in `tailwind.config.ts` (dark, monochrome + restrained accents) |
| Charts | **Recharts** — trend, divergence, indexed growth, waterfall cash bridge, donut, scenario bars; custom SVG risk gauge |
| Motion | **Framer Motion** — page transitions, animated nav indicator, count-up numbers, animated gauge/bars |
| Icons | **Lucide React** |
| File parsing | **SheetJS (`xlsx`)** — reads `.xlsx` and `.csv` in the browser |
| Fonts | **Inter** (UI), **Manrope** (headings / key numbers), **JetBrains Mono** (financial values) via `next/font` |
| State | React Context (`lib/state/store.tsx`) — no external state library |
| Backend (planned) | **Python FastAPI**: `POST /analyze`, `POST /investigate` |

No login, payments, portfolio management or market feeds, by design.

## Deploy to Vercel

`vercel.json` pins the framework to Next.js, so no output directory is needed (Next.js serves from `.next`, not `public`).
If you still see `STATIC_BUILD_NO_OUT_DIR`, open *Project Settings → Build & Development Settings* and set **Framework Preset = Next.js**,
leaving **Output Directory** empty (not `public`). No environment variables are required for the demo.

## Documentation

- [`docs/CALCULATIONS.md`](docs/CALCULATIONS.md): every formula, threshold, weight and edge case, with a worked example to re-check by hand or in Excel.

## Pages

| Route | Purpose |
|---|---|
| `/overview` | Investment Intelligence dashboard: KPIs, trends, risk snapshot, signals, working-capital cycle |
| `/company-analysis` | Drag-and-drop CSV/Excel upload, validation, editable records table, data-quality panel, **Analyse Financials** |
| `/investment-assessment` | Risk score /100, six-category breakdown, evidence cards, divergence & cash-bridge charts, coverage |
| `/cash-impact` | DSO scenario calculator (conservative / base / optimistic) with live AED cash-release |
| `/due-diligence-report` | 11-section report, verified evidence vs possible explanations, print / Markdown export |
| `/methodology` | Formulas, scoring thresholds, AI rules, limitations |

## Architecture

```
app/                 routes (one folder per page)
components/
  layout/            Sidebar, MobileNav, Header (company selector, ⌘K, notifications), Shell
  charts/            Recharts charts + RiskGauge
  dashboard/         KpiCard
  shared/            ui primitives, Dropzone, Guard (requires analysis)
lib/
  calculations/      metrics.ts · risk.ts · alerts.ts · analyze.ts · narrative.ts   (pure, UI-free)
  demo-data/         gulftech.ts (synthetic)
  utilities/         format.ts · parse.ts (CSV/XLSX + validation) · useCountUp.ts
  state/             store.tsx (datasets, analysis, toasts)
  api/client.ts      seam for the FastAPI backend
types/               shared TypeScript types
```

Calculation logic is kept separate from UI so it can move to the Python backend unchanged in behaviour.

## Calculation engine

- **DSO** = Avg Receivables ÷ Revenue × 365 · **DIO** = Avg Inventory ÷ COGS × 365 · **DPO** = Avg Payables ÷ COGS × 365
- **CCC** = DSO + DIO − DPO · **Cash conversion** = Operating Cash Flow ÷ EBITDA
- **Net debt** = Debt − Cash · **Net debt / EBITDA**
- Average opening/closing balances are used when a prior year exists; otherwise closing balances are used and flagged *approximate*.
- Missing inputs yield `null` (shown as "—"), **never zero**. Zero or negative EBITDA, and zero denominators, are handled safely.

### Risk score (higher = more risk)

Receivables 20 · Inventory 15 · Profit-to-cash 25 · EBITDA vs OCF divergence 20 · CCC 10 · Leverage 10.
Bands: 0–24 Low · 25–49 Moderate · 50–74 High · 75–100 Critical.
Missing indicators are excluded and the score is **normalised** over those evaluated; at least **4 of 6** are required, otherwise
"Insufficient Data" is shown. Coverage is always displayed.

### Alerts

Receivables > revenue growth · inventory > revenue growth · EBITDA up / OCF down · rising DSO · rising DIO · rising CCC · high net debt/EBITDA.
Each shows severity, evidence, previous vs current values, why it matters, and what to investigate. None claims fraud or bad debt.

### AI report

No AI key is configured in the prototype, so the report is built from **deterministic templates** using calculated figures only
and is labelled as such. Verified evidence and possible explanations are rendered separately. It never recommends investing or rejecting.

## Upload format

Columns: `Year, Revenue, COGS, EBITDA, Receivables, Inventory, Payables, Operating_Cash_Flow, Cash, Debt`
(common aliases such as Sales, OCF, Total Debt are recognised; a CSV template can be downloaded from the Company Analysis page).
Max 5 MB, at least two years. Pick the unit (AED / thousands / millions) after upload.

### Statement workbooks

Besides the flat table, a workbook with **Income Statement**, **Balance Sheet** and **Cash Flow Statement** sheets (line items down,
years across) is detected automatically. Revenue, COGS, EBITDA, trade receivables/inventories/payables, cash, total borrowings and
operating cash flow are read by row label; units (`AED '000`) are detected; *Credit sales* / *Credit purchases* rows are used for DSO / DPO and the
earlier balance-sheet column provides opening balances. A sample is in `data/GulfTech_Manufacturing_Synthetic_Financials.xlsx`
(its computed DSO/DIO/DPO/CCC match the workbook's own *Expected Metrics* sheet).

## FastAPI integration (planned)

- `POST /analyze` — body: `Dataset`; returns `AnalysisResult` (metrics, risk, alerts). Set `NEXT_PUBLIC_API_URL` and the client in `lib/api/client.ts` will call it.
- `POST /investigate` — returns AI-written section text from the engine's figures. **API keys stay on the backend** and are never exposed to the frontend.

## Responsive design

Desktop icon-rail sidebar (collapsible) → mobile bottom navigation; tables become cards on mobile; charts and report navigation
(horizontal section chips) are re-composed for phones; touch targets ≥ 44px.

## Chatbot, notifications and provider exports

- **Assistant:** the floating chat button answers questions about the active company (risk score drivers, red flags, DSO/DIO/DPO, cash release, weights, upload help). By default it uses built-in answers computed from the same engine as the dashboard. Set `ANTHROPIC_API_KEY` (server-side, see `.env.example`) to route questions through Claude instead; the key never reaches the browser.
- **Notifications:** uploads, parse errors, finished analyses and High/Critical signals appear as popups the moment they happen and are kept in the bell feed with an unread count. The bell offers optional desktop alerts for when the tab is in the background.
- **Upload formats:** flat table, *Income Statement* + *Balance Sheet* workbook, and S&P Capital IQ *Financial Highlights* exports (the files in `data/`). Provider exports carry reported DSO/DIO but no payables, so DPO and the cash conversion cycle show as unavailable and the score uses the remaining indicators.
