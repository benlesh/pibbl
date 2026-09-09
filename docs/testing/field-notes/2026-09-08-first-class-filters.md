# First-class filters delivery field note

> **Historical status: COMPLETED FIELD RECORD.** Results are dated evidence for the named revision and environment, not current API guidance or reusable test totals.

Initial delivery date: 2026-09-08

Final-review correction rerun: 2026-09-09

Vendor-color correction rerun: 2026-09-09

## 2026-09-09 vendor contextual-color correction

A subsequent final re-review found that Chromium accepts the contextual vendor
colors `-webkit-link` and `-webkit-activelink` in native drop shadows, while the
CRC lexical set did not classify them as contextual. Direct Chromium
`151.0.7922.34` probes retained all of these complete native chains:

```text
drop-shadow(4px 0px 0px -webkit-link)
drop-shadow(4px 0px 0px -WEBKIT-ACTIVELINK)
drop-shadow(4px 0px 0px -\77 ebkit-link)
drop-shadow(4px 0px 0px -webkit-act\69 velink)
drop-shadow(4px 0px 0px color-mix(in srgb, -webkit-link, red))
```

The direct and escaped vendor values left a `#010203` `fillStyle` sentinel
unchanged even though the native filter retained them. The nested `color-mix`
serialized through `fillStyle` as `color(srgb 0.5 0 0.466667)` and was likewise
retained by the complete filter, but remains contextual because its result
depends on the browser's link color.

The RED normalization/rendering run failed exactly 16 vendor cases while 85
controls passed across 2 files. It covered both identifiers, mixed case, CSS
escapes, nested `color-mix`, exact singular `filter.color` and indexed
`filter[1].color` diagnostics, and substring non-matches. The rendering cases
confirmed that the old implementation could reach allocation and callback
execution. Commit
`b2d29cfd5d53468a7c0d5db2f82ec6d9a14f16f9` (`fix(core): reject webkit
contextual colors`) added only the two normalized contextual identifiers and
the regression evidence in:

```text
packages/core/src/lib/style/filter.ts
packages/core/src/lib/style/filter.test.ts
packages/core/src/lib/filter/filter-rendering.test.ts
```

The GREEN style/filter rendering/integration command passed all 143 tests in 3
files in 770 ms. It retained the exact early singular/list diagnostics, zero
native filter assignments and pool slots before rejection, no callback, and
all existing concrete-color, full-chain-first, `contrast-color`, injection,
`light-dark`, `currentColor`, system-color, and `var()` evidence. Typecheck,
ESLint, Prettier, and `git diff --check` then exited 0.

The complete aggregate was restarted from scratch at that clean code/test head
with the same macOS 26.6.2 arm64, Node.js `v24.15.0`, pnpm `11.21.0`, Vitest
`4.1.10`, Playwright `1.62.1`, and Chromium `151.0.7922.34` environment:

```sh
fnm exec --using=24.15.0 corepack pnpm@11.21.0 trust
```

It exited 0 with these fresh results:

- 48 lessons and 17 test laboratories;
- documentation: 11 guides, 40 current/migration files, 57 historical/work
  records, 46 values, 133 types, 21 acceptance rows, 53 parsed snippets, 8
  extracted TypeScript programs, 667 pre-Task-14 and 708 current semantic units
  across 12 contracts, 52 mappings, 85 migrations, and 103 presentation
  sources; all 796 documentation mutation probes passed;
- typecheck, ESLint, Prettier, package builds, source and built Studio builds,
  declaration parity, and packed consumers passed; packed focus elimination
  measured 136,480 no-focus bytes versus 160,125 with-focus bytes;
- browser suite: 104 files passed, with 1,473 passed and 2 intentionally skipped
  tests of 1,475 in 21.62 seconds;
- visual safeguard rejected the deliberate drill and preserved every baseline
  byte; all 5 full-page Studio baselines matched;
- built smoke passed 1 file and 1 test in 636 ms;
- lifecycle passed 3 files and 15 tests in 9.75 seconds; and
- structural performance passed 14 tests with 2 opt-in wall-clock skips of 16
  in 1.64 seconds.

No visual was altered. The first-class-filter expected/actual pair remained
byte-identical at SHA-256
`634e1b892cd6dee7ada14ee76369f60a2db41bdfae725b3e83924ce639f74a5f`,
and all five Studio expected/actual comparisons were byte-identical. Exact
channels and the previously documented no-mask status remain unchanged.
Ownership/lifecycle counters also remained exactly as documented in the fresh
aggregate assertions below. The isolated worktree was clean at code/test head
`b2d29cfd5d53468a7c0d5db2f82ec6d9a14f16f9` before this field-note refresh;
the original `main` checkout remained untouched with its six unrelated entries.

## 2026-09-09 final-review correction and trust rerun

A fresh independent review of the complete implementation identified three
correctness or diagnostic gaps. Each was reproduced before production code was
changed, fixed without weakening structural, lifecycle, or visual assertions,
and committed separately:

- `0d0a162c62e5c675bb6357c4f0c5ddf0bb14a43c` (`fix(core): derive
filter bounds from root bitmap`) inverse-projects all four backing-bitmap
  corners to make the root render target describe the actually visible logical
  rectangle for `contain`, `cover`, `none`, and `scale-down`. The focused RED
  run had 10 failed and 35 passed tests of 45; the corrected root-surface and
  filter-integration run passed all 66 tests in 4 files.
- `6d5fdb60d845146635ca981f73b3de889ee94e1c` (`fix(core): trust full
native filter chains first`) makes lexical normalization reject balanced-token
  injection and contextual references, then gives the complete native Canvas
  filter chain first authority. Per-shadow native assignments occur only on the
  rejected-chain diagnostic path. The focused RED run had 25 failed and 104
  passed tests of 129; the corrected normalization/rendering/integration and
  structural run passed all 129 tests in 4 files.
- `2575213ac1ce863fd716cdfe9218ae81e42abf92` (`fix(core): wrap filter
surface acquisition failures`) wraps both `OffscreenCanvas` construction and
  2D-context acquisition for pooled and singular discard surfaces, preserves
  the host exception as `cause`, and retains callback suppression, pool-depth
  rollback, global-state restoration, and same-instance recovery. The focused
  RED run had 3 failed and 39 passed tests of 42; the pooled constructor case
  was already green, while pooled acquisition and both discard paths exposed
  raw host errors. The corrected integration, pool, and rendering run passed
  all 99 tests in 3 files.

The combined root-surface, normalization, filter-region, filter-pool,
filter-rendering, filter-integration, ownership, lifecycle, cleanup, and
structural-performance command passed all 210 tests in 12 files in 10.39
seconds. Root typecheck, ESLint, Prettier, and `git diff --check` also exited 0
before the complete aggregate rerun.

### Native parser probe

A direct `OffscreenCanvasRenderingContext2D` probe in the provisioned Chromium
`151.0.7922.34` confirmed why `fillStyle` cannot be the authority for a
drop-shadow color. Assigning `contrast-color(red)` left a `#010203` `fillStyle`
sentinel unchanged, but the full native filter retained
`drop-shadow(4px 0px 0px contrast-color(red))`; the source pixel was
`[255, 0, 0, 255]` and its contrast shadow was `[0, 0, 0, 255]`.
`light-dark(red, blue)` likewise left the fill sentinel unchanged but was
accepted by the native filter and resolved its light-scheme shadow to
`[255, 0, 0, 255]`, which is why CRC rejects it lexically as contextual.
Concrete `color-mix(in srgb, red, blue)` and `rgb(from red r g b)` were accepted
by both native accessors and rendered `[128, 0, 128, 255]` and
`[255, 0, 0, 255]` shadows respectively. `currentColor` was accepted by the
browser but remains an intentional lexical contextual rejection at the CRC
boundary.

### Fresh aggregate evidence

The 2026-09-09 rerun used macOS 26.6.2 (25G83), arm64; Node.js `v24.15.0`
through `fnm`; pnpm `11.21.0`; Vitest `4.1.10`; Playwright `1.62.1`; and
headless Playwright Chromium `151.0.7922.34`. The exact aggregate invocation
was:

```sh
fnm exec --using=24.15.0 corepack pnpm@11.21.0 trust
```

It exited 0. Fresh results from this rerun only were:

- scenario validation: 48 lessons and 17 test laboratories;
- documentation: 11 guides, 40 current/migration files, 57 historical/work
  records, 46 values, 133 types, 21 acceptance rows, 53 parsed snippets, 8
  extracted TypeScript programs, 667 pre-Task-14 and 708 current semantic units
  across 12 normative contracts, 52 direct evidence mappings, 85
  baseline-derived field migrations, and 103 presentation sources;
- documentation RED mutation probes: 796 passed;
- typecheck, ESLint, Prettier, package builds, source and built Studio builds,
  Studio declaration parity, and packed-package consumers: passed;
- packed focus elimination: 136,444 no-focus bytes versus 160,089 with-focus
  bytes;
- complete browser suite: 104 files passed; 1,458 passed and 2 intentionally
  skipped tests of 1,460 in 21.65 seconds;
- visual safeguard: deliberate mutation rejected, every baseline byte
  preserved, and green recovered;
- Studio visuals: all 5 full-page baselines matched exactly;
- built-package smoke: 1 file and 1 test passed in 643 ms;
- lifecycle gate: 3 files and 15 tests passed in 9.75 seconds; and
- structural-performance gate: 2 files, 14 passed and 2 opt-in wall-clock tests
  skipped of 16 in 1.65 seconds.

The first-class-filter expected, expected-artifact, and actual images remained
byte-identical at SHA-256
`634e1b892cd6dee7ada14ee76369f60a2db41bdfae725b3e83924ce639f74a5f`.
Expected, actual, and the neutral no-difference image were freshly inspected at
the paths recorded below. This comparison uses exact channel equality and no
ignored region or mask. All five Studio expected/actual pairs also compared
byte-for-byte equal; the reviewed Mouse and Advanced baselines remained at
`91df13745238b7f0957beba6d29dec8f7e8d8b00a3495f1860607c8c92727e51`
and
`ea1be96e8e3a088b64023d3e34e51f6f6bb7910a0bc2097010c4f7b362055dad`
respectively. No visual baseline changed during the review-fix rerun.

The fresh ownership/lifecycle assertions retained 2 created/live slots and
peak 1 active pair for 100 filtered siblings plus 1,000 rerenders, with 100,100
checkouts exactly matched by 100,100 returns. The forced depth-3 failure grew
to 6 slots and peak 3, ended with 100,103 matched checkouts/returns and 0 active
pairs, then disposal released all 6 slots. The fresh depth-3 remount again used
and released exactly 6 slots. The structural sibling case reused 2 slots with
peak 1 and 100 matched returns; the ten-function case retained 0 pixel
readbacks, writes, or bitmap transfers.

The rerun started from and returned to a clean isolated worktree. The original
`main` checkout remained untouched at
`1e4926e0286a7b4f3bed59b0b48e0b6384de4abd` with its previously recorded
unrelated modifications and untracked files. The historical 2026-09-08
failure/fix/baseline path remains below rather than being rewritten as current
evidence.

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
