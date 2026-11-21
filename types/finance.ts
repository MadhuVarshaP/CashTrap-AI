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
  /** indicators assessed / total indicators */
  evaluated: number;
  total: number;
  /** share of the 100 points that could be assessed */
  coverage: number;
  categories: RiskCategory[];
  insufficient: boolean;
  warnings: string[];
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
}

export interface Dataset {
  id: string;
  name: string;
  industry: string;
  synthetic: boolean;
  records: FinancialRecord[]; // raw, as supplied
  unitMultiplier: number; // converts supplied units into AED
  fileName?: string;
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
