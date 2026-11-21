/** CashCop AI mark: a scope ring whose cash-flow line splits into two diverging paths (profit vs cash). */
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <path d="M26.2 9.6A12 12 0 1 0 28 16" stroke="#F5F6F8" strokeWidth="2" strokeLinecap="round" />
      <path d="M8.5 17.5 14 15l3.6 1.2" stroke="#F5F6F8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17.6 16.2 23.5 9.5" stroke="#35C994" strokeWidth="2" strokeLinecap="round" />
      <path d="M17.6 16.2 23.5 22" stroke="#F06464" strokeWidth="2" strokeLinecap="round" />
      <circle cx="23.5" cy="9.5" r="1.7" fill="#35C994" />
      <circle cx="23.5" cy="22" r="1.7" fill="#F06464" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <div className="leading-none">
      <div className="font-display text-[15px] font-semibold tracking-[0.14em] text-ink">CASHCOP AI</div>
      <div className="mt-1 text-[10px] text-ink3">Find the cash traps.</div>
    </div>
  );
}
