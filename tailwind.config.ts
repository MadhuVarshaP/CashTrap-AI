import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0A0B0D",
        bg2: "#101216",
        card: "#17191E",
        elev: "#1D2026",
        line: "#292D35",
        ink: "#F5F6F8",
        ink2: "#A2A7B0",
        ink3: "#707681",
        accent: "#3988F5",
        pos: "#35C994",
        warn: "#F5A640",
        crit: "#F06464",
        ai: "#A78BFA",
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
