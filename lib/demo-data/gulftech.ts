import type { Dataset } from "@/types/finance";

/** SYNTHETIC data. GulfTech Manufacturing LLC is fictional. Figures in AED millions. */
export const GULFTECH: Dataset = {
  id: "gulftech-demo",
  name: "GulfTech Manufacturing LLC",
  industry: "Industrial Manufacturing · Dubai, UAE",
  synthetic: true,
  unitMultiplier: 1_000_000,
  records: [
    { year: 2023, revenue: 412, cogs: 289, ebitda: 62, receivables: 58, inventory: 52, payables: 41, operatingCashFlow: 49, cash: 38, debt: 142 },
    { year: 2024, revenue: 448, cogs: 316, ebitda: 71, receivables: 84, inventory: 71, payables: 44, operatingCashFlow: 38, cash: 31, debt: 168 },
    { year: 2025, revenue: 471, cogs: 337, ebitda: 79, receivables: 112, inventory: 96, payables: 45, operatingCashFlow: 24, cash: 22, debt: 196 },
  ],
};
