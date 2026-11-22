"use client";

import clsx from "clsx";
import { useRef } from "react";

/**
 * Gives a card a soft 3D feel: it tilts toward the pointer and lifts with a deeper shadow.
 * Skipped for touch input and for people who prefer reduced motion. Content is never transformed away from readable.
 */
export function Tilt({ children, className, max = 6, as: Tag = "div", ...rest }: { children: React.ReactNode; className?: string; max?: number; as?: "div" | "button"; onClick?: () => void; "aria-pressed"?: boolean; "aria-label"?: string }) {
  const ref = useRef<HTMLDivElement & HTMLButtonElement>(null);
  const ok = () => typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce), (pointer: coarse)").matches;
  const move = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || !ok()) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateX(${(-y * max).toFixed(2)}deg) rotateY(${(x * max).toFixed(2)}deg) translateZ(10px)`;
    el.style.setProperty("--gx", `${(x + 0.5) * 100}%`);
    el.style.setProperty("--gy", `${(y + 0.5) * 100}%`);
  };
  const leave = () => { if (ref.current) ref.current.style.transform = ""; };
  return (
    <Tag ref={ref as never} onPointerMove={move} onPointerLeave={leave} {...rest}
      className={clsx("relative block text-left transition-[transform,box-shadow] duration-200 ease-out [transform-style:preserve-3d] will-change-transform hover:shadow-lift", className)}
      style={{ backgroundImage: "radial-gradient(240px circle at var(--gx, 50%) var(--gy, 0%), rgb(var(--accent) / .07), transparent 60%)" }}>
      {children}
    </Tag>
  );
}
