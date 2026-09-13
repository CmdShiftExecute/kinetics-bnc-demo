# Halvard Project Intelligence System demo (kinetics-bnc-demo)

## What this is

This is a zero-backend Project Intelligence System demo for a fictional engineering group, Halvard Engineering Group, Building Technologies Division. It is a static Vite and React application sitting on top of finished JSON tables: a market register of 3,500 construction projects, a relevance matrix of 80 rows against ten Halvard verticals, and the consultants, contractors and developers that sit on those projects. Nothing is computed in the browser except sorting, filtering and CSV export; every score, owner and activity state is decided once, by the generator, and the browser only reads it. All data is synthetic, generated from one seed. No real company, project, person or figure appears anywhere in this repository. It is the sibling of the Kinetics MIS demo (port 926) and the Kinetics WMS demo (port 927) and shares their Swiss Industrial Print design system. It is live at https://node-ss.tail640a1e.ts.net:928/.

The system answers one question a sales desk actually asks: of everything being built in the market right now, which projects matter to us, who already owns the relationship, and how far has that relationship gone. The register never says "buy from us"; it says which vertical a project is relevant to and how relevant, and a separate ownership rule decides who inside Halvard is carrying it.

## Routes

| Route | Description |
|---|---|
| `/` | Overview: the headline strip (projects in register, projects owned, pipeline value owned, open enquiries and quotes, orders received this year, no-owner count), then where the value sits by sector and stage, who owns what by vertical, the top twenty worth-chasing projects, and the full activity funnel across every project-and-vertical pair. |
| `/relevance` | The relevance matrix as a heatmap: 80 rows of sector, industry and project type down the side, the ten verticals across the top, a side panel that explains the grade scale and reads the cell under the pointer. Clicking a cell opens the Projects page filtered to it. |
| `/projects` | The full register with a filter rail, removable chips, an always-visible count and value, sortable columns, a column chooser and CSV export. All filter state lives in the URL, so any view is a shareable link. |
| `/engineers` | One block per engineer, grouped by vertical, ruled like a printed ledger: their owned count, pipeline value and activity funnel. |
| `/engineers/:slug` | One engineer's book: their figures, their funnel, their full project table, and the consultants and contractors they hold. |
| `/parties` | The "who is the door in" page: pick a consultant or contractor and see its relationship level and rating, the engineer who owns it, the projects it sits on, the verticals in play, and the other firms it shares projects with. |
| `/p/:ref` | One project's page: identity, value, the four party slots, the ten vertical scores, the owner and the cascade step that decided it, the activity bucket per vertical, and the generated description. |
| `/data-basis` | Data basis: the reporting basis, the relevance grade scale, the ownership cascade, the activity buckets, the precision policy, the synthetic assumptions, the machine's own reconciliation result, and the definitions. |
| `*` | Not found. |

## Run it

1. `bun install` installs dependencies.
2. `bun run verticals` imports the ten verticals and the 24 engineers from the MIS demo's published index into `data/verticals.json` and `data/engineers.json`. This is a one-shot import, not a build-time dependency; both files are committed, and re-running it only matters if the MIS roster changes.
3. `bun run data` runs the generator, `scripts/generate_demo_data.ts`, and writes `public/data/rollup.json`, one file per sector shard under `public/data/projects/`, and `public/data/parties/{consultants,contractors,owners}.json`.
4. `bun run reconcile` re-reads the written files and asserts every cross-table equality and every derived rule, then writes `public/data/reconciliation.json`. This is the result shown on the Data basis page.
5. `bun run stable` hashes every published file, re-runs the generator and the reconciliation, hashes again, and fails if anything differs, is added or is removed: the byte-stability gate.
6. `bun run typecheck` runs the TypeScript compiler in strict mode with no emitted output.
7. `bun run lint` runs oxlint.
8. `bun run build` runs the typecheck and then the Vite production build.
9. `bun run preview` serves the built site at `127.0.0.1:4182`.
10. `bun run contrast` measures the WCAG contrast of every text and surface pair the stylesheet defines, reading the tokens directly from `src/styles/index.css`.
11. `bun scripts/interactions.ts --base <origin> [--insecure]` runs the interaction, keyboard, structure and resilience gate against a served build. `--insecure` skips certificate checks when the origin is self-signed.
12. `bun run screenshots` captures every route at desktop, laptop and phone widths, plus the Projects page filtered and the matrix rolled up to sector level.
13. `bun scripts/perf_probe.ts [--base <origin>] [--path /projects]` loads the Projects page (3,500 windowed rows), measures time to first drawn row, then scrolls for four seconds in a real Chromium and records frame timing. It is run directly, not through a package script.
14. `bun run check` chains `data`, `reconcile`, `stable`, `typecheck`, `lint`, `build` and `contrast`, in that order.
15. `bash scripts/install_hooks.sh` once per clone. It points this clone's git hooks at `scripts/scan_staged.sh`, so the scan runs itself before every commit, on every commit message, and before every push.
16. `bash scripts/scan_staged.sh [--tree]` runs the scan by hand: with no argument it checks the staged diff, `--tree` checks every tracked file instead.

`bun x playwright install chromium` installs the Chromium build the interaction gate, the screenshot script and the performance probe all drive. Run it once before the first use of any of the three. The dev server binds `127.0.0.1:5182`; preview binds `127.0.0.1:4182`, one port pair up from the MIS demo's 5180/4180, so both can run on the same box at once.

## Data schema

`data/schema.ts` is the one contract every screen, the generator and the reconciliation read from.

`Meta` carries the company, division and system name, the data-as-of date and its label, the fiscal year, currency, unit, seed and the register's own name ("the market register"). `Vertical` is a slug, a name and a channel: `consultants`, `contractors`, or `both`, the route by which that vertical reaches a project. `Engineer` is a slug, a name and the vertical it sits on. `MatrixRow` is one `(sector, industry, type)` combination with a grade per vertical, `High`, `Medium`, `Low` or null. `Project` is one row of the market register: its reference, name, stage, completion percent (recorded under construction only), completion date, value, city, sector, category, industry, type, attributes, up to two owners, up to two lead consultants, an MEP consultant, up to two main contractors, an MEP contractor, a generated description, a last-updated date, its ten vertical scores, which of those scores were hand-adjusted off the matrix grade, the overall (highest) score, the owning vertical and engineer, the `OwnerWhy` record of how the cascade decided it, a bucket code per vertical, and an activity date per vertical. `Shard` is one sector's file: its path, sector, project count and value. `Party` is a consultant or contractor: kind, role (`lead`, `mep` or `both`), the verticals it matters to, its relationship level, its rating, the engineer who owns the relationship, its project count and value, and the list of project references. `Owner` is a developer id and name. `KpiStrip`, `SectorStageCell`, `ChaseRow`, `VerticalSummary`, `EngineerSummary` and `MatrixCellRollup` are the rolled-up shapes each report reads. `Rollup` is the front-page data: `meta`, `verticals`, `engineers`, `matrix`, `matrixRows`, `shards`, `kpis`, `sectorStage`, `chase`, `verticalSummary`, `engineerSummary`, the two funnels, `parties`, the grade scale, the scope floor, the buying-completion floor, `definitions`, `precisionPolicy`, `assumptions`, `cascade`, `bucketRule` and `distributions`. `Reconciliation` is the shape `reconcile.ts` writes: the policy lines, the categories with their pass counts, and the full list of assertions.

Files on disk: `public/data/rollup.json` (everything above except individual projects), `public/data/projects/<sector>[-n].json` (one file per shard: Urban Construction in 4 shards, Industrial, Oil Gas and Fuels, Transport and Utilities in one each, 8 shards holding 3,500 projects), `public/data/parties/consultants.json`, `contractors.json` and `owners.json` (795 consultants, 667 contractors and 1,032 developers that sit on at least one project), and `public/data/reconciliation.json` (written by the reconcile step).

Units: money is AED million to one decimal. Scores are 0.0 to 8.0 to one decimal, or null where the matrix has no grade for that type. Percentages are plain numbers to one decimal, so 69.1 means 69.1 percent. Counts are whole. Ratings are whole numbers from 1 to 10. No published file carries a generation timestamp, so a re-run writes byte-identical files. Every date is a calendar date, stated as of 12 Sep 2026; nothing published is UTC.

## The rules the generator encodes

Invented names, checked against a list. Every name other than the ten verticals and the 24 engineers, which are imported from the MIS demo, is built from invented syllables and checked against `scripts/forbidden_terms.txt` before it is used. This is the same discipline the sibling demos use for supplier and material-group names.

The relevance grade scale, `data/rules.ts`. A grade converts to a number: High is 8.0, Medium is 5.0, Low is 2.0, no relevance is null. About 8 percent of projects carry a hand-adjusted score, nudged from the matrix grade so a table is not simply the grade repeated 3,500 times; a nearest-grade reading of a hand-adjusted score still respects the same 6.5 and 3.5 boundaries the matrix itself would produce. Overall relevance is the highest of a project's ten scores.

The ownership cascade, evaluated in five steps, in reference order so the running counts are reproducible.

1. **Scope floor.** A vertical is eligible for a project only when its score is 4.0 or more.
2. **Stage gate.** Concept and Design projects go to a vertical that sells through consultants. Tender, and Under Construction at 5.0 percent complete or less, go to a vertical that sells through contractors. Under Construction beyond that, and Completed, stay unassigned unless a contractor is already appointed, in which case they still go to a vertical that sells through contractors.
3. **Highest score wins** among the eligible verticals that pass the gate. A tie goes to the vertical with fewer projects already assigned so far, then to the earlier vertical in the published order.
4. **Engineer pick.** Within the winning vertical, the project goes to the engineer with the lowest current pipeline value, so books fill evenly but not equally.
5. **No match, no owner.** A project with no vertical at or above the scope floor, or none that passes the stage gate, has no owner and is counted in the unassigned figure.

Every decision is published on the project record as `why`: the eligible verticals, the gate that fired, the candidates that passed it, and whether a tie was broken.

The activity buckets, eleven of them, highest priority first: Order received, Quote sent, Enquiry generated, Company profile shared, Project closed, Visit done, Reached out, Waiting or follow up, No response, Contractor or consultant not yet awarded, No update. Each project-and-vertical pair carries exactly one, chosen by a weighted random draw over a base distribution keyed to the score band (none, low, medium, high), then reshaped by the project's stage (a Concept or Design project leans toward "not yet awarded" and away from orders; a Completed project leans toward orders and closed, and away from enquiries) and by ownership (an owned pair leans toward the active states and away from "no update"). Orders received counts as an order this year only when its activity date falls in the fiscal year.

The "worth chasing now" rule: a project at Tender, or Under Construction at 5.0 percent complete or less, with overall relevance 5.0 or more, and no vertical already in Project closed. The top twenty by value are published on the Overview page.

The precision policy. Money is AED million to one decimal at the project level, rounded once; every rollup is a sum of those one-decimal figures, carried in tenths, so tables that show the same figure tie exactly. Relevance scores are one decimal from 0.0 to 8.0. Percentages are one decimal from the underlying sums, never from other percentages. Counts and ratings are whole numbers.

Party relationships are derived from the register, not invented separately. A consultant or contractor's verticals are the ones graded Medium or High on the projects it actually sits on, by count; its relationship level and rating are drawn with larger books leaning senior; its relationship owner is the engineer who owns most of that party's projects.

The generator's own assumptions, published verbatim on the Data basis page: 3,500 projects drawn over 80 sector, industry and project-type rows, with Urban Construction about three quarters of the register, Industrial about a tenth, and Oil, Gas and Fuels, Transport and Utilities sharing the rest; project values follow a wide log-normal in AED million, scaled by project type and capped at AED 60,000.0 million; stages weight toward Under Construction and Design, with four completed bands covering a quarter of the register; completion percent is recorded for under-construction rows only, and most of those carry 0.0 until a site report arrives.

Determinism. A mulberry32 pseudo-random generator seeded at 20260913 drives every random choice, so a re-run with the same seed writes byte-identical files: the same guarantee `bun run stable` checks.

## Gates

`bun run reconcile` re-reads the written JSON files, independently of the generator's own in-memory checks, and publishes 2,562 assertions across 11 categories: Shards and register, Precision policy, Relevance matrix, Ownership cascade, Engineers, Verticals, Headline figures, Sector by stage, Activity funnel, Worth chasing, and Consultants and contractors. Every one currently passes, and the result renders on the Data basis page.

`bun run stable` hashes every file under `public/data`, runs the generator and the reconciliation again, hashes again, and fails on any file that changed, appeared or disappeared between the two runs. This is the machine's own proof that the register is a pure function of its seed.

`bun run typecheck` runs the TypeScript compiler across the project in strict mode and fails on any type error.

`bun run lint` runs oxlint across the source.

`bun run contrast` reads the color tokens directly out of `src/styles/index.css`, so it cannot drift from the stylesheet, and fails if any text pair falls below a 4.5 to 1 contrast ratio or any non-text mark falls below 3 to 1.

`bun scripts/interactions.ts` drives a real, served build with Playwright: structure at three viewport widths, the filter rail and chips against the same predicate the page itself uses (`src/lib/filters.ts`), sorting, the matrix heatmap and its click-through to a filtered register, keyboard traversal, and the resilience paths (a missing shard, a malformed rollup, an unknown route). Every positive check carries a negative control that must fail before the positive is trusted: a defeated hover rule, a chart that ignores the pointer, a broken filter prediction, a reduced-motion page that must render static, and a removed matrix cell the alignment gate must report. The gate currently runs 89 checks against a served build.

`bun run screenshots` captures every route at 1440, 1024 and 390 pixels with a real Chromium, plus the Projects page filtered and the matrix rolled up to sector level, waits for fonts to load and for animation to settle, and fails the run on any console error or a document wider than its viewport.

`scripts/perf_probe.ts` loads the Projects page with its 3,500 windowed rows, measures time to the first drawn row against a 1.5 second budget (measured in the range of 1.0 to 1.2 seconds), then scrolls for four seconds and records frame-interval timing: median, 95th percentile, maximum, and the count of intervals above 25 milliseconds. Its numbers are observer-dependent, so they are only meaningful comparing before and after a change, on the same machine, against the same origin.

`scripts/scan_staged.sh` refuses a commit, a commit message or a push that carries a credential shape, an em or en dash, AI attribution, or any term listed in `scripts/forbidden_terms.txt` (matched whole word, case-insensitive). `scripts/install_hooks.sh` wires it into git as the pre-commit, commit-msg and pre-push hooks for the clone.

## Regenerating

To build a different but still internally coherent register, change `SEED` near the top of `scripts/generate_demo_data.ts` and rerun `bun run data`, then `bun run reconcile` and `bun run stable`. To change the sector, industry and project-type structure or the weight each takes in the register, edit `data/taxonomy.ts`. To change which channel a vertical sells through, edit `data/channels.ts`. To change which ten verticals and 24 engineers the demo names, re-run `bun run verticals` against a different MIS index and regenerate.

If a figure on screen is wrong, the fix belongs in the generator, in `data/rules.ts` or in `data/schema.ts`. It never belongs in a component. A component only sorts, filters, formats and links to what the generator has already computed.

## Stack

Vite 8, React 19, TypeScript in strict mode, Tailwind v4 through its Vite plugin, Motion, d3-scale, d3-shape and d3-array, React Router, and Bun as the runtime and package manager. Fonts are self-hosted through Fontsource: Archivo Black and JetBrains Mono, the same pairing as the MIS and WMS demos.

## Deploying

The build output is a static `dist` folder; any static host that falls back to `index.html` for unknown paths works, since the app is a single-page application. On node-ss, `deploy/kinetics-bnc-demo.nginx` is a tailnet-only HTTPS site on port 928 serving `dist/` directly, with no dynamic behaviour and no backend; the register is about 3 MB of JSON across eight shards, so JSON is gzipped at the site level. `bash deploy/install-site.sh` installs or re-installs it: it copies the site file when it differs, tests the nginx configuration, reloads only on a passing test, then proves port 928 answers with this build's own `index.html` without touching the sibling MIS demo on port 926 or the WMS demo on port 927. A rebuild alone needs no reload, since nginx serves the built files as static assets; re-run the installer only after a change to the nginx site file itself.

## Synthetic data statement

Every project, party, score, owner and activity state in this repository is generated by a seeded script. No real project, company, person or figure is represented, referenced or implied anywhere in this demo, its data or its documentation. The generator checks every invented name against a forbidden-terms list before writing it, and `scripts/scan_staged.sh` checks every commit for the same before it reaches version control.
