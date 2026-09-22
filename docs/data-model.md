# Data Model

`data/schema.ts` is the one contract every screen, the generator and the reconciliation read from.

## Files on disk

`public/data/rollup.json`, nine project shards holding **4,536 projects**, three party files (consultants, contractors, owners), and `public/data/reconciliation.json`. The private source workbooks and the reference map stay under gitignored `.private/` and are never published.

## Project fields

A `Project` carries the masked reference, name, stage, completion fields, source USD value, city, source location, sector, category, industry, type, attributes, the workbook source, and the recorded owner, consultant and contractor company cells. Alongside these, it carries the separate illustrative fields used by the demo: internal relevance scores, owner-engineer, activity buckets and the ownership decision record.

## The relevance grade scale

`data/rules.ts` converts a grade to a number: High is 8.0, Medium is 5.0, Low is 2.0, no relevance is null. Source project types are mapped deterministically to the nearest demo taxonomy type. Overall relevance is the highest of a project's vertical scores.

## The ownership cascade

Evaluated in five steps, in reference order, so the running counts are reproducible:

1. **Scope floor.** A vertical is eligible for a project only when its score is 4.0 or more.
2. **Stage gate.** Concept and Design projects go to a vertical that sells through consultants. Tender, and Under Construction at 5.0 percent complete or less, go to a vertical that sells through contractors. Under Construction beyond that, and Completed, stay unassigned unless a contractor is already appointed, in which case they still go to a vertical that sells through contractors.
3. **Highest score wins** among the eligible verticals that pass the gate. A tie goes to the vertical with fewer projects already assigned so far, then to the earlier vertical in the published order.
4. **Engineer pick.** Within the winning vertical, the project goes to the engineer with the lowest current pipeline value, so books fill evenly but not equally.
5. **No match, no owner.** A project with no vertical at or above the scope floor, or none that passes the stage gate, has no owner and is counted in the unassigned figure.

Every decision publishes on the project record as `why`: the eligible verticals, the gate that fired, the candidates that passed it, and, on a tie, which half of the rule decided it, "fewer" or "order".

## Workload and capacity

Owning many projects is not the same as being busy. Each owned project earns workload points by its activity band on the engineer's own vertical, from `WORKLOAD_WEIGHTS`: an active pair (quote sent, enquiry generated, profile shared, visit done, reached out) is worth 3, an order received or a quiet pair 1, a closed project 0. `ENGINEER_CAPACITY` is 320 points, set so a handful of the 24 books exceed it. `loadPct` is the workload against capacity, `overloaded` is true above the line. Both are synthetic and both are published on the Data basis page.

## The no-relationship cohort

A firm can sit on the register without an owning relationship. The generator draws that cohort per firm: 60 percent for a firm with no project owned, 20 percent for a firm on three projects or fewer, 5 percent for four to eight, and a larger book always has one. Level, rating and owner are then all null together.

## Activity buckets

Eleven states, highest priority first: Order received, Quote sent, Enquiry generated, Company profile shared, Project closed, Visit done, Reached out, Waiting or follow up, No response, Contractor or consultant not yet awarded, No update. Each project-and-vertical pair carries exactly one, chosen by a weighted draw over a base distribution keyed to the score band, then reshaped by stage and by ownership. Orders received counts as an order this year only when its activity date falls in the fiscal year.

## The "worth chasing now" rule

A project at Tender, or Under Construction at 5.0 percent complete or less, with overall relevance 5.0 or more, and no vertical already in Project closed. The top twenty by value publish on the Overview page.

## The declared source shape

`data/shape.ts` states fourteen ranges the register is meant to resemble, each carrying its basis in words: the owned share, the smallest and largest engineer book, the quiet/order/closed shares of activity pairs, the three party fill rates, the consultant and contractor median and largest book, and the share of firms with no relationship. The generator measures all fourteen before it writes and refuses to write a single file when one is missed; the reconciliation re-measures them from the written files.

## Precision policy

Source values are stored in USD millions to one decimal at project level, and every rollup is a sum of those same values. Relevance scores and percentages use one decimal. Counts and ratings are whole numbers.

## Determinism

A mulberry32 pseudo-random generator seeded at `20260913` drives every random choice, so a re-run with the same seed writes byte-identical files, the same guarantee `bun run stable` checks.

## Reference masking

Real source references are replaced everywhere in the published tree by a seeded fictional id: two country letters plus seven characters (for example `AE22C8L5B`). The map lives in the gitignored `.private/ref-map.json`, written locally by the generator, and is never committed, so a public clone can never restore the real ids. `bun run refs:check` exits non-zero if any real reference reaches a published surface.

## See also

- [Quality gates](quality-gates.md) for how this model is checked.
- [Data basis](08-Data-Basis.md) for the page this model publishes to.
- Back to [README](../README.md).
