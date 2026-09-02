# Task 10 report — JSX-first learning catalog migration

## Result

Task 10 is implemented and ready to commit.

- Workspace: `/private/tmp/crc-jsx-component-authoring`
- Branch: `codex/jsx-component-authoring`
- Required start: `8c66e3f2305556550a9ed0d1b46d2747177f1ea9`
- Runtime: Node `v26.7.0`, pnpm `11.21.0`
- R8 variance: Node 26 is noncanonical versus the documented Node 24 LTS
  line. Node 24 was not available in this workspace.
- Review mode: self-review only, because Task 10 explicitly prohibited
  subagents and reviewers.

The complete learning catalog now teaches the shipped descriptive JSX API.
The catalog contains 42 `.example.tsx` lessons across eight learning sections:
41 JSX lessons and exactly one dedicated non-JSX `createElement` lesson. The 16
deterministic test-lab scenarios remain a separate, unchanged catalog.

## Migration counts and structure

- Renamed all 41 pre-existing learning sources from `.example.ts` to
  `.example.tsx` with `git mv`, preserving file history.
- Added one new source,
  `start/create-element-authoring.example.tsx`, immediately after Getting
  Started.
- Added `authoring: "jsx" | "createElement"` metadata. Every lesson records one
  of those two values; only the dedicated lesson uses `"createElement"`.
- The non-JSX source stays `.tsx`, is tagged `createElement` and `non-jsx`, uses
  `createElement(type, props, ...children)` for the entire scene, and contains
  no JSX element syntax.
- All other sources contain descriptive uppercase JSX and use ordinary named
  functions for components. No learning source imports or calls `defineComp`,
  the lowercase drawing/composition/layout factories, or the old focus
  wrappers.
- `Text` receives text as child content. `Group`, `Clip`, `Layer`, and the layout
  components receive normal JSX children. `Layer` no longer uses a render prop.
  Focus lessons use `FocusManagement` and `KeyboardNavigation` policy
  components.
- Drawing styles are explicit `style={{ ... }}` objects. The Flex lesson shows
  that a child receives its specified `style` while `crcLayoutBox()` exposes the
  allocation resolved by the parent.
- Getting Started introduces a stateless plain function before adding state and
  click feedback. Focus prose states that the Canvas is the single native focus
  host and that CRC does not create semantic DOM or an accessibility tree.

All 41 existing canvas metadata values and all existing `related` lists remain
unchanged. The generated previous/next chain changes only where the required
new lesson is inserted. Existing scenes retain their interaction handlers,
feedback text, focus state, event traces, canvas dimensions, source paint order,
and deterministic behavior. The added lesson has its own 720 × 420 scene.

## Catalog, Studio, and documentation

- Learning source discovery is TSX-only in the Studio.
- The catalog validator and browser assertions reject `.example.ts`, legacy
  authoring imports/calls, old focus functions, `TextStyle.text`, and `Layer`
  render props. They also enforce the one-lesson `createElement` exception and
  its required position and tags.
- Catalog API tags, objectives, notes, prompts, and source paths use current
  descriptive vocabulary and agent-readable prose.
- `docs/scenario-index.md` was regenerated from the catalog and inspected. It
  links all 42 `.example.tsx` lessons and still lists the 16 test labs
  separately.

## TDD evidence

### RED

The catalog and source-contract assertions were changed before the lesson
migration. The first focused browser run reported five intended failures:

```text
Test Files  1 failed (1)
Tests       5 failed | 47 passed (52)
```

The failures showed the transitional state directly: `.example.ts` was still
accepted, only 41 lessons existed, no `createElement` lesson existed, source
paths still ended in `.example.ts`, and drawing/composition tags still used
lowercase factories.

An independent tooling assertion was then added. Before renaming sources,
`scenarios:check` failed with:

```text
Learning example "getting-started" must use a .example.tsx source path.
```

### GREEN

After migration, the focused learning suite passed 53 tests. The suite mounts
every source and retains its existing semantic, event, focus, geometry, and
pixel checks in addition to the new catalog-wide authoring assertions.

## Studio live-edit evidence

Direct interactive UI control was not available, so this is explicitly
headless Playwright evidence, not a claim of manual visual inspection.

After each source and built Studio build, a temporary evidence harness started
Vite preview, opened each route in a fresh Chromium page, waited for the initial
`Live · changes run automatically` state and `No TypeScript issues.`, appended
the valid comment `// task-10 headless live-edit evidence` through Monaco's
rendered editor surface, and required:

- the URL code state to change;
- the sandbox preview `data-run-id` to change;
- exactly one replacement preview iframe;
- iframe sandbox value exactly `allow-scripts`;
- clean TypeScript diagnostics; and
- a return to the live mounted state.

Routes checked in both source and built modes:

```text
#/examples/start/getting-started
#/examples/start/create-element-authoring
#/examples/layout/flex
#/examples/composition/layer
#/examples/keyboard-focus/focus-management
```

Both runs reported:

```text
getting-started: edited, typechecked, and remounted
create-element: edited, typechecked, and remounted
flex-layout: edited, typechecked, and remounted
layer: edited, typechecked, and remounted
focus: edited, typechecked, and remounted
```

The temporary harness was removed after recording the evidence; it did not
change product or test sources.

## Final verification

All evidence below ran against the final implementation unless noted.

### Catalog and focused learning behavior

```sh
corepack pnpm@11.21.0 scenarios:check
```

```text
Validated 42 lessons, 16 test labs, and docs/scenario-index.md.
```

```sh
corepack pnpm@11.21.0 exec vitest run \
  packages/core/test/learning-examples.test.ts \
  --browser.headless --browser.ui=false
```

```text
Test Files  1 passed (1)
Tests       53 passed (53)
```

```sh
corepack pnpm@11.21.0 exec vitest run \
  packages/core/test/learning-examples.test.ts \
  packages/core/test/browser.test.ts \
  packages/core/test/share-code.test.ts \
  --browser.headless --browser.ui=false
```

```text
Test Files  3 passed (3)
Tests       82 passed (82)
```

### Complete browser suite

```sh
corepack pnpm@11.21.0 test:ci
```

```text
Test Files  83 passed (83)
Tests       925 passed | 2 skipped (927)
Duration    21.41s
```

### Studio source and built modes

```sh
corepack pnpm@11.21.0 playground:build
corepack pnpm@11.21.0 playground:build:built
```

```text
Studio declarations passed strict TSX, compiler-runtime, event-family,
generic, layout, and surface checks in both modes.
Source mode: 1308 modules transformed.
Built mode: 1209 modules transformed.
```

Both builds included chunks for all migrated lessons and the new non-JSX
lesson. The built-mode command also rebuilt every workspace package. The Vite
output retained only the pre-existing ineffective-dynamic-import and
large-chunk warnings.

### Static and package boundaries

```sh
corepack pnpm@11.21.0 typecheck
corepack pnpm@11.21.0 lint
corepack pnpm@11.21.0 test:package-consumer:packed
```

```text
tsc --noEmit: passed
ESLint and Prettier: passed
Packed consumer: Bundler, NodeNext, declarations, runtime exports, blocked
deep imports, no-source checks, and optimized focus elimination passed.
```

The packed consumer measured 113966 no-focus bytes and 137630 with-focus bytes;
the focus marker remained absent without focus and present with focus.

### Built smoke and visual safety

```sh
corepack pnpm@11.21.0 test:smoke:built
corepack pnpm@11.21.0 test:visual-safeguard
git diff --check
```

```text
Built smoke: 1 file and 1 test passed.
Visual safeguard rejected its mutation drill, preserved every baseline byte,
and recovered green.
git diff --check: no output.
```

The first sandboxed catalog and visual-safeguard attempts hit local IPC/listen
`EPERM` restrictions. The same commands passed with the required local-server
permission; these were environment restrictions, not product failures. No
visual baseline was rewritten.

## Self-review and concerns

- Learning and test-lab discovery remain separate. No test-lab source,
  metadata, action, or baseline changed.
- Source inspection found no `.example.ts` learning files, no legacy component
  authoring, no lowercase factory calls/imports, no `TextStyle.text`, and no
  `Layer` render prop. False-positive `path.rect(...)` calls in focus geometry
  helpers and lowercase SVG tags inside an image data URI are browser APIs/data,
  not CRC authoring.
- The dedicated non-JSX source contains no JSX element syntax. Every other
  lesson contains uppercase descriptive JSX.
- Existing canvas metadata and related lists were compared in the catalog diff;
  only the new lesson adds values. Existing behavior is additionally exercised
  by the 53-test learning suite and complete 925-pass browser run.
- The Studio visual-baseline suite was not used as live-edit evidence because
  the intentional source-code and catalog-copy migration changes its full-page
  screenshots. Baselines were not updated. Source and built live editing were
  instead verified semantically with fresh preview mounts and diagnostics.
- Fresh evidence is Node 26.7.0 only. Node 24 LTS remains unverified under R8.

## Fix Round 1 — syntax-aware catalog enforcement

Review of `d1ae6cb2c34d7214794a8677a96b01429d98922a` did not approve the
catalog enforcement. The migrated lesson sources were clean, but the guard used
regular expressions for JSX and imports, and reserved authoring tags were not
exclusive. This round replaces those guards without changing any lesson source,
scene, test-lab fixture, or generated index content.

### Shared AST source contract

`tooling/learning-source-contract.ts` is now the single source-text validator
used by both `tooling/scenario-catalog.ts` and the executable browser tests. It
uses the existing cataloged Babel parser with TypeScript and JSX plugins. Babel
is a root development dependency for the tool/test boundary; the validator is
not imported by the Studio or scenario runtime, so it adds no production
catalog bundle path.

The validator now:

- detects every `JSXElement` and `JSXFragment`, including fragment, member, and
  namespaced element names;
- parses legal TypeScript generics, `as` assertions, and comparisons without
  treating angle brackets as JSX;
- accepts only static `ImportDeclaration` nodes from `@crc/core`, with named
  specifiers and at least one value import; inline named type specifiers remain
  valid;
- rejects namespace, default, side-effect, external/helper, dynamic, and
  type-only module shapes;
- resolves imported and local binding names so aliased legacy factories and
  focus enhancers remain forbidden;
- follows namespace member syntax before rejecting the namespace import shape,
  including `CRC.rect`;
- recognizes `createElement` calls through the resolved core import rather than
  arbitrary text;
- detects legacy `Text` `style.text` and `Layer` `render` only when the JSX or
  `createElement` component resolves to those core imports, including aliases;
- validates the canonical default `mount(canvas)` signature structurally; and
- preserves learning/test-lab separation through AST-level `SOURCE_ID` and
  test-runner call detection while ignoring those words in strings or ordinary
  type/object properties.

Catalog metadata validation now rejects duplicate API tags globally. It also
requires the sole `authoring: "createElement"` entry to contain each reserved
`createElement` and `non-jsx` tag exactly once, and rejects either reserved tag
on every JSX entry.

### Fix-round TDD evidence

A behavior-preserving centralization was green before adding the new fixtures:

```text
Focused learning suite: 53 passed
Catalog: 42 lessons and 16 test labs validated
```

The first adversarial RED run then exercised fragments, JSX member/namespaced
names, legal TypeScript generics/assertions/comparisons, namespace/default/
side-effect/helper/dynamic/type-only imports, legacy aliases, non-syntax legacy
words, extra reserved tags, and duplicate tags:

```text
Test Files  1 failed (1)
Tests       14 failed | 58 passed (72)
```

After the initial AST implementation, a second RED preserved a requirement
that had existed in the old tooling guard but was not yet centralized:

```text
Test Files  1 failed (1)
Tests       2 failed | 77 passed (79)
```

Those two failures were the `SOURCE_ID` marker and a test-runner call fixture.
The AST implementation now rejects both without scanning strings. The final
focused result, including binding-aware `Text`, `Layer`, factory, and focus
alias fixtures, is:

```text
Test Files  1 passed (1)
Tests       79 passed (79)
```

### Fix-round verification

```sh
corepack pnpm@11.21.0 scenarios:check
corepack pnpm@11.21.0 typecheck
corepack pnpm@11.21.0 lint
```

```text
Catalog: 42 lessons, 16 test labs, and docs/scenario-index.md validated
tsc --noEmit: passed
ESLint and Prettier: passed
```

```sh
corepack pnpm@11.21.0 test:ci
```

```text
Test Files  83 passed (83)
Tests       951 passed | 2 skipped (953)
Duration    21.56s
```

```sh
corepack pnpm@11.21.0 playground:build
corepack pnpm@11.21.0 playground:build:built
```

```text
Studio declaration/runtime verifier: passed in both commands
Source mode: 1308 modules transformed; built in 867ms
Built mode: 1209 modules transformed; built in 876ms
```

```sh
corepack pnpm@11.21.0 test:package-consumer
corepack pnpm@11.21.0 test:package-consumer:packed
corepack pnpm@11.21.0 test:smoke:built
git diff --check
```

```text
Workspace Bundler, NodeNext, and runtime consumer: passed
Packed declarations, exports, deep-import, no-source, and optimized focus
consumer: passed (113966 no-focus bytes; 137630 with-focus bytes)
Built browser smoke: 1 file and 1 test passed
git diff --check: no output
```

### Fix-round self-review and concerns

- The browser suite and catalog tool call the same exported validator; no JSX,
  import, alias, or legacy-property regular expression remains duplicated.
- Parser traversal ignores locations, comments, tokens, and parser metadata.
  Legacy decisions use AST node kinds and resolved bindings, not source words.
- Inline `type` specifiers on an approved named value import remain supported,
  matching all 42 real lessons. Standalone type-only imports are rejected
  because a lesson must import at least one executable CRC value.
- Reserved tags are checked per entry before the global one-authoring-lesson and
  adjacency rule, so an extra JSX tag cannot be hidden by a valid non-JSX entry.
- No migrated lesson, test-lab source, catalog prose, relationship, canvas size,
  generated documentation, runtime package, or visual baseline changed in this
  round.
- Fresh evidence remains Node 26.7.0 rather than the canonical Node 24 LTS line
  recorded by R8.

## Fix Round 2 — scope, props, and module-graph enforcement

Review of `8d278e5805a29233be8c3e43b0d43073d7683ebe` found three
remaining structural bypass classes: copied or shadowed core bindings,
indirect/spread props, and module declarations other than the canonical mount
export. This round closes those bypasses in the shared AST validator.

### Strict learning-source readability contract

Learning examples now use a deliberately narrow syntax that a reader and the
catalog checker can inspect locally:

- `@crc/core` value and type specifiers must retain their exported names. A
  core value cannot be copied to an alias, reassigned, or shadowed by a local
  declaration or parameter. The validator resolves identifiers from the
  parsed core import map and checks their AST binding and value positions; it
  does not infer bindings from matching source text.
- A direct core binding is valid as a direct call target, JSX component, or the
  first argument of the dedicated lesson's direct `createElement` call. Other
  value positions are rejected, which structurally prevents variable,
  destructuring, conditional, and object-held component aliases.
- JSX spread attributes are rejected. A `style` prop on a directly imported
  CRC JSX component must be an inline object with static keys and no spreads.
- Every direct `createElement` call must provide either `null` or an inline,
  static-key props object. Its `style`, when present, must also be an inline,
  spread-free object. This keeps legacy `Text` content and `Layer` render props
  visible to the existing component-specific checks.
- The sole permitted export is the already-required canonical default
  `mount(canvas)` function. Named exports, local or source-backed re-exports,
  star re-exports, TypeScript import-equals/export forms, dynamic imports, and
  `import.meta` are rejected.

One existing learning helper forwarded `<PropagationLeaf {...props} />`. It now
spells the same `mode` and `record` values explicitly. This is a source-level
readability change only: the scene, canvas, handlers, event order, feedback,
and catalog metadata are unchanged. No test-lab source or catalog entry changed.

### Fix-round TDD evidence

The 15 adversarial fixtures were added before validator changes. The RED run
reported exactly the intended failures while every pre-existing assertion
remained green:

```text
Test Files  1 failed (1)
Tests       15 failed | 79 passed (94)
```

The failing cases covered local and destructured component aliases, a shadowed
and reassigned `createElement`, JSX style variables and spreads, indirect and
spread `createElement` props, source-backed/local/star exports, `import.meta`,
and TypeScript import-equals. The final focused run is:

```text
Test Files  1 passed (1)
Tests       94 passed (94)
```

### Fix-round verification

```sh
corepack pnpm@11.21.0 scenarios:check
corepack pnpm@11.21.0 typecheck
corepack pnpm@11.21.0 lint
```

```text
Catalog: 42 lessons, 16 test labs, and docs/scenario-index.md validated
tsc --noEmit: passed
ESLint and Prettier: passed
```

```sh
corepack pnpm@11.21.0 test:ci
```

```text
Test Files  83 passed (83)
Tests       966 passed | 2 skipped (968)
Duration    21.47s
```

```sh
corepack pnpm@11.21.0 playground:build
corepack pnpm@11.21.0 playground:build:built
```

```text
Studio declaration/runtime verifier: passed in both commands
Source mode: 1308 modules transformed; built in 868ms
Built mode: 1209 modules transformed; built in 873ms
```

```sh
corepack pnpm@11.21.0 test:package-consumer
corepack pnpm@11.21.0 test:package-consumer:packed
corepack pnpm@11.21.0 test:smoke:built
git diff --check
```

```text
Workspace Bundler, NodeNext, and runtime consumer: passed
Packed declarations, exports, deep-import, no-source, and optimized focus
consumer: passed (113966 no-focus bytes; 137630 with-focus bytes)
Built browser smoke: 1 file and 1 test passed
git diff --check: no output
```

### Fix-round self-review and concerns

- The strict binding rule intentionally rejects even harmless core aliases and
  shadows. This is a learning-catalog readability policy, not a restriction on
  the public runtime or ordinary consumer code.
- Parent-aware AST inspection allows a core name used only as an object or
  member key, while rejecting the same identifier in a value position. The
  legal TypeScript generics, assertions, and comparison fixture remains green.
- Props are inspected only from parsed object and JSX nodes. Strings, comments,
  similarly named type properties, and unrelated local object keys do not
  trigger legacy-authoring findings.
- The browser suite and catalog tool still share the same validator. No
  duplicate browser-only parser logic or regular-expression fallback was added.
- The single explicit-prop learning edit preserves behavior, and the 94-test
  focused suite remounts every lesson. Test-lab separation, reserved-tag
  exclusivity, catalog ordering, canvas sizes, actions, relationships, and the
  generated scenario index remain unchanged.
- Fresh evidence is Node 26.7.0 with pnpm 11.21.0. Node 24 LTS remains
  unverified under R8.

## Fix Round 3 — component calls, literal props, identifier contexts, and CommonJS

Review of `ac053a18fd60a8cccb0e24ef2129c2d43791b109` identified four
remaining P2 cases in the shared learning-source validator. This round closes
them without changing any learning source, catalog entry, test-lab fixture,
generated index, runtime package, or visual baseline.

### Structural enforcement changes

- The validator now keeps an explicit export-name allowlist for all 19
  descriptive component values in the current public surface: drawing,
  composition, layout, focus-policy, and `Fragment` element types. Direct
  invocation of any of these imports is rejected in JSX and non-JSX lessons;
  construction must use JSX or `createElement`.
- Direct calls to non-component public values remain valid. Executable fixtures
  cover `crc`, `crcState`, `crcMemo`, `resolveLength`, and `measureElement`,
  while the catalog continues to exercise direct `createElement` calls in the
  sole non-JSX lesson.
- Inspectable props and styles now contain only static `ObjectProperty` nodes.
  Object methods, getters, setters, computed properties, and spreads are all
  rejected. A method-shaped property can no longer conceal `Text` style or a
  `Layer` render value.
- Parent-aware identifier classification now distinguishes static property
  names from value references. Imported component spellings are permitted as
  TypeScript property/method signatures, class property/method/accessor keys,
  enum member names, object keys, and noncomputed member names. Computed keys
  remain value uses and are rejected.
- Executable references named `require`, `module`, or `exports` are forbidden,
  covering direct and shadowed `require` calls, `require.resolve`, dot and
  computed `module.exports`, property writes through `exports`, and passing
  `exports` to helpers. Declarations and static keys with the same spelling are
  intentionally ignored because they do not load or export a module.

### Fix-round TDD evidence

All behavioral fixtures were written before the validator change. The final
RED run distinguished the `Layer` getter's required uninspectable-object error
from its incidental legacy-render rejection:

```text
Test Files  1 failed (1)
Tests       33 failed | 97 passed (130)
```

The 33 failures were the 19 public component exports, one mixed non-JSX direct
component call, three getter/method props cases, three false-positive static-key
contexts, and seven CommonJS forms. Positive fixtures for runtime/hook calls,
ordinary object/member keys, and computed value references already behaved as
intended. A final positive CommonJS-spelling fixture brought the green focused
total to:

```text
Test Files  1 passed (1)
Tests       131 passed (131)
```

### Fix-round verification

```sh
corepack pnpm@11.21.0 scenarios:check
corepack pnpm@11.21.0 typecheck
corepack pnpm@11.21.0 lint
```

```text
Catalog: 42 lessons, 16 test labs, and docs/scenario-index.md validated
tsc --noEmit: passed
ESLint and Prettier: passed
```

```sh
corepack pnpm@11.21.0 test:ci
```

```text
Test Files  83 passed (83)
Tests       1003 passed | 2 skipped (1005)
Duration    21.42s
```

```sh
corepack pnpm@11.21.0 playground:build
corepack pnpm@11.21.0 playground:build:built
```

```text
Studio declaration/runtime verifier: passed in both commands
Source mode: 1308 modules transformed; built in 874ms
Built mode: 1209 modules transformed; built in 869ms
```

```sh
corepack pnpm@11.21.0 test:package-consumer
corepack pnpm@11.21.0 test:package-consumer:packed
corepack pnpm@11.21.0 test:smoke:built
git diff --check
```

```text
Workspace Bundler, NodeNext, and runtime consumer: passed
Packed declarations, exports, deep-import, no-source, and optimized focus
consumer: passed (113966 no-focus bytes; 137630 with-focus bytes)
Built browser smoke: 1 file and 1 test passed
git diff --check: no output
```

### Fix-round self-review and concerns

- The component allowlist matches every uppercase element type currently
  exported from `packages/core/src/index.ts` and deliberately excludes
  uppercase non-component values such as `LayoutDiagnostic`. A future public
  component export must update this catalog-policy list and its table fixture.
- Static-key recognition checks AST node relationships and the `computed` flag;
  it does not exempt matching identifier text in value positions. Existing
  alias, destructuring, reassignment, and shadowing fixtures remain green.
- Object getters and methods are rejected before legacy-property reporting, so
  their failure records the general inspectability contract rather than relying
  on a component-specific side effect.
- CommonJS rejection is intentionally a learning-source module policy, not a
  runtime or consumer restriction. Non-value declarations and keys are covered
  by a positive fixture to bound false positives.
- Fresh evidence is Node 26.7.0 with pnpm 11.21.0. Node 24 LTS remains
  unverified under R8.

## Fix Round 4 — authoring exclusivity, method scopes, and global CommonJS

Review of `c2f199bed9a8cb4bb4d72c1222ffcd6c64724488` identified three
remaining P2 validator gaps: JSX lessons could mix a direct imported
`createElement` call, object and class method parameters could shadow that
import, and CommonJS access through known global objects was not recognized.
This round closes those gaps without changing any learning source, catalog
entry, test-lab fixture, generated index, runtime package, or visual baseline.

### Structural enforcement changes

- Authoring modes are now exclusive in both directions. A JSX lesson must
  contain JSX and no direct call resolving to the imported `@crc/core`
  `createElement`; the dedicated non-JSX lesson must contain no JSX and at
  least one such call.
- The strict no-shadowing scan now uses one function-like binding list for
  function declarations/expressions, arrow functions, object methods, public
  class methods, private class methods, and TypeScript declare functions.
  Object, class, and private method parameters therefore follow the same
  binding rule. Unrelated method parameter names remain legal.
- CommonJS member access is resolved as a static path rooted at
  `globalThis`, `window`, `self`, or `global`. The resolver unwraps
  TypeScript assertions and other transparent expression wrappers, follows
  ordinary, computed-string, nested, and optional member chains, and rejects
  exact `require`, `module`, or `exports` segments.
- The global-path rule is deliberately root-sensitive: ordinary objects may
  still expose properties or methods named `require`, `module`, and `exports`.
  The existing bare-identifier CommonJS rule remains unchanged.

### Fix-round TDD evidence

All focused fixtures were added before changing the validator. After correcting
the object/class fixtures so their fake calls used otherwise-valid inline
`createElement(Group, null)` arguments, the final RED run was:

```text
Test Files  1 failed (1)
Tests       11 failed | 134 passed (145)
```

The failures were the JSX/createElement mixture, object and public class method
parameter shadows, and eight global-object CommonJS forms. The private-method
fixture was already rejected incidentally by the old parent classifier; this
round makes that result explicit through the shared function-like binding
list. Positive unrelated-method and unrelated-object-property fixtures were
green during RED and bound the false-positive surface.

After the validator change, the focused result was:

```text
Test Files  1 passed (1)
Tests       145 passed (145)
```

### Fix-round verification

```sh
corepack pnpm@11.21.0 scenarios:check
corepack pnpm@11.21.0 typecheck
corepack pnpm@11.21.0 lint
```

```text
Catalog: 42 lessons, 16 test labs, and docs/scenario-index.md validated
tsc --noEmit: passed
ESLint and Prettier: passed
```

```sh
corepack pnpm@11.21.0 test:ci
```

```text
Test Files  83 passed (83)
Tests       1017 passed | 2 skipped (1019)
Duration    21.44s
```

```sh
corepack pnpm@11.21.0 playground:build
corepack pnpm@11.21.0 playground:build:built
```

```text
Studio declaration/runtime verifier: passed in both commands
Source mode: 1308 modules transformed; built in 874ms
Built mode: 1209 modules transformed; built in 870ms
```

Both Studio builds retained only the pre-existing ineffective-dynamic-import
and large-chunk warnings.

```sh
corepack pnpm@11.21.0 test:package-consumer
corepack pnpm@11.21.0 test:package-consumer:packed
corepack pnpm@11.21.0 test:smoke:built
git diff --check
```

```text
Workspace Bundler, NodeNext, and runtime consumer: passed
Packed declarations, exports, deep-import, no-source, and optimized focus
consumer: passed (113966 no-focus bytes; 137630 with-focus bytes)
Built browser smoke: 1 file and 1 test passed
git diff --check: no output
```

The initial sandboxed focused-test and catalog commands could not create their
local listen socket (`EPERM`). The same commands passed with the required local
server permission; this was an environment restriction, not a product failure.

### Fix-round self-review and concerns

- The code and test changes remain confined to the shared validator and its
  focused browser fixtures. All 42 real lesson sources still pass the shared
  contract, and no lesson, catalog, runtime, index, or baseline file changed.
- The authoring check consumes the resolved core import map rather than source
  spelling. Because accepted learning sources forbid every lexical shadow of a
  core import, a counted `createElement` call is the imported CRC function.
- Global CommonJS detection is exact-segment and known-root based. It covers
  asserted, computed, nested, and optional chains without treating
  `loader.require` or `loader.module.exports` as CommonJS.
- Fresh evidence is Node 26.7.0 with pnpm 11.21.0. Node 24 LTS remains
  unverified under R8.

## Fix Round 5 — invocation forms and computed-template paths

Review of `10aeb6e2637815e02bb8eaf191fc024b118b0804` found the final two
P2 gaps in the shared learning-source validator. Imported `createElement`
optional and constructor calls were outside the normal-call inspection, and
computed no-substitution template keys were outside static global-path
resolution. This round closes both without changing a learning source, catalog
entry, runtime source, generated index, test-lab fixture, or visual baseline.

### Structural enforcement changes

- Invocation inspection now classifies direct imported values across
  `CallExpression`, `OptionalCallExpression`, `NewExpression`, and
  `TaggedTemplateExpression`. Every imported `createElement` invocation counts
  toward authoring-mode exclusivity, but only a normal `CallExpression` is
  permitted in the sole non-JSX lesson.
- Optional and constructor `createElement` argument lists use the same inline
  props/style inspection as normal calls, so an invalid call form cannot hide
  indirect props, indirect style, `Text` legacy content, or a `Layer` render
  prop. Imported component arguments in those forms remain direct core
  references long enough for the specific inspection to run.
- Direct descriptive components remain invalid across normal, optional,
  constructor, tagged-template, and TypeScript-wrapped call shapes. The tagged
  reference exception is deliberately limited to imported `createElement`;
  other CRC values remain rejected as tags under the direct-binding policy.
- `propertyName` now unwraps transparent expression wrappers and returns the
  cooked value of a no-substitution `TemplateLiteral`, in addition to ordinary
  identifiers and string literals. Computed member resolution separately
  distinguishes statically known string/template keys from dynamic expressions.
- Static no-substitution template paths rooted at `globalThis`, `window`,
  `self`, or `global` now recognize exact `require`, `module`, and `exports`
  segments through nested, optional, escaped, and TypeScript-wrapped access.
  Dynamic computed segments on those known roots fail closed. The rule remains
  root-sensitive: template, expression-template, tagged-template, and dynamic
  keys on unrelated objects remain valid, as do static unrelated global keys.

### Fix-round TDD evidence

All requested regression fixtures preceded the validator change. The final
initial RED run was:

```text
Test Files  1 failed (1)
Tests       20 failed | 149 passed (169)
```

The failures covered JSX and non-JSX optional/constructor/tagged
`createElement` use, optional-call props/style inspection, static and dynamic
template keys, optional and TypeScript-wrapped paths, tagged/dynamic computed
keys on known globals, and cooked escaped template content. Neighboring direct
component and unrelated-object cases were already green during RED.

The first GREEN run passed 169 tests. Bounded self-review then found that the
initial tagged-callee exception was too broad and could admit tagged use of
another CRC value. An additional regression fixture failed alone while the
other 169 tests stayed green:

```text
Test Files  1 failed (1)
Tests       1 failed | 169 passed (170)
```

After limiting that exception to imported `createElement`, the final focused
result was:

```text
Test Files  1 passed (1)
Tests       170 passed (170)
```

### Fix-round verification

All final evidence ran after the self-review correction on Node `v26.7.0` with
pnpm `11.21.0`.

```sh
corepack pnpm@11.21.0 scenarios:check
corepack pnpm@11.21.0 typecheck
corepack pnpm@11.21.0 lint
```

```text
Catalog: 42 lessons, 16 test labs, and docs/scenario-index.md validated
tsc --noEmit: passed
ESLint and Prettier: passed
```

```sh
corepack pnpm@11.21.0 test:ci
```

```text
Test Files  83 passed (83)
Tests       1042 passed | 2 skipped (1044)
Duration    21.42s
```

```sh
corepack pnpm@11.21.0 playground:build
corepack pnpm@11.21.0 playground:build:built
```

```text
Studio declaration/runtime verifier: passed in both commands
Source mode: 1308 modules transformed; built in 868ms
Built mode: 1209 modules transformed; built in 857ms
```

Both builds retained only the pre-existing ineffective-dynamic-import and
large-chunk warnings.

```sh
corepack pnpm@11.21.0 test:package-consumer
corepack pnpm@11.21.0 test:package-consumer:packed
corepack pnpm@11.21.0 test:smoke:built
git diff --check
```

```text
Workspace Bundler, NodeNext, and runtime consumer: passed
Packed declarations, exports, deep-import, no-source, and optimized focus
consumer: passed (113966 no-focus bytes; 137630 with-focus bytes)
Built browser smoke: 1 file and 1 test passed
git diff --check: no output
```

The sandboxed focused-test and catalog commands could not create their local
listen/IPC sockets (`EPERM`). The same commands passed with the required local
server permission; these were environment restrictions, not product failures.

### Fix-round self-review and concerns

- The configured Babel parser emits direct optional syntax as
  `OptionalCallExpression`/`OptionalMemberExpression`; normal calls,
  constructors, and tags use their corresponding explicit node families.
  Transparent-wrapper traversal also retains `ChainExpression` compatibility
  if that representation is supplied in a future parser mode.
- Normal imported `createElement` calls still use the exact existing props,
  legacy-property, and authoring checks. Optional and constructor calls now
  share those checks before their call-form diagnostic; tagged use has no
  argument list and is rejected explicitly.
- No-substitution template keys use cooked values, so escaped static spellings
  cannot bypass exact segment matching. Template expressions, identifier keys,
  and tagged-template computed keys are dynamic and fail closed only after a
  statically known global root.
- Unrelated-object template keys and static unrelated global keys remain valid,
  bounding false positives. Static object props remain subject to the existing
  no-computed-key/no-spread inspectability policy.
- The code and test diff remains confined to the shared validator and focused
  browser fixtures; this report is the only record change.
- Fresh evidence remains Node 26.7.0 rather than the canonical Node 24 LTS line
  recorded by R8.
