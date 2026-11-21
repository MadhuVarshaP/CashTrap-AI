import type { AnalysisResult, Dataset } from "@/types/finance";
import { analyze } from "@/lib/calculations/analyze";

/**
 * Seam for the future Python FastAPI backend.
 *   POST {API_URL}/analyze     -> AnalysisResult   (calculations + alerts)
 *   POST {API_URL}/investigate -> { sections }     (AI explanations; keys stay server-side)
 * Until NEXT_PUBLIC_API_URL is set, analysis runs locally in the browser.
 */
const API = process.env.NEXT_PUBLIC_API_URL;

export async function analyzeRemote(ds: Dataset): Promise<AnalysisResult | null> {
  if (!API) return analyze(ds);
  const res = await fetch(`${API}/analyze`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ds) });
  if (!res.ok) throw new Error(`Analysis service returned ${res.status}`);
  return res.json();
}
