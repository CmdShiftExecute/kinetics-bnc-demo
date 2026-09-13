import { useEffect, useRef, useState } from 'react';

/** Measures the wrapper so an SVG chart can be drawn at its real width. */
export function useWidth(initial = 900, min = 300) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) setWidth(Math.max(min, w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [min]);
  return { ref, width };
}
