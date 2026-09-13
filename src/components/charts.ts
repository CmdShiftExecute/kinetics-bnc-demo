/**
 * Shared chart grammar: one readout box sized in mono characters, keyboard steps,
 * and the hover state. Every chart answers a plain pointer move with no click and
 * walks its marks with the arrow keys; Escape clears. The exact figures always sit
 * in a table beside the chart, so the chart may be terse.
 */
import type { KeyboardEvent } from 'react';

/** Mono glyph advance at 11px, used to size a readout box to its text. */
export const CH = 6.8;

export function keyStep(e: KeyboardEvent<SVGSVGElement>, n: number, hover: number | null, set: (i: number | null) => void) {
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    e.preventDefault();
    set(Math.min(n - 1, (hover ?? -1) + 1));
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault();
    set(Math.max(0, (hover ?? n) - 1));
  } else if (e.key === 'Home') {
    e.preventDefault();
    set(0);
  } else if (e.key === 'End') {
    e.preventDefault();
    set(n - 1);
  } else if (e.key === 'Escape') set(null);
}

/** Box geometry for a one-line readout that stays inside the drawing. */
export function readboxAt(text: string, x: number, y: number, width: number): { x: number; y: number; w: number; h: number } {
  const w = Math.min(width, 16 + text.length * CH);
  const h = 22;
  return { x: Math.max(0, Math.min(width - w, x)), y: Math.max(0, y), w, h };
}
