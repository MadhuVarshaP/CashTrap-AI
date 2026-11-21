import * as XLSX from "xlsx";
import type { FieldKey, FinancialRecord } from "@/types/finance";

const ALIASES: Record<string, keyof FinancialRecord> = {
  year: "year", fy: "year", fiscalyear: "year",
  revenue: "revenue", sales: "revenue", turnover: "revenue",
  cogs: "cogs", costofgoodssold: "cogs", costofsales: "cogs",
  ebitda: "ebitda",
  receivables: "receivables", accountsreceivable: "receivables", tradereceivables: "receivables",
  inventory: "inventory", inventories: "inventory", stock: "inventory",
  payables: "payables", accountspayable: "payables", tradepayables: "payables",
  operatingcashflow: "operatingCashFlow", ocf: "operatingCashFlow", cashfromoperations: "operatingCashFlow",
  cash: "cash", cashandequivalents: "cash",
  debt: "debt", totaldebt: "debt", borrowings: "debt",
};

export const REQUIRED_COLUMNS = ["Year", "Revenue", "COGS", "EBITDA", "Receivables", "Inventory", "Payables", "Operating_Cash_Flow", "Cash", "Debt"];
const NUM_FIELDS: FieldKey[] = ["revenue", "cogs", "ebitda", "receivables", "inventory", "payables", "operatingCashFlow", "cash", "debt"];

export interface ParseResult {
  records: FinancialRecord[];
  errors: string[];
  warnings: string[];
}

const norm = (s: unknown) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");

export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export async function parseFinancialFile(file: File): Promise<ParseResult> {
  const errors: string[] = [], warnings: string[] = [];
  if (!/\.(csv|xlsx|xls)$/i.test(file.name)) return { records: [], errors: ["Unsupported file type. Upload a .csv or .xlsx file."], warnings };
  if (file.size > MAX_FILE_BYTES) return { records: [], errors: ["File is larger than 5 MB."], warnings };

  let rows: Record<string, unknown>[];
  try {
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: null, raw: true });
  } catch {
    return { records: [], errors: ["The file could not be read. It may be corrupted."], warnings };
  }
  if (!rows.length) return { records: [], errors: ["The file contains no data rows."], warnings };

  const colMap: Record<string, keyof FinancialRecord> = {};
  for (const h of Object.keys(rows[0])) if (ALIASES[norm(h)]) colMap[h] = ALIASES[norm(h)];
  const found = new Set(Object.values(colMap));
  if (!found.has("year")) return { records: [], errors: ["Missing required column: Year."], warnings };
  const absent = (["revenue", "cogs", "ebitda", "receivables", "inventory", "payables", "operatingCashFlow", "cash", "debt"] as const).filter((f) => !found.has(f));
  if (absent.length) warnings.push(`Columns not found: ${absent.join(", ")}. Dependent indicators will be marked unavailable.`);

  const records: FinancialRecord[] = [];
  const seen = new Set<number>();
  rows.forEach((row, idx) => {
    const rec: FinancialRecord = { year: NaN, revenue: null, cogs: null, ebitda: null, receivables: null, inventory: null, payables: null, operatingCashFlow: null, cash: null, debt: null };
    for (const [h, key] of Object.entries(colMap)) {
      const raw = row[h];
      if (key === "year") rec.year = Number(String(raw).replace(/[^0-9]/g, "").slice(0, 4));
      else if (raw == null || raw === "") rec[key] = null;
      else {
        const n = typeof raw === "number" ? raw : Number(String(raw).replace(/[,\s]/g, "").replace(/^\((.*)\)$/, "-$1"));
        if (Number.isFinite(n)) rec[key] = n;
        else { rec[key] = null; warnings.push(`Row ${idx + 2}: "${h}" is not a number and was treated as missing.`); }
      }
    }
    if (!Number.isInteger(rec.year) || rec.year < 1990 || rec.year > 2100) return void errors.push(`Row ${idx + 2}: invalid Year.`);
    if (seen.has(rec.year)) return void errors.push(`Row ${idx + 2}: duplicate year ${rec.year}.`);
    seen.add(rec.year);
    for (const f of ["revenue", "cogs", "receivables", "inventory", "payables"] as const)
      if (rec[f] != null && (rec[f] as number) < 0) warnings.push(`${rec.year}: ${f} is negative, which is unusual.`);
    records.push(rec);
  });
  if (!errors.length && records.length < 2) errors.push("At least two years of data are required to assess trends.");
  return { records: records.sort((a, b) => a.year - b.year), errors, warnings };
}

export const dataQuality = (records: FinancialRecord[]) => {
  const cells = records.length * NUM_FIELDS.length;
  const missing = records.flatMap((r) => NUM_FIELDS.filter((f) => r[f] == null).map((f) => ({ year: r.year, field: f })));
  return { count: records.length, cells, missing, completeness: cells ? (cells - missing.length) / cells : 0 };
};

export const SAMPLE_CSV =
  "Year,Revenue,COGS,EBITDA,Receivables,Inventory,Payables,Operating_Cash_Flow,Cash,Debt\n2023,412,289,62,58,52,41,49,38,142\n2024,448,316,71,84,71,44,38,31,168\n2025,471,337,79,112,96,45,24,22,196\n";
