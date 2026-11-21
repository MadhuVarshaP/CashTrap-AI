import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Manrope } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/lib/state/store";
import { Shell } from "@/components/layout/Shell";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "CashCop AI — Find the cash traps before you invest",
  icons: { icon: "/favicon.svg" },
  description: "Financial due diligence for private equity: find the cash traps before you invest.",
};
export const viewport: Viewport = { themeColor: "#0A0B0D", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable} ${mono.variable}`}>
      <body className="bg-bg font-sans text-ink antialiased">
        <AppProvider>
          <Shell>{children}</Shell>
        </AppProvider>
      </body>
    </html>
  );
}
