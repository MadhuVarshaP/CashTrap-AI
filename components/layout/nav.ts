import { BookOpenText, Calculator, FileText, Gauge, LayoutGrid, Table2 } from "lucide-react";

export const NAV = [
  { href: "/company-analysis", label: "Company Analysis", short: "Analysis", icon: Table2, title: "Company Analysis" },
  { href: "/overview", label: "Overview", short: "Overview", icon: LayoutGrid, title: "Investment Intelligence" },
  { href: "/investment-assessment", label: "Investment Risk Analysis", short: "Risk", icon: Gauge, title: "Investment Risk Analysis" },
  { href: "/cash-impact", label: "Cash Impact Calculator", short: "Cash Impact", icon: Calculator, title: "Cash Impact Calculator" },
  { href: "/due-diligence-report", label: "Due Diligence Report", short: "Report", icon: FileText, title: "Due Diligence Report" },
  { href: "/methodology", label: "Methodology", short: "Method", icon: BookOpenText, title: "Methodology" },
] as const;
