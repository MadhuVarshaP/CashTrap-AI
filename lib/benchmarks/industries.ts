import type { Cuts } from "@/lib/calculations/thresholds";

/** how much an indicator matters for an industry. "na" removes it from the score: it is not assessed, not scored as zero. */
export type Relevance = "core" | "standard" | "low" | "na";

export const INDICATOR_IDS = ["adj", "revq", "margin", "vol", "ocf", "fcf", "cons", "dso", "dio", "dpo", "owc", "lev", "int", "dscr", "mat", "liqr", "down", "res"] as const;
export type IndId = (typeof INDICATOR_IDS)[number];

export interface SubIndustry { id: string; name: string; groups: string[] }
export interface IndustryDef {
  id: string;
  name: string;
  /** Damodaran industry groups whose figures describe this industry */
  groups: string[];
  subs: SubIndustry[];
  /** only the indicators that differ from "standard" */
  relevance: Partial<Record<IndId, Relevance>>;
  /** what an investor should watch in this industry */
  focus: string;
  /** proposed screening thresholds that differ from the general defaults (labelled as such everywhere) */
  cuts: Partial<Record<string, Cuts>>;
}

const FIN_NA: Partial<Record<IndId, Relevance>> = { revq: "na", margin: "na", ocf: "na", fcf: "na", cons: "na", dso: "na", dio: "na", dpo: "na", owc: "na", lev: "na", int: "na", dscr: "na", mat: "na", liqr: "na", down: "na", res: "na" };

export const INDUSTRIES: IndustryDef[] = [
  { id: "manufacturing", name: "Manufacturing", groups: ["Machinery", "Electrical Equipment", "Electronics (General)", "Chemical (Specialty)", "Packaging & Container", "Steel", "Paper/Forest Products", "Rubber& Tires", "Aerospace/Defense"],
    subs: [{ id: "machinery", name: "Industrial machinery & equipment", groups: ["Machinery", "Electrical Equipment"] }, { id: "electronics", name: "Electronics & components", groups: ["Electronics (General)"] }, { id: "chemicals", name: "Chemicals & materials", groups: ["Chemical (Specialty)", "Chemical (Basic)", "Chemical (Diversified)"] }, { id: "packaging", name: "Packaging, paper & metals", groups: ["Packaging & Container", "Paper/Forest Products", "Steel"] }],
    relevance: { dio: "core", dso: "core", dpo: "core", owc: "core" },
    focus: "Inventory efficiency, the cash conversion cycle and supplier payment cycles carry the most weight; capex intensity matters for free cash flow.",
    cuts: { dio: [3, 9, 18], ocf: [75, 45, 20], fcf: [40, 20, 0], cr: [1.4, 1.1, 0.8] } },
  { id: "retail", name: "Retail and E-commerce", groups: ["Retail (General)", "Retail (Special Lines)", "Retail (Grocery and Food)", "Retail (Building Supply)", "Retail (Automotive)"],
    subs: [{ id: "grocery", name: "Grocery & food retail", groups: ["Retail (Grocery and Food)"] }, { id: "specialty", name: "Specialty retail", groups: ["Retail (Special Lines)"] }, { id: "general", name: "General merchandise", groups: ["Retail (General)"] }, { id: "homebuild", name: "Home & building supply", groups: ["Retail (Building Supply)"] }],
    relevance: { margin: "core", dio: "core", dpo: "core", owc: "core", dso: "low" },
    focus: "Inventory turnover, gross and operating margins and supplier payment terms dominate; most sales are paid at the till, so receivables matter less.",
    cuts: { dio: [3, 8, 15], ocf: [70, 40, 15], cr: [1.2, 1.0, 0.7], qr: [0.5, 0.3, 0.2] } },
  { id: "wholesale", name: "Wholesale and Distribution", groups: ["Retail (Distributors)", "Food Wholesalers"],
    subs: [{ id: "foodw", name: "Food wholesale", groups: ["Food Wholesalers"] }, { id: "dist", name: "General distribution", groups: ["Retail (Distributors)"] }],
    relevance: { margin: "core", dso: "core", dio: "core", dpo: "core", owc: "core" },
    focus: "Thin margins make working capital the main source of both risk and value: receivables, stock and supplier terms are all central.",
    cuts: { dso: [2, 6, 12], dio: [2, 6, 12], ocf: [70, 40, 15], cr: [1.2, 1.0, 0.8], lev: [2.5, 3.5, 4.5] } },
  { id: "it", name: "Information Technology and Software", groups: ["Software (System & Application)", "Software (Internet)", "Computer Services", "Information Services"],
    subs: [{ id: "saas", name: "Software & SaaS", groups: ["Software (System & Application)"] }, { id: "internet", name: "Internet platforms", groups: ["Software (Internet)"] }, { id: "itservices", name: "IT services", groups: ["Computer Services"] }],
    relevance: { margin: "core", revq: "core", ocf: "core", fcf: "core", dso: "core", dio: "na", dpo: "low" },
    focus: "EBITDA margin, revenue quality and cash conversion matter most. Inventory metrics do not apply. Revenue concentration and recurring-revenue quality need data not in financial statements.",
    cuts: { ocf: [85, 60, 30], fcf: [60, 35, 10], dso: [3, 8, 16], qr: [1.2, 0.9, 0.6], lev: [2.5, 4, 5.5] } },
  { id: "healthcare", name: "Healthcare and Pharmaceuticals", groups: ["Drugs (Pharmaceutical)", "Drugs (Biotechnology)", "Healthcare Products", "Healthcare Support Services", "Hospitals/Healthcare Facilities", "Heathcare Information and Technology"],
    subs: [{ id: "pharma", name: "Pharmaceuticals", groups: ["Drugs (Pharmaceutical)"] }, { id: "biotech", name: "Biotechnology", groups: ["Drugs (Biotechnology)"] }, { id: "devices", name: "Medical products", groups: ["Healthcare Products"] }, { id: "facilities", name: "Hospitals & facilities", groups: ["Hospitals/Healthcare Facilities"] }, { id: "hsvc", name: "Healthcare services", groups: ["Healthcare Support Services"] }],
    relevance: { revq: "core", dso: "core", dio: "low", vol: "core" },
    focus: "Receivables collection (often from insurers or government payers) is central; regulatory and operating-cost risk is not visible in the statements. Inventory relevance depends on the sub-sector.",
    cuts: { dso: [3, 9, 18], ocf: [75, 50, 25] } },
  { id: "construction", name: "Construction and Real Estate", groups: ["Engineering/Construction", "Homebuilding", "Real Estate (Development)", "Construction Supplies", "Real Estate (General/Diversified)", "Real Estate (Operations & Services)"],
    subs: [{ id: "contracting", name: "Engineering & contracting", groups: ["Engineering/Construction"] }, { id: "homebuilding", name: "Homebuilding & development", groups: ["Homebuilding", "Real Estate (Development)"] }, { id: "reops", name: "Real estate operations", groups: ["Real Estate (Operations & Services)", "Real Estate (General/Diversified)"] }],
    relevance: { revq: "core", vol: "core", dso: "core", owc: "core", lev: "core", cons: "core", dio: "low" },
    focus: "Receivables, unbilled revenue and contract assets, and project cash-flow timing dominate. Contract assets are not separate fields in this model, so receivables are the proxy.",
    cuts: { dso: [4, 10, 20], ocf: [65, 35, 10], fcf: [30, 15, 0], lev: [3, 4.5, 6] } },
  { id: "transport", name: "Transportation and Logistics", groups: ["Transportation", "Trucking", "Air Transport", "Transportation (Railroads)", "Shipbuilding & Marine"],
    subs: [{ id: "trucking", name: "Trucking & road freight", groups: ["Trucking"] }, { id: "air", name: "Air transport", groups: ["Air Transport"] }, { id: "rail", name: "Railroads", groups: ["Transportation (Railroads)"] }, { id: "marine", name: "Marine & logistics", groups: ["Shipbuilding & Marine", "Transportation"] }],
    relevance: { fcf: "core", lev: "core", int: "core", dscr: "core", mat: "core", dio: "low", dpo: "low" },
    focus: "Capital intensity: free cash flow after capex, leverage, interest cover and debt service decide resilience. Inventory is minimal.",
    cuts: { lev: [3, 4.5, 6], fcf: [30, 15, 0], ocf: [75, 50, 25], cover: [4, 2.5, 1.5], dscr: [1.4, 1.2, 1.0] } },
  { id: "food", name: "Food and Beverage", groups: ["Food Processing", "Beverage (Soft)", "Beverage (Alcoholic)", "Farming/Agriculture"],
    subs: [{ id: "foodproc", name: "Food processing", groups: ["Food Processing"] }, { id: "bev", name: "Beverages", groups: ["Beverage (Soft)", "Beverage (Alcoholic)"] }, { id: "agri", name: "Farming & agriculture", groups: ["Farming/Agriculture"] }],
    relevance: { dio: "core", margin: "core", owc: "core" },
    focus: "Inventory turns matter because stock can spoil; input-cost pass-through shows up in margin; payables terms with farmers and suppliers affect cash.",
    cuts: { dio: [3, 8, 15], ocf: [75, 50, 25], cr: [1.2, 1.0, 0.8] } },
  { id: "hospitality", name: "Hospitality and Tourism", groups: ["Hotel/Gaming", "Restaurant/Dining", "Recreation"],
    subs: [{ id: "hotels", name: "Hotels & gaming", groups: ["Hotel/Gaming"] }, { id: "restaurants", name: "Restaurants & dining", groups: ["Restaurant/Dining"] }, { id: "recreation", name: "Recreation & leisure", groups: ["Recreation"] }],
    relevance: { fcf: "core", lev: "core", int: "core", cons: "core", vol: "core", dso: "low", dio: "low", dpo: "low" },
    focus: "Seasonality and demand cyclicality make earnings volatility, leverage and capex-heavy free cash flow the key tests. Receivables and inventory are small.",
    cuts: { lev: [3, 4.5, 6], fcf: [35, 15, 0], cr: [1.0, 0.8, 0.6], qr: [0.6, 0.4, 0.3] } },
  { id: "energy", name: "Energy and Utilities", groups: ["Power", "Utility (General)", "Utility (Water)", "Oil/Gas (Integrated)", "Oil/Gas Distribution", "Oil/Gas (Production and Exploration)", "Oilfield Svcs/Equip.", "Green & Renewable Energy"],
    subs: [{ id: "utilities", name: "Utilities (power & water)", groups: ["Power", "Utility (General)", "Utility (Water)"] }, { id: "oilgas", name: "Oil & gas", groups: ["Oil/Gas (Integrated)", "Oil/Gas Distribution", "Oil/Gas (Production and Exploration)"] }, { id: "oilfield", name: "Oilfield services", groups: ["Oilfield Svcs/Equip."] }, { id: "renew", name: "Renewables", groups: ["Green & Renewable Energy"] }],
    relevance: { vol: "core", fcf: "core", lev: "core", int: "core", dscr: "core", mat: "core", res: "core", dio: "low" },
    focus: "Leverage, debt service and maturity profile dominate for these capital-intensive businesses; commodity exposure makes earnings volatility and downside resilience key.",
    cuts: { lev: [4, 5.5, 7], cover: [3.5, 2.5, 1.5], fcf: [30, 15, 0], dscr: [1.4, 1.2, 1.0], ocf: [75, 50, 25] } },
  { id: "telecom", name: "Telecommunications", groups: ["Telecom. Services", "Telecom (Wireless)", "Cable TV", "Telecom. Equipment"],
    subs: [{ id: "tsvc", name: "Telecom services", groups: ["Telecom. Services", "Telecom (Wireless)"] }, { id: "cable", name: "Cable & broadband", groups: ["Cable TV"] }, { id: "tequip", name: "Telecom equipment", groups: ["Telecom. Equipment"] }],
    relevance: { fcf: "core", lev: "core", int: "core", dscr: "core", dio: "low", dpo: "low" },
    focus: "Network capex weighs on free cash flow and leverage is structurally high; stable recurring revenue supports it.",
    cuts: { lev: [3.5, 5, 6.5], cover: [4, 2.5, 1.5], fcf: [30, 15, 0] } },
  { id: "financial", name: "Financial Services", groups: ["Banks (Regional)", "Bank (Money Center)", "Financial Svcs. (Non-bank & Insurance)", "Insurance (General)", "Insurance (Life)", "Insurance (Prop/Cas.)", "Investments & Asset Management", "Brokerage & Investment Banking"],
    subs: [{ id: "banks", name: "Banks", groups: ["Banks (Regional)", "Bank (Money Center)"] }, { id: "insurance", name: "Insurance", groups: ["Insurance (General)", "Insurance (Life)", "Insurance (Prop/Cas.)"] }, { id: "assetmgmt", name: "Asset management & brokerage", groups: ["Investments & Asset Management", "Brokerage & Investment Banking"] }],
    relevance: FIN_NA,
    focus: "Industrial leverage, working-capital and cash-conversion ratios do not describe a bank or insurer. Sector indicators (capital adequacy, non-performing loans, solvency, net interest margin) need data this model does not take, so most indicators are Not Applicable.",
    cuts: {} },
  { id: "professional", name: "Professional and Business Services", groups: ["Business & Consumer Services", "Advertising", "Education", "Environmental & Waste Services", "Office Equipment & Services"],
    subs: [{ id: "bizsvc", name: "Business & consulting services", groups: ["Business & Consumer Services"] }, { id: "advert", name: "Advertising & marketing", groups: ["Advertising"] }, { id: "edu", name: "Education & training", groups: ["Education"] }],
    relevance: { revq: "core", dso: "core", margin: "core", dio: "na", dpo: "low" },
    focus: "Receivables collection and utilisation-driven margins matter; there is little or no inventory.",
    cuts: { dso: [3, 9, 18], ocf: [80, 55, 25] } },
  { id: "consumer", name: "Consumer Goods", groups: ["Household Products", "Apparel", "Shoe", "Furn/Home Furnishings", "Electronics (Consumer & Office)", "Tobacco"],
    subs: [{ id: "household", name: "Household products", groups: ["Household Products"] }, { id: "apparel", name: "Apparel & footwear", groups: ["Apparel", "Shoe"] }, { id: "home", name: "Furniture & home", groups: ["Furn/Home Furnishings"] }],
    relevance: { dio: "core", margin: "core", dso: "core", owc: "core" },
    focus: "Inventory turns, brand-driven margins and retailer payment terms drive working capital.",
    cuts: { dio: [3, 8, 16], dso: [3, 8, 15], ocf: [75, 50, 25] } },
  { id: "automotive", name: "Automotive", groups: ["Auto & Truck", "Auto Parts", "Rubber& Tires", "Retail (Automotive)"],
    subs: [{ id: "oem", name: "Vehicle manufacturers", groups: ["Auto & Truck"] }, { id: "parts", name: "Parts & components", groups: ["Auto Parts", "Rubber& Tires"] }, { id: "autoretail", name: "Automotive retail", groups: ["Retail (Automotive)"] }],
    relevance: { dio: "core", fcf: "core", lev: "core", dpo: "core", owc: "core" },
    focus: "Cyclical demand, capex and inventory financing: stock days, supplier terms, leverage and free cash flow are central.",
    cuts: { dio: [3, 9, 18], lev: [3, 4.5, 6], fcf: [30, 15, 0], ocf: [75, 50, 25] } },
  { id: "other", name: "Other / Custom Industry", groups: [], subs: [],
    relevance: {}, focus: "No industry benchmark is applied. Proposed generic screening thresholds are used; enter your own benchmarks under Thresholds.", cuts: {} },
];

export const industryById = (id?: string) => INDUSTRIES.find((i) => i.id === id);
