import { useEffect } from "react";

/** collapses an expanded panel again after a while, so screens settle back to their short form */
export function useAutoCollapse(isOpen: boolean, collapse: () => void, ms = 25000) {
  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(collapse, ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, ms]);
}
