import { useInView } from 'motion/react';
import type { RefObject } from 'react';
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

/**
 * Charts that should enter when scrolled to, rather than on mount, take one
 * in-view trigger from their HTML wrapper and drive the marks with variants.
 * Never an IntersectionObserver on an SVG element, and never one per mark:
 * WebKit reports an SVG target once and then never again
 * (w3c/IntersectionObserver#376), so a `whileInView` on a <g> or <rect> leaves
 * every bar at its collapsed entry state for ever on an iPhone. Measured on his
 * phone, 16 Sep 2026: the activity funnel drew its labels and counts and no bars.
 * The wrapper div is always laid out at full size, so its trigger cannot deadlock.
 * `scripts/interactions.ts` refuses a build that puts `whileInView` on anything
 * but an HTML element.
 */
export function useChartEntry(ref: RefObject<Element | null>, reduce: boolean | null) {
  const inView = useInView(ref, { once: true, amount: 'some' });
  return reduce ? {} : { initial: 'hidden' as const, animate: inView ? ('show' as const) : ('hidden' as const) };
}

/** A mark's entry as variants the group drives, on the family's one easing. */
export const mark = (from: Record<string, number>, to: Record<string, number>, delay: number, duration = 0.5) => ({
  variants: { hidden: from, show: { ...to, transition: { duration, delay, ease: CHART_EASE } } },
});
