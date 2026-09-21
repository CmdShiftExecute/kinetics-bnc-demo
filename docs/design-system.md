# Design System

A print-style Swiss industrial look, shared with its two sibling demos so all three read as one family.

## Type

Two self-hosted faces, through Fontsource: **Archivo Black** for display and headings, **JetBrains Mono** for figures, labels and anything that needs to line up in a column. No third face.

## Color and ink

A paper background carries ink for text and a second print ink, `--spot`, for non-text marks: chart fills, legend swatches, and anything that is data rather than prose. Segment classes (`c-ink`, `c-spot`, `c-ink2`, `c-spot2`, `c-ink3`, `c-hz`) paint both SVG fills and legend swatches from one rule each, so a color only ever has one definition. Hazard red is earned rather than decorative: on the charts, it marks only closed projects. Every text and non-text pairing is checked by `bun run contrast` directly against the stylesheet's own tokens, so the gate cannot drift from what actually ships.

## Charts

Every chart has entry motion from the baseline or the left edge, a pointer readout with keyboard parity (`tabIndex={0}` on every chart, so a keyboard user gets the same hover state a mouse user gets), and, where a second reading of the same data helps, a view switch that remembers its choice per chart. Tooltips are ink on paper with a hard-edged shadow, fixed beside the cursor and never under it.

## View switches

A print-style segmented control, usually top-right of a chart, offering two or three readings of the same underlying data: value against count, book against workload, activity funnel against stage. The state persists per chart for the session.

## Motion

Entry motion draws on real rendered frames, not just a CSS transition class, because a route that only sets a class can look animated in a synthetic test and render static in a real browser. Reduced-motion is a first-class state: a page under `prefers-reduced-motion` renders fully and statically, checked by its own gate with a defeated-motion negative control.

## The phone pass

Every route is checked at a narrow viewport in real mobile Chromium: no sideways scroll, every chart label inside its chart, every data mark drawn once scrolled into view, every tap target sized for a coarse pointer. The gate carries a specific negative control for a WebKit bug: an `IntersectionObserver` on an SVG element reports the element's first scroll-into-view once and never again, so a chart can pass every desktop check that watches a `div` wrapper and still draw nothing the first time a real phone scrolls to it. The fix is drawing on the wrapper's own visibility, not the SVG's, and the gate proves the fix by planting the bug back and confirming the check catches it.

## Keyboard and structure

Every interactive control is reachable and operable from the keyboard: chart hover states, the filter rail, the matrix heatmap's cell-by-cell walk, and the menu system. The interaction gate checks a published cell against a real keyboard walk, not just that a `tabindex` attribute exists.

## See also

- [Quality gates](quality-gates.md) for the contrast and interaction checks that enforce this system.
- Back to [README](../README.md).
