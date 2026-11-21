import * as XLSX from "xlsx";
import type { FieldKey, FinancialRecord } from "@/types/finance";

type Col = "year" | FieldKey;
const ALIASES: Record<string, Col> = {
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

export interface ParseMeta {
  unitMultiplier?: number;
  name?: string;
  synthetic?: boolean;
}

export interface ParseResult {
  records: FinancialRecord[];
  errors: string[];
  warnings: string[];
  /** informational, not problems */
  notes?: string[];
  meta?: ParseMeta;
}

const norm = (s: unknown) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");


// ---------------------------------------------------------------------------
// Statement workbooks: one sheet per statement, line items down, years across.
// ---------------------------------------------------------------------------
type Grid = unknown[][];

const sheetGrid = (wb: XLSX.WorkBook, name: string): Grid | null => {
  const key = wb.SheetNames.find((n) => n.replace(/\s+/g, " ").trim().toLowerCase() === name);
  return key ? XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[key], { header: 1, defval: null, raw: true }) : null;
};
const rowLabel = (r: unknown[]) => String(r[0] ?? "").trim().toLowerCase();
const findRow = (rows: Grid, ...res: RegExp[]) => {
  for (const re of res) { const hit = rows.find((r) => re.test(rowLabel(r))); if (hit) return hit; }
  return undefined;
};

/** column index per year, read from the first header row containing two or more years (FY2024, 31-Dec-2024, …) */
function yearColumns(rows: Grid): Map<number, number> {
  const cols = new Map<number, number>();
  for (const row of rows.slice(0, 12)) {
    const hits = row.flatMap((c, i) => { const m = i > 0 ? /(20\d\d)/.exec(String(c ?? "")) : null; return m ? [[Number(m[1]), i] as const] : []; });
    if (hits.length >= 2) { hits.forEach(([y, i]) => cols.set(y, i)); break; }
  }
  return cols;
}

const num = (row: unknown[] | undefined, col: number | undefined): number | null => {
  const v = row && col != null ? row[col] : null;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
};

export function isStatementWorkbook(wb: XLSX.WorkBook) {
  const names = wb.SheetNames.map((n) => n.toLowerCase());
  return names.includes("income statement") && names.includes("balance sheet");
}

function parseStatements(wb: XLSX.WorkBook): ParseResult {
  const warnings: string[] = [];
  const is = sheetGrid(wb, "income statement")!, bs = sheetGrid(wb, "balance sheet")!, cf = sheetGrid(wb, "cash flow statement");
  const fail = (msg: string): ParseResult => ({ records: [], errors: [msg], warnings });

  const header = is.slice(0, 5).map((r) => String(r[0] ?? "")).join(" ");
  const unitMultiplier = /million|aed\s*m\b/i.test(header) ? 1_000_000 : /'000|thousand/i.test(header) ? 1_000 : 1;
  const meta: ParseMeta = { unitMultiplier, synthetic: /synthetic/i.test(header), name: String(is[0]?.[0] ?? "").trim() || "Uploaded company" };

  const isCols = yearColumns(is), bsCols = yearColumns(bs), cfCols = cf ? yearColumns(cf) : new Map<number, number>();
  const years = [...isCols.keys()].sort((a, b) => a - b);
  if (years.length < 2) return fail("Could not find at least two year columns (e.g. FY2023, FY2024) on the Income Statement.");

  const revenue = findRow(is, /^total revenue/, /^revenue$/, /^(net )?sales/);
  if (!revenue) return fail("The Income Statement has no “Total revenue” row.");
  const cogs = findRow(is, /^total cost of (sales|goods sold|revenue)/, /^cost of (sales|goods sold)/);
  const ebitda = findRow(is, /^ebitda\b/);
  const creditSales = findRow(is, /^credit sales$/), creditPurchases = findRow(is, /^credit purchases$/);
  const cash = findRow(bs, /^cash\b/);
  const rec = findRow(bs, /^trade receivables, net/, /^trade receivables/, /^receivables/);
  const inv = findRow(bs, /^inventories, net/, /^inventor/);
  const pay = findRow(bs, /^trade payables/, /^payables/);
  const debtRows = [findRow(bs, /^short-term (bank )?borrowings/), findRow(bs, /^current portion of (term )?loans/), findRow(bs, /^(term )?loans,? non-current/, /^long-term (debt|borrowings)/)].filter((r): r is unknown[] => !!r);
  const ocf = cf ? findRow(cf, /^net cash (from|generated from|provided by) operating/) : undefined;

  const missing = [["EBITDA", ebitda], ["COGS", cogs], ["receivables", rec], ["inventory", inv], ["payables", pay], ["cash", cash], ["operating cash flow", ocf]].filter(([, r]) => !r).map(([n]) => n);
  if (!debtRows.length) missing.push("debt");
  if (missing.length) warnings.push(`Not found in the workbook: ${missing.join(", ")}. Dependent indicators will be marked unavailable.`);

  const debtAt = (y: number) => {
    const v = debtRows.map((r) => num(r, bsCols.get(y)));
    return v.every((x) => x == null) ? null : v.reduce<number>((s, x) => s + (x ?? 0), 0);
  };
  const abs = (v: number | null) => (v == null ? null : Math.abs(v));

  const records: FinancialRecord[] = years.map((y, i) => {
    const c = isCols.get(y), b = bsCols.get(y);
    const r: FinancialRecord = {
      year: y, revenue: num(revenue, c), cogs: abs(num(cogs, c)), ebitda: num(ebitda, c),
      receivables: num(rec, b), inventory: num(inv, b), payables: num(pay, b),
      operatingCashFlow: num(ocf, cfCols.get(y)), cash: num(cash, b), debt: debtAt(y),
    };
    if (creditSales) r.creditSales = num(creditSales, c);
    if (creditPurchases) r.creditPurchases = num(creditPurchases, c);
    if (i === 0 && bsCols.has(y - 1)) {
      const o = bsCols.get(y - 1);
      r.opening = { receivables: num(rec, o), inventory: num(inv, o), payables: num(pay, o) };
    }
    return r;
  });

  const notes: string[] = [];
  notes.push(`Statement workbook detected: read ${years.length} years from Income Statement, Balance Sheet and Cash Flow sheets (units: ${unitMultiplier === 1_000 ? "AED thousands" : unitMultiplier === 1_000_000 ? "AED millions" : "AED"}).`);
  if (creditSales || creditPurchases) notes.push("Credit sales / credit purchases found and used for DSO / DPO.");
  if (records[0].opening) notes.push(`Opening balances (FY${years[0] - 1}) used so first-year days metrics use averages.`);
  return { records, errors: [], warnings, notes, meta };
}

export const MAX_FILE_BYTES = 5 * 1024 * 1024;

function finish(r: ParseResult): ParseResult {
  if (!r.errors.length && r.records.length < 2) r.errors.push("At least two years of data are required to assess trends.");
  return r;
}

export async function parseFinancialFile(file: File): Promise<ParseResult> {
  const errors: string[] = [], warnings: string[] = [];
  if (!/\.(csv|xlsx|xls)$/i.test(file.name)) return { records: [], errors: ["Unsupported file type. Upload a .csv or .xlsx file."], warnings };
  if (file.size > MAX_FILE_BYTES) return { records: [], errors: ["File is larger than 5 MB."], warnings };

  let rows: Record<string, unknown>[];
  try {
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    if (isStatementWorkbook(wb)) return finish(parseStatements(wb));
    // flat table: use the first sheet that has a Year column
    const sheetRows = (n: string) => XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[n], { defval: null, raw: true });
    const withYear = wb.SheetNames.find((n) => Object.keys(sheetRows(n)[0] ?? {}).some((h) => ALIASES[norm(h)] === "year"));
    rows = sheetRows(withYear ?? wb.SheetNames[0]);
  } catch {
    return { records: [], errors: ["The file could not be read. It may be corrupted."], warnings };
  }
  if (!rows.length) return { records: [], errors: ["The file contains no data rows."], warnings };

  const colMap: Record<string, Col> = {};
  for (const h of Object.keys(rows[0])) if (ALIASES[norm(h)]) colMap[h] = ALIASES[norm(h)];
  const found = new Set(Object.values(colMap));
  if (!found.has("year")) return { records: [], errors: ["Missing required column: Year. Upload a flat table (Year, Revenue, COGS, …) or a workbook with “Income Statement” and “Balance Sheet” sheets."], warnings };
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
