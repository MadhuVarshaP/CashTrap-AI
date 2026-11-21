# CashCop AI — Calculation Reference

Every number the app shows is computed by the code listed next to each section. This document states the **inputs, formula,
thresholds and edge-case rules** so each can be re-checked by hand or in Excel.

| Area | Source file |
|---|---|
| Unit scaling, orchestration | `lib/calculations/analyze.ts` |
| Working-capital & cash metrics | `lib/calculations/metrics.ts` |
| Risk score (five pillars, 18 indicators) | `lib/calculations/pe-risk.ts` |
| Stress scenarios | `lib/calculations/stress.ts` |
| Valuation & illustrative returns | `lib/calculations/valuation.ts` |
| Investment findings | `lib/calculations/findings.ts` |
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

Optional columns (used by the Investment Risk Analysis pillars; each indicator says what it needs): `Capex / Capital Expenditure`,
`Interest Expense / Finance Costs`, `Current Assets`, `Current Liabilities`, `Scheduled Principal Repayment`, `Short-term Debt / Debt due in 12 months`.

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
| Capex | Cash Flow Statement | `Purchase of property, plant…` (absolute value) |
| Interest | Income Statement | `Finance costs` (absolute value) |
| Current assets / liabilities | Balance Sheet | `Total current assets` / `Total current liabilities` |
| Scheduled principal | Balance Sheet | `Current portion of term loans` |
| Debt due in 12 months | Balance Sheet | `Short-term bank borrowings` + `Current portion of term loans` |
| Opening balances | Balance Sheet | the column for the year **before** the first record (receivables, inventory, payables) |

---

### 1c. Provider export (S&P Capital IQ “Financial Highlights”)
One sheet, line items down column A, fiscal years across (`2024 FY`); currency and magnitude are read from the header lines.
Revenue ← `Total Revenue`; COGS = Revenue − `Gross Profit`; EBITDA; OCF ← `Cash from Ops.`; Cash ← `Cash & Short-term Investments`; Debt ← `Total Debt`;
Capex ← `Capital Expenditure` (absolute); current/quick ratios ← reported. DSO/DIO are the **provider's reported averages** (take precedence over balances);
an implied balance (days × base ÷ 365) is stored for display. Interest = EBITDA ÷ `EBITDA / Interest Expense` when numeric (“NM/NA” → not available).
No payables line, so DPO, CCC and the working-capital indicator are *not assessed*.

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

## 3. Investment Risk Score (`assessRisk` in `pe-risk.ts`)

Five pillars, 18 indicators, 100 points. **Higher = more identified financial risk.** It is a screening score, not a probability
of failure and not a recommendation.

### 3a. Pillars and indicator allocation

| Pillar (weight) | Indicator | Max |
|---|---|---:|
| **Quality of Earnings (25)** | EBITDA adjustments and unusual earnings | 10 |
| | Revenue quality and cash evidence | 5 |
| | EBITDA margin deterioration | 5 |
| | Three-year earnings volatility | 5 |
| **Cash Flow Sustainability (25)** | EBITDA-to-operating-cash conversion | 10 |
| | Free cash flow conversion | 10 |
| | Historical cash-flow consistency | 5 |
| **Working Capital Risk (20)** | Receivables collection (DSO) | 7 |
| | Inventory efficiency (DIO) | 5 |
| | Payables sustainability (DPO) | 3 |
| | Overall working-capital deterioration | 5 |
| **Debt and Repayment Risk (20)** | Net debt / EBITDA | 7 |
| | Interest coverage | 5 |
| | Debt service coverage ratio | 5 |
| | Debt maturity concentration | 3 |
| **Liquidity and Stress Risk (10)** | Cash and short-term liquidity adequacy | 4 |
| | Revenue and EBITDA downside scenario | 3 |
| | Cash-flow resilience under stress | 3 |

### 3b. From level to points
Every indicator is judged **Low / Moderate / High / Critical** against its threshold, then awarded a share of its maximum:
**Low 0% · Moderate 40% · High 70% · Critical 100%** (e.g. a 10-point indicator rated High = 7 points).

### 3c. Thresholds (indicative screening bands, not industry standards)

| Indicator | Measure | Low | Moderate | High | Critical |
|---|---|---|---|---|---|
| EBITDA adjustments | Support status of the entered adjustment | verified | needs documents | unsupported | unexplained |
| | (a verified adjustment above 20% of EBITDA is raised to Moderate) | | | | |
| Revenue quality | receivables growth − revenue growth | ≤ 0 pp | ≤ 10 | ≤ 30 | > 30 |
| EBITDA margin | change in margin | ≥ −0.5 pp | ≥ −2 | ≥ −5 | < −5 |
| Earnings volatility | worst YoY EBITDA fall, last 3 periods (needs 3 years) | none | ≤ 10% | ≤ 25% | > 25% |
| OCF conversion | OCF ÷ adjusted EBITDA | ≥ 80% | ≥ 50% | ≥ 20% | < 20% or negative (EBITDA ≤ 0 → Critical) |
| FCF conversion | (OCF − capex) ÷ adjusted EBITDA | ≥ 50% | ≥ 25% | ≥ 0% | negative. Raised to at least High if FCF < interest + scheduled principal |
| Cash-flow consistency | issues in 3 years: negative OCF years, FCF falling 2 years running, EBITDA up while OCF not up (per year), OCF swing > 40% | 0 | 1 | 2–3 | 4+ |
| Receivables | change in DSO | ≤ +2 d | ≤ +7 | ≤ +15 | > +15 |
| Inventory | change in DIO | ≤ +2 d | ≤ +7 | ≤ +15 | > +15 |
| Payables | absolute change in DPO | ≤ 5 d | ≤ 12 | ≤ 20 | > 20 |
| Working-capital deterioration | change in OWC ÷ revenue (OWC = receivables + inventory − payables) | ≤ +1 pp | ≤ +3 | ≤ +6 | > +6 |
| Net debt / EBITDA | net debt ÷ adjusted EBITDA | < 2x (net cash = Low) | ≤ 3x | ≤ 4x | > 4x (EBITDA ≤ 0 with net debt → Critical) |
| Interest coverage | adjusted EBITDA ÷ cash interest | ≥ 5x | ≥ 3x | ≥ 1.5x | < 1.5x |
| DSCR | (OCF + interest) ÷ (interest + scheduled principal) | ≥ 1.5x | ≥ 1.2x | ≥ 1.0x | < 1.0x |
| Debt maturity | debt due within 12 months ÷ total debt | < 30% | < 50% | < 70% | ≥ 70% |
| Liquidity adequacy | current ratio (quick ratio) — worse of the two applies | ≥ 1.5 (≥ 1.0) | ≥ 1.1 (≥ 0.7) | ≥ 0.8 (≥ 0.5) | below |
| Downside scenario | net debt ÷ stressed EBITDA (revenue −10%, margin −3 pp) | net cash or < 2x | ≤ 3x | ≤ 4x | > 4x or EBITDA ≤ 0 |
| Cash-flow resilience | shortfall = capex + scheduled principal − stressed OCF (all four stresses) | none | cash ≥ 1.5× shortfall | cash ≥ shortfall | cash < shortfall |

Notes:
- **Adjusted EBITDA** = reported EBITDA + the adjustment **only when it is marked verified** (latest year). Otherwise it equals reported.
- **No double counting:** DSO, DIO and DPO are scored on their own changes; the *overall* working-capital indicator is scored on cash
  absorbed relative to revenue; **CCC is shown as a cross-check and is not scored.**
- **CFADS** for DSCR = OCF + interest paid (OCF is struck after interest).
- Scheduled principal = current portion of term loans (workbook) or the supplied column. Without it DSCR is *not assessed*.
- Industry benchmarks are **not used** unless a comparable dataset is supplied (none is built in); history is the comparison.

### 3d. Stress model (`stress.ts`)
```
stressed revenue = revenue × (1 − revenue drop)
stressed EBITDA  = stressed revenue × (EBITDA margin − margin drop)
working-capital drag = stressed credit sales ÷ 365 × collection delay (days)
extra interest   = total debt × interest rise
stressed OCF     = OCF + (stressed EBITDA − EBITDA) − working-capital drag − extra interest
```
Defaults: revenue −10%, margin −3 pp, collections +15 days, interest +2 pp. The score is **always judged on the defaults**; the user's
own assumptions on the Liquidity & stress tab change only the displayed outputs. Illustrative, not a forecast; tax and management actions ignored.

### 3e. Missing data, coverage and overall score
- An indicator that can't be computed is **not assessed** (`points = null`), never zero. Each says what it needs.
- `score = round(points earned ÷ points assessable × 100)`; `coverage = points assessable` (out of 100).
- If `coverage < 40` the score reads **Insufficient data**.
- Pillar display: points earned / assessable points in that pillar.
- Classification: 0–24 Low · 25–49 Moderate · 50–74 High · 75–100 Critical.
- Prior-year score: same engine on the records without the latest year (adjustment input ignored).

### 3f. Valuation view (`valuation.ts`) — separate from the risk score
```
Entry multiple  = enterprise value ÷ adjusted EBITDA
Equity value    = enterprise value − net debt
Acquisition debt = entered, else enterprise value − equity   (labelled when derived)
Acquisition leverage = acquisition debt ÷ adjusted EBITDA
WC adjustment   = max(0, (OWC% − prior OWC%) × revenue)
```
Illustrative returns: exit EBITDA = adjusted EBITDA × (1 + g)^years (g entered, else historical CAGR capped 0–10%); exit EV = exit EBITDA × exit multiple
(entered, else entry multiple); debt repaid = Σ adjusted EBITDA_t × latest FCF conversion; MOIC = (exit EV − remaining debt) ÷ equity; IRR = MOIC^(1/years) − 1.
No attractiveness score is derived from the risk score.

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

Six sections, each answering an investor question: Executive Investment Summary (financial health) · Financial Performance & Earnings Quality ·
Cash Flow & Working Capital Analysis (where cash is trapped) · Cash Release & Value Creation · Valuation & Investment Returns · Investment Risks & Due Diligence Priorities.

- Every line is tagged **Fact** (from the engine), **Estimate** (sized from the data, e.g. cash tied up = Δdays × sales or COGS ÷ 365), **Assumption**, **Missing data** or **Hypothesis**.
- Risks are ordered by points scored; impact is quantified in AED / % wherever the data allows (`findings.ts`).
- Cash-release lines: DSO cuts of 8 / 15 / 25 days on the §7 base, plus a return to last year's DSO and DIO; one-off, constant revenue.
- Management questions: the questions attached to the highest-scoring flagged indicators (max 8).
- The report never recommends buying or rejecting the company.

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

**Risk score for FY2025** (adjustments not entered, so the EBITDA-adjustments indicator is *not assessed*; 90 of 100 points assessable)

| Indicator | Evidence | Points |
|---|---|---|
| Revenue quality | receivables +29.3% vs revenue +9.5% = +19.8 pp (≤ 30 → High) | 3.5 / 5 |
| EBITDA margin | 14.6% → 16.5% (+1.8 pp) | 0 / 5 |
| Earnings volatility | EBITDA +21.9%, +23.3%, no fall | 0 / 5 |
| OCF conversion | 6,231 ÷ 23,300 = 26.7% (20–50% → High) | 7 / 10 |
| FCF conversion | (6,231 − 8,400) ÷ 23,300 = −9.3% (negative → Critical) | 10 / 10 |
| Cash-flow consistency | EBITDA up but OCF down in both years (1 issue → Moderate) | 2 / 5 |
| Receivables | Δ DSO +12.0 d (≤ +15 → High) | 4.9 / 7 |
| Inventory | Δ DIO +13.6 d (High) | 3.5 / 5 |
| Payables | Δ DPO −5.7 d (≤ 12 → Moderate) | 1.2 / 3 |
| Working-capital deterioration | OWC 49,100 = 34.7% of revenue vs 27.8%: +6.8 pp (Critical) | 5 / 5 |
| Net debt / EBITDA | 1.30x | 0 / 7 |
| Interest coverage | 23,300 ÷ 3,100 = 7.5x | 0 / 5 |
| DSCR | (6,231 + 3,100) ÷ (3,100 + 3,200) = 1.48x (≥ 1.2 → Moderate) | 2 / 5 |
| Debt maturity | 19,000 ÷ 34,700 = 54.8% (< 70% → High) | 2.1 / 3 |
| Liquidity adequacy | current 63,581 ÷ 33,961 = 1.87x; quick 1.15x | 0 / 4 |
| Downside scenario | stressed EBITDA 17,150; 30,319 ÷ 17,150 = 1.77x | 0 / 3 |
| Cash-flow resilience | stressed OCF −5,321 vs need 8,400 + 3,200 = 11,600; shortfall 16,921 > cash 4,381 (Critical) | 3 / 3 |
| **Total** | 44.2 ÷ 90 × 100 | **49 → Moderate Risk** (prior year 47) |

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

1. **Weights/thresholds are design choices**, not calibrated or industry-standard. No industry benchmarks are used.
2. **Year-end vs average balances:** alerts 1–2 compare year-end balances; DSO/DIO use averages. Both are shown, so numbers may differ slightly.
3. **Revenue/COGS stand in for credit sales/purchases** when those are not supplied (flat files), overstating the denominator and **understating DSO/DPO**.
4. **Most indicators compare the latest year with the previous one** (three years for volatility and consistency); a single-year spike can swing them.
5. **Leverage uses total borrowings** (short-term + current portion + term loans). Leases and other debt-like items are not included unless in the debt input.
6. **Cash bridge “Other” is a plug**, not an audited figure.
7. **Cash release** assumes constant revenue and customer mix and is a one-off timing effect.
8. **Provider exports** carry reported days, not balances; implied balances are derived, and payables are absent.
9. **Verification status of EBITDA adjustments is the investor's input**; the tool cannot verify documents.
10. **Stress outputs** are illustrative and ignore tax, management actions and covenant effects.
