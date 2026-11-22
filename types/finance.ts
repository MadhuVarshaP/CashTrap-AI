export type Num = number | null;

export interface FinancialRecord {
  year: number;
  revenue: Num;
  cogs: Num;
  ebitda: Num;
  receivables: Num;
  inventory: Num;
  payables: Num;
  operatingCashFlow: Num;
  cash: Num;
  debt: Num;
  /** optional: used instead of revenue / COGS for DSO and DPO when supplied */
  creditSales?: Num;
  creditPurchases?: Num;
  /** optional: prior-year closing balances so the first year can use averages */
  opening?: { receivables: Num; inventory: Num; payables: Num };
  /** optional: days metrics reported by a data provider (e.g. S&P Capital IQ); used when balances can't be averaged */
  reportedDso?: Num;
  reportedDio?: Num;
  reportedDpo?: Num;
  /** optional, used by the Investment Risk Analysis pillars (each indicator says what it needs) */
  capex?: Num; // positive = cash spent
  interestExpense?: Num; // cash interest
  currentAssets?: Num;
  currentLiabilities?: Num;
  principalRepayment?: Num; // scheduled principal due in the next 12 months
  shortTermDebt?: Num; // debt due within 12 months (for maturity concentration)
  /** provider-reported ratios, used when the balance-sheet lines are not in the file */
  reportedCurrentRatio?: Num;
  reportedQuickRatio?: Num;
  /** per-year EBITDA adjustment amount as supplied; only counted once its status is "verified" */
  ebitdaAdjustment?: Num;
  /** cash taxes actually paid (not the income-tax expense) */
  cashTaxes?: Num;
}

export type FieldKey = "revenue" | "cogs" | "ebitda" | "receivables" | "inventory" | "payables" | "operatingCashFlow" | "cash" | "debt";

export interface YearMetrics {
  year: number;
  dso: Num;
  dio: Num;
  dpo: Num;
  ccc: Num;
  cashConversion: Num; // ratio, 0.30 = 30%
  ebitdaMargin: Num;
  netDebt: Num;
  netDebtToEbitda: Num;
  /** true when no opening balance was available, so closing balances were used */
  approximate: boolean;
}

export type Severity = "Low" | "Medium" | "High" | "Critical";
export type Classification = "Low Risk" | "Moderate Risk" | "High Risk" | "Critical Risk" | "Insufficient Data";

/** one scored indicator inside a pillar */
export interface IndicatorBench {
  metric: string;
  median: string;
  range: string;
  /** the risk threshold the score used: distinct from the median and the typical range */
  threshold: string;
  source: string;
  tier: string;
  reliability: string;
  geography: string;
  year: string;
  status: "sourced" | "custom" | "unavailable";
  note: string;
  url?: string;
}

export interface Indicator {
  id: string;
  pillar: string;
  name: string;
  max: number;
  /** null = not assessed (never zero) */
  points: Num;
  level: Severity | null;
  actual: string;
  previous: string;
  /** the screening threshold or comparison the value was judged against */
  benchmark: string;
  explanation: string;
  /** false = not applicable to the selected industry (excluded from the score; not zero risk) */
  applicable: boolean;
  relevance: "core" | "standard" | "low" | "na";
  /** industry benchmark context for this indicator */
  bench: IndicatorBench | null;
  /** data this indicator needs when it could not be assessed */
  requires: string[];
  questions: string[];
}

/** a risk pillar: its weight is nominal; points/max are over the indicators that could be assessed */
export interface RiskCategory {
  id: string;
  name: string;
  weight: number;
  max: number; // assessed maximum within this pillar
  points: Num; // null = no indicator in this pillar could be assessed
  severity: Severity;
  prev: string;
  curr: string;
  evidence: string;
  explanation: string;
  questions: string[];
  indicators: Indicator[];
}

export interface RiskResult {
  score: Num; // points earned / points assessable x 100, null if coverage too low
  rawPoints: number;
  maxEvaluated: number;
  classification: Classification;
  /** how far the score can be relied on: separate from the score itself */
  confidence: { level: "High" | "Medium" | "Low"; reasons: string[] };
  /** indicators assessed / total indicators */
  evaluated: number;
  total: number;
  /** share of the 100 points that could be assessed */
  coverage: number;
  categories: RiskCategory[];
  insufficient: boolean;
  warnings: string[];
  /** indicators excluded because they do not apply to the selected industry */
  notApplicable: number;
  industry: { name: string; sub?: string; selected: boolean; focus: string };
}

export interface Alert {
  id: string;
  name: string;
  severity: Severity;
  evidence: string;
  previous: string;
  current: string;
  why: string;
  investigate: string[];
}

export interface AnalysisResult {
  /** all monetary figures in AED millions */
  records: FinancialRecord[];
  metrics: YearMetrics[];
  latest: YearMetrics;
  previous: YearMetrics | null;
  latestRecord: FinancialRecord;
  previousRecord: FinancialRecord | null;
  risk: RiskResult;
  /** screening score one period earlier (needs 3+ years), for change-over-time */
  previousScore: Num;
  /** user-entered adjustments and valuation inputs in force for this run */
  inputs: AssessmentInputs;
  alerts: Alert[];
  missingFields: string[];
  generatedAt: string;
}

/** inputs the investor supplies (AED millions); none are guessed */
export interface AssessmentInputs {
  /** EBITDA adjustment claimed for the latest year, and how well it is supported */
  ebitdaAdjustment?: Num;
  adjustmentStatus?: "verified" | "needs-docs" | "unsupported" | "unexplained";
  enterpriseValue?: Num;
  acquisitionDebt?: Num;
  equityInvested?: Num;
  holdYears?: Num;
  exitMultiple?: Num;
  ebitdaGrowth?: Num; // % a year
  stress?: { revenueDrop: number; marginDrop: number; collectionDelay: number; interestRise: number };
  /** industry preset and any per-metric overrides of the proposed screening thresholds */
  /** target company profile: industry id and optional sub-industry drive the benchmarks and thresholds */
  industry?: string;
  subIndustry?: string;
  currency?: string;
  frequency?: string;
  /** benchmarks the user entered, which override sourced figures */
  customBench?: Record<string, { median?: number | null; low?: number | null; high?: number | null }>;
  thresholds?: Record<string, number[]>;
  /** deal inputs: either the proposed EV or an entry multiple on adjusted EBITDA */
  entryMultiple?: Num;
  /** cash on the target's balance sheet that the deal can use against acquisition debt */
  availableCash?: Num;
  /** overrides total debt − cash from the file (e.g. after adjusting for leases or debt-like items) */
  existingNetDebt?: Num;
  /** cash taxes for the latest year, entered when the file has none (an investor input, not data) */
  cashTaxes?: Num;
  /** cash the business must keep to operate (limits how much released cash is usable) */
  minOperatingCash?: Num;
}

export interface Dataset {
  id: string;
  name: string;
  industry: string;
  synthetic: boolean;
  records: FinancialRecord[]; // raw, as supplied
  unitMultiplier: number; // converts supplied units into AED
  fileName?: string;
  /** currency detected in the uploaded file, if any */
  fileCurrency?: string;
  fileSize?: number;
  uploadedAt?: string;
  inputs?: AssessmentInputs;
}

/** one row in the upload log; kept (marked deleted) after the company itself is removed */
export interface HistoryItem {
  id: string;
  name: string;
  fileName?: string;
  fileSize?: number;
  uploadedAt: string;
  rows: number;
  period: string;
  status: "active" | "deleted";
  analysedAt?: string;
  deletedAt?: string;
}
