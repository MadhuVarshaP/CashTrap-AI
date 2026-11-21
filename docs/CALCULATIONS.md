# CashTrap AI — Calculation Reference

Every number the app shows is computed by the code listed next to each section. This document states the **inputs, formula,
thresholds and edge-case rules** so each can be re-checked by hand or in Excel.

| Area | Source file |
|---|---|
| Unit scaling, orchestration | `lib/calculations/analyze.ts` |
| Working-capital & cash metrics | `lib/calculations/metrics.ts` |
| Risk score (six categories) | `lib/calculations/risk.ts` |
| Alerts (seven signals) | `lib/calculations/alerts.ts` |
| Report text | `lib/calculations/narrative.ts` |
| File import / mapping | `lib/utilities/parse.ts` |
| KPI cards, charts, calculator | `app/overview`, `components/charts/Charts.tsx`, `app/cash-impact` |

> Thresholds and weights are **illustrative screening rules**, not industry standards or a definitive investment decision.

---

## 0. Conventions

- **Units.** Inputs are converted to **AED millions** before any maths: `value × unitMultiplier ÷ 1,000,000`
  (`AED '000` → multiplier 1,000; detected automatically from the workbook header, or chosen on the Company Analysis page for flat files).
- **Missing data is `null`, never 0.** A formula with any `null` input returns `null`, shown as “—”. No metric silently treats a gap as zero.
- **Division by zero / negative denominators** return `null` (see each formula).
- **Years** are sorted ascending. “Latest” = last year, “previous” = the year before it.
- **Growth** = `(current − previous) ÷ |previous|`; `null` if either is missing or previous = 0.
- **Rounding** only happens for display (and the final risk score, rounded to a whole number).
- **365-day year** is used for all day-count metrics.

---

## 1. Input mapping (what is read from your file)

### 1a. Flat table (one row per year)
Columns are matched case-insensitively ignoring punctuation. Accepted names include:
`Year/FY`, `Revenue/Sales/Turnover`, `COGS/Cost of Sales`, `EBITDA`, `Receivables/Accounts Receivable/Trade Receivables`,
`Inventory/Inventories/Stock`, `Payables/Accounts Payable/Trade Payables`, `Operating_Cash_Flow/OCF/Cash From Operations`,
`Cash/Cash and Equivalents`, `Debt/Total Debt/Borrowings`.
Blank or non-numeric cells → `null` (with a warning). Negative revenue/COGS/balances → warning. Duplicate or invalid years → error.
At least **2 years** required.

### 1b. Statement workbook (sheets “Income Statement”, “Balance Sheet”, “Cash Flow Statement”)
Year columns are found from the header row (`FY2024`, `31-Dec-2024`). Rows are found by **label** (first match):

| Field | Sheet | Row label matched |
|---|---|---|
| Revenue | Income Statement | `Total revenue` |
| COGS | Income Statement | `Total cost of sales…` (**absolute value**, costs are stored negative) |
| EBITDA | Income Statement | first row starting `EBITDA` |
| Credit sales | Income Statement | `Credit sales` (optional) |
| Credit purchases | Income Statement | `Credit purchases` (optional) |
| Receivables | Balance Sheet | `Trade receivables, net` (net of ECL allowance) |
| Inventory | Balance Sheet | `Inventories, net` (net of provision) |
| Payables | Balance Sheet | `Trade payables` |
| Cash | Balance Sheet | `Cash and bank balances` |
| Debt | Balance Sheet | **sum of** `Short-term bank borrowings` + `Current portion of term loans` + `Term loans, non-current` |
| Operating cash flow | Cash Flow Statement | `Net cash from operating activities` |
| Opening balances | Balance Sheet | the column for the year **before** the first record (receivables, inventory, payables) |

---

## 2. Per-year metrics (`computeMetrics`)

For year *t* with previous year *t−1* (or opening balances if *t* is the first year):

**Average balance** `avg(X) = (X_t + X_{t−1}) ÷ 2`.
If no prior balance exists, the closing balance is used and the year is flagged **approximate**.

| Metric | Formula | Notes |
|---|---|---|
| **DSO** (days sales outstanding) | `avg(Receivables) ÷ SalesBase × 365` | `SalesBase` = **Credit sales if supplied, otherwise Revenue** |
| **DIO** (days inventory outstanding) | `avg(Inventory) ÷ COGS × 365` | |
| **DPO** (days payables outstanding) | `avg(Payables) ÷ PurchasesBase × 365` | `PurchasesBase` = **Credit purchases if supplied, otherwise COGS** |
| **CCC** (cash conversion cycle) | `DSO + DIO − DPO` | `null` if any of the three is `null` |
| **Cash conversion** | `Operating Cash Flow ÷ EBITDA` | `null` unless **EBITDA > 0** |
| **EBITDA margin** | `EBITDA ÷ Revenue` | |
| **Net debt** | `Debt − Cash` | `null` if either missing |
| **Net debt / EBITDA** | `Net debt ÷ EBITDA` | `null` unless **EBITDA > 0** |

**Approximate flag:** `true` only when there is neither a previous year nor opening balances.

---

## 3. Risk score (`scoreRisk`)

Six categories are scored by comparing the **latest year vs the previous year**. Higher points = more risk.

### 3a. Weights — they are **not** equal

Weights sum to **100**, so *points = percent of the total score*.

| # | Category | Weight (pts = %) | Why it carries this weight (design rationale) |
|---|---|---|---|
| 1 | Profit-to-cash conversion | **25** | The most direct test of earnings quality: does EBITDA actually become cash? |
| 2 | Receivables (DSO change) | **20** | Largest and most common cash trap; also carries credit-loss risk. |
| 3 | EBITDA vs OCF divergence | **20** | Classic earnings-quality red flag; looks at direction of *both* lines. |
| 4 | Inventory (DIO change) | **15** | Important, but build-ups are more often explainable (orders, hedging). |
| 5 | Cash conversion cycle | **10** | Largely a *composite* of DSO, DIO and DPO, so it is down-weighted to avoid triple-counting the same effect. |
| 6 | Leverage (Net debt/EBITDA) | **10** | An amplifier of cash weakness, not a working-capital measure itself. |

The split is a judgement-based prototype design, **not statistically calibrated**. To change it, edit the `max` values and the
`pts` tuples in `lib/calculations/risk.ts` (keep them summing to 100).

### 3b. Scoring rules

`Δ` = latest − previous. For day-based rows, an increase below **1 day** counts as stable (0 points).

| Category | Rule → points |
|---|---|
| **Receivables** — Δ DSO | ≤ 0 or < 1 day → **0**; 1–10 days → **5**; > 10 – 20 → **10**; > 20 → **20** |
| **Inventory** — Δ DIO | ≤ 0 or < 1 day → **0**; 1–10 → **5**; > 10 – 20 → **10**; > 20 → **15** |
| **Profit-to-cash** — cash conversion (latest) | ≥ 80% → **0**; 50% to < 80% → **10**; 20% to < 50% → **20**; < 20% (incl. negative) → **25** |
| **Divergence** — EBITDA growth *e*, OCF growth *o* | *e* > +10% **and** *o* < −10% → **20**; else if *e* < 0 **or** *o* < 0 → **10**; else (neither deteriorates) → **0** |
| **CCC** — Δ CCC | ≤ 0 or < 1 day → **0**; 1–10 → **3**; > 10 – 20 → **6**; > 20 → **10** |
| **Leverage** — Net debt/EBITDA | < 2x → **0**; 2x – 3x → **3**; > 3x – 4x → **7**; > 4x → **10** |

Special cases:
- Profit-to-cash is **not evaluated** if EBITDA ≤ 0.
- Leverage with **EBITDA ≤ 0 and net debt > 0** scores the **maximum 10** (ratio not meaningful) and says so in the evidence text.
- A category with missing inputs is **not evaluated** (`points = null`).
- “Increase of 1–10 days” and “11–20 days” leave a hairline gap (10.0–11.0); the code treats anything **above 10 and up to 20** as the 11–20 band.

### 3c. Overall score and classification

```
evaluated   = categories with points ≠ null
rawPoints   = Σ points of evaluated categories
maxEvaluated= Σ max of evaluated categories
score       = round( rawPoints ÷ maxEvaluated × 100 )       // normalised
```
- Fewer than **4** evaluated categories → **“Insufficient Data”**, no score.
- With full coverage `maxEvaluated = 100`, so score = rawPoints.
- With missing categories the remaining weights are **rescaled** (the “effective weight” shown beside each category =
  `max ÷ maxEvaluated × 100`).

| Score | Classification |
|---|---|
| 0–24 | Low Risk |
| 25–49 | Moderate Risk |
| 50–74 | High Risk |
| 75–100 | Critical Risk |

### 3d. Category severity label
`ratio = points ÷ max`: 0 → Low (“No flag”); < 0.5 → Medium; < 0.8 → High; ≥ 0.8 → Critical.

### 3e. Change vs prior year
With **3+ years**, the same model is run on the previous year (vs the year before it); the page shows `score − previousScore`.

---

## 4. Alerts (`detectAlerts`)

Evaluated for latest vs previous year. An alert appears only if triggered; results are sorted Critical → Low.
Note alerts 1–2 use **year-end balances** (simple growth), whereas DSO/DIO use **averages** — so they can differ slightly by design.

| # | Alert | Triggers when | Severity |
|---|---|---|---|
| 1 | Receivables > revenue growth | receivables growth > revenue growth **and** > 0 | gap = (rec growth − rev growth) in pp: > 30 **Critical**; > 15 **High**; > 5 **Medium**; else Low |
| 2 | Inventory > revenue growth | inventory growth > revenue growth **and** > 0 | same gap bands |
| 3 | EBITDA up, OCF down | EBITDA growth > 0 **and** OCF growth < 0 | **Critical** if EBITDA > +10% and OCF < −10%; otherwise **High** |
| 4 | DSO increasing | Δ DSO ≥ 1 day | Δ > 35 **Critical**; > 20 **High**; > 10 **Medium**; else Low |
| 5 | DIO increasing | Δ DIO ≥ 1 day | same day bands |
| 6 | CCC lengthening | Δ CCC ≥ 1 day | same day bands |
| 7 | High leverage | Net debt/EBITDA ≥ 2x | > 4x **Critical**; > 3x **High**; else **Medium** |

Alert severity bands are **intentionally separate** from the scoring points in §3 (they have an extra Critical tier).
Alerts never claim fraud or bad debt; they list evidence and what to investigate.

---

## 5. Overview KPI cards

| Card | Value | Change shown |
|---|---|---|
| Revenue / EBITDA / Operating Cash Flow | latest-year figure | YoY % growth |
| Net Debt | `Debt − Cash` | YoY % change (an **increase** is coloured as negative) |
| EBITDA Margin | `EBITDA ÷ Revenue` | change in **percentage points** (margin_t − margin_{t−1}) × 100 |
| Cash Conversion | `OCF ÷ EBITDA` | change in percentage points |

Sparklines plot the available yearly values. Colour: green = favourable direction, red = unfavourable, grey = change < 0.5%.

---

## 6. Chart calculations

- **Indexed trend** (Overview) and **Receivables/Inventory vs revenue** (Assessment): `value ÷ first-year value × 100` (base year = 100).
- **EBITDA vs OCF**: two lines; the shaded band spans OCF → EBITDA (= profit not converted to cash).
- **Cash bridge (waterfall)**, latest year, AED m:
  ```
  EBITDA
  + Δ Receivables  = −(Receivables_t − Receivables_{t−1})
  + Δ Inventory    = −(Inventory_t − Inventory_{t−1})
  + Δ Payables     =  (Payables_t − Payables_{t−1})
  + Other          =  OCF − (EBITDA + ΔRec + ΔInv + ΔPay)     ← balancing figure (tax, interest, other)
  = Operating cash flow
  ```
  “Other” is a **plug**, so the bridge always reconciles by construction; it is not read from the cash-flow statement.
- **Risk distribution donut**: each category’s points ÷ total raw points.

---

## 7. Cash Impact Calculator

```
Potential cash release = (Annual sales ÷ 365) × (Current DSO − Target DSO)
Days improved          = Current DSO − Target DSO
% improvement          = Days improved ÷ Current DSO
Pro-forma CCC          = CCC − Days improved            (all else equal)
```
- **Annual sales** defaults to **credit sales** when the file supplies it (otherwise revenue) — the same base DSO was measured on.
- **Current DSO** defaults to the latest-year DSO from §2.
- Default scenario targets: `round(Current DSO − cut)` with cuts **8 / 15 / 25 days** (Conservative / Base / Optimistic), floored at 0.
- If Target ≥ Current, release is shown as 0 (no negative “release”).
- Validation: revenue > 0; DSO between 0 and 365.
- It is a **one-off, illustrative** working-capital estimate — not guaranteed cash recovery or profit.

---

## 8. Due Diligence Report numbers

- **Completeness** = evaluated indicators ÷ 6.
- Section text only quotes figures from §2–§7.
- The report’s cash-release line uses a **15-day DSO reduction** on the §7 base (`target = DSO − 15`).
- Questions to management are collected from the triggered alerts’ “investigate” lists (max 10).
- Every statement is tagged **Verified evidence** (from the engine) or **Possible explanation** (unverified hypothesis).

---

## 9. Data quality panel

- `cells = years × 9` (Revenue, COGS, EBITDA, Receivables, Inventory, Payables, OCF, Cash, Debt).
- `Completeness = (cells − missing) ÷ cells`.
- Warnings: missing values; < 2 years (blocks analysis); < 3 years; EBITDA ≤ 0 in any year; first year lacks opening balances.

---

## 10. Worked example — `GulfTech_Manufacturing_Synthetic_Financials.xlsx`, FY2025 (AED '000)

Inputs read: Credit sales 127,440 · COGS 94,200 · Credit purchases 70,500 · EBITDA 23,300 · OCF 6,231 · Cash 4,381 · Debt 34,700
Net receivables 24,900 → 32,200 · Net inventory 19,000 → 24,500 · Payables 7,900 → 7,600.

| Step | Calculation | Result |
|---|---|---|
| avg receivables | (24,900 + 32,200) ÷ 2 | 28,550 |
| **DSO** | 28,550 ÷ 127,440 × 365 | **81.77** |
| avg inventory | (19,000 + 24,500) ÷ 2 | 21,750 |
| **DIO** | 21,750 ÷ 94,200 × 365 | **84.28** |
| avg payables | (7,900 + 7,600) ÷ 2 | 7,750 |
| **DPO** | 7,750 ÷ 70,500 × 365 | **40.12** |
| **CCC** | 81.77 + 84.28 − 40.12 | **125.92** |
| **Cash conversion** | 6,231 ÷ 23,300 | **26.7%** |
| **Net debt** | 34,700 − 4,381 | **30,319** |
| **Net debt / EBITDA** | 30,319 ÷ 23,300 | **1.30x** |

FY2024 values (same method): DSO 69.79 · DIO 70.66 · DPO 45.84 · CCC 94.61 · cash conversion 33.6%. EBITDA growth +23.3%, OCF growth −1.9%.

**Risk score for FY2025**

| Category | Evidence | Points |
|---|---|---|
| Receivables | Δ DSO = 81.77 − 69.79 = +11.98 d (> 10 – 20) | 10 / 20 |
| Inventory | Δ DIO = 84.28 − 70.66 = +13.62 d (> 10 – 20) | 10 / 15 |
| Profit-to-cash | 26.7% (20% to < 50%) | 20 / 25 |
| Divergence | EBITDA +23.3% but OCF only −1.9% (not below −10%); one line deteriorates | 10 / 20 |
| CCC | Δ CCC = 125.92 − 94.61 = +31.31 d (> 20) | 10 / 10 |
| Leverage | 1.30x (< 2x) | 0 / 10 |
| **Total** | 60 ÷ 100 × 100 | **60 → High Risk** (prior year 65) |

**Cash release (§7)**: 127,440 ÷ 365 × (81.77 − 60) = **7,601** (AED '000) — equals the workbook’s own “collections” benchmark.

**Cash bridge FY2025:** EBITDA 23,300 − 7,300 (receivables) − 5,500 (inventory) − 300 (payables) − 3,969 (other, plug) = **6,231** OCF.

### Cross-check against the workbook’s “Expected Metrics” sheet

| Metric | FY2023 | FY2024 | FY2025 | Matches workbook |
|---|---|---|---|---|
| DSO | 60.6 | 69.8 | 81.8 | ✅ |
| DIO | 60.6 | 70.7 | 84.3 | ✅ |
| DPO | 51.9 | 45.8 | 40.1 | ✅ |
| CCC | 69.4 | 94.6 | 125.9 | ✅ |
| Cash conversion | 45.8% | 33.6% | 26.7% | ✅ |
| Net debt / EBITDA | 1.11x | 1.28x | 1.30x | ✅ |

### Excel formulas to reproduce it yourself
```
DSO  = AVERAGE(rec_prev, rec_cur) / credit_sales * 365
DIO  = AVERAGE(inv_prev, inv_cur) / cogs * 365
DPO  = AVERAGE(pay_prev, pay_cur) / credit_purchases * 365
CCC  = DSO + DIO - DPO
Conv = ocf / ebitda
ND   = debt - cash        ND/EBITDA = ND / ebitda
Release = credit_sales / 365 * (DSO - target)
```

---

## 11. Known simplifications — worth a second look

1. **Weights/thresholds are design choices**, not calibrated or industry-standard.
2. **Year-end vs average balances:** alerts 1–2 compare year-end balances; DSO/DIO use averages. Both are shown, so numbers may differ slightly.
3. **Revenue/COGS stand in for credit sales/purchases** when those are not supplied (flat files), overstating the denominator and **understating DSO/DPO**.
4. **Only two data points drive the score** (latest vs previous year); a single-year spike can swing it.
5. **Leverage uses total borrowings** (short-term + current portion + term loans). Leases and other debt-like items are not included unless in the debt input.
6. **Cash bridge “Other” is a plug**, not an audited figure.
7. **Cash release** assumes constant revenue and customer mix and is a one-off timing effect.
8. **The 1–2 day hairlines** between scoring bands (see §3b) are resolved as described.
