import { ArrowRightLeft, BookOpenText, Calculator, FileText, Gauge, LayoutGrid, Table2 } from "lucide-react";

export const NAV = [
  { href: "/company-analysis", label: "Data & Upload", short: "Data", icon: Table2, title: "Data & Upload" },
  { href: "/overview", label: "Overview", short: "Overview", icon: LayoutGrid, title: "Investment Overview" },
  { href: "/investment-assessment", label: "Investment Risk", short: "Risk", icon: Gauge, title: "Investment Risk Analysis" },
  { href: "/cash-impact", label: "Cash Impact", short: "Cash", icon: Calculator, title: "Working Capital Cash Release" },
  { href: "/ebitda-cash-bridge", label: "EBITDA-to-Cash Bridge", short: "Bridge", icon: ArrowRightLeft, title: "EBITDA-to-Cash Bridge" },
  { href: "/due-diligence-report", label: "Due Diligence Report", short: "Report", icon: FileText, title: "Due Diligence Report" },
  { href: "/methodology", label: "Methodology", short: "Method", icon: BookOpenText, title: "Methodology" },
] as const;

/** the four primary categories. Everything else is a module reached inside a category. */
export interface NavItem { label: string; href: string }
export interface NavGroup { id: string; label: string; icon: typeof LayoutGrid; href: string; items: NavItem[]; /** pages shown as tabs inside the category */ tabs: NavItem[] }

export const GROUPS: NavGroup[] = [
  { id: "overview", label: "Investment Overview", icon: LayoutGrid, href: "/company-analysis",
    items: [{ label: "Data & upload", href: "/company-analysis" }, { label: "Investment dashboard", href: "/overview" }],
    tabs: [{ label: "Data & upload", href: "/company-analysis" }, { label: "Dashboard", href: "/overview" }] },
  { id: "analysis", label: "Financial Analysis", icon: Gauge, href: "/investment-assessment",
    items: [{ label: "Investment Risk Analysis", href: "/investment-assessment" }, { label: "EBITDA-to-Cash Bridge", href: "/ebitda-cash-bridge" }, { label: "Working Capital Cash Impact", href: "/cash-impact" }],
    tabs: [{ label: "Investment Risk Analysis", href: "/investment-assessment" }, { label: "EBITDA-to-Cash Bridge", href: "/ebitda-cash-bridge" }, { label: "Working Capital Cash Impact", href: "/cash-impact" }] },
  { id: "ai", label: "AI Due Diligence", icon: FileText, href: "/due-diligence-report",
    items: [],
    tabs: [] },
];

export const groupFor = (path: string) => GROUPS.find((g) => g.items.some((i) => path === i.href.split("#")[0]) || path === g.href);
