import { useLayoutEffect, useState } from "react";

// Must match the row and header heights set for .source-preview tables in styles.css.
const ROW_HEIGHT = 32;
const HEADER_HEIGHT = 34;
const SIDEWAYS_SCROLLBAR = 12;
const MIN_ROWS = 3;
const MAX_ROWS = 50;

// How many table rows fit in an element, so the panel can page instead of scroll.
export function useFitRows(ref) {
  const [rows, setRows] = useState(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      const fit = Math.floor((el.clientHeight - HEADER_HEIGHT - SIDEWAYS_SCROLLBAR) / ROW_HEIGHT);
      setRows(Math.min(MAX_ROWS, Math.max(MIN_ROWS, fit)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return rows;
}
