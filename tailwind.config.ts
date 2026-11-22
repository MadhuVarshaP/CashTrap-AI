import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        bg2: "rgb(var(--bg2) / <alpha-value>)",
        card: "rgb(var(--card) / <alpha-value>)",
        elev: "rgb(var(--elev) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        line2: "rgb(var(--line2) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        ink2: "rgb(var(--ink2) / <alpha-value>)",
        ink3: "rgb(var(--ink3) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        pos: "rgb(var(--pos) / <alpha-value>)",
        warn: "rgb(var(--warn) / <alpha-value>)",
        crit: "rgb(var(--crit) / <alpha-value>)",
        ai: "rgb(var(--ai) / <alpha-value>)",
      },
      boxShadow: {
        card: "0 1px 2px rgba(30,40,110,.06), 0 14px 30px -16px rgba(50,70,190,.25)",
        lift: "0 2px 4px rgba(30,40,110,.08), 0 24px 44px -18px rgba(70,70,230,.38)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-manrope)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: { card: "18px" },
    },
  },
  plugins: [],
};
export default config;
