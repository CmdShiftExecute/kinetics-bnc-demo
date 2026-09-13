## Reference coverage map

This map records every field and every source workbook of the market register's structure, and where each one lives in this demo, or why it does not. The source structure is described generically, shape only, never content: a register sheet with one row per project; a Consultant Relationship Matrix sheet and a Contractor Relationship Matrix sheet; an Owners sheet; a Relationships sheet with one row per project-to-party link; a scored register carrying 20 vertical score columns across four divisions, with Summary by Project Type, Summary by Industry, Summary by Sector, and Legend and Methodology sheets; a Vertical Relevance Matrix sheet of about 80 rows with its own Summary by Sector; a compiled relationship workbook with Clients and End-Users, Contractors, Consultants and an Analytics and Insights narrative; an Other Sectors master file; Brownfield retrofit and FM slices; a consultants allocation workbook with a UAE Consultants sheet, one sheet per engineer, a Consultant Relationship Matrix and a Project Assignment sheet; one workbook per sales engineer with Projects, Contractors, Consultants and Sign-Off sheets; sector-sliced register files; and method notes for sales-activity bucketing, the ownership cascade and a dedup audit. Every figure in this demo is synthetic; only the structure is borrowed.

Verification evidence referred to below: `bun run reconcile` (2,783 cross-table assertions across 15 categories, published on the Data basis page), `bun scripts/interactions.ts` (151 browser checks), `bun run screenshots` (every route at 1440, 1024 and 390 pixels, plus the Projects page filtered and the matrix rolled up to sector level), and `bun run stable` (byte-stability across two runs).

Disposition codes: **Reproduced** (present, same meaning); **Adapted** (present, reshaped for this demo's structure, stated inline); **Simplified** (present, with detail collapsed or narrowed); **Not reproduced** (deliberately excluded, with the reason).

## Register sheet, one row per project

| Source field | Application in this demo | Disposition |
|---|---|---|
| Reference | `Project.ref`, the register's own identifier, used as the URL param on `/p/:ref` | Reproduced |
| Name | `Project.name`, unique across the register (reconcile: `register-unique-refs` checks the reference; names are checked unique in the generator) | Reproduced |
| Stage (eight values) | `Project.stage`, the `STAGES` union: Concept, Design, Tender, Under Construction, and four Completed bands (3 months, 1 year, 3 years, above 3 years) | Reproduced |
| Completion % | `Project.completionPct`, recorded for Under Construction rows only, null elsewhere | Adapted: the source's completion field is generalised here to one stage rather than tracked continuously across stages |
| Completion date | `Project.completionDate`, an ISO calendar date | Reproduced |
| Value | `Project.value`, AED million to one decimal | Reproduced |
| Country | Not carried; every project sits in one of eight UAE emirates | Not reproduced: this demo is a single-country register, so a country column would carry one repeated value |
| City | `Project.city`, the `CITIES` union of eight UAE emirates | Reproduced |
| Sector | `Project.sector`, the `SECTORS` union of five sectors, also the shard key under `public/data/projects/` | Reproduced |
| Project category | `Project.category`, Greenfield or Brownfield | Reproduced |
| Industry | `Project.industry`, a `data/taxonomy.ts` industry name nested under its sector | Reproduced |
| Project type | `Project.type`, a `data/taxonomy.ts` type name nested under its industry; one relevance-matrix row exists per (sector, industry, type) triple | Reproduced |
| Project attributes | `Project.attributes`, the `ATTRIBUTES` union (Commercial, Residential, Office, Complex, Labor Camp, Data Center, Staff or Student Accommodation), zero or more per project | Reproduced |
| Owners | `Project.owners`, up to two ids into `parties/owners.json`, named in the generated description | Reproduced |
| Lead/design consultants | `Project.leadConsultants`, up to two ids into `parties/consultants.json` with role `lead` or `both` | Reproduced |
| MEP consultants | `Project.mepConsultant`, one id into `parties/consultants.json` with role `mep` or `both` | Adapted: one MEP-consultant slot per project rather than a list, because the register's own party pool already carries the mep-or-lead distinction on the party record |
| Main/EPC contractors | `Project.mainContractors`, up to two ids into `parties/contractors.json` with role `lead` or `both` | Reproduced |
| MEP contractors | `Project.mepContractor`, one id into `parties/contractors.json` with role `mep` or `both` | Adapted: single slot, same reasoning as the MEP consultant field |
| Description | `Project.description`, a generated sentence naming the type, city, value, stage, parties and completion date | Adapted: authored by the generator from the other fields on the same row, rather than typed by a person, so it can never disagree with the structured fields beside it |
| Last updated | `Project.lastUpdated`, an ISO calendar date | Reproduced |
| Ten vertical scores | `Project.scores`, one per Halvard vertical, 0.0 to 8.0 or null, with `Project.adjusted` naming which of the ten were hand-nudged off the matrix grade | Reproduced |

## Consultant Relationship Matrix sheet and Contractor Relationship Matrix sheet

| Source sheet | Application in this demo | Disposition |
|---|---|---|
| Consultant Relationship Matrix | `parties/consultants.json`, one `Party` per consultant (kind `consultant`), with `role`, `verticalCounts` and `verticalValues` (a project count and an AED million figure against all ten verticals, not a short list of the ones that matter most), `level`, `rating`, `owner`, `projectCount`, `projectValue` and `projects`; browsed on `/parties` | Adapted: one party table carrying the full ten-vertical vectors per firm, in place of a matrix with a vertical down every column, so every vertical a firm is in play on is published with its count rather than a top few. `level`, `rating` and `owner` are nullable and always null together, the state of a firm that sits on projects but that Halvard holds no relationship with, drawn as a synthetic cohort weighted toward firms with no owned project and small books |
| Contractor Relationship Matrix | `parties/contractors.json`, the same shape with kind `contractor`, role `lead`, `mep` or `both`, the same ten-vertical count and value vectors, and the same nullable relationship fields | Adapted, same reasoning |

## Owners sheet

| Source sheet | Application in this demo | Disposition |
|---|---|---|
| Owners | `parties/owners.json`, an `Owner` record of `id` and `name` only, referenced from `Project.owners` and named in every description | Simplified: id and name only, with no relationship level, rating or engineer assignment, because owners in this demo are not a sales-relationship target the way consultants and contractors are |

## Relationships sheet, one row per project-to-party link

| Source sheet | Application in this demo | Disposition |
|---|---|---|
| Relationships | No standalone link table. Every project-to-party link is a field on `Project` itself (`owners`, `leadConsultants`, `mepConsultant`, `mainContractors`, `mepContractor`), and each `Party.projects` is the reverse index the generator builds from those fields | Adapted: the link is stored once, on the project, and derived onto the party, rather than kept as an independent table that could disagree with either side; `reconcile.ts` category "Consultants and contractors" checks the two views tie |

## Scored register (20 vertical score columns, four divisions) and its summary sheets

| Source field or sheet | Application in this demo | Disposition |
|---|---|---|
| 20 vertical score columns across four divisions | `Project.scores`, ten columns in one division: Halvard's own ten verticals | Simplified: twenty columns across four divisions collapse to the ten verticals this demo actually names, because Halvard's Building Technologies Division is one division, not four |
| Summary by Project Type | `rollup.matrixRows`, one count and value per relevance-matrix row, read on `/relevance` and filterable on `/projects` | Reproduced |
| Summary by Industry | No dedicated per-industry rollup table | Not reproduced: an industry-level total is one filter away on `/projects` (filter by industry, read the always-visible count and value), so a fixed summary table would only restate what the filter already answers |
| Summary by Sector | `rollup.sectorStage` (sector by stage) and `rollup.distributions.sectors`, both read on the Overview page's "Where the value sits" chart | Reproduced |
| Legend | The grade-scale key on `/relevance` and the "Relevance grade scale" section of `/data-basis` | Reproduced |
| Methodology | The "Reporting basis", "Precision policy", "Synthetic assumptions" and "Definitions" sections of `/data-basis`, published from the generator's own `precisionPolicy`, `assumptions` and `definitions` arrays | Reproduced |

## Vertical Relevance Matrix sheet (about 80 rows, Summary by Sector)

| Source field or sheet | Application in this demo | Disposition |
|---|---|---|
| Matrix rows (sector, industry, type against vertical columns; High, Medium, Low or a dash) | `data/taxonomy.ts` defines the sector, industry and type nesting; `rollup.matrix` is the resulting `MatrixRow[]`, one row per triple, cells `High`, `Medium`, `Low` or null; rendered as the heatmap on `/relevance` (matrix has 80 or more rows, checked by reconcile category "Relevance matrix", assertion `matrix-rows`) | Reproduced |
| Summary by Sector | The matrix, rolled up to sector level, is one of the states `bun run screenshots` captures explicitly on `/relevance` | Reproduced |

## Compiled relationship workbook (Clients and End-Users, Contractors, Consultants, Analytics and Insights)

| Source sheet | Application in this demo | Disposition |
|---|---|---|
| Clients and End-Users | `parties/owners.json`, named on projects and in descriptions | Simplified: name only, no analytics sheet of its own; see the Owners sheet row above |
| Contractors | `/parties` filtered to kind `contractor` | Reproduced |
| Consultants | `/parties` filtered to kind `consultant` | Reproduced |
| Analytics and Insights narrative | The stated assumptions, precision policy and definitions on `/data-basis` | Adapted: a fixed, machine-checked statement of what the data means and how it was built, in place of a free-form narrative that could drift from the numbers beside it |

## Other Sectors master file

| Source sheet | Application in this demo | Disposition |
|---|---|---|
| Other Sectors master file | Folded into the same `Project` schema and the same generator: Industrial, Oil, Gas and Fuels, Transport and Utilities each get their own shard file under `public/data/projects/`, one sector per file since none exceeds the 720-project shard limit | Reproduced |

## Brownfield retrofit and FM slices

| Source sheet | Application in this demo | Disposition |
|---|---|---|
| Brownfield retrofit slice | `Project.category`, one of `Greenfield` or `Brownfield`, on every project | Reproduced |
| FM (facilities management) slice | No facilities-management workstream is modelled | Not reproduced: this demo covers project origination and ownership, not ongoing facilities management of completed assets |

## Consultants allocation workbook

| Source sheet | Application in this demo | Disposition |
|---|---|---|
| UAE Consultants sheet | `parties/consultants.json` | Reproduced |
| One sheet per engineer | `/engineers/:slug`, the Engineer page: figures, funnel, full project table, held consultants and contractors | Reproduced |
| Consultant Relationship Matrix | See the Consultant Relationship Matrix row above | Adapted |
| Project Assignment sheet: register plus per-vertical owner columns | `Project.ownerVertical` and `Project.ownerEngineer`, a single owner per project rather than a column per vertical | Simplified: the ownership cascade already resolves a project to exactly one vertical and one engineer, so a column per vertical would carry nine empty cells for every filled one |
| Project Assignment sheet: project owner column | `Project.ownerEngineer` | Reproduced |
| Project Assignment sheet: decision-log columns | `Project.why` (`OwnerWhy`): the eligible verticals, the gate that fired, the candidates that passed it, and whether a tie was broken; shown on the Project page and checked whole by reconcile category "Ownership cascade" | Reproduced |
| Project Assignment sheet: no-scoring flag | Not carried as a separate flag | Not reproduced: a project the matrix has no view on already reads as ten null scores, which the cascade already treats as "no eligible vertical," so a second flag would duplicate what a null already states |

## Workbook per sales engineer (Projects, Contractors, Consultants, Sign-Off)

| Source sheet | Application in this demo | Disposition |
|---|---|---|
| Projects | The Engineer page's full project table, sortable, for that engineer's owned projects | Reproduced |
| Contractors | `EngineerSummary.contractors`, the count of distinct contractors held across that engineer's owned projects | Simplified: a count, not a per-engineer contractor table; the full contractor detail is one click away on `/parties` |
| Consultants | `EngineerSummary.consultants`, the same treatment | Simplified, same reasoning |
| Sign-Off | No approval or sign-off workflow is modelled | Not reproduced: this demo is a reporting and relationship-ownership tool, not an approvals system |

## Sector-sliced register files

| Source sheet | Application in this demo | Disposition |
|---|---|---|
| Sector-sliced register files | `public/data/projects/<sector>[-n].json`, eight shard files: four for Urban Construction (the largest sector, split at 720 projects per file) and one each for Industrial, Oil Gas and Fuels, Transport and Utilities | Reproduced |

## Method notes

| Source note | Application in this demo | Disposition |
|---|---|---|
| Sales-activity bucketing method | The "Activity buckets" section of `/data-basis`, the published `bucketRule` array, and the generator's `bucketFor` weighting by score band, stage and ownership | Reproduced |
| Ownership cascade method | The "Ownership cascade" section of `/data-basis`, the published `cascade` array (the five numbered steps), and `data/rules.ts` | Reproduced |
| Dedup audit | Not carried | Not reproduced: this demo has one generated source and no overlapping exports to merge, so there is nothing to de-duplicate; the closest analogue, unique project references and unique names, is checked directly by reconcile assertions `register-unique-refs` and the generator's own uniqueness check |
