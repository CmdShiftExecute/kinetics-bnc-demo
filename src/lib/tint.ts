/**
 * The value tint of the relevance matrix: one defined scale, shared by the heatmap and
 * the interaction gate so the gate predicts exactly the class the page paints.
 *
 * Five steps on a square-root scale of a cell's share of the LARGEST CELL AT ITS OWN
 * LEVEL (sector cells against the largest sector cell, industry against industry, type
 * against type). The square root spreads a register where one sector carries most of the
 * value: a cell at 4 percent of the largest reads step 1, at 16 percent step 2, at 36
 * percent step 3, at 64 percent step 4, and the largest itself step 5. The level maximum
 * is computed from every row of the matrix at that level, never from what is expanded.
 */
export const TINT_STEPS = 5;

export function valueStep(value: number, levelMax: number): number {
  if (value <= 0) return 1;
  const share = Math.sqrt(value / Math.max(1, levelMax));
  return Math.min(TINT_STEPS, Math.max(1, Math.ceil(TINT_STEPS * share)));
}
