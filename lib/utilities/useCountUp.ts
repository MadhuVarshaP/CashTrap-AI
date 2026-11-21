"use client";
import { animate } from "framer-motion";
import { useEffect, useRef, useState } from "react";

export function useCountUp(target: number, duration = 0.9) {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const c = animate(from.current, target, { duration, ease: [0.22, 1, 0.36, 1], onUpdate: (x) => { from.current = x; setV(x); } });
    return () => c.stop();
  }, [target, duration]);
  return v;
}
