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
/** optional columns used by the Investment Risk Analysis pillars */
type OptKey = "capex" | "interestExpense" | "currentAssets" | "currentLiabilities" | "principalRepayment" | "shortTermDebt";
const OPT_ALIASES: Record<string, OptKey> = {
  capex: "capex", capitalexpenditure: "capex", capitalexpenditures: "capex",
  interestexpense: "interestExpense", cashinterestexpense: "interestExpense", financecosts: "interestExpense", interest: "interestExpense",
  currentassets: "currentAssets", currentliabilities: "currentLiabilities",
  scheduledprincipalrepayment: "principalRepayment", principalrepayment: "principalRepayment", scheduledprincipal: "principalRepayment",
  shorttermdebt: "shortTermDebt", debtdue12months: "shortTermDebt", currentportionofdebt: "shortTermDebt",
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
  for (const row of rows.slice(0, 20)) {
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
  const capexRow = cf ? findRow(cf, /^purchase of (property|plant|fixed)/, /^capital expenditure/, /^(additions to|acquisition of) (property|fixed)/) : undefined;
  const interestRow = findRow(is, /^finance costs?$/, /^interest expense/, /^finance expense/);
  const caRow = findRow(bs, /^total current assets/), clRow = findRow(bs, /^total current liabilities/);
  const cpRow = findRow(bs, /^current portion of (term )?loans/), stRow = findRow(bs, /^short-term (bank )?borrowings/);

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
    if (capexRow) { const v = num(capexRow, cfCols.get(y)); r.capex = v == null ? null : Math.abs(v); }
    if (interestRow) { const v = num(interestRow, c); r.interestExpense = v == null ? null : Math.abs(v); }
    if (caRow) r.currentAssets = num(caRow, b);
    if (clRow) r.currentLiabilities = num(clRow, b);
    if (cpRow) r.principalRepayment = num(cpRow, b); // current portion of term loans = principal due in the next 12 months
    if (cpRow || stRow) { const v = [num(stRow, b), num(cpRow, b)]; r.shortTermDebt = v.every((x) => x == null) ? null : v.reduce<number>((t, x) => t + (x ?? 0), 0); }
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


// ---------------------------------------------------------------------------
// Provider exports (e.g. S&P Capital IQ "Financial Highlights"): one sheet, line items
// down column A, fiscal years across ("2024 FY"), currency and magnitude in the header.
// ---------------------------------------------------------------------------

function parseWide(wb: XLSX.WorkBook): ParseResult | null {
  for (const name of wb.SheetNames) {
    const rows: Grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: null, raw: true });
    const cols = yearColumns(rows);
    if (cols.size < 2) continue;
    const find = (...res: RegExp[]) => findRow(rows, ...res);
    const revenue = find(/^total revenue/, /^revenue$/, /^(net )?sales/);
    if (!revenue) continue;

    const head = rows.slice(0, 14).map((r) => String(r[0] ?? "")).join(" | ");
    const magnitude = /magnitude:\s*billions?/i.test(head) ? 1_000_000_000 : /magnitude:\s*thousands?/i.test(head) ? 1_000 : /magnitude:\s*millions?/i.test(head) || /million|\bdhs?\.?\s*m\b/i.test(head) ? 1_000_000 : 1;
    const currency = /currency:\s*([^|(]*?)\s*(\((\w{3})\))?\s*(\||$)/i.exec(head)?.[3] ?? "";
    const title = String(rows.find((r) => /\|/.test(String(r[0] ?? "")))?.[0] ?? "");
    const meta: ParseMeta = { unitMultiplier: magnitude, synthetic: false, name: title.split("|")[0].trim() || name };

    const gross = find(/^gross profit$/), cogsRow = find(/^(total )?cost of (goods sold|revenue|sales)/);
    const ebitda = find(/^ebitda$/), ocf = find(/^cash from ops/, /^net cash (from|provided by) operating/);
    const cash = find(/^cash (&|and) short-term investments/, /^cash\b/), debt = find(/^total debt$/);
    const dso = find(/^avg\.? days sales out/), dio = find(/^avg\.? days inventory out/), dpo = find(/^avg\.? days payable/);
    const capexRow = find(/^capital expenditure/), curRatio = find(/^current ratio/), quickRatio = find(/^quick ratio/), covRow = find(/^ebitda \/ interest expense/);
    const rec = find(/^(trade )?(accounts )?receivables(, net)?$/), inv = find(/^inventor(y|ies)(, net)?$/), pay = find(/^(trade )?(accounts )?payables$/);

    const years = [...cols.keys()].sort((a, b) => a - b);
    const days = (row: unknown[] | undefined, y: number) => num(row, cols.get(y));
    const records: FinancialRecord[] = years.map((y) => {
      const c = cols.get(y);
      const rev = num(revenue, c), gp = num(gross, c);
      const cogs = num(cogsRow, c) != null ? Math.abs(num(cogsRow, c)!) : rev != null && gp != null ? rev - gp : null;
      const r: FinancialRecord = {
        year: y, revenue: rev, cogs, ebitda: num(ebitda, c),
        receivables: num(rec, c), inventory: num(inv, c), payables: num(pay, c),
        operatingCashFlow: num(ocf, c), cash: num(cash, c), debt: num(debt, c),
      };
      const cx = num(capexRow, c);
      if (capexRow) r.capex = cx == null ? null : Math.abs(cx);
      if (curRatio) r.reportedCurrentRatio = num(curRatio, c);
      if (quickRatio) r.reportedQuickRatio = num(quickRatio, c);
      // interest isn't in the export, but EBITDA ÷ interest is: back it out when the provider gives a number ("NM"/"NA" = none)
      const cov = num(covRow, c);
      if (covRow) r.interestExpense = cov != null && cov > 0 && r.ebitda != null ? r.ebitda / cov : null;
      // the export has reported days rather than balances: keep the days, and back out an implied balance for display
      const d = { s: days(dso, y), i: days(dio, y), p: days(dpo, y) };
      if (d.s != null) { r.reportedDso = d.s; if (r.receivables == null && rev != null) r.receivables = (d.s * rev) / 365; }
      if (d.i != null) { r.reportedDio = d.i; if (r.inventory == null && cogs != null) r.inventory = (d.i * cogs) / 365; }
      if (d.p != null) { r.reportedDpo = d.p; if (r.payables == null && cogs != null) r.payables = (d.p * cogs) / 365; }
      return r;
    });

    const warnings: string[] = [];
    const gaps = [["receivables / DSO", dso || rec], ["inventory / DIO", dio || inv], ["payables / DPO", dpo || pay], ["EBITDA", ebitda], ["operating cash flow", ocf], ["cash", cash], ["debt", debt]].filter(([, r]) => !r).map(([n]) => n);
    if (gaps.length) warnings.push(`Not found in the file: ${gaps.join(", ")}. Dependent indicators will be marked unavailable.`);
    if (!dpo && !pay) warnings.push("No payables or days-payable data in this export, so DPO and the cash conversion cycle can't be computed.");
    if (records.some((r) => r.reportedDio == null && r.inventory == null)) warnings.push("Inventory days are 'NA' for some years (service / software business): the inventory indicator is skipped for those years.");
    if (currency && currency !== "AED") warnings.push(`File currency is ${currency}. Figures are shown as-is and labelled AED: convert first if you need AED.`);

    const notes = [`Provider export detected (${meta.name}): read ${years.length} fiscal years from “${name}” (${magnitude === 1_000_000 ? "millions" : magnitude === 1_000 ? "thousands" : magnitude === 1_000_000_000 ? "billions" : "units"}${currency ? `, ${currency}` : ""}).`,
      "DSO / DIO are the provider's reported averages; COGS is Revenue − Gross Profit."];
    return { records, errors: [], warnings, notes, meta };
  }
  return null;
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
    const hasYearHeader = wb.SheetNames.some((n) => Object.keys(XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[n], { defval: null })[0] ?? {}).some((h) => ALIASES[norm(h)] === "year"));
    if (!hasYearHeader) { const wide = parseWide(wb); if (wide) return finish(wide); }
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
  const optMap: Record<string, OptKey> = {};
  for (const h of Object.keys(rows[0])) if (OPT_ALIASES[norm(h)]) optMap[h] = OPT_ALIASES[norm(h)];
  const found = new Set(Object.values(colMap));
  if (!found.has("year")) return { records: [], errors: ["Missing required column: Year. Upload a flat table (Year, Revenue, COGS, …), a workbook with “Income Statement” and “Balance Sheet” sheets, or an S&P Capital IQ Financial Highlights export."], warnings };
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
    for (const [h, key] of Object.entries(optMap)) {
      const raw = row[h];
      const n = raw == null || raw === "" ? NaN : typeof raw === "number" ? raw : Number(String(raw).replace(/[,\s]/g, "").replace(/^\((.*)\)$/, "-$1"));
      rec[key] = Number.isFinite(n) ? (key === "capex" ? Math.abs(n) : n) : null;
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
