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

export interface RiskCategory {
  id: string;
  name: string;
  max: number;
  points: Num; // null = could not be evaluated
  severity: Severity;
  prev: string;
  curr: string;
  evidence: string;
  explanation: string;
  questions: string[];
}

export interface RiskResult {
  score: Num; // normalised 0-100, null if insufficient
  rawPoints: number;
  maxEvaluated: number;
  classification: Classification;
  evaluated: number;
  total: number;
  categories: RiskCategory[];
  insufficient: boolean;
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
  alerts: Alert[];
  missingFields: string[];
  generatedAt: string;
}

export interface Dataset {
  id: string;
  name: string;
  industry: string;
  synthetic: boolean;
  records: FinancialRecord[]; // raw, as supplied
  unitMultiplier: number; // converts supplied units into AED
  fileName?: string;
}
