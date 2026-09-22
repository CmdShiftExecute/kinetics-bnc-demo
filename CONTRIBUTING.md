# Contributing

## Running it locally

1. `bun install` installs dependencies.
2. `bun run data` imports the private source workbooks and writes the public JSON tables (the raw source and the reference map stay under gitignored `.private/` and are never published).
3. `bun run dev` starts the Vite dev server.

## Before opening a PR

Run the full gate chain and make sure it passes clean:

```
bun run check
bun run interactions
```

`bun run check` chains the reference check, data generation, reconciliation, byte-stability check, typecheck, lint, motion check, build and contrast check. `bun run interactions` drives a real served build with Playwright across three viewport widths and fails on any of its 194 checks, each paired with a negative control.

## House rules

- **Data is generated, never edited by hand.** Everything under `public/data` is written by `scripts/generate_demo_data.ts` from the imported register and the published rules in `data/rules.ts`, `data/channels.ts` and `data/taxonomy.ts`. If a published file looks wrong, fix the generator or the rules it reads and re-run `bun run data`, never the JSON directly.
- **No em dashes.** `scripts/scan_staged.sh` (wired into git via `bash scripts/install_hooks.sh`) refuses any staged file, commit message or push containing an em or en dash, along with credential shapes, AI attribution and any real (unmasked) source register reference.
- **Masked references only.** Real market-register identifiers never enter the published tree; `bun run refs:check` refuses a commit or push carrying one.

## Opening an issue or PR

Open an issue describing what you found or want to change before a large PR; small fixes can go straight to a PR. Describe what you tested and paste the last lines of `bun run check`.
