import type { Dataset } from "@/types/finance";

/** SYNTHETIC data. GulfTech Manufacturing LLC is fictional. Figures in AED millions. */
export const GULFTECH: Dataset = {
  id: "gulftech-demo",
  name: "GulfTech Manufacturing LLC",
  industry: "Industrial Manufacturing · Dubai, UAE",
  synthetic: true,
  unitMultiplier: 1_000_000,
  records: [
    { year: 2023, revenue: 412, cogs: 289, ebitda: 62, receivables: 58, inventory: 52, payables: 41, operatingCashFlow: 49, cash: 38, debt: 142, capex: 30, interestExpense: 11, currentAssets: 156, currentLiabilities: 123, principalRepayment: 14, shortTermDebt: 60 },
    { year: 2024, revenue: 448, cogs: 316, ebitda: 71, receivables: 84, inventory: 71, payables: 44, operatingCashFlow: 38, cash: 31, debt: 168, capex: 38, interestExpense: 13.5, currentAssets: 196, currentLiabilities: 145, principalRepayment: 15, shortTermDebt: 76 },
    { year: 2025, revenue: 471, cogs: 337, ebitda: 79, receivables: 112, inventory: 96, payables: 45, operatingCashFlow: 24, cash: 22, debt: 196, capex: 41, interestExpense: 17, currentAssets: 242, currentLiabilities: 168, principalRepayment: 17, shortTermDebt: 96 },
  ],
};

/** shown until the user uploads a company or loads the demo: no company, no figures */
export const NO_COMPANY: Dataset = { id: "", name: "No company selected", industry: "", synthetic: false, records: [], unitMultiplier: 1_000_000 };
