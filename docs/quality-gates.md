# Quality Gates

Every gate below is a real command in this repository, not a description of one.

## Reference masking

`bun run refs:check` exits 1 if any real market-register reference appears in a published surface. `bun run refs:mask` and `bun run refs:restore` are exact inverses, both idempotent, so the working tree is either fully masked (the state that gets committed) or fully restored (the state used to generate locally), never a mix.

## Reconciliation

`bun run reconcile` re-reads the written JSON files, independently of the generator's own in-memory checks, and publishes **4,189 assertions across 15 categories**: Shards and register, Precision policy, Relevance matrix, Ownership cascade, Descriptions, Engineers, Verticals, Headline figures, Sector by stage, Activity funnel, Worth chasing, Consultants and contractors, Matrix summary, Party summary, and Source shape. Every one currently passes, and the result renders live on the Data basis page. Five deliberate corruptions are the gate's negative controls: a description that drops the MEP consultant, a tie rule flipped, a half-recorded relationship, a workload off by one with its verdict flipped, and a shape measurement pushed 30 points off. Each one fails the gate, which is how the gate proves it is actually checking something.

## Validation at the boundary

`src/lib/validate.ts` checks the published data before the register cache is populated, and it checks all of it, every row of every file rather than a sample: each field's type, the closed vocabularies, the multi-vertical score, bucket and date vectors, the score and bucket domains, the tie record's internal consistency, and the whole-or-absent relationship state. `validateReferences` in `src/lib/register.ts` then resolves every party id, project reference, engineer slug and vertical index across files.

## Byte-stability

`bun run stable` hashes every file under `public/data`, runs the generator and the reconciliation again, hashes again, and fails on any file that changed, appeared or disappeared between the two runs. This is the machine's own proof that the register is a pure function of its seed.

## Types and lint

`bun run typecheck` runs the TypeScript compiler across the project in strict mode and fails on any type error. `bun run lint` runs oxlint across the source.

## Contrast

`bun run contrast` reads the color tokens directly out of `src/styles/index.css`, so it cannot drift from the stylesheet, and fails if any text pair falls below a 4.5:1 contrast ratio or any non-text mark falls below 3:1.

## Interactions

`bun scripts/interactions.ts` drives a real, served build with Playwright: structure at three viewport widths including a phone width, the filter rail and chips against the same predicate the page itself uses, sorting, the matrix heatmap and its click-through to a filtered register, keyboard traversal, and resilience paths (a missing shard, a malformed rollup, an unknown route). Every positive check carries a negative control that must fail before the positive is trusted: a defeated hover rule, a chart that ignores the pointer, a broken filter prediction, a reduced-motion page that must render static, and a removed matrix cell the alignment gate must report. The gate runs **194 checks** against a served build.

## Screenshots and performance

`bun run screenshots` captures every route at desktop, laptop and phone widths, plus filtered and rolled-up views, waits for fonts and animation to settle, and fails on any console error or a document wider than its viewport. `scripts/perf_probe.ts` loads the Projects page's windowed table, measures time to the first drawn row against a budget, then scrolls for four seconds and records frame-interval timing.

## The commit and push gate

`scripts/scan_staged.sh` refuses a commit, a commit message or a push that carries a credential shape or an em or en dash. `scripts/install_hooks.sh` wires it into git as the pre-commit, commit-msg and pre-push hooks for a clone, once.

## The full chain

`bun run check` runs `refs:check`, `data`, `reconcile`, `stable`, `typecheck`, `lint`, `motion`, `build`, `contrast`, then `refs:check` again, in that order.

## See also

- [Data model](data-model.md) for what the reconciliation and validation gates are checking against.
- [Data basis](08-Data-Basis.md) for where the reconciliation result is published.
- Back to [README](../README.md).
