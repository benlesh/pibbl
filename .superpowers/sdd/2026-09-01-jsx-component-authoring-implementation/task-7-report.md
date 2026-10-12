# Task 7 report — recursive JSX layout children

> **Historical status: COMPLETED IMPLEMENTATION EVIDENCE.** This dated report is preserved for audit and is not current API guidance.

## Result

Task 7 is implemented and ready to commit.

- Workspace: `/private/tmp/pibbl-jsx-component-authoring`
- Branch: `codex/jsx-component-authoring`
- Required start: `41f2c4af51b89d5c1e21ff8c1502d8310e59179d`
- Runtime: Node `v26.7.0`, pnpm `11.21.0`
- R8 variance: Node 26 is noncanonical versus the documented Node 24 LTS
  line. Node 24 was not available in this workspace.
- Review mode: self-review only, as Task 7 explicitly prohibited subagents and
  reviewers.

Public `Absolute`, `Overlay`, `Flow`, `Flex`, and `Grid` are now descriptive
`definePrimitive` component values. Each accepts the complete recursive
`PibblNode` child algebra, materializes one finite frozen direct-element array at
its receiving render or measurement boundary, and reuses that same array for
inspection, measurement, placement, and paint preparation.

Temporary lowercase layout adapters remain until Task 12. Focus policy
authoring, examples, scenarios, and unrelated component vocabulary were not
converted.

## Implementation

### One direct-child preparation boundary

- Added `materializeLayoutChildren`, the single layout preparation helper over
  `materializeContainerChildren`.
- `renderAbsolute`, `renderOverlay`, `renderFlow`, `renderFlex`, and
  `renderGrid` invoke the helper exactly once, then pass its frozen result
  through all direct-child layout work. No algorithm rereads author arrays or
  iterables.
- Flow, Flex, and Grid pure measurement invoke the same helper once per
  receiving measurement. The direct `layoutFlow`, `layoutFlex`, and
  `layoutGrid` algorithm entry points also prepare recursive input once before
  calculation.
- Layout preparation defers duplicate-key validation to the existing placement
  identity scope. This retains one-time flattening while preserving established
  fail-closed timing: a later duplicate still releases resources acquired by
  an earlier child exactly once.
- Unkeyed Fragments flatten through `materializeContainerChildren`; unsupported
  residual values use its contextual diagnostics. Keyed Fragments remain
  direct elements and therefore must satisfy the ordinary direct-item style
  contract.

### Immutable elements and private placement metadata

- Replaced every layout `{ ...child }` structural clone with
  `clonePibblElement`. Measurement and paint clones are branded, immutable Pibbl
  elements that preserve props, key, JSX development source, legacy adapter
  props, and other private metadata.
- Used-size and pre-normalized style overrides remain private WeakMap metadata
  on those per-occurrence clones. Primitive receiver tokens are attached to
  the clones so one occurrence shares materialized content between measurement
  and paint while repeated use of the same descriptor receives distinct
  tokens.
- Removed `isPreNormalizedElement` and the child traversal exception that
  authenticated unbranded object spreads through a WeakMap. Child traversal
  now admits only branded Pibbl elements.
- Direct-child declared style continues to come from
  `element.props.style`. A plain child receives the same author props and the
  exact same specified style object by identity; its finite used allocation is
  available only through `pibblLayoutBox()` and the private placement wrapper.
- Placement identity still preserves the original child component type, key,
  and unkeyed occurrence. Keyed reorder evidence covers every layout
  algorithm.

### Public and package surface

- Added the five uppercase layout values to the root package exports while
  retaining lowercase adapters.
- Updated the source package-consumer runtime allowlist with exactly those five
  values.
- Added Bundler and NodeNext TSX consumer evidence that all five values accept
  recursive generator children through the automatic JSX runtime.

## Observable evidence added

`packages/core/src/lib/layout/layout-jsx.test.tsx` adds 13 public-package JSX
tests:

- one case for each Absolute, Overlay, Flow, Flex, and Grid algorithm with
  nested arrays, a synchronous generator, true and false conditionals, keyed
  plain components, a direct Rectangle primitive, exact local allocation and
  global placement, overflow clipping, specified-style object identity, and
  keyed reorder without remount;
- Flow, Flex, and Grid render paths with measured automatic child sizes,
  proving one generator execution feeds child inspection, measurement,
  placement, and paint;
- Flow, Flex, and Grid pure measurements with recursive generator input,
  proving exactly one materialization and no render work;
- a repeated Text descriptor under Flow, proving Task 5 per-occurrence receiver
  tokens keep two occurrences distinct while each shares its own measurement
  content with paint; and
- a Flow iterable inside Layer, proving Task 6 retained snapshot equality does
  not execute the layout iterable on a cache hit.

The existing lifecycle ownership test remained the authoritative regression
for duplicate-key failure timing and exact handler release. The existing 120
layout tests continued to own detailed algorithm diagnostics and compatibility
geometry.

## TDD evidence

### Clean baseline

Before test or production edits, the required Task 7 layout scope passed:

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/layout packages/core/test/layout-foundation.test.ts packages/core/test/flex-css-compatibility.test.ts packages/core/test/grid-css-compatibility.test.ts --browser.headless --browser.ui=false
```

```text
Test Files  11 passed (11)
Tests       120 passed (120)
Duration    1.67s
```

The first sandboxed attempt could not bind Vitest's local browser port
(`listen EPERM ::1:63315`; no tests ran). The identical command passed with
local-listener permission. This was an environment restriction, not a
repository failure.

### RED

The 13 JSX layout tests were written before production changes. The required
RED command then retained all 120 inherited passes and failed the new suite at
the intended missing public surface:

```text
SyntaxError: @pibbl/core does not provide an export named `Absolute`
Test Files  1 failed | 11 passed (12)
Tests       120 passed (120)
```

### GREEN and investigated test corrections

After the implementation, the first focused run passed 9 of 13 tests. Four
new assertions were corrected only after tracing their observed geometry and
paint behavior:

- Flow and Flex source-order reorder correctly changes positions even while
  keyed identities remain stable;
- the chosen Overlay clipping probe is painted by the intentionally
  overflowing green plain child, not the purple direct primitive; and
- Text without a fill performs no `fillText` call.

No production layout behavior changed for those corrections. The focused
suite then passed 13 of 13.

The first full-core run exposed an existing lifecycle oracle: eager duplicate
key validation produced zero handler acquisitions instead of one acquisition
and one release. The fix kept one-time flattening but restored placement-owned
key validation. The focused lifecycle plus JSX layout run passed 19 of 19, and
the final full core run was green.

## Verification

All final evidence below ran after production changes on Node `v26.7.0` and
pnpm `11.21.0`.

### Required Task 7 Step 6 gate

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/layout packages/core/test/layout-foundation.test.ts packages/core/test/flex-css-compatibility.test.ts packages/core/test/grid-css-compatibility.test.ts packages/core/test/jsx-authoring.test.tsx --browser.headless --browser.ui=false
```

```text
Test Files  13 passed (13)
Tests       145 passed (145)
Duration    1.80s
```

### Full core browser suite

```sh
corepack pnpm@11.21.0 test:ci
```

```text
Test Files  82 passed (82)
Tests       866 passed | 2 skipped (868)
Duration    22.41s
```

### Visual safeguard

```sh
corepack pnpm@11.21.0 test:visual-safeguard
```

```text
Visual safeguard rejected the drill, preserved every baseline byte, and recovered green.
```

No expected image or visual baseline changed.

### Typecheck, lint, and core build

```sh
corepack pnpm@11.21.0 typecheck
corepack pnpm@11.21.0 lint
corepack pnpm@11.21.0 -C packages/core build
git diff --check
```

```text
tsc --noEmit: passed
ESLint: passed
Prettier: all matched files use Prettier code style
@pibbl/core declarations and ESM bundles: passed
git diff --check: no output
```

The core build emitted `index`, `types`, `jsx-runtime`, and
`jsx-dev-runtime` declarations, bundles, and source maps.

### Source and packed package consumers

```sh
corepack pnpm@11.21.0 test:package-consumer
corepack pnpm@11.21.0 test:package-consumer:packed
```

The source consumer passed the workspace build, strict Bundler and NodeNext
compiles, automatic-runtime TSX layout fixture, exact runtime exports, and
blocked private subpaths. Its first run failed only because the exact runtime
allowlist omitted the five new uppercase values; adding precisely those values
made the same command green.

The packed consumer passed Bundler, NodeNext, declarations, runtime exports,
blocked deep imports, no-source checks, and optimized focus elimination. It
reported `112770` no-focus bytes versus `136083` with-focus bytes.

## Self-review

- Read `AGENTS.md`, the complete approved JSX design, Task 7 brief, progress
  ledger, implementation-plan Task 7 section, and the full style, layout,
  runtime/hook, drawing, and surface contracts before editing.
- Verified every layout public value is produced by `definePrimitive` from a
  `render*` callback and the lowercase adapter retains its historical
  descriptive component name.
- Verified every receiving render and supported pure measurement invokes the
  layout materializer once, with no subsequent author iterable read.
- Verified direct algorithm entry points prepare recursive input once before
  resolving placements.
- Verified used-size and measurement clones are branded and immutable and that
  no unbranded child exception remains.
- Verified plain component props and `props.style` identity are unchanged while
  `pibblLayoutBox()` supplies finite local allocation.
- Verified primitive style normalization is reused rather than repeated and
  allocation syntax is finite before primitive dispatch.
- Verified per-occurrence receiver tokens remain distinct for descriptor reuse
  and shared for one occurrence's measurement and paint.
- Verified Layer snapshot equality does not execute retained nested layout
  iterables.
- Verified duplicate keys retain the existing placement identity diagnostic
  path and exact partial-owner teardown.
- Verified source paint order, reverse target order, clipping, local box
  stability, keyed reorder, measurement isolation, and lowercase adapter
  compatibility through the focused and full-core suites.
- Inspected the final diff and file list, confirmed no focus policy, example,
  scenario, or baseline migration was included, and found no remaining Task 7
  correctness concern.

## Remaining concern

The only open variance is R8: verification is fresh on Node 26.7.0 rather than
the documented Node 24 LTS line. No Node-24-specific evidence was available in
this workspace.

---

## Fix round 1 — nested preparation reuse and clone-safe policies

### Result

Both review blockers are resolved.

- A measured nested Flow, Flex, or Grid occurrence now shares one exact frozen
  direct-element array with its later paint in the same render transaction.
  The cache is scoped by both render transaction and Task 5's per-occurrence
  primitive receiver token.
- Repeated occurrences of one descriptor remain isolated, a later render uses
  a new transaction and revalidates its iterable, and standalone
  `measureElement` calls materialize independently. Direct `layoutFlow`,
  `layoutFlex`, and `layoutGrid` calls remain uncached and retain their existing
  one-call semantics.
- `clonePibblElement` now copies registered private WeakMap-backed annotations.
  Enhancer/policy descriptor arrays are stored frozen and each clone receives a
  distinct frozen array containing the same readonly descriptor identities.
  Mounted enhancer ownership is deliberately not copied.
- Layout measurement clones remain pure; enhancer mount/update/enter/exit only
  occur for the final painted element. Absolute, Flow, Flex, and Grid placement
  clones retain custom enhancers. A measured and placed Grid child retains the
  existing `withFocusManagement` plus `withKeyboardNavigation` semantics,
  component identity, Pibbl brand, development freeze, and private-only metadata.
- No public element field or forgeable object exception was introduced. The
  existing focus functions and lowercase layout adapters remain unchanged for
  Tasks 8 and 12 respectively.

### TDD evidence

The corrected focused RED was run before production edits:

```sh
corepack pnpm@11.21.0 exec vitest run --config vitest.config.ts packages/core/src/lib/layout/layout-jsx.test.tsx packages/core/src/lib/element-enhancers.test.ts
```

```text
Test Files  2 failed (2)
Tests       15 failed | 25 passed (40)
Duration    1.13s
```

The failures matched the reported defects: one-shot nested children painted
zero descendants, reusable nested iterables ran four times instead of twice,
cloned descriptor lists were empty, custom layout-child enhancers did not
mount, and the measured Grid child installed no focus policy. An earlier RED
attempt used the uppercase primitive values as ordinary functions in the
internal `.ts` test; those four test-construction errors were corrected to use
`createElement` before recording the behavioral RED above.

After the minimal production changes and test-oracle corrections, the focused
suite passed:

```text
Test Files  2 passed (2)
Tests       40 passed (40)
Duration    812ms
```

The new layout evidence includes Flow/Flex/Grid one-shot generators, reusable
iterables that yield different descriptors, the exact same nested descriptor
used twice, a later root render, and repeated standalone measurements. The new
enhancer evidence includes direct immutable clone assertions, every layout
placement clone that performs this work, pure measurement, focus/directional
policy collection, and stable keyed identity on rerender.

### Verification

All commands below ran on Node `v26.7.0` with pnpm `11.21.0` after the final
production changes.

Required Task 7 Step 6 gate:

```text
Test Files  13 passed (13)
Tests       154 passed (154)
Duration    1.89s
```

Focused enhancer, focus/keyboard, Layer, and lifecycle gate:

```text
Test Files  14 passed (14)
Tests       188 passed (188)
Duration    10.52s
```

Full core browser suite (`corepack pnpm@11.21.0 test:ci`):

```text
Test Files  82 passed (82)
Tests       880 passed | 2 skipped (882)
Duration    21.57s
```

Visual safeguard:

```text
Visual safeguard rejected the drill, preserved every baseline byte, and recovered green.
```

Static, build, and package evidence:

- `corepack pnpm@11.21.0 typecheck`: passed.
- `corepack pnpm@11.21.0 lint`: ESLint passed and Prettier reported all
  matched files conforming.
- `corepack pnpm@11.21.0 -C packages/core build`: declarations, ESM bundles,
  JSX runtime entries, and source maps passed; `dist/index.mjs` was 300.1kb.
- `corepack pnpm@11.21.0 test:package-consumer`: workspace build, Bundler,
  NodeNext, runtime exports, and source consumer passed.
- `corepack pnpm@11.21.0 test:package-consumer:packed`: declarations,
  Bundler, NodeNext, runtime exports, blocked deep imports, no-source checks,
  and optimized focus elimination passed; `113146` no-focus bytes versus
  `136474` with-focus bytes.
- `git diff --check`: no output.

### Self-review and remaining concern

- Confirmed only primitive measure/render paths use transaction reuse; public
  direct algorithms still call the uncached materializer.
- Confirmed the cache cannot cross occurrences or renders because the first key
  is the root render transaction and the second is the occurrence receiver
  token. Standalone measurement has no transaction and cannot enter the cache.
- Confirmed `materializeContainerChildren` remains the sole traversal and
  freezes every prepared direct-element array; key-diagnostic timing remains
  placement-owned.
- Confirmed clone handlers operate only on finalized branded elements and use
  WeakMaps, so no public field or structural-copy admission was restored.
- Confirmed descriptor arrays do not alias, remain frozen, preserve descriptor
  identity for Layer equality and enhancer reconciliation, and do not copy
  mounted resource ownership.
- Inspected the complete production diff and found no remaining correctness
  concern in the fix scope.

The sole remaining variance is still R8: Node 26.7.0 is available here instead
of the documented Node 24 LTS line. No baseline was rewritten.
