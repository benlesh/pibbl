# Plan 003 style and layout field notes

## 2026-08-17 — P003-01 element style protocol

### Environment

- Node: `v26.7.0`
- pnpm: `11.21.0` selected through `corepack pnpm@11.21.0`
- Browser: Playwright Chromium through Vitest Browser Mode

### RED

Command:

```sh
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/runtime-contract.test.ts packages/core/src/lib/components/layer.test.ts --browser.headless --browser.ui=false
```

Result: exit 1; 2 test files failed, with 2 failed and 26 passed tests.

- The element-protocol test received neither descriptor `style` nor descriptor
  `key`; both were still nested in props.
- The layer render count remained 1 instead of 2 when only the root descriptor
  style changed, proving that its cache comparison ignored style.

The first draft of the layer test put style in the old props object, which made
the old shallow-props comparison invalidate accidentally. Before production
changes, the test was tightened to vary descriptor style while holding props
stable; that version produced the second expected RED failure above.

### GREEN

Command:

```sh
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/runtime-contract.test.ts packages/core/src/lib/components/layer.test.ts --browser.headless --browser.ui=false
```

Result: exit 0; 2 test files and all 28 tests passed.

Command:

```sh
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 typecheck
```

Result: exit 0; `tsc --noEmit` reported no errors. This includes the public
package-consumer assertions for required style, reserved `key`/`style`
collisions, and the three-argument rendering context.

### Review-relevant observations

- Specified style is preserved by reference and exposed readonly to render;
  omitted style shares one frozen empty object.
- `SystemStyle` remains an optional-only, index-free public base. A closed
  structural schema check supports inline component-specific style shapes
  without TypeScript weak-type rejection or arbitrary excess properties.
- Existing visual props are intentionally unchanged in this protocol task;
  P003-02 begins their migration. No visual baseline was changed.

### Adversarial review round 1

Review found four important gaps: reserved names were checked only across the
intersection of union keys, required style fields were checked only across the
intersection of union keys, every component call cloned props even when no
metadata needed extraction, and the execution ledger advanced before its review
was clean. It also found that a raw `object` style constraint admitted arrays,
functions, dates, and other non-style values too broadly.

Fix RED commands:

```sh
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/runtime-contract.test.ts packages/core/src/lib/components/layer.test.ts --browser.headless --browser.ui=false
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 typecheck
```

The browser command exited 1 with 1 failed and 27 passed tests because plain
props were equal but not reference-identical. Typecheck exited 1 with six unused
`@ts-expect-error` directives: partial-union `key`, partial-union `style`, a
disjoint required-style union, and array/function/date style schemas were all
incorrectly accepted.

Fix GREEN commands:

```sh
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/runtime-contract.test.ts packages/core/src/lib/components/layer.test.ts --browser.headless --browser.ui=false
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 typecheck
```

The browser command exited 0 with both files and all 28 tests passing.
Typecheck exited 0 with no errors. Distributive union-key utilities now reject a
reserved name or require style when any union member demands it. A closed,
index-free structural style-schema validator retains the public
`SystemStyle.custom` capability while rejecting non-object, empty/broad-index,
array, function, date, and common built-in resource schemas. A no-extraction
fast path preserves the original props reference; inputs with an own `key` or
`style` still produce separated props.

P003-01 remains in progress pending clean adversarial re-review. P003-02 has not
started.

### Adversarial review round 2

Re-review found that round 1's finite non-plain-style blacklist was not a sound
definition of a style schema: unrelated resource and class types not named by
the blacklist could still pass the structural heuristic.

Fix RED command:

```sh
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 typecheck
```

Result: exit 1 with three unused `@ts-expect-error` directives. `URL`, `Error`,
and `Blob` were all incorrectly accepted as component style schemas.

The heuristic was replaced with a positive base contract: every accepted style
type explicitly extends `SystemStyle` or intersects with it. `SystemStyle`
retains optional `custom` and has no index signature. Declared styles with
required members accept ordinary object inputs without spelling `custom`,
remain excess-property checked, and continue to participate in distributive
required-style logic. Unrelated resource/class types fail unless their declared
type deliberately opts in.

Fix GREEN commands:

```sh
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 typecheck
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/runtime-contract.test.ts packages/core/src/lib/components/layer.test.ts --browser.headless --browser.ui=false
```

Typecheck exited 0 with no errors. The focused browser command exited 0 with
both files and all 28 tests passing. P003-01 remains in progress pending clean
re-review, and P003-02 remains queued.

### Clean adversarial review closure

The final code re-review of the positive `SystemStyle` base contract was clean
with no remaining findings. Across the task, initial review found four Important
issues plus the broad style-shape concern, the first re-review found one
remaining Important blacklist issue, and the next code re-review accepted all
fixes.

Per the review workflow, this status-only closure marks P003-01 done, advances
P003-02 as the sole next step, synchronizes the board, and amends the same task
commit. No production or test file changed in this closure and no checks were
rerun; the immediately preceding fresh evidence remains clean workspace
typecheck and 28/28 focused browser tests. The final amended task commit is sent
for status-only re-review before P003-02 begins.

## 2026-08-17 — P003-02 path, rectangle, and SVG path styles

### Environment

- Node: `v26.7.0`
- pnpm: `11.21.0` selected through `corepack pnpm@11.21.0`
- Browser: Playwright Chromium through Vitest Browser Mode

### RED

Command:

```sh
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components/path.test.ts packages/core/src/lib/components/rect.test.ts packages/core/src/lib/components/svg-path.test.ts --browser.headless --browser.ui=false
```

Result: exit 1; all 3 test files failed, with 11 failed and 3 passed tests. The
new style-only calls did not paint or register the expected interaction
geometry: opacity-zero fill, SVG path updates, rectangle pixels, cursor, and
mouse targeting all failed against the legacy top-level implementation.

Command:

```sh
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 typecheck
```

Result: exit 1 with the expected missing `PathStyle`, `RectStyle`, and
`SvgPathStyle` exports, rejected component-specific style fields, and legacy
required visual props. The public negative assertions were unused until the
style-only signatures existed.

The first sandboxed browser attempt exited before test collection with
`listen EPERM` on the local Vitest server. It is not counted as RED evidence;
the command above was rerun with localhost/Chromium permission to obtain the
actual 11-failure behavioral result.

### GREEN

Command:

```sh
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components/path.test.ts packages/core/src/lib/components/rect.test.ts packages/core/src/lib/components/svg-path.test.ts --browser.headless --browser.ui=false
```

Result: exit 0; all 3 files and all 14 tests passed. This includes explicit
coverage for opacity zero, transparent-fill hit geometry, optional rectangle
`x`/`y` defaulting, cursor/region behavior, and SVG path updates.

Command:

```sh
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 typecheck
```

Result: exit 0; `tsc --noEmit` reported no errors across the migrated core,
scenario, playground, tooling, and package-consumer callers.

Changed TypeScript files also passed ESLint, `git diff --check` was clean, and
an AST audit found no remaining direct path/rectangle/SVG-path call with legacy
top-level visual fields or legacy style names. No visual baseline changed.

P003-02 remains in progress pending adversarial review. P003-03 remains TODO.

### Adversarial review round 1

Review found one Important issue in the shared event seam. `Path` passed
`style.cursor`, but an absent cursor arrived as `undefined` and activated
`wireCommonEvents`' default parameter, which read `props.cursor`. An untyped
JavaScript path, rectangle, or SVG-path caller could therefore retain a legacy
top-level cursor alias despite the style-only contract.

Fix RED command:

```sh
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components/path.test.ts --browser.headless --browser.ui=false
```

Result: exit 1 with 1 failed and 2 passed tests. The new untyped-caller
regression hovered a transparently filled path with only a top-level `cursor`
and observed the leaked `pointer` value.

`wireCommonEvents` now requires its cursor argument and never reads visual data
from props. Path supplies its style cursor. The not-yet-migrated text and image
components explicitly supply `props.cursor`, preserving their current public
behavior until their scheduled migrations.

Fix GREEN commands:

```sh
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components/path.test.ts --browser.headless --browser.ui=false
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components/path.test.ts packages/core/src/lib/components/rect.test.ts packages/core/src/lib/components/svg-path.test.ts packages/core/src/lib/components/text.test.ts packages/core/src/lib/components/img.test.ts --browser.headless --browser.ui=false
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 typecheck
```

The regression command exited 0 with 3/3 tests passing. The combined focused
browser command exited 0 with all 5 files and all 47 tests passing. Typecheck
exited 0 with no errors. Inspection found exactly three shared-helper callers:
Path passes style cursor, and text/image pass their current legacy cursor
explicitly. P003-02 remains in progress pending re-review; P003-03 remains
TODO.

### Clean adversarial review closure

Code re-review found the cursor-authority fix complete with no remaining
findings and declared Task 2 ready for status-only closure. This closure marks
P003-02 done, advances P003-03 as the sole next step, and synchronizes the plan
board.

No production or test file changed in this closure and no behavior check was
rerun. The immediately preceding fresh evidence remains the 3/3 cursor
regression suite, 47/47 combined focused browser tests, and clean workspace
typecheck. The final amended Task 2 commit is sent for status-only review before
P003-03 begins.

## 2026-08-17 — P003-03 line-family styles

### Environment

- Node: `v26.7.0`
- pnpm: `11.21.0` selected through `corepack pnpm@11.21.0`
- Browser: Playwright Chromium through Vitest Browser Mode

### RED

Command:

```sh
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components/line.test.ts packages/core/src/lib/components/line-helpers.test.ts --browser.headless --browser.ui=false
```

Result: exit 1; both test files failed, with 10 failed and 4 passed tests plus
9 expected render errors. Style-only line coordinates were ignored by the
legacy renderers, helper coordinates became undefined, and mouse regions were
not registered.

Command:

```sh
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 typecheck
```

Result: exit 1 with the expected missing public `LineStyle`,
`HorizontalLineStyle`, and `VerticalLineStyle` exports, rejected style fields,
legacy required visual props, and unused negative legacy-shape assertions.

### GREEN

Command:

```sh
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components/line.test.ts packages/core/src/lib/components/line-helpers.test.ts --browser.headless --browser.ui=false
```

Result: exit 0; both files and all 15 tests passed. This includes exact
horizontal/vertical default extents and pixel alignment, widened line hit
geometry, cursor propagation, and opacity-zero interaction without painted
pixels.

The helper-forwarding regression was mutation-checked independently: removing
the shared line style from `horizontalLine` produced the intended 1 failed and
5 passed result because its click region disappeared, then restoring the style
forwarding returned the combined suite to 15/15.

Command:

```sh
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 typecheck
```

Result: exit 0; `tsc --noEmit` reported no errors across core, scenarios,
playground, tooling, and the public package consumer.

Changed TypeScript files also passed ESLint, `git diff --check` was clean, and
the legacy-call audit found only the intentional `@ts-expect-error` package
consumer cases. Every authored line-family caller now supplies visual geometry,
paint, cursor, pixel alignment, and interaction width through required style.
No visual baseline changed.

P003-03 remains in progress pending adversarial review. P003-04 remains TODO.

### Adversarial review round 1

Review found one Important runtime style-boundary issue. `LineStyle` excluded
`fill` statically, but `Line` used object rest to forward every runtime style
key into `Path`. A JavaScript or `any` caller could inject `fill`, causing a
closed polyline to paint a polygon interior and register that interior as fill
interaction geometry. Horizontal and vertical helpers used the same permissive
rest forwarding.

Fix RED command:

```sh
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components/line.test.ts --browser.headless --browser.ui=false
```

Result: exit 1 with 2 failed and 9 passed tests. A runtime-bypassed closed line
painted the injected red fill, and a click in the polygon interior invoked the
line handler once. Workspace typecheck remained green with a new meaningful
`@ts-expect-error` assertion proving public `LineStyle` rejects `fill`.

`Line`, `HorizontalLine`, and `VerticalLine` now explicitly construct the next
style object from only `stroke`, `strokeWidth`, `opacity`, `cursor`,
`lineInteractionWidth`, and generated coordinates. Unknown runtime keys and
component-owned `custom` data do not cross the internal line-to-path boundary.

Fix GREEN commands:

```sh
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components/line.test.ts packages/core/src/lib/components/line-helpers.test.ts --browser.headless --browser.ui=false
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 typecheck
```

The focused browser command exited 0 with both files and all 17 tests passing.
Typecheck exited 0 with no errors. Changed-file ESLint and `git diff --check`
also passed. P003-03 remains in progress pending re-review; P003-04 remains
TODO.

### Clean adversarial review closure

Code re-review found the explicit allowed-field construction complete with no
remaining findings and declared Task 3 ready for status-only closure. This
closure marks P003-03 done, advances P003-04 as the sole next step, and
synchronizes the plan board.

No production or test file changed and no behavior check was rerun. The
immediately preceding fresh evidence remains 17/17 focused browser tests, clean
workspace typecheck, and clean changed-file hygiene. The final amended Task 3
commit is sent for status-only review before P003-04 begins.

## 2026-08-17 — P003-04 text style and pure text layout

### Environment

- Node: `v26.7.0`
- pnpm: `11.21.0` selected through `corepack pnpm@11.21.0`
- Browser: Playwright Chromium through Vitest Browser Mode

### RED

Command:

```sh
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components/text-layout.test.ts packages/core/src/lib/components/text.test.ts --browser.headless --browser.ui=false
```

Result: exit 1. The new pure suite could not import the absent text-layout
module. The style-only component suite also recorded three expected failures
before the browser connection closed: opacity-zero paint was absent and the new
style geometry did not register the expected click/double-click targets.

Command:

```sh
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 typecheck
```

Result: exit 1 with the expected missing `TextStyle` and text-layout exports,
rejected text style fields, and legacy required visual-prop signature.

### GREEN pending adversarial review

`TextStyle` now owns literal content, local geometry, bounds, typography, paint,
opacity, cursor, wrapping, and CRC-native fit. `TextProps` contains only mouse
handlers. `resolveTextLayout` is pure and returns final literal lines with their
anchors/baselines, measured per-line bounds, aggregate bounds, and finite clip
geometry. The painter uses those exact lines and bounds; a pure clip helper
accepts the Canvas-height fallback needed to preserve omitted-height clipping.

Command:

```sh
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components/text-layout.test.ts packages/core/src/lib/components/text.test.ts --browser.headless --browser.ui=false
```

Result: exit 0; both files and all 23 tests passed. Evidence includes exact
wrapped/ellipsized literal lines, y positions and measured bounds, single-line
ellipsis, squish width, finite clipping, centered/middle-baseline and squished
hit bounds, zero-origin defaults, opacity zero, cursor-only interaction, and a
runtime-bypassed legacy-prop authority check.

Command:

```sh
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 typecheck
```

Result: exit 0 across core, scenarios, playground, tooling, and the public
package consumer. Public consumer assertions accept `TextStyle` and reject
top-level text content/paint, omitted required style, and legacy
`maxWidth`/`overflow` names.

All 107 repository text-call expressions were audited. Every authored caller is
style-bearing; the only top-level visual cases are intentional negative public
type assertions and the runtime-bypass regression. No runtime adapter, alias,
fallback, or visual baseline was added. P003-04 remains in progress pending
adversarial review, and P003-05 remains TODO.

One migration attempt coupled the range-based caller rewrite with a general
TypeScript Prettier invocation, producing a noisy whole-file reformat. That
owned diff was reversed before continuing. The final migration uses syntax
ranges only for each `text(...)` object and leaves surrounding source unchanged;
future migration tooling should keep formatting scoped the same way.

### Adversarial review round 1 — text-local clip interaction

Review found one Important paint/interaction mismatch. `fit: 'clip'` applied a
raw Canvas clip, but `crcRegion` captured only CRC's shared clipping stack, so
the measured glyph rectangles outside the visible text clip still received
handlers and cursor ownership.

Fix RED command:

```sh
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components/text.test.ts --browser.headless --browser.ui=false
```

Result: exit 1 with 1 failed and 22 passed tests. Moving to a measured glyph
position outside the text clip produced `cursor: pointer`, proving the region
ignored the paint clip before the click assertion ran.

The new internal `pushClippingPath` seam applies a Canvas clip and publishes the
same `Path2D`, fill rule, and current transform to CRC interaction state. It
returns an idempotent release callback. Both the existing `clip` component and
text-local clipping now use this seam; text keeps it active only through paint
and region registration and releases it in `finally`. Nested clips remain stack
ordered, while component save/restore continues to own Canvas state.

Fix GREEN command:

```sh
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components/text-layout.test.ts packages/core/src/lib/components/text.test.ts packages/core/src/lib/components/clip.test.ts packages/core/test/interaction-dispatch.test.ts --browser.headless --browser.ui=false
```

Result: exit 0 with all four files and 38 tests passing. The regression proves
the clipped-away glyph area has neither click nor cursor behavior while the
visible clipped portion retains both. Workspace typecheck also exits 0.
P003-04 remains in progress pending adversarial re-review; P003-05 remains TODO.

### Clean adversarial review closure

Code re-review found the shared Canvas/interaction clipping seam complete with
no remaining findings and declared Task 4 ready for status-only closure. This
closure marks P003-04 done, advances P003-05 as the sole next step, and
synchronizes the plan board.

No production or test file changed and no behavior check was rerun. The
immediately preceding fresh evidence remains 38/38 focused browser tests, clean
workspace typecheck, and clean changed-file hygiene. The final amended Task 4
commit is sent for status-only review before P003-05 begins.

## 2026-08-17 — P003-05 image styles

### Environment

- Node: `v26.7.0`
- pnpm: `11.21.0` selected through `corepack pnpm@11.21.0`
- Browser: Playwright Chromium through Vitest Browser Mode

### RED

Command:

```sh
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components/img.test.ts packages/core/src/lib/components/img-async.test.ts --browser.headless --browser.ui=false
```

Result: exit 1; both files failed, with 20 failed and 5 passed tests. The legacy
renderer read source and geometry from program props, so style-only inputs did
not create image generations or usable interaction geometry. The focused run
also exposed the old renderer's undefined-source path during those expected
failures.

Command:

```sh
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 typecheck
```

Result: exit 1 with the expected absent `ImgStyle` export, rejected image style
fields, and the legacy required top-level `src`/`x`/`y` signature.

### GREEN pending adversarial review

`ImgStyle` now owns source, optional local geometry, border paint, opacity,
cursor, and pixel alignment. `ImgProps` contains only mouse handlers. Each
asynchronous image generation is keyed only by `style.src`; the existing
settlement, source-change, removal, disposal, and saved-late-callback teardown
paths remain intact.

Explicit dimensions establish the same image/border/interaction rectangle
before load and after failure. Omitted dimensions remain zero until the current
source loads, then resolve independently from natural width and height. Pixel
alignment still produces one shared adjusted rectangle, and opacity zero keeps
the explicit transparent geometry interactive.

Command:

```sh
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components/img.test.ts packages/core/src/lib/components/img-async.test.ts --browser.headless --browser.ui=false
```

Result: exit 0; both files and all 27 tests passed. The focused evidence includes
success/error/race/removal/disposal ownership, explicit zero and negative
dimensions, zero-origin defaults, natural sizing, all pixel-grid modes,
opacity-zero paint and interaction, cursor behavior, and untyped legacy-input
authority checks.

Command:

```sh
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 typecheck
```

Result: exit 0 across core, scenarios, playground, tooling, and the public
package consumer. The consumer accepts `ImgStyle` and rejects top-level source
and paint values, omitted required style, and legacy paint aliases.

All 28 repository `img(...)` call expressions were inspected. Every authored
caller is style-bearing; the remaining top-level visual inputs are deliberate
negative type assertions or runtime-bypass regressions. No image alias/helper
call site, compatibility adapter, runtime fallback, or visual baseline was
introduced. P003-05 remains in progress pending adversarial review, and P003-06
remains TODO.

### Batched clean review closure

Task 5's independent adversarial code review found no remaining issues. Under
the phase-batched workflow, its status advances together with Task 6 rather than
through a status-only amendment. The 27/27 focused browser and clean typecheck
evidence above remains authoritative; no Task 5 production or test file changed
after that clean review.

## 2026-08-17 — P003-06 composition styles and style-only milestone

### RED

Command:

```sh
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components/g.test.ts packages/core/src/lib/components/clip.test.ts packages/core/src/lib/components/layer.test.ts --browser.headless --browser.ui=false
```

Result: exit 1; all 3 files failed, with 3 failed and 42 passed tests. Descriptor
style was ignored while legacy top-level group transforms, clipping paths, and
layer dimensions remained authoritative.

Command:

```sh
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 typecheck
```

Result: exit 1 with missing `GStyle`, `ClipStyle`, and `LayerStyle` exports, the
legacy required top-level clip path, and unused negative assertions for the
still-accepted visual props.

### GREEN

`GStyle` uses CRC-native `rotationDegrees` and `rotationOrigin`, preserving the
existing scale, origin-relative rotation, translation, and skew order. Clip path
data and fill rule are style-only; layer dimensions are style-only while the
child descriptor remains a structural prop. Untyped top-level visual values are
ignored. Layer invalidation independently compares child type, key, props, and
style. Obsolete visual-prop mixins were removed after their usage reached zero.

The migration inspected 123 `g(...)`, `clip(...)`, and `layer(...)` call
expressions. Every authored visual value is style-bearing; the only direct
top-level visual names are deliberate public negative assertions. No alias,
top-level spread, compatibility adapter, or visual baseline was introduced.

Focused command:

```sh
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components/g.test.ts packages/core/src/lib/components/clip.test.ts packages/core/src/lib/components/layer.test.ts --browser.headless --browser.ui=false
```

Result: exit 0; all 3 files and all 46 tests passed. Exact transform order,
paint/interaction clipping, layer dimensions, child-props/style invalidation,
global target order, nested transforms/layers, and cursor/ownership behavior are
covered.

### Planned style-migration milestone

```sh
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 typecheck
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 lint:code
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 test:ci
PATH=/private/tmp/crc-toolchain/node_modules/.bin:$PATH corepack pnpm@11.21.0 test:package-consumer:packed
```

Results: typecheck and full ESLint exited 0. Browser mode passed 37 files and 315
tests with 2 skips. The packed `@crc/core` consumer passed Bundler, NodeNext,
runtime, and no-source checks. Aggregate `trust` was intentionally not run at
this milestone. P003-05 and P003-06 are done; P003-07 is the sole next step.

## 2026-08-18 — P003-07 through P003-10 layout-foundation phase

### Delivered contracts

- P003-07 added finite numbers, decimal percentages, `auto`, constraints,
  normalized numeric edges, content-box resolution, min/max validation, and
  contextual overflow-safe diagnostics. The final Task 7 review was clean.
- P003-08 added specified/normalized/resolved style capabilities, intrinsic-root
  and nested containing contexts, stable placement identity hints,
  `crcLayoutBox`, and finite dispatch before Canvas callbacks. Review fixes
  covered percentage basis, line endpoint vocabulary, and conservative resolved
  schema/runtime validation; the final review was clean.
- P003-09 added public absolute and overlay contexts with normalized direct-child
  inspection, unkeyed-only occurrence counting, source-order placement,
  mathematical alignment, and shared paint/interaction overflow clips. The
  final review was clean.
- P003-10 added non-enumerable pure measurement capabilities, isolated and
  cycle-safe recursive `measureElement`, shared text measurement, explicit-only
  image measurement, and CRC-native horizontal/vertical flow with finite
  wrapping, gaps, line sizing, alignment, definite-box bypass, recursive nested
  measurement, and exactly-once required measurement. Measurement reports
  intrinsic content size; auto measured sizes are reused by placement and render
  through a one-shot internal normalized-style seam. The shared layout-foundation scenario now
  includes measurable text plus resize-sensitive flow paint and interaction.

### Task 10 RED and focused GREEN

RED failed because the measurement/flow modules, public exports, and component
measurement capability did not exist; workspace typecheck reported the same
missing surface.

Focused GREEN:

```sh
node /Users/benlesh/.cache/node/corepack/v1/pnpm/11.21.0/bin/pnpm.mjs exec vitest run packages/core/src/lib/layout/measure.test.ts packages/core/src/lib/layout/flow.test.ts packages/core/test/layout-foundation.test.ts --browser.headless --browser.ui=false
```

Result: exit 0; 3 files and 13 tests passed.

### Planned layout-foundation milestone

Environment: Node v26.7.0, pnpm 11.21.0, Playwright 1.62.1 Chromium.

```sh
node /Users/benlesh/.cache/node/corepack/v1/pnpm/11.21.0/bin/pnpm.mjs exec vitest run packages/core/src/lib/layout packages/core/test/layout-foundation.test.ts --browser.headless --browser.ui=false
node /Users/benlesh/.cache/node/corepack/v1/pnpm/11.21.0/bin/pnpm.mjs typecheck
node /Users/benlesh/.cache/node/corepack/v1/pnpm/11.21.0/bin/pnpm.mjs test:lifecycle
node /Users/benlesh/.cache/node/corepack/v1/pnpm/11.21.0/bin/pnpm.mjs test:performance
```

Results: layout/scenario passed 7 files and 62 tests; typecheck exited 0;
lifecycle passed 2 files and 9 tests; structural performance passed 1 file and
3 tests with the 2 controlled wall-clock cases skipped by default. Aggregate
`trust` was intentionally not run at this milestone. P003-07 through P003-10
are done; P003-11 is the sole next step.

## 2026-08-18 — P003-11 and P003-12 CSS layout algorithms

- P003-11 added the public CSS-compatible Flex subset. Its pure algorithm covers
  row/column, nowrap/wrap, iterative grow/shrink freezing, numeric gaps, main and
  cross alignment, and explicit min/max constraints. Reverse/reordered behavior,
  baseline, auto margins, percentage gaps, and allocation-dependent intrinsic
  cases reject with diagnostics instead of approximating CSS. Hand-derived and
  Chromium-oracle evidence passed 3 files and 30 tests, workspace typecheck was
  clean, and the final adversarial review accepted commit `6c341bb`.
- P003-12 added public `grid`, `GridStyle`, `GridTrack`, and `GridItemStyle` for
  the explicit-only Grid subset. Tracks parse exact finite numeric, decimal
  percentage, and decimal `fr` values; fractional free space uses
  `remaining / max(1, totalFr)` after fixed tracks, percentages, and gaps.
  Explicit one-based placement, spans, source-order overlap, container/item
  alignment, clipping, stable identity, normalize-once placement, and used-size
  rendering share the existing layout foundation. Implicit placement/tracks and
  advanced CSS track syntax reject with contextual diagnostics.

### Task 12 RED and focused GREEN

RED failed at the absent Grid module and public export boundary. Focused GREEN:

```sh
node /Users/benlesh/.cache/node/corepack/v1/pnpm/11.21.0/bin/pnpm.mjs exec vitest run src/lib/layout/grid.test.ts test/grid-css-compatibility.test.ts test/layout-foundation.test.ts --browser.headless --browser.ui=false
```

Result after review regressions: exit 0; 3 files and 21 tests passed. The added
cases cover public percentage/fractional dispatch, validation on definite
measurement paths, and independent start/span diagnostics.

### Planned CSS algorithm milestone

Environment: Node v26.7.0, pnpm 11.21.0, Playwright 1.62.1 Chromium.

```sh
node /Users/benlesh/.cache/node/corepack/v1/pnpm/11.21.0/bin/pnpm.mjs exec vitest run packages/core/src/lib/layout packages/core/test/flex-css-compatibility.test.ts packages/core/test/grid-css-compatibility.test.ts packages/core/test/layout-foundation.test.ts packages/core/test/geometry-composition.test.ts packages/core/test/interaction-dispatch.test.ts --browser.headless --browser.ui=false
node /Users/benlesh/.cache/node/corepack/v1/pnpm/11.21.0/bin/pnpm.mjs typecheck
node /Users/benlesh/.cache/node/corepack/v1/pnpm/11.21.0/bin/pnpm.mjs test:performance
```

Results: the layout/oracle/scenario/geometry/interaction milestone passed 13
files and 126 tests; typecheck exited 0; structural performance passed 1 file
and 3 tests with the 2 controlled wall-clock cases skipped by default.
Aggregate `trust` was intentionally not run at this milestone. P003-11 and
P003-12 are done; P003-13 is the sole next step.

## 2026-08-18 — P003-13 public examples and integration

- Added exactly four canonical learner routes under the new Layout section:
  absolute/overlay, CRC-native Flow, CSS-compatible Flex, and explicit Grid.
  Each source imports only `@crc/core`, exports the standard
  `mount(canvas): CRCController` function, has exactly two objectives, paints a
  visible interactive lesson, and contains no laboratory diagnostics.
- Promoted `layout-foundation.example.ts` into the cataloged test laboratory.
  Its public scene nests Flex→Grid→Overlay, resizes from 720 × 420 to 480 × 360,
  proves clipped paint and hit geometry plus topmost selection, preserves keyed
  hook state across reflow, composes measured text and an explicitly sized
  image, and reports exact local boxes of 432 × 420 and 288 × 360 through
  `crcLayoutBox`.
- Replaced the Studio's obsolete visual-prop declarations with the current
  style, length, box, layout-item, layout-component, measurement, and
  observation surface. The strict consumer now covers positive and negative
  style/layout usage from both main and types entrypoints, and its runtime
  export manifest includes layout, measurement, resolution, and diagnostics.
- Regenerated `docs/scenario-index.md` using the repository tool; it now records
  28 learning lessons and 14 deterministic test labs.

### Public integration RED and milestone

RED found the expected missing four learning routes, uncataloged layout
laboratory, absent exact observed boxes, and stale consumer runtime manifest.

Environment: Node v26.7.0, pnpm 11.21.0, Playwright 1.62.1 Chromium.

```sh
node /Users/benlesh/.cache/node/corepack/v1/pnpm/11.21.0/bin/pnpm.mjs scenarios:check
node /Users/benlesh/.cache/node/corepack/v1/pnpm/11.21.0/bin/pnpm.mjs typecheck
node /Users/benlesh/.cache/node/corepack/v1/pnpm/11.21.0/bin/pnpm.mjs playground:build
node /Users/benlesh/.cache/node/corepack/v1/pnpm/11.21.0/bin/pnpm.mjs playground:build:built
node /Users/benlesh/.cache/node/corepack/v1/pnpm/11.21.0/bin/pnpm.mjs test:package-consumer:packed
node /Users/benlesh/.cache/node/corepack/v1/pnpm/11.21.0/bin/pnpm.mjs exec vitest run packages/core/test/learning-examples.test.ts packages/core/test/scenario-catalog.test.ts packages/core/test/layout-foundation.test.ts --browser.headless --browser.ui=false
```

Results: catalog validation passed 28 lessons and 14 labs; typecheck exited 0;
source and built Studio production builds passed; the packed consumer passed
Bundler, NodeNext, runtime export, and no-source checks; focused public
integration passed 3 files and 48 browser tests. P003-13 is done; P003-14 is the
sole next step.
