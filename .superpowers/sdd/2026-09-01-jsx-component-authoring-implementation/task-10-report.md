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
