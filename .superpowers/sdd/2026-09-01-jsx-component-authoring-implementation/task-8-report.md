# Task 8 report — transparent focus policy components

> **Historical status: COMPLETED IMPLEMENTATION EVIDENCE.** This dated report is preserved for audit and is not current API guidance.

## Result

Task 8 is implemented and ready to commit.

- Workspace: `/private/tmp/crc-jsx-component-authoring`
- Branch: `codex/jsx-component-authoring`
- Required start: `ee12465`
- Runtime: Node `v26.7.0`, pnpm `11.21.0`
- R8 variance: Node 26 is noncanonical versus the documented Node 24 LTS
  line. Node 24 was not available in this workspace.
- Review mode: self-review only, as Task 8 explicitly prohibited subagents and
  reviewers.

Public `FocusManagement` and `KeyboardNavigation` component values replace the
two root-exported enhancer functions. They are preparation-only descriptors:
each removes empty child values, requires exactly one remaining branded CRC
element, and appends the existing private lifecycle descriptor to a clone of
that child before component identity is assigned.

The old implementation files and functions remain private for lifecycle reuse,
as allowed by the Task 8/Task 12 progress ruling. They are no longer exported
or used through the public package surface.

## Implementation

### Private policy preparation

- Added a WeakMap-backed policy-definition registry beside the existing
  primitive metadata registry. No public fields are attached to policy
  functions or element descriptors.
- `materializeContainerChildren` recognizes a policy before ordinary component
  or Fragment dispatch. It materializes each policy's child structure once,
  removes empty values, validates exactly one branded child, and recursively
  collects nested policy descriptors.
- Pending policies are applied outer-to-inner to the final child. Each policy
  uses the existing append operation, so existing private child metadata stays
  first while nested JSX policies retain declaration-order entry.
- Each append uses `cloneCRCElement`; all Task 7 source, style, receiver,
  identity-hint, and registered clone metadata is preserved. The enhancer clone
  handler also copies its frozen descriptor array.
- Policy values are built by a conditionally pure factory initializer. This
  keeps WeakMap registration when a policy export is used while allowing the
  whole focus implementation to disappear from an optimized non-focus bundle.

### Public policy contract

- Added public `FocusManagement`, `KeyboardNavigation`,
  `FocusManagementProps`, and `KeyboardNavigationProps` exports.
- The recursive child type accepts branded elements, arrays, finite synchronous
  iterables, and empty values while excluding raw strings and nonzero numbers.
- Runtime validation rejects zero remaining elements, multiple elements, raw
  text, unsupported values, and foreign React-like elements with the receiving
  policy name and JSX development source when available.
- Direct calls to either component produce the approved diagnostic directing
  authors to CRC JSX or `createElement`.
- Directional-mode validation, keyboard-without-focus validation, duplicate
  focus/directional policy validation, and OffscreenCanvas focus-host
  diagnostics now use the public policy vocabulary.

### Transparency and retained behavior

The focused evidence covers:

- exact child type, props, style object, key, private identity hint, and clone
  metadata preservation;
- stable component ID, parent ID, hook state, layout-box object, pure
  measurement, paint order, pixels, and logical event path when both policies
  are added and removed;
- existing descriptor append order followed by outer-to-inner policy order;
- focus manager and directional-boundary mount, update, entry, exit, failure,
  replacement, removal, and idempotent cleanup behavior;
- focus candidate IDs, press focus, Tab order, arrow navigation, keyboard
  activation, focus events, and DOM host ownership;
- Layer retained-tree equality and cached focus metadata replay without child
  execution; and
- the existing 1,000-render ownership stress test with stable counters.

## Public migration and scope boundary

- Migrated the complete core focus suite, public focus API evidence,
  focus-navigation scenario, Layer focus/cache tests, lifecycle ownership test,
  package consumers, packed tree-shaking probe, and Studio declaration probe.
- Updated focus-only catalog tags/notes and regenerated
  `docs/scenario-index.md` so no public scenario advertises the removed names.
- Five existing keyboard/focus learning `.ts` sources had to move from the
  removed public functions to `createElement(FocusManagement, ...)` and
  `createElement(KeyboardNavigation, ...)` for the current build and catalog
  gate. This is the only Task 10 pull-forward. They remain `.ts`, keep their
  existing lesson content and metadata shape, and were not converted to the
  planned JSX lesson authoring.
- The focus-navigation deterministic scenario was the only Task 11 scenario
  touched, because it directly used the removed public functions. No general
  deterministic catalog or syntax migration was pulled forward.

## TDD and investigation evidence

### RED

`policy-components.test.tsx` and the JSX type fixtures were written before the
production implementation. The focused runtime run failed because `@crc/core`
did not export `FocusManagement`; `typecheck` failed on both missing policy
exports and their not-yet-defined props contracts.

After the first implementation, the migrated focus gate exposed stale public
imports, old diagnostic vocabulary, and assertions that still inspected the
preparation descriptor rather than its transparent child. Those call sites and
oracles were migrated without weakening the behavioral assertions.

The first packed consumer run then failed its existing focus-elimination guard:

```text
Optimized no-focus bundle retained focus implementation code.
```

A direct esbuild trace showed `CRC_FOCUS_MANAGEMENT_V1` in a rect-only bundle.
The cause was two unconditional top-level WeakMap registrations. Moving
registration into the policy value's conditionally pure initializer made a
rect-only probe omit both the marker and registration while a
`FocusManagement` probe retained both. The unchanged packed guard then passed.

The expanded event-path assertion initially dispatched only `click`, which did
not establish the existing mouse activation sequence. Reusing the established
`mousedown`/`mouseup`/`click` test driver made the assertion pass without a
production change.

The first scenario check rejected a transitional local helper import because
learning examples may import only `@crc/core`. Inlining the public
`createElement` policy descriptors into the five focus lessons restored that
contract. Regenerating the index then resolved the expected stale generated
catalog after focus API tags changed.

### Final focused gate

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/focus packages/core/src/lib/element-enhancers.test.ts packages/core/src/lib/components/layer.test.ts packages/core/test/focus-navigation.test.ts packages/core/test/interaction-dispatch.test.ts --browser.headless --browser.ui=false
```

```text
Test Files  15 passed (15)
Tests       200 passed (200)
Duration    2.74s
```

## Final verification

All evidence below ran after the final production and migration changes.

### Complete core browser suite

```sh
corepack pnpm@11.21.0 exec vitest run packages/core --browser.headless --browser.ui=false
```

```text
Test Files  83 passed (83)
Tests       887 passed | 2 skipped (889)
Duration    21.43s
```

### Static, catalog, build, and Studio checks

```sh
corepack pnpm@11.21.0 typecheck
corepack pnpm@11.21.0 lint
corepack pnpm@11.21.0 scenarios:check
corepack pnpm@11.21.0 playground:build
git diff --check
```

```text
tsc --noEmit: passed
ESLint: passed
Prettier: all matched files use Prettier code style
Scenario catalog: 41 lessons, 16 test labs, and docs/scenario-index.md validated
Studio declarations: strict consumer passed
Playground Vite production build: passed
git diff --check: no output
```

The playground build retained its existing `import.meta`/IIFE, dynamic-import,
and large-chunk warnings; it exited successfully. Workspace package builds also
ran successfully as part of both consumer gates.

### Source and packed package consumers

```sh
corepack pnpm@11.21.0 test:package-consumer
corepack pnpm@11.21.0 test:package-consumer:packed
```

The source consumer passed the workspace build, strict Bundler and NodeNext
compiles, exact runtime exports, public descriptor construction, and blocked
private subpaths.

The packed consumer passed Bundler, NodeNext, declarations, runtime exports,
blocked deep imports, no-source checks, and optimized focus elimination. It
reported the focus marker absent without a policy import and present with one:
`113647` no-focus bytes versus `137311` with-focus bytes.

### Visual safeguard

```sh
corepack pnpm@11.21.0 test:visual-safeguard
```

```text
Visual safeguard rejected the drill, preserved every baseline byte, and recovered green.
```

No expected image or visual baseline changed.

## Self-review and concerns

- Root exports, package consumers, Studio declarations, focus scenario tags,
  and learning sources contain no public use of `withFocusManagement` or
  `withKeyboardNavigation`.
- The only remaining occurrences are the approved private implementation
  functions and their private legacy diagnostics. Task 12 owns their deletion.
- Policy descriptors never reach ordinary component dispatch, so they acquire
  no identity, parent, layout, paint, hook, or measurement boundary.
- Layer comparison sees the prepared child's stable descriptor objects, and a
  cache hit replays retained focus metadata without executing children.
- The top-level registration shape was specifically checked for tree-shaking;
  policy imports retain registration and rect-only imports eliminate focus.
- Fresh evidence is Node 26.7.0 only. Node 24 LTS remains unverified under R8.

## Fix Round 1 — keyed Fragment ownership and direct measurement

Review of `ba45a0064f70f30befdbaf2b6f97fce6e13e13c6` found two
preparation-dispatch gaps. A policy attached its descriptors to a keyed
`Fragment`, but the Fragment-specific renderer did not run enhancer ownership
or entry/exit. Separately, public `measureElement` selected measurement support
before preparing a directly received policy descriptor.

### TDD RED

The new direct policy suite first failed with the production code unchanged:

```sh
corepack pnpm@11.21.0 exec vitest run \
  packages/core/src/lib/focus/policy-components.test.tsx \
  packages/core/src/lib/layout/measure.test.ts \
  packages/core/src/lib/components/layer.test.ts \
  --browser.headless --browser.ui=false
```

```text
Test Files  2 failed | 1 passed (3)
Tests       7 failed | 51 passed (58)
```

The failures independently demonstrated missing keyed-Fragment focus
ownership, missing keyed-Fragment lifecycle entry/exit, bypassed
keyboard-without-focus validation, three unsupported policy measurements, and
missing policy state during Layer replay.

### Implementation and regression coverage

- The keyed-Fragment renderer now reconciles, enters, and exits descriptors on
  its existing keyed identity scope. It still never invokes `Fragment`, opens
  hook or paint state, or creates an additional policy identity.
- Direct `measureElement(policy)` prepares that policy once before dispatch and
  measures the resulting child without reconciling or acquiring enhancers.
- Private preparation-source metadata preserves the original active
  measurement identity through policy clones. This prevents a cyclic
  measurement from evading cycle detection by manufacturing a fresh clone on
  each recursive call.
- Direct tests cover nested finite iterables executing exactly once, nested
  policy declaration order, keyed-Fragment focus and keyboard validation,
  duplicate managers, mount/update/enter/exit/dispose and failure cleanup,
  stable target state and parent identity, no Fragment hook slots, policy
  removal without remount, and Layer cache replay.
- Public measurement tests cover primitive and measurable-component parity,
  unsupported plain-component parity, invalid-child source metadata, nested
  iterable execution count, keyed-Fragment behavior, cycle detection, and no
  focus-manager DOM listener acquisition.

### Final Fix Round 1 evidence

All evidence below ran after the final implementation and cycle-identity
regression.

```sh
corepack pnpm@11.21.0 exec vitest run \
  packages/core/src/lib/focus/policy-components.test.tsx \
  packages/core/src/lib/layout/measure.test.ts \
  --browser.headless --browser.ui=false
```

```text
Test Files  2 passed (2)
Tests       22 passed (22)
```

```sh
corepack pnpm@11.21.0 exec vitest run \
  packages/core/src/lib/focus \
  packages/core/src/lib/element-enhancers.test.ts \
  packages/core/src/lib/components/layer.test.ts \
  packages/core/test/focus-navigation.test.ts \
  packages/core/test/interaction-dispatch.test.ts \
  --browser.headless --browser.ui=false
```

```text
Test Files  15 passed (15)
Tests       208 passed (208)
Duration    2.74s
```

```sh
corepack pnpm@11.21.0 exec vitest run \
  packages/core/src/lib/layout \
  packages/core/src/lib/focus \
  packages/core/src/lib/components/layer.test.ts \
  packages/core/src/lib/element-enhancers.test.ts \
  packages/core/test/lifecycle-ownership.test.ts \
  packages/core/test/runtime-cleanup-stress.test.ts \
  --browser.headless --browser.ui=false
```

```text
Test Files  24 passed (24)
Tests       329 passed (329)
Duration    10.49s
```

```sh
corepack pnpm@11.21.0 exec vitest run packages/core \
  --browser.headless --browser.ui=false
```

```text
Test Files  83 passed (83)
Tests       895 passed | 2 skipped (897)
Duration    21.43s
```

The following gates also passed:

```sh
corepack pnpm@11.21.0 typecheck
corepack pnpm@11.21.0 lint
corepack pnpm@11.21.0 scenarios:check
corepack pnpm@11.21.0 playground:build
corepack pnpm@11.21.0 test:package-consumer
corepack pnpm@11.21.0 test:package-consumer:packed
corepack pnpm@11.21.0 test:visual-safeguard
```

The packed tree-shaking check again found the focus marker absent without the
policy import and present with it: `113966` no-focus bytes versus `137630`
with-focus bytes. The visual safeguard preserved every baseline byte. The
playground build retained only the previously recorded warnings.

### Fix Round 1 self-review and concerns

- Enhancer ordering and validation use the same descriptor reconciliation as
  ordinary components; the keyed Fragment adds no second ownership boundary.
- Measurement preparation is direct-policy-only, so an unwrapped keyed
  Fragment retains its established unsupported-measurement diagnostic.
- Measurement performs preparation per public call and never invokes enhancer
  mount/update/enter/exit or attaches focus listeners.
- No public exports, declarations, scenario catalogs, or visual baselines
  changed in this fix. No Task 10–11 scenario work was pulled forward.
- Fresh evidence remains Node 26.7.0 with pnpm 11.21.0 under the R8 variance.
