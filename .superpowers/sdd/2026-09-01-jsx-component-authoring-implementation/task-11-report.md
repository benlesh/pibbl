# Task 11 report — deterministic scenario and cross-feature test migration

## Result

Task 11 is implemented and ready to commit.

- Workspace: `/private/tmp/crc-jsx-component-authoring`
- Branch: `codex/jsx-component-authoring`
- Required start: `ec4c2305b89f5a31af3376fa30828ac1439e96f3`
- Runtime: Node `v26.7.0`, pnpm `11.21.0`
- R8 variance: Node 26 is noncanonical versus the documented Node 24 LTS
  line. Node 24 was not available in this workspace.
- Review mode: self-review only, because Task 11 explicitly prohibited
  subagents and reviewers.

All 16 deterministic test-lab sources now use descriptive uppercase JSX and
ordinary components. Cross-feature evidence uses JSX or `createElement` and no
longer authors scenes through `defineComp`, lowercase component factories,
`CompEl`, `CompFn`, or the old focus enhancer functions. Production legacy
adapters and exports remain for Task 12.

## Deterministic scenario migration

- Renamed every deterministic source from `.example.ts` to `.example.tsx`:
  surface/smoke, five drawing and composition sources, layout, hooks/lifecycle,
  interaction, focus, geometry, cleanup, mouse, and performance.
- Converted scene structure to `Rectangle`, `Path`, `SvgPath`, `Line`,
  `HorizontalLine`, `VerticalLine`, `Text`, `Image`, `Group`, `Clip`, `Layer`,
  `Absolute`, `Overlay`, `Flow`, `Flex`, and `Grid` JSX.
- Converted focus composition to `FocusManagement` and
  `KeyboardNavigation` policy elements. `Text` receives content through normal
  children, and `Layer` receives normal children instead of a render prop.
- Kept scenario orchestration in the existing `.ts` helpers. Those helpers
  mount the TSX-authored scenes through `crc` and do not reintroduce a second
  authoring vocabulary.
- Preserved all 16 source-marker declarations and exported state type names;
  a direct before/after script checked those identifiers against `ec4c230`.
  Catalog validation and the representative suites additionally retain source
  IDs, action IDs, state/controller contracts, canvas sizes, geometry, manual
  procedures, and deterministic assertions.
- The learning catalog remains separate and unchanged. Its intentionally
  stricter authoring/readability policy is not applied to deterministic
  scenarios.

Scenario metadata now uses `language: "tsx"` and exact `.example.tsx` paths.
The Studio raw-source glob is TSX-only for test labs, API tags and display prose
use descriptive component names, and `docs/scenario-index.md` was regenerated.
The resulting catalog still contains 42 learning lessons and 16 test labs.

## Cross-feature evidence migration

The migration touched 65 cross-feature test files: 47 colocated core unit files
and 18 browser/integration files under `packages/core/test`. It also converted
the shared component harness and focus-policy test fixture.

- Ordinary functions now represent user components. `.ts` tests use
  `createElement` when element structure is incidental; existing `.tsx` tests
  use JSX where tree shape and policy nesting are the subject.
- Low-level drawing and layout probes use private `definePrimitive`, retaining
  exact Canvas/context/style capabilities without exercising obsolete public
  authoring syntax.
- `CRCElement` and `CRCComponent` replace legacy descriptor/function aliases.
- Focus tests construct policy descriptors through `createElement` and final
  policy components. The final test helper returns `CRCElement`, not `CompEl`.
- The four former `defineComp` contract cases were not discarded. They now
  assert the corresponding final element/primitive guarantees: fresh
  descriptors with stable type and copied props, specified/resolved style
  delivery, pre-render rejection of unresolved allocation syntax, and
  rejection of an untyped resolver that leaks allocation syntax.
- Lifecycle, event order, focus, cleanup, geometry, image races, layer caching,
  root scheduling, and performance-structure assertions were retained.

No production adapter, legacy export, or implementation file scheduled for
Task 12 deletion was removed in this task.

## Migration contract and TDD evidence

The scenario gate was strengthened before source migration. Both the tooling
catalog command and executable browser test use the same Babel-AST inspection
path. Deterministic sources must contain JSX, import executable public values
from `@crc/core`, and reject legacy component bindings/direct component calls,
`TextStyle.text`, and `Layer.render`. This intentionally avoids the false
positives produced by a word/regex-only gate, such as native
`CanvasRenderingContext2D.rect()` calls.

A repository type fixture imports only the final public vocabulary and proves
both TSX and direct `createElement` authoring.

### RED

Before migrating sources, the strengthened focused gate reported exactly the
two intended migration failures: deterministic catalog entries still declared
`language: "ts"` and still referenced `.example.ts`. The independent catalog
tool also rejected the first old deterministic source path. No implementation
was changed before this RED evidence.

### GREEN

The post-migration combined scenario-catalog and representative run passed 6
files and 44 tests. After final fixture cleanup, the controller reran the exact
Task 11 five-file representative command with local-server permission:

```sh
corepack pnpm@11.21.0 exec vitest run \
  packages/core/test/smoke-scenario.test.ts \
  packages/core/test/drawing-gallery.test.ts \
  packages/core/test/layout-foundation.test.ts \
  packages/core/test/runtime-hooks-laboratory.test.ts \
  packages/core/test/focus-navigation.test.ts \
  --browser.headless --browser.ui=false
```

```text
Test Files  5 passed (5)
Tests       22 passed (22)
```

After rewriting the four final element/primitive contract cases, the
controller also ran the changed file directly:

```text
packages/core/src/lib/runtime-contract.test.ts: 13 passed (13)
```

## Final verification

### Catalog, types, lint, and static triage

```sh
node --import tsx tooling/scenario-catalog.ts
corepack pnpm@11.21.0 typecheck
corepack pnpm@11.21.0 lint
git diff --check
```

```text
Validated 42 lessons, 16 test labs, and docs/scenario-index.md.
tsc --noEmit: passed
ESLint and Prettier: passed
git diff --check: no output
```

The package-script form of `scenarios:check` had already passed against the
migrated catalog. A later sandboxed rerun was prevented by the `tsx` CLI's IPC
bind restriction, so the final equivalent invocation used Node's `tsx` loader
and completed without the IPC server.

The plan's broad grep was reviewed semantically. Remaining broad matches divide
into these permitted groups:

- production compatibility declarations and adapters deliberately retained
  until Task 12;
- native Canvas methods such as `path.rect(...)` and ordinary local words;
- adversarial source strings in the learning/scenario AST-gate tests; and
- direct policy calls in low-level diagnostic tests that assert the helpful
  outside-renderer error itself.

There are no real legacy authoring imports/calls in deterministic scenarios,
cross-feature tests, the shared component harness, or focus test support. There
are no deterministic `.example.ts` files or production references to their old
paths. The apparent `language: 'ts'`, legacy import, and direct-component-call
matches are negative test fixtures for the migration gate.

### Complete core and browser evidence

```sh
corepack pnpm@11.21.0 exec vitest run \
  packages/core/src/lib/components \
  packages/core/src/lib/events \
  packages/core/src/lib/focus \
  packages/core/src/lib/hooks \
  packages/core/src/lib/layout \
  packages/core/src/lib/runtime-contract.test.ts \
  --browser.headless --browser.ui=false
```

```text
Test Files  48 passed (48)
Tests       575 passed (575)
```

```sh
corepack pnpm@11.21.0 test:ci
```

```text
Test Files  83 passed (83)
Tests       1039 passed | 2 skipped (1041)
Duration    21.46s
```

That aggregate run preceded the coverage-preserving rewrite of four assertions
in `runtime-contract.test.ts`; the final version of that only subsequently
changed runtime file passed all 13 tests as recorded above. The final scenario
representative slice also passed after the last shared-fixture type cleanup.

### Studio source and built modes

```sh
corepack pnpm@11.21.0 playground:build
corepack pnpm@11.21.0 playground:build:built
```

```text
CRC Studio declarations passed strict TSX, compiler-runtime, event-family,
generic, layout, and surface checks in both modes.
Source mode: 1308 modules transformed; built in 896ms.
Built mode: 1209 modules transformed; built in 898ms.
```

Both builds emitted chunks for every migrated test lab. Output retained only
the pre-existing ineffective-dynamic-import and large-chunk warnings.

### Package and built-runtime evidence

```sh
corepack pnpm@11.21.0 test:package-consumer
corepack pnpm@11.21.0 test:package-consumer:packed
```

```text
Workspace Bundler, NodeNext, and runtime consumer: passed.
Packed Bundler, NodeNext, declarations, runtime exports, blocked deep imports,
no-source checks, and optimized focus elimination: passed.
```

The packed check measured 113966 no-focus bytes and 137630 with-focus bytes;
the focus marker remained absent without focus and present with focus.

The first local `test:smoke:built` attempt rebuilt all packages successfully
but the browser could not bind its sandboxed local port (`EPERM`). Two
automatic permission-review attempts timed out before process launch. The
controller reran the exact command with local-server permission:

```text
Built smoke: 1 file passed, 1 test passed, exit 0.
```

### Visual safety

```sh
corepack pnpm@11.21.0 test:visual-safeguard
```

```text
Visual safeguard rejected the drill, preserved every baseline byte, and
recovered green.
```

No screenshot or visual-baseline file is modified. Baselines were not rewritten.

## Self-review and concerns

- All 16 test-lab paths are direct `.ts` to `.tsx` renames. Because four of the
  largest scenes changed more than half their lines while becoming JSX, the
  final staged review used `--find-renames=20%`; all 16 are recognized as
  renames at similarities from 42% to 74%, so the structural moves remain
  reviewable rather than being mistaken for unrelated files.
- Temporary codemod/recovery scripts were removed. The final diff has no
  generated migration helper and avoids the earlier printer-wide formatting
  churn.
- Static checking is binding- and AST-aware. It rejects actual obsolete CRC
  syntax while allowing native Canvas calls and local names.
- The final type fixture, catalog, Studio source/built builds, source and packed
  consumers, browser behavior, built smoke, and visual safeguard agree on TSX
  scenario consumption.
- Production compatibility symbols intentionally remain. Removing them in this
  task would collapse the explicit Task 11 → Task 12 boundary.
- Browser commands need local IPC/listen permission in this environment. Every
  code-relevant blocked command has an equivalent passing run recorded above;
  the bind failures occurred before tests launched.
- Fresh evidence remains Node 26.7.0 rather than the canonical Node 24 LTS line
  recorded by R8.
