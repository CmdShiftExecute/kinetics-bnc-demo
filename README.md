# Halvard Project Intelligence System demo (kinetics-bnc-demo)

## What this is

This is a zero-backend Project Intelligence System demo for a fictional engineering group, Halvard Engineering Group, Building Technologies Division. It is a static Vite and React application sitting on top of finished JSON tables: a market register of 4,536 unique BNC construction projects and the genuine company labels recorded against them. Project references, names, USD values, stages, locations, sectors, industries, types, owners, consultants and contractors come from three supplied BNC workbooks. The 24 sales engineers and the internal relevance, ownership, activity, workload and relationship layer are deterministic illustrative demo data. Individual contacts, telephone numbers, emails and workbook assignees are excluded. The app is live on the private Tailnet at https://node-ss.tail640a1e.ts.net:928/.

The system answers one question a sales desk actually asks: of everything being built in the market right now, which projects matter to us, who already owns the relationship, and how far has that relationship gone. The register never says "buy from us"; it says which vertical a project is relevant to and how relevant, and a separate ownership rule decides who inside Halvard is carrying it.

## Routes

| Route | Description |
|---|---|
| `/` | Overview: six figures in primary/supporting bands (register, owned value, chase shortlist, owned count, open pairs and current-year order pairs), then management attention, then where the value sits by sector and stage, who owns what by vertical, the top twenty worth-chasing projects, and the full activity funnel across every project-and-vertical pair. |
| `/relevance` | The relevance matrix as a heatmap: the BNC sector, industry and project-type rows down the side, the ten verticals across the top, and click-through to the filtered project register. |
| `/projects` | The full register with a filter rail, removable chips, an always-visible count and value, sortable columns, a column chooser and CSV export. All filter state lives in the URL, so any view is a shareable link. Alongside the taxonomy, stage, city, value and activity keys it carries `owned` (1 for owned, 0 for no owner), `omin` (an overall relevance floor, 6.5 being the point at which a project reads High), `year` (activity pairs dated in that calendar year, and with `bucket` the pair must be in the bucket and in the year), `nocon` (no lead and no MEP consultant recorded) and `nokon` (no main and no MEP contractor appointed). |
| `/engineers` | Six cards over the whole desk, among them "Over capacity" (5 of the 24 engineers) and "Heaviest load", then every book on one full-width chart with a workload view that draws the capacity line across it, then one block per engineer, grouped by vertical, ruled like a printed ledger: their owned count, pipeline value, activity funnel, and an over-capacity tag on any book past the line. |
| `/engineers/:slug` | One engineer's book: six cards (projects owned, pipeline value, workload as a percent of capacity, enquiries and quotes, orders received, largest project), then a full-width chart with a view switch across the activity funnel, the book by stage and value by stage, then their full project table and the consultants and contractors they hold. |
| `/parties` | The "who is the door in" page: six cards, among them "No relationship yet", the twenty largest firms of the current ranking charted, and a picker that ranks firms by value or by count, on the whole book or on one vertical (URL key `v`), and filters by relationship state (`rel`, held or none). A firm's card shows its relationship level, rating and owning engineer, or a "None yet" strip where Halvard holds no relationship, the projects it sits on, every vertical it is in play on with the count behind each, and the other firms it shares projects with. |
| `/p/:ref` | One project's page: six figures (value, stage, overall relevance, verticals in scope, owner, best activity), the ten vertical scores at the section's full width directly beneath them, then identity, the four party slots, the owner and the cascade step that decided it, with a tie explained from its own record (fewer projects assigned, with both counts, or an equal count and the published order), the activity bucket per vertical, and the generated description. |
| `/data-basis` | Data basis: source provenance, the authentic/illustrative boundary, quality checks, definitions, ownership and activity rules, and the machine reconciliation. |
| `*` | Not found. |

## Reading hierarchy and suite

The Overview prioritizes three answers: register size, the value of owned projects, and the top-twenty chase shortlist. A quieter supporting band retains ownership coverage, open enquiry/quote pairs and current-year order pairs. Management attention exposes the published no-owner population and engineers above workload capacity. All six figures retain their exact populations and drill paths. Full project value is explicitly distinguished from Halvard revenue and addressable contract value.

The sector-stage visual retains value, project-count and sector-share views. Vertical ownership, sector concentration, the complete twenty-project shortlist, the pair-based activity funnel and the distinct unique-project explanation remain below it. Every other analytical route retains six headline figures and its full-width chart; Data basis deliberately has no chart.

A persistent Halvard masthead now shares the finalized MIS circular Module and Theme menus. Names and selected states live inside the menus. Module browsing requires explicit activation; keyboard arrows, Enter/Space, Escape, outside dismissal and Tab exit are supported. Parchment, Light and Dark cover all routes, charts, heatmaps, tooltips and error states. The `halvard-pis-theme` preference restores in the HTML head before application mounting and tolerates invalid or denied storage. Preferences are per browser origin; ports 926, 927 and 928 do not synchronize storage.

The semantic palettes and controls follow MIS at commit `227629042371be9db44a9fae7a8972aa78d7cde4`. The PIS grade and value heatmaps add sequential theme-specific ramps with unchanged grade meanings, data-driven steps and text polarity. Relevance measures fit; ownership assigns a relationship; neither represents an order win.

See [the refinement design and analytical preservation map](docs/REFINEMENT.md). Fixtures, ownership rules, ranking rules, export calculations and virtual-table row height are preserved. The adversarial audit added exact ownership (`ov`) and chase-eligibility (`chase=1`) filters, with URL state, removable chips and shared table/chart/CSV predicates, to repair inherited drill mismatches.

## Run it

1. `bun install` installs dependencies.
2. `bun run verticals` imports the ten verticals and the 24 engineers from the MIS demo's published index into `data/verticals.json` and `data/engineers.json`. This is a one-shot import, not a build-time dependency; both files are committed, and re-running it only matters if the MIS roster changes.
3. Place the three supplied workbooks under the ignored `.private/bnc/` directory. `bun run data` first runs `scripts/import_bnc_data.py`, de-duplicates by BNC reference using source recency, then runs `scripts/generate_demo_data.ts` and writes the public JSON tables. The raw workbooks and canonical intermediate JSON remain ignored and must never be pushed.
4. `bun run reconcile` re-reads the written files and asserts every cross-table equality and every derived rule, then writes `public/data/reconciliation.json`. This is the result shown on the Data basis page.
5. `bun run stable` hashes every published file, re-runs the generator and the reconciliation, hashes again, and fails if anything differs, is added or is removed: the byte-stability gate.
6. `bun run typecheck` runs the TypeScript compiler in strict mode with no emitted output.
7. `bun run lint` runs oxlint.
8. `bun run build` runs the typecheck and then the Vite production build.
9. `bun run preview` serves the built site at `127.0.0.1:4182`.
10. `bun run contrast` measures the same text, surface, heatmap, chart and hover contrast floors across all three themes, reading the tokens directly from `src/styles/index.css`.
11. `bun scripts/interactions.ts --base <origin> [--insecure]` runs the interaction, keyboard, structure and resilience gate against a served build. `--insecure` skips certificate checks when the origin is self-signed.
12. `bun run screenshots` captures every route at desktop, laptop and phone widths, plus the Projects page filtered and the matrix rolled up to sector level.
13. `bun scripts/perf_probe.ts [--base <origin>] [--path /projects]` loads the Projects page (3,500 windowed rows), measures time to first drawn row, then scrolls for four seconds in a real Chromium and records frame timing. It is run directly, not through a package script.
14. `bun run check` chains `data`, `reconcile`, `stable`, `typecheck`, `lint`, `build` and `contrast`, in that order.
15. `bash scripts/install_hooks.sh` once per clone. It points this clone's git hooks at `scripts/scan_staged.sh`, so the scan runs itself before every commit, on every commit message, and before every push.
16. `bash scripts/scan_staged.sh [--tree]` runs the scan by hand: with no argument it checks the staged diff, `--tree` checks every tracked file instead.

`bun x playwright install chromium` installs the Chromium build the interaction gate, the screenshot script and the performance probe all drive. Run it once before the first use of any of the three. The dev server binds `127.0.0.1:5182`; preview binds `127.0.0.1:4182`, one port pair up from the MIS demo's 5180/4180, so both can run on the same box at once.

### Private refinement preview

The review is **HTTP**, at `http://node-ss.tail640a1e.ts.net:4182/`; port 4182 has no TLS listener. The Tailscale IP equivalent is `http://100.100.228.66:4182/`. The hostname is explicitly listed in `preview.allowedHosts`; do not use an unrestricted allowlist. For a normal installed checkout, `bun run preview --host 100.100.228.66` serves its build on the tailnet.

On node-ss, the transient user unit `halvard-pis-refinement-preview.service` serves the isolated refinement `dist` using the original checkout's installed Vite. Its environment explicitly sets `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=node-ss.tail640a1e.ts.net`, since that runtime reads the original checkout's config. This avoids changing the existing staging checkout. The unit is not persistent across reboot; retain its exact launch command in the review evidence. Verify the exact hostname in a fresh browser after starting it. An IP-only check does not verify hostname access.

The suite regression gate now defaults to the hostname: `node scripts/refinement.mjs`; `BASE` can override the origin and `OUT` selects the evidence directory. HTTPS port 928 is the separately published service and requires explicit approval before promotion.

## Data schema

`data/schema.ts` is the one contract every screen, the generator and the reconciliation read from.

`Project` includes the BNC reference, name, stage, completion fields, source USD value, city, source location, sector, category, industry, type, attributes, the workbook source and the recorded owner, consultant and contractor company cells. It also carries the separate illustrative internal score, owner-engineer, activity and decision fields used by the demo.

Files on disk: `public/data/rollup.json`, nine project shards holding 4,536 projects, the three party files, and `public/data/reconciliation.json`. The workbook files and `.private/bnc-source.json` are ignored.

Units: source money remains USD and is stored as USD million to one decimal; the interface selects a readable million, billion or trillion label automatically. No AED conversion or value scaling is applied. Scores are 0.0 to 8.0 to one decimal. Percentages are plain numbers to one decimal and counts whole. The combined source is stated as of 04 May 2026.

## The rules the generator encodes

Source identity and privacy. External project and company labels come from the supplied BNC workbooks. The 24 sales engineers remain fictional. Contact names, telephone numbers, email addresses and assignee fields are excluded. `Not Yet Awarded` and `See Sub-Projects` are treated as missing company appointments, not as firms.

The relevance grade scale, `data/rules.ts`. A grade converts to a number: High is 8.0, Medium is 5.0, Low is 2.0, no relevance is null. BNC project types are mapped deterministically to the nearest demo taxonomy type; this commercial relevance layer is illustrative and distinct from the source fields. Overall relevance is the highest of a project's ten scores.

The ownership cascade, evaluated in five steps, in reference order so the running counts are reproducible.

1. **Scope floor.** A vertical is eligible for a project only when its score is 4.0 or more.
2. **Stage gate.** Concept and Design projects go to a vertical that sells through consultants. Tender, and Under Construction at 5.0 percent complete or less, go to a vertical that sells through contractors. Under Construction beyond that, and Completed, stay unassigned unless a contractor is already appointed, in which case they still go to a vertical that sells through contractors.
3. **Highest score wins** among the eligible verticals that pass the gate. A tie goes to the vertical with fewer projects already assigned so far, then to the earlier vertical in the published order.
4. **Engineer pick.** Within the winning vertical, the project goes to the engineer with the lowest current pipeline value, so books fill evenly but not equally.
5. **No match, no owner.** A project with no vertical at or above the scope floor, or none that passes the stage gate, has no owner and is counted in the unassigned figure.

Every decision is published on the project record as `why`: the eligible verticals, the gate that fired, the candidates that passed it, and, when two or more candidates shared the top score, the tied verticals, the number of projects each already carried at the moment of the decision, and which half of the tie rule actually decided, `fewer` or `order`. The project page renders its explanation from that record rather than restating the rule, so it can never say a vertical had fewer projects assigned when the two counts were equal and the published order decided.

The description clauses. A project's generated sentence builds its consultant clause and its contractor clause independently: a lead consultant is named when there is one, an MEP consultant when there is one, and the "no consultant recorded" sentence is used only when both slots are empty. Contractors follow the same rule. The generator self-checks it before writing, and the reconciliation carries a "Descriptions" category of its own.

Workload and capacity, `data/rules.ts`. Owning many projects is not the same as being busy, so each owned project earns points by its activity band on the engineer's own vertical: an active pair (quote sent, enquiry generated, profile shared, visit done, reached out) is worth 3, an order received or a quiet pair 1, a closed project 0, from `WORKLOAD_WEIGHTS`. `ENGINEER_CAPACITY` is 320 points, set so a handful of the 24 books exceed it. An engineer's workload is that sum, `loadPct` is the workload against capacity, and `overloaded` is true above the line. Both the weights and the capacity are synthetic and both are published on the Data basis page.

The no-relationship cohort. A firm can sit on the register without Halvard holding any relationship with it, and the generator draws that cohort per firm: a firm with no project owned by Halvard has a 60 percent chance of no relationship, a firm on three projects or fewer 20 percent, a firm on four to eight 5 percent, and a larger book always has one. Level, rating and owner are then all null together. The parties page filters on that state and its "No relationship yet" card counts exactly those firms.

The declared source shape, `data/shape.ts`. Fourteen ranges state the magnitudes the synthetic register is meant to resemble, each carrying its basis in words: the owned share, the smallest and the largest engineer book, the quiet, order and closed shares of activity pairs, the three party fill rates, the consultant and contractor median and largest book, and the share of firms with no relationship. The generator measures all fourteen before it writes and refuses to write when one is missed; the reconciliation re-measures them from the written files, and the Data basis page publishes the table, measured against declared.

The activity buckets, eleven of them, highest priority first: Order received, Quote sent, Enquiry generated, Company profile shared, Project closed, Visit done, Reached out, Waiting or follow up, No response, Contractor or consultant not yet awarded, No update. Each project-and-vertical pair carries exactly one, chosen by a weighted random draw over a base distribution keyed to the score band (none, low, medium, high), then reshaped by the project's stage (a Concept or Design project leans toward "not yet awarded" and away from orders; a Completed project leans toward orders and closed, and away from enquiries) and by ownership (an owned pair leans toward the active states and away from "no update"). Orders received counts as an order this year only when its activity date falls in the fiscal year.

The "worth chasing now" rule: a project at Tender, or Under Construction at 5.0 percent complete or less, with overall relevance 5.0 or more, and no vertical already in Project closed. The top twenty by value are published on the Overview page.

The precision policy. Source USD is stored in millions to one decimal at project level; every rollup is a sum of those same values. Relevance scores and percentages use one decimal. Counts and ratings are whole numbers.

Party project membership comes from the BNC workbook company cells. The internal relationship level, rating and owner are illustrative because those fields are absent from the supplied source.

The import combines 3,327 Urban & Industrial rows, 568 Other Sectors rows and 673 Brownfield rows. The 4,568 raw rows become 4,536 unique references after 32 overlaps are resolved by source recency. Company cells are preserved intact because commas are ambiguous between legal-name punctuation and multi-company separators.

Determinism. A mulberry32 pseudo-random generator seeded at 20260913 drives every random choice, so a re-run with the same seed writes byte-identical files: the same guarantee `bun run stable` checks.

## Gates

`bun run reconcile` re-reads the written JSON files, independently of the generator's own in-memory checks, and publishes 2,783 assertions across 15 categories: Shards and register, Precision policy, Relevance matrix, Ownership cascade, Descriptions, Engineers, Verticals, Headline figures, Sector by stage, Activity funnel, Worth chasing, Consultants and contractors, Matrix summary, Party summary, and Source shape. Every one currently passes, and the result renders on the Data basis page. Five deliberate corruptions are the gate's negative controls, and each one fails it: a description that drops the MEP consultant, a tie rule flipped, a half-recorded relationship, a workload off by one with its verdict flipped, and a shape measurement pushed 30 points.

`src/lib/validate.ts` checks the published data at the boundary, before the register cache is populated, and it checks all of it: every row of every file rather than a sample, each field's type, the closed vocabularies, ten-long score, bucket and date vectors, the score and bucket domains, the tie record's internal consistency, and the whole-or-absent relationship state. `validateReferences` in `src/lib/register.ts` then resolves every party id, project reference, engineer slug and vertical index across files. The interaction gate feeds six corrupt shards through the same path and requires each to be refused with the offending row and field named, against a positive control that replays a shard's own bytes and renders all 3,500 rows.

`bun run stable` hashes every file under `public/data`, runs the generator and the reconciliation again, hashes again, and fails on any file that changed, appeared or disappeared between the two runs. This is the machine's own proof that the register is a pure function of its seed.

`bun run typecheck` runs the TypeScript compiler across the project in strict mode and fails on any type error.

`bun run lint` runs oxlint across the source.

`bun run contrast` reads the color tokens directly out of `src/styles/index.css`, so it cannot drift from the stylesheet, and fails if any text pair falls below a 4.5 to 1 contrast ratio or any non-text mark falls below 3 to 1.

`bun scripts/interactions.ts` drives a real, served build with Playwright: structure at three viewport widths, the filter rail and chips against the same predicate the page itself uses (`src/lib/filters.ts`), sorting, the matrix heatmap and its click-through to a filtered register, keyboard traversal, and the resilience paths (a missing shard, a malformed rollup, an unknown route). Every positive check carries a negative control that must fail before the positive is trusted: a defeated hover rule, a chart that ignores the pointer, a broken filter prediction, a reduced-motion page that must render static, and a removed matrix cell the alignment gate must report. The gate currently runs 151 checks against a served build. Among the families it now covers: six cards and a full-width visual on seven routes, with Data basis as the negative control; the top-twenty firms ranked by count as well as by value; the value tint on a fresh matrix predicted cell by cell from the data, with the retired rule as the negative control; the two tie explanations; the description clauses agreeing with the party fields beside them; every headline card's drill opening a register whose population equals the figure on the card, with the retired links as negative controls; the per-vertical ranking reached in two clicks; the workload card, view and capacity marker; and the no-relationship card, filter and card state.

`bun run screenshots` captures every route at 1440, 1024 and 390 pixels with a real Chromium, plus the Projects page filtered and the matrix rolled up to sector level, waits for fonts to load and for animation to settle, and fails the run on any console error or a document wider than its viewport.

`scripts/perf_probe.ts` loads the Projects page with its 3,500 windowed rows, measures time to the first drawn row against a 1.5 second budget (measured at 980 milliseconds against the live origin on 13 September 2026), then scrolls for four seconds and records frame-interval timing: over 241 frames, a median of 17 milliseconds, a 95th percentile of 18.6, a maximum of 25.6, and one interval above 25 milliseconds. Its numbers are observer-dependent, so they are only meaningful comparing before and after a change, on the same machine, against the same origin.

`scripts/scan_staged.sh` refuses a commit, a commit message or a push that carries a credential shape, an em or en dash, AI attribution, or any term listed in `scripts/forbidden_terms.txt` (matched whole word, case-insensitive). `scripts/install_hooks.sh` wires it into git as the pre-commit, commit-msg and pre-push hooks for the clone.

## Regenerating

To build a different but still internally coherent register, change `SEED` near the top of `scripts/generate_demo_data.ts` and rerun `bun run data`, then `bun run reconcile` and `bun run stable`. To change the sector, industry and project-type structure or the weight each takes in the register, edit `data/taxonomy.ts`. To change which channel a vertical sells through, edit `data/channels.ts`. To change which ten verticals and 24 engineers the demo names, re-run `bun run verticals` against a different MIS index and regenerate. To move a declared source-shape range, edit it in `data/shape.ts` and nowhere else, so the target and the check cannot drift apart: the generator measures all fourteen ranges before it writes and refuses to write a single file when one is missed, so a tuning change that pushes the register out of shape fails loudly instead of shipping quietly.

If a figure on screen is wrong, the fix belongs in the generator, in `data/rules.ts` or in `data/schema.ts`. It never belongs in a component. A component only sorts, filters, formats and links to what the generator has already computed.

## Stack

Vite 8, React 19, TypeScript in strict mode, Tailwind v4 through its Vite plugin, Motion, d3-scale, d3-shape and d3-array, React Router, and Bun as the runtime and package manager. Fonts are self-hosted through Fontsource: Archivo Black and JetBrains Mono, the same pairing as the MIS and WMS demos.

## Deploying

The build output is a static `dist` folder; any static host that falls back to `index.html` for unknown paths works. On node-ss, `deploy/kinetics-bnc-demo.nginx` is a tailnet-only HTTPS site on port 928 serving `dist/` directly, with no backend; JSON is gzipped at the site level. A rebuild alone needs no nginx reload because the site serves the files directly.

## Data statement

The external market layer is BNC data supplied for this closed demo: project and company identities are genuine source fields. The internal sales layer is illustrative: sales engineers, relevance, ownership, activity, workload, relationship level, rating and relationship owner are generated deterministically. Raw workbooks and intermediate extracts stay under ignored `.private/`; no source files are pushed by this workflow.

## Refinement review verification

`OUT=/tmp/pis-review BASE=http://100.100.228.66:4182 node scripts/refinement.mjs` runs the suite/theme/browser gate and writes screenshots and checks. Use Node for the Firefox screenshot path. The existing `interactions` gate retains all analytical, motion and deliberately corrupt-data controls. Its presentation checks now recognize the compact MIS masthead and the overview attention band before the chart.

The original staging build at HTTPS port 928 is separate from the isolated review runtime. Promotion requires the refinement's own explicit approval; the original source/build archives are retained until deletion is expressly approved.
