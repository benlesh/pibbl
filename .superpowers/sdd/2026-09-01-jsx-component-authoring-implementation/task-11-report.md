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

## Fix Round 1 — deterministic migration gate completeness

The first review accepted the migration semantics but found three holes in the
deterministic-source gate, one discovery omission, and a stale documentation
count. This round closes those findings without changing runtime behavior,
scenario actions, geometry, or Canvas output.

### Executable policy

- Deterministic source inspection now resolves named and namespace
  `@crc/core` value bindings through lexical scopes. It rejects direct calls
  such as `CRC.Rectangle(...)`, computed namespace equivalents, and namespace
  legacy calls such as `CRC.rect(...)`, while allowing a genuinely local
  parameter that shadows an imported component name.
- Obsolete `CompEl`, `CompFn`, `ComponentInput`,
  `ComponentCapabilities`, and `FalsyNodes` type imports are rejected,
  including aliases and namespace-qualified uses. Dynamic imports, CommonJS,
  `import.meta`, import-equals syntax, default imports, side-effect imports,
  import attributes, and external runtime imports are also rejected.
- Deterministic scenarios use static public imports from `@crc/core`. Their
  existing relative imports are permitted only when type-only, so shared
  scenario event-trace contracts remain single-sourced without creating a
  runtime dependency. The two inline `import('./event-trace')` type queries
  were changed to ordinary static type imports.
- `Text` and `Layer` receive conservative legacy-sensitive inspection. Inline
  object props and styles are checked for `style.text` and `render`; external
  style expressions or spreads that could hide those fields are rejected.
  This is intentionally narrower than the learning catalog's overall inline
  readability policy.
- Source discovery now scans both `.example.ts` and `.example.tsx`. It first
  rejects every legacy `.example.ts`, including an orphan outside the catalog,
  then checks exact learning and deterministic catalog completeness. A
  temporary-directory Node check proves legacy-orphan rejection, uncataloged
  TSX rejection, and the matching-catalog success case.
- The gallery documentation now reports the actual 42 learning lessons. The
  generated index remains 42 lessons and 16 deterministic test labs.

The first version of the discovery check used a conventional `.test.ts`
suffix. The complete browser run correctly exposed that Vitest would collect
the Node-only fixture and fail on `node:fs/promises`. Renaming it to
`scenario-source-discovery.check.ts` keeps the check in `scenarios:check` and
outside browser test discovery. The post-rename aggregate run is green.

### RED and GREEN evidence

The controller captured the browser RED before the validator change:

```text
packages/core/test/scenario-catalog.test.ts
Test Files  1 failed (1)
Tests       3 failed | 22 passed (25)
```

The failures were the intended gaps: the namespace direct call produced only
the generic import diagnostic, the dynamic legacy import was accepted, and an
external `Text` style was accepted (with the `Layer` spread covered in the
same case). The independent discovery fixture also failed before its production
discovery module existed. Temporary failure screenshots from these RED runs
were removed.

After implementation, the focused browser gate passed all 25 tests, and the
Node discovery fixture reported:

```text
Scenario discovery fixture rejected legacy and uncataloged example sources.
```

After the fixture rename, the controller ran the exact package gate and the
complete browser suite:

```sh
corepack pnpm@11.21.0 scenarios:check
corepack pnpm@11.21.0 test:ci
```

```text
Scenario discovery fixture rejected legacy and uncataloged example sources.
Validated 42 lessons, 16 test labs, and docs/scenario-index.md.
Test Files  83 passed (83)
Tests       1046 passed | 2 skipped (1048)
```

That aggregate includes the five-file Task 11 representative slice and the
runtime-contract coverage. Their earlier exact focused runs remained green at
22/22 and 13/13 respectively; the only subsequent change was the tooling-only
discovery-check filename.

Final local static checks were also fresh after the rename:

```sh
node --import tsx tooling/scenario-source-discovery.check.ts
node --import tsx tooling/scenario-catalog.ts
corepack pnpm@11.21.0 typecheck
corepack pnpm@11.21.0 lint
git diff --check
```

```text
Discovery check: passed.
Catalog: validated 42 lessons, 16 test labs, and docs/scenario-index.md.
TypeScript: passed.
ESLint and Prettier: passed.
git diff --check: no output.
```

The Studio source build, Studio built-package build, workspace package
consumer, and packed-package consumer all passed with the strengthened gate.
The controller's post-fix built smoke rebuilt the packages and passed 1 file / 1
test. The post-fix visual safeguard rejected its drill, recovered green, and
preserved every baseline byte. No screenshot or visual-baseline file is part
of this fix.

### Fix-round self-review

- Scope resolution is based on parsed bindings rather than identifier text, so
  native Canvas methods and unrelated local words remain outside the policy.
- Deterministic imports are deliberately less restrictive than learning-source
  style: namespace JSX and aliases remain legal, but any imported descriptive
  component binding is still rejected when directly called.
- The `Text`/`Layer` rule rejects uninspectable legacy-sensitive expressions
  instead of guessing their values. All 16 current deterministic sources stay
  readable and pass the shared validator.
- Discovery behavior is exercised as a Node check rather than a browser test;
  `scenarios:check` is the owning aggregate boundary.
- Verification used Node 26.7.0 and pnpm 11.21.0. The existing R8 variance from
  the documented Node 24 LTS line remains unchanged.

## Fix Round 2 — deterministic module-policy matrix

The second review found that the deterministic validator still relied on a
learning-specific module flag that did not express the complete test-lab
policy. Source-backed re-exports were therefore accepted, nested TypeScript
import-equals declarations escaped the top-level scan, and the promise to
accept relative type-only imports did not consistently cover default imports.

### Final deterministic module policy

The shared inspection result now gives learning and deterministic sources
separately named module-policy facts. This preserves the deliberate catalog
boundary instead of applying the learning catalog's stricter canonical-export
rule to test labs.

- Deterministic sources may use named or namespace imports from `@crc/core`.
  Core default imports, side-effect imports, import attributes/assertions, and
  every external runtime import are rejected.
- A relative import is accepted only when the entire declaration is type-only.
  Default, named, namespace, inline named-type, and inline default-type forms
  are covered. Relative default/named/namespace runtime imports and relative
  side-effect imports are rejected. Non-relative external type imports are
  also rejected.
- Dynamic value imports, TypeScript import types, `import.meta`, bare CommonJS,
  known-global CommonJS paths, TypeScript export assignments, namespace
  exports, and import-equals declarations are rejected.
- The import-equals and export checks walk the complete parsed AST. A nested
  import-equals declaration inside a TypeScript namespace can no longer bypass
  the policy.
- Every source-backed named, star, namespace, value, or type re-export is
  rejected regardless of whether its source is `@crc/core`, relative, or an
  external package. This also prevents obsolete component authoring values and
  legacy types from escaping through a re-export.
- Local named declarations/exports and a local default export remain allowed.
  The 16 deterministic scenario modules intentionally expose source markers,
  state/action/controller types, scene functions, and in one case a default
  scenario definition; forbidding those would break the approved Task 11
  contract rather than strengthen module isolation.

All earlier authoring rules remain in the same matrix: named, aliased, and
namespace legacy component calls/imports; direct descriptive component calls;
JSX-only structure; legacy and uninspectable `Text`/`Layer` props; every one of
the five obsolete component types in aliased and namespace-qualified form; and
positive lexical-shadow, namespace JSX, native Canvas, and unrelated property
name cases.

### TDD evidence

The initial consolidated matrix produced the intended RED result before the
validator changed:

```text
packages/core/test/scenario-catalog.test.ts
Test Files  1 failed (1)
Tests       8 failed | 61 passed (69)
```

The eight failures were six source-backed re-export shapes, one nested
import-equals declaration, and the valid relative default type-only import.
One initially drafted combined default-plus-named `import type` fixture was
removed before implementation because TypeScript itself forbids that syntax;
the corrected RED run above contains only valid TSX inputs. All temporary RED
failure screenshots were removed.

Once the behavior was green, nine negative import cases were changed to demand
an accurate diagnostic and went RED because the old message incorrectly said
that imports were allowed only from `@crc/core`. The final message now names
both supported categories—core named/namespace imports and relative type-only
imports—and the same nine cases returned green.

After implementation and consolidation, the final 64-case deterministic
policy matrix passed as part of the complete focused file:

```text
Test Files  1 passed (1)
Tests       85 passed (85)
```

### Final Fix Round 2 verification

```sh
node --import tsx tooling/scenario-source-discovery.check.ts
corepack pnpm@11.21.0 scenarios:check
corepack pnpm@11.21.0 exec vitest run \
  packages/core/test/smoke-scenario.test.ts \
  packages/core/test/drawing-gallery.test.ts \
  packages/core/test/layout-foundation.test.ts \
  packages/core/test/runtime-hooks-laboratory.test.ts \
  packages/core/test/focus-navigation.test.ts \
  --browser.headless --browser.ui=false
corepack pnpm@11.21.0 exec vitest run \
  packages/core/src/lib/runtime-contract.test.ts \
  --browser.headless --browser.ui=false
corepack pnpm@11.21.0 test:ci
```

```text
Discovery: rejected legacy and uncataloged example fixtures.
Catalog: validated 42 lessons, 16 test labs, and docs/scenario-index.md.
Representative scenarios: 5 files, 22 passed.
Runtime contract: 1 file, 13 passed.
Complete browser suite: 83 files, 1106 passed, 2 skipped.
```

```sh
corepack pnpm@11.21.0 typecheck
corepack pnpm@11.21.0 lint
corepack pnpm@11.21.0 playground:build
corepack pnpm@11.21.0 playground:build:built
corepack pnpm@11.21.0 test:package-consumer
corepack pnpm@11.21.0 test:package-consumer:packed
corepack pnpm@11.21.0 test:smoke:built
corepack pnpm@11.21.0 test:visual-safeguard
git diff --check
```

```text
TypeScript, ESLint, and Prettier: passed.
Studio source mode: declarations passed; 1308 modules transformed.
Studio built mode: declarations and package build passed; 1209 modules transformed.
Workspace and packed Bundler/NodeNext/runtime consumers: passed.
Built smoke: 1 file, 1 passed.
Visual safeguard: rejected the drill, recovered green, and preserved every
baseline byte.
git diff --check: no output.
```

The fix changes only the shared static inspector, its consolidated browser
evidence, this report, and the ignored local progress ledger. Runtime code,
deterministic scenarios, catalogs/index output, and visual baselines are
unchanged. Verification remains on Node 26.7.0 with pnpm 11.21.0, retaining the
already documented Node 24 LTS R8 variance.

## Fix Round 3 — namespace scope and precise module diagnostics

The third review identified two remaining policy edges and one diagnostic
quality issue in the shared deterministic-source validator. This round keeps
the runtime, scenario sources, catalog/index, and visual baselines unchanged.

### Scope and import-policy corrections

- `TSModuleBlock` now participates in lexical-scope collection. Local
  functions, classes, variables, enums, and TypeScript namespace declarations
  therefore shadow an imported component or namespace only inside the owning
  module block.
- `TSModuleDeclaration` bindings are derived from identifier names and the root
  of dotted namespace names. String-literal ambient-module names deliberately
  do not create an outer lexical binding. Nested namespaces, dotted namespaces,
  local namespace member names that overlap legacy CRC names, and
  string-module-local namespace shadows have positive coverage. Matching
  negative cases prove that an unshadowed imported CRC namespace still resolves
  inside plain, nested, and dotted namespaces and that a local namespace shadow
  does not leak outside its module block.
- Type-only namespace imports now use the same shadow map as value namespace
  imports, preventing a local `CRC.CompEl` declaration from being mistaken for
  the imported obsolete type while retaining rejection of genuinely imported
  `CRC.CompEl` references.
- Bare `.` and `..` directory-index specifiers are classified as relative.
  Default, named, namespace, inline named-type, and inline default-type positive
  forms are represented across both directory-index spellings. Runtime default,
  named, namespace, and side-effect counterparts remain rejected.

### Precise module facts and diagnostics

The previous combined dynamic/unsupported-module booleans were replaced with
separate inspection facts for dynamic import expressions, TypeScript import
types, `import.meta`, import attributes/assertions, TypeScript import-equals,
TypeScript export assignments, and export-as-namespace declarations. CommonJS
and source-backed re-exports retain their own facts. The deterministic
validator checks those facts before the generic static-import policy, producing
an actionable diagnostic for the construct actually found. The learning
validator preserves its stricter module contract by combining the same precise
facts at its existing boundary.

The adversarial matrix now requires exact diagnostic families for import
attributes/assertions, top-level and nested import-equals, export assignment,
export as namespace, dynamic value imports, TypeScript import types,
`import.meta`, and ten bare/known-global CommonJS forms. Existing source-backed
namespace re-export coverage continues to require the re-export diagnostic.

### TDD evidence

Before changing the validator, the consolidated focused file produced the
intended RED result:

```text
Test Files  1 failed (1)
Tests       33 failed | 77 passed (110)
```

The failures were seven valid namespace-shadow cases, eight valid bare `.`/`..`
type-only imports, and eighteen precise-diagnostic expectations. The new
unshadowed namespace cases and bare directory-index runtime imports were already
green, demonstrating that the RED was limited to the requested gaps. After the
implementation, the recovered focused matrix passed:

```text
Test Files  1 passed (1)
Tests       110 passed (110)
```

Temporary failure screenshots from the RED runs were removed. No screenshot or
baseline file is part of the commit.

### Final Fix Round 3 verification

```sh
corepack pnpm@11.21.0 scenarios:check
corepack pnpm@11.21.0 exec vitest run \
  packages/core/test/smoke-scenario.test.ts \
  packages/core/test/drawing-gallery.test.ts \
  packages/core/test/layout-foundation.test.ts \
  packages/core/test/runtime-hooks-laboratory.test.ts \
  packages/core/test/focus-navigation.test.ts \
  --browser.headless --browser.ui=false
corepack pnpm@11.21.0 exec vitest run \
  packages/core/src/lib/runtime-contract.test.ts \
  --browser.headless --browser.ui=false
corepack pnpm@11.21.0 test:ci
```

```text
Discovery: rejected legacy and uncataloged example fixtures.
Catalog: validated 42 lessons, 16 test labs, and docs/scenario-index.md.
Representative scenarios: 5 files, 22 passed.
Runtime contract: 1 file, 13 passed.
Complete browser suite: 83 files, 1131 passed, 2 skipped.
```

```sh
corepack pnpm@11.21.0 typecheck
corepack pnpm@11.21.0 lint
corepack pnpm@11.21.0 playground:build
corepack pnpm@11.21.0 playground:build:built
corepack pnpm@11.21.0 test:package-consumer
corepack pnpm@11.21.0 test:package-consumer:packed
corepack pnpm@11.21.0 test:smoke:built
corepack pnpm@11.21.0 test:visual-safeguard
git diff --check
```

```text
TypeScript, ESLint, and Prettier: passed.
Studio source mode: declarations passed; 1308 modules transformed.
Studio built mode: declarations and package build passed; 1209 modules transformed.
Workspace and packed Bundler/NodeNext/runtime consumers: passed.
Built smoke: 1 file, 1 passed.
Visual safeguard: rejected the drill, recovered green, and preserved every
baseline byte.
git diff --check: no output.
```

### Fix-round self-review

- The scope change is narrowly additive: ordinary block/function shadowing is
  untouched, while TypeScript module blocks gain the same lexical treatment.
- Dotted namespace declarations bind their root name; quoted ambient module
  names do not. Tests cover both sides so an imported CRC reference is not
  accidentally hidden.
- Construct-specific diagnostic priority precedes generic import rejection, but
  legacy authoring/type and JSX structure diagnostics keep their existing order
  once module syntax is valid.
- Verification used Node 26.7.0 and pnpm 11.21.0. The documented R8 variance
  from Node 24 LTS remains unchanged. No unresolved concern remains for this
  focused validator fix.
