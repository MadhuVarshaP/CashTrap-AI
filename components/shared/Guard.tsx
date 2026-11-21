"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useApp } from "@/lib/state/store";
import { Button, EmptyState } from "./ui";
import type { AnalysisResult } from "@/types/finance";

/** Renders children only once the active company has been analysed. */
export function WithAnalysis({ children }: { children: (a: AnalysisResult) => React.ReactNode }) {
  const { analysis, status, active, hasCompany, loadDemo } = useApp();
  if (status === "processing")
    return <EmptyState title="Analysing financials…" body="Computing working-capital metrics and scoring risk." action={<Loader2 className="animate-spin text-accent" />} />;
  if (!hasCompany)
    return (
      <EmptyState
        title="No company loaded yet"
        body="Upload a company's financial statements to see its cash-conversion analysis here. Nothing is shown until you do."
        action={<div className="flex flex-wrap justify-center gap-3"><Link href="/company-analysis"><Button>Upload a company</Button></Link><Button variant="ghost" onClick={loadDemo}>Explore the demo</Button></div>}
      />
    );
  if (!analysis)
    return (
      <EmptyState
        title={`${active.name} hasn't been analysed yet`}
        body="Review the uploaded records and run the analysis to populate this page. Nothing is shown until it is computed from your data."
        action={<Link href="/company-analysis"><Button>Go to Company Analysis</Button></Link>}
      />
    );
  return <>{children(analysis)}</>;
}
