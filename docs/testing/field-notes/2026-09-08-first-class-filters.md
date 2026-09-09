# First-class filters delivery field note

> **Historical status: COMPLETED FIELD RECORD.** Results are dated evidence for the named revision and environment, not current API guidance or reusable test totals.

Date: 2026-09-08

## Scope and environment

Final verification covered the complete implementation range after design commit
`adde72cdac14268a374d9d15c9239485e40126e7`. The implementation-only branch
setup began at `ee140764b60a826c617c3cafe7c9354117c13424`; the gate initially
started at clean commit `a5983feaaa07fa35d0670254da78c43c5b15e9a8` in the isolated
`codex/first-class-filters` worktree.

- macOS 26.6.2 (25G83), arm64
- Node.js `v24.15.0` selected through `fnm`; pnpm `11.21.0`
- Vitest `4.1.10`; Playwright `1.62.1`
- Playwright Chromium `151.0.7922.34`, headless

The original `main` checkout at
`1e4926e0286a7b4f3bed59b0b48e0b6384de4abd` retained unrelated modifications
to `.beads/metadata.json`, `.gitignore`, `package.json`, and `pnpm-lock.yaml`,
plus untracked `.beads/identity.toml` and `_bmad-output/`. None was read as
implementation evidence, staged, or changed. The isolated worktree was clean
before the audit and allowed the nominal documentation checks to run.

## Complete-diff audit

`git diff --check` and `git diff --check adde72c..HEAD` exited 0. Before this
field note, `git diff --stat adde72c..HEAD` reported 76 files, 11,038 insertions,
and 449 deletions.

The complete range contained no public raw-string filter, `boxShadow`, URL
filter, or backdrop-filter API. Matching raw strings and rejected properties
were deliberate negative package-consumer fixtures, and Canvas `filter`
strings in integration tests were native-state fixtures. Production files
under `packages/core/src/lib/filter` contained no `getImageData`,
`putImageData`, JavaScript pixel-buffer, `ImageBitmap`, or bitmap-transfer path.
The public type/export changes were represented by unit and browser tests,
learning and laboratory scenarios, packed Bundler and NodeNext consumers,
Studio declarations, API and guide material, normative contracts, and the
scenario index.

## Aggregate trust evidence

Every command below ran under Node 24.15.0. The repository aggregate command
was:

```sh
corepack pnpm@11.21.0 trust
```

The final from-scratch run exited 0. Its fresh results were:

- scenario validation: 48 lessons and 17 test laboratories;
- documentation: 11 guides, 40 current/migration files, 56 historical/work
  records, 46 values, 133 types, 21 acceptance rows, 53 parsed snippets, 8
  extracted TypeScript programs, 667 pre-Task-14 and 708 current semantic units
  across 12 normative contracts, 52 direct evidence mappings, 85
  baseline-derived field migrations, and 103 presentation sources;
- documentation RED mutation probes: 796 passed;
- typecheck, ESLint, Prettier, package builds, source and built Studio builds,
  Studio declaration parity, and packed-package consumers: passed;
- packed focus elimination: 135,241 no-focus bytes versus 158,886 with-focus
  bytes;
- complete browser suite: 104 files passed; 1,423 passed and 2 intentionally
  skipped tests of 1,425 in 21.63 seconds;
- visual safeguard: deliberate mutation rejected, baseline bytes preserved,
  and green recovered;
- Studio visuals: 5 full-page baselines matched;
- built-package smoke: 1 file and 1 test passed;
- lifecycle gate: 3 files and 15 tests passed in 9.75 seconds; and
- structural-performance gate: 2 files, 14 passed and 2 opt-in wall-clock tests
  skipped of 16 in 1.64 seconds.

No historical test total was substituted for these results.

### Focused recoveries

The first aggregate attempt passed its static and packed-package stages, then
found a feature-branch regression in the complete browser suite: 103 files
passed and 1 failed, with 1,422 passed, 1 failed, and 2 skipped tests of 1,425.
The retained Flow regression
`normalizes a measured child once and renders the used normalized style`
reproduced alone with 21 passed and 1 failed tests. Comparison against both
`adde72c` and `ee14076` traced the extra normalization to filter dispatch making
`measureElement` normalize a supplied pre-normalized style again after removing
the system filter. Commit `127e2d9` (`fix(core): preserve pre-normalized
measurement styles`) restored the pre-normalized fast path while retaining
system-filter stripping; the focused Flow file then passed all 22 tests.

The next complete aggregate passed all 104 browser files and reached the Studio
visual gate, where the Mouse Events page differed by exactly 66 pixels. The
focused Studio visual command reproduced the difference. Inspection showed
only the intended lesson ordinal changing from 23 to 24 after inserting the
Filters lesson. The update command also exposed the corresponding Advanced
ordinal change from 47 to 48, limited to 65 pixels. Old expected, new actual,
and generated diff images were inspected for both pages; Canvas content was
unchanged. Commit `3166c65` (`test: update Studio lesson ordinals`) recorded
only those two reviewed baselines. The focused Studio visual command then
matched all five baselines, and the final aggregate above ran from scratch.

## Focused filter and visual evidence

This combined public/runtime command exited 0 in 3.68 seconds:

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/style/filter.test.ts packages/core/src/lib/filter/filter-region.test.ts packages/core/src/lib/filter/filter-surface-pool.test.ts packages/core/src/lib/filter/canvas-state.test.ts packages/core/src/lib/filter/filter-rendering.test.ts packages/core/src/lib/filter/filter-integration.test.ts packages/core/test/filter-lab.test.ts packages/core/test/filter-ownership.test.ts packages/core/test/filter-performance.test.ts --browser.headless --browser.ui=false
```

All 9 files and all 146 tests passed. They cover typed normalization and native
compilation, capture windows, pooled surfaces, Canvas-state transfer,
composition, nesting and failure restoration, the public laboratory, exact
ownership, and deterministic structural cost.

The first-class-filter expected and actual visual artifacts were byte-identical
with SHA-256
`634e1b892cd6dee7ada14ee76369f60a2db41bdfae725b3e83924ce639f74a5f`.
The expected, actual, and neutral diff images were inspected at:

- `packages/core/test/visual-baselines/first-class-filters.expected.png`
- `test-screenshots/first-class-filters/filters.expected.png`
- `test-screenshots/first-class-filters/filters.actual.png`
- `test-screenshots/first-class-filters/filters.diff.png`

The comparison used exact channels and no ignored region or visual mask. No
first-class-filter baseline changed during closure.

## Ownership and structural counts

The deterministic ownership stress rendered 100 filtered siblings and then
1,000 scheduled rerenders. It retained exactly 2 created slots, peak 1 active
pair, 100,100 checkouts, 100,100 returns, 0 active pairs, and 0 releases while
the pool remained reusable. A forced failure through three nested boundaries
grew to exactly 6 slots and peak 3 active pairs, then ended with 100,103
checkouts matched by 100,103 returns and 0 active pairs. Disposal reduced live
slots to 0 and released all 6 created slots. A fresh three-level remount used 6
new slots, peak 3, and 3 matched checkouts/returns; disposal again released all 6.

The structural suite independently locked 3 nested pairs to 6 slots and 3
matched returns, while 100 sequential siblings reused 2 slots with peak 1 and
100 matched checkouts/returns. Its ten-function case executed the primitive
once, walked normalize/reverse/compile once each, created 2 offscreen surfaces,
submitted 1 filtered draw and 1 parent composite over 1,870 input pixels, and
performed 0 pixel readbacks, 0 pixel writes, and 0 bitmap transfers.

## Record checks

After this record was added, `corepack pnpm@11.21.0 docs:check` exited 0 with
57 historical/work records and the same 796 RED mutation probes. The first
format check identified only this newly drafted Markdown file; the repository
formatter corrected it. The repeated full Markdown/CSS/data format check and
`git diff --check` both exited 0 before the scoped evidence commit.
