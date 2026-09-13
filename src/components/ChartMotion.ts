/**
 * The one easing and the two entry shapes every chart uses. Marks animate with
 * `animate` (not `whileInView`) so a chart whose data changes under a filter tweens
 * to its new shape instead of re-entering, and a mark whose entry state collapses it
 * can never deadlock an intersection observer (the MIS measured that on 13 Sep 2026).
 */
export const CHART_EASE = [0.16, 1, 0.3, 1] as const;

/** Grow a bar from the left: scaleX from 0 with its origin at the bar's own left edge. */
export const growX = (delay: number, reduce: boolean | null) => (reduce ? {} : { initial: { scaleX: 0 }, animate: { scaleX: 1 }, transition: { duration: 0.55, delay, ease: CHART_EASE } });

/** A column rising from the baseline: y and height tween, so a data change under a filter re-shapes the column in place. */
export const riseTo = (y: number, height: number, baseline: number, delay: number, reduce: boolean | null) =>
  reduce ? { y, height } : { initial: { y: baseline, height: 0 }, animate: { y, height }, transition: { duration: 0.5, delay, ease: CHART_EASE } };

export const fadeIn = (delay: number, reduce: boolean | null) => (reduce ? {} : { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.35, delay, ease: CHART_EASE } });
