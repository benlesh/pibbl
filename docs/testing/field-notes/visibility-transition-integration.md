# Visibility transition integration — 2026-10-04

This is a dated verification record, not a claim that the aggregate trust gate passed.

## Delivery

The user approved the Bifrost, Hologram, and Embers appearance and requested all
workspace changes be committed, merged to main, and pushed. Commit `8dd44396`
preserves the entire original workspace, including opt-in ember physics, package
consolidation, HtmlBox, text geometry, and the other in-flight assets. Integration
uses main at `96732539` and retains its newer geometry, manipulation, texture,
particle-flow, and ownership fixes.

Conflicts were resolved at the consolidated core subpaths. Incoming texture
kernels and their mask implementation were preserved. Transition samples and
fixtures were adapted to main's `left`/`top` placement model; effect regions stay
receiver-local. The layout inspection fixture now uses an explicit rectangle
path to preserve its deliberate shape-local offset independently of placement.

## Fresh verification

Environment: macOS arm64, Node 24.15.0 through fnm, pnpm 11.21.0, Playwright
Chromium. Initial exploratory checks used Node 26.9.0; final checks used Node 24.

- Typecheck and ESLint passed.
- Core, Three, text package, and Studio production builds passed.
- Bundler and NodeNext consumer typechecks and runtime export checks passed.
- Packed core/Three/viz and textures checks passed. Optional-feature bundle
  isolation and import-inertness checks passed.
- Transition and texture WASM generated-byte checks passed. Texture kernel
  isolation passed 72 source/built esbuild/Vite checks.
- Browser suite passed in four sequential shards, each using `--maxWorkers=1`:
  3,733 tests passed, seven skipped; 378 files passed, three skipped.
- The ember physics Studio demo loaded without page errors or editor type errors.
  Burn/materialize, mid-flight reversal, and physics on/off were exercised.
- The scenario index covers 87 lessons, 12 tutorial snapshots, and 33 test labs.

Commands were run through `fnm exec --using=24.15.0 corepack pnpm@11.21.0`:
`typecheck`, `lint:code`, `build`, `playground:build`, consumer typecheck projects,
`scenarios:write-index`, and `exec vitest run --browser.headless
--browser.ui=false --maxWorkers=1 --shard=N/4` for N=1..4. Packed and WASM checks
used the corresponding checked-in verification scripts.

The earlier parallel browser run had native-input/focus failures. A single long
serial run passed 3,270 tests before Chromium disconnected; it was incomplete.
The four bounded runs above completed successfully and supersede those attempts.

## Remaining aggregate-gate blockers

`trust` is not green. Its requirement ledger rejects stale ENV-03 closure evidence
for `packages/core/package.json`. `docs:check` also rejects the dated texture
contract preservation record: it records 12 semantic units, while the current
contract has 33. These certifications require substantive evidence reconciliation;
the checks were not disabled and their fingerprints were not refreshed to imply
review. Non-overlapping historical review records from both branches were kept.

The complete aggregate pipeline after those blockers, including all additional
Studio visual checks, has not been certified by this integration run.
