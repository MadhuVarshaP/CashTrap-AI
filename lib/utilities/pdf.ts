import type { ReportSection, Tag } from "@/lib/calculations/narrative";

const TAG: Record<Tag, { label: string; rgb: [number, number, number] }> = {
  fact: { label: "FACT", rgb: [30, 100, 210] },
  estimate: { label: "ESTIMATE", rgb: [20, 130, 90] },
  assumption: { label: "ASSUMPTION", rgb: [180, 110, 10] },
  missing: { label: "MISSING DATA", rgb: [200, 50, 50] },
  hypothesis: { label: "INTERPRETATION", rgb: [110, 80, 200] },
};

/** the PDF's built-in fonts only cover Latin-1, so typographic symbols are mapped to plain equivalents */
const plain = (s: string) =>
  s.replace(/[−–—]/g, "-").replace(/→/g, "->").replace(/≥/g, ">=").replace(/≤/g, "<=").replace(/≈/g, "~").replace(/[…]/g, "...").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[•●]/g, "-").replace(/×/g, "x").replace(/÷/g, "/");

export interface PdfMeta {
  company: string;
  period: string;
  generated: string;
  score: string;
  coverage: string;
  confidence: string;
}

/** builds the report as a real, text-based PDF in the browser and downloads it; nothing is sent anywhere */
export async function downloadReportPdf(meta: PdfMeta, sections: ReportSection[], fileName: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, H = 297, M = 16, CW = W - 2 * M;
  let y = M;

  const need = (h: number) => { if (y + h > H - 18) { doc.addPage(); y = M; } };
  const para = (text: string, x: number, width: number, size = 9.5, color: [number, number, number] = [40, 44, 52], style: "normal" | "bold" | "italic" = "normal", lh = 4.6) => {
    doc.setFont("helvetica", style); doc.setFontSize(size); doc.setTextColor(...color);
    for (const ln of doc.splitTextToSize(plain(text), width) as string[]) { need(lh); doc.text(ln, x, y); y += lh; }
  };

  // title block
  doc.setFillColor(23, 25, 30); doc.rect(0, 0, W, 40, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(120, 165, 245); doc.text("CASHCOP AI  |  DUE DILIGENCE REPORT", M, 14);
  doc.setFontSize(19); doc.setTextColor(245, 246, 248); doc.text(plain(meta.company), M, 25);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(170, 175, 185);
  doc.text(plain(`${meta.period}   |   Generated ${meta.generated}`), M, 33);
  y = 50;
  const stats: [string, string][] = [["Investment Risk Index", meta.score], ["Model coverage", meta.coverage], ["Confidence", meta.confidence]];
  stats.forEach(([l, v], i) => {
    const x = M + i * (CW / 3);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(120, 125, 135); doc.text(l.toUpperCase(), x, y);
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(30, 34, 42); doc.text(plain(v), x, y + 6);
  });
  y += 16;
  para("Decision support generated from deterministic calculations on the uploaded data. It is not investment advice. It does not recommend buying or rejecting the company, and the risk score is not a probability of failure.", M, CW, 8.5, [100, 105, 115], "italic");
  y += 3;
  // legend
  doc.setFontSize(7.5); let lx = M; need(6);
  (Object.keys(TAG) as Tag[]).forEach((t) => { doc.setFont("helvetica", "bold"); doc.setTextColor(...TAG[t].rgb); doc.text(TAG[t].label, lx, y); lx += doc.getTextWidth(TAG[t].label) + 6; });
  y += 8;

  sections.forEach((s, i) => {
    need(22);
    doc.setDrawColor(215, 218, 224); doc.line(M, y, W - M, y); y += 7;
    para(`${i + 1}. ${s.title}`, M, CW, 13, [20, 24, 32], "bold", 6);
    para(s.question, M, CW, 9, [110, 115, 125], "italic");
    y += 2;
    for (const it of s.items) {
      const tg = TAG[it.tag];
      doc.setFont("helvetica", "bold"); doc.setFontSize(6.8);
      const lines = doc.splitTextToSize(plain(it.text), CW - 26) as string[];
      need(lines.length * 4.4 + 1.5);
      doc.setTextColor(...tg.rgb); doc.text(tg.label, M, y);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9.2); doc.setTextColor(it.tag === "fact" ? 25 : 70, it.tag === "fact" ? 28 : 74, it.tag === "fact" ? 36 : 84);
      lines.forEach((ln, k) => { doc.text(ln, M + 26, y + k * 4.4); });
      y += lines.length * 4.4 + 1.8;
    }
    if (s.flags?.length) {
      s.flags.forEach((fl, n) => {
        need(30); y += 1.5;
        para(`${n + 1}. ${fl.title}  [${fl.level}]`, M, CW, 10, [20, 24, 32], "bold", 5);
        ([["What the indicator shows", fl.shows], ["Why it matters to a PE investor", fl.matters], ["Potential financial implication", fl.implication], ["What to investigate", fl.investigate.join("; ")]] as const).forEach(([k, t]) => {
          para(k.toUpperCase(), M + 4, CW - 4, 7, [120, 125, 135], "bold", 3.8);
          para(t, M + 4, CW - 4, 9, [50, 54, 64], "normal", 4.4);
        });
        y += 1.5;
      });
    }
    y += 5;
  });

  const n = doc.getNumberOfPages();
  for (let p = 1; p <= n; p++) {
    doc.setPage(p); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(140, 145, 155);
    doc.text(plain(`CashCop AI | ${meta.company} | decision support, not investment advice`), M, H - 9);
    doc.text(`Page ${p} of ${n}`, W - M, H - 9, { align: "right" });
  }
  doc.save(fileName);
}
