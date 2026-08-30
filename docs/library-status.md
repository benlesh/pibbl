# CRC library status and feature inventory

_Feature inventory refreshed: 2026-08-29, after the DOM-aligned user-event
delivery. Verification totals below remain explicitly dated evidence._

## At a glance

CRC is a small functional component runtime over the HTML Canvas 2D API. It
provides scheduled rendering, hook state, DOM-aligned user events, eleven
style-only drawing/composition components, transforms, cumulative clipping,
globally ordered offscreen layers, and five dedicated layout contexts. The
project has contract-driven browser evidence for public exports, shared
manual/headless scenarios, deterministic lifecycle ledgers, structural
performance guards, strict package consumers, and reviewed visual comparisons.

Historical test totals in completed plans are dated evidence rather than the
current result. The verification snapshot below is authoritative only for its
named Plan 003 closure revision and does not verify later user-event work.
Controlled wall-clock timing remains opt-in; deterministic structural
counterparts run normally.

“Trusted” below means the applicable supported behavior, boundary cases,
updates, errors, teardown, interaction, and visual output have deterministic
evidence. It does not mean CRC adds a focus/input policy, public input adapter,
hidden editable DOM, DOM accessibility, rich text, or image CORS control.

## Public feature inventory

### Runtime and component model

| Feature / API                 | Supported behavior and evidence                                                                                                                                                                                                                       | Known boundary                                                                                                                                |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `crc(canvas, root, options?)` | **Trusted.** Mount/update coalescing, latest-root retention, controller identity, mount-only signal, queued-frame safety, explicit/idempotent disposal, stale controller protection, 1,000-cycle release, and built-package use are direct contracts. | One Canvas owns one live mount. Updating with another signal does not replace the original lifetime.                                          |
| `defineComp`                  | **Trusted.** Public type/runtime contracts cover specified/normalized/resolved styles, optional pure measurement, function identity, keyed and unkeyed siblings, falsy children, duplicate keys, removal, and root replacement.                       | Unkeyed same-type identity follows occurrence order; use a key for semantic identity. Allocation syntax requires a finite resolver.           |
| Tree and hook sequencing      | **Trusted.** Function-plus-key identity, keyed reorder/insert/remove, hook-kind/count diagnostics, failed-render cleanup, Canvas/global restoration, and valid retry are direct.                                                                      | Conditional/reordered hooks are rejected. A failed render resets resources but does not roll back pixels already drawn earlier in that frame. |
| Scheduled updates             | **Trusted.** State/root permutations, frame cancellation, already-dequeued no-ops, parent update intent, and settle helpers are deterministic.                                                                                                        | Rendering remains `requestAnimationFrame` scheduled.                                                                                          |
| Teardown/resource model       | **Trusted.** Every native listener, registry entry, cursor token, component follower, layer instance, frame, image callback, hook cleanup, and mount map entry has one owner and exact release evidence.                                              | Garbage-collection timing is deliberately not a required oracle.                                                                              |

### Drawing components

| Public export    | Confidence and supported behavior                                                                                                                                                      | Known boundary                                                                                                                     |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `rect`           | **Trusted.** Style-only paint/opacity, signed local geometry, length resolution, pixel-grid modes, cursor, grouped user-event props, transforms/clips/layers/layout, and exact pixels. | Canvas owns signed/degenerate primitive semantics; layout allocation is nonnegative.                                               |
| `path`           | **Trusted.** Style-only path/paint/opacity, replacement, empty paths, line hit width, targeting, and exact pixels.                                                                     | A `Path2D` is browser-owned geometry.                                                                                              |
| `line`           | **Trusted.** Multipoint styling/updates, empty and single-point no-pixel behavior, transforms/clips, line hit width, and exact pixels.                                                 | A single `moveTo` does not paint a point.                                                                                          |
| `horizontalLine` | **Trusted.** Full-Canvas/default and custom bounds, every pixel-grid mode, updates, and interaction parity with `line`.                                                                | Pixel snapping follows effective stroke offset.                                                                                    |
| `verticalLine`   | **Trusted.** Same matrix as `horizontalLine`, including symmetric defaults and modes.                                                                                                  | Same as horizontal line.                                                                                                           |
| `svgPath`        | **Trusted.** Style-only data/paint, valid/empty/malformed browser delegation, updates, interactions, transforms, and public example.                                                   | CRC does not add an SVG parser; Chromium can accept malformed data as empty or partial geometry.                                   |
| `text`           | **Trusted.** Style-only content/paint/font/alignment/baseline, fit/wrap behavior, exact Canvas calls, shared pure measurement, multiline hits, updates, and public example.            | Glyph rasterization and text metrics depend on browser/font platform; no DOM rich text or accessibility semantics are synthesized. |
| `img`            | **Trusted.** Style-owned source/geometry, success/error/source race/removal, inert late callbacks, natural/explicit dimensions, opacity, border, alignment, and exact stable pixels.   | Decode/CORS/taint behavior belongs to the browser. Layout measurement requires explicit dimensions.                                |
| `g`              | **Trusted.** Nested translate/scale/rotate/origin/skew, zero/negative scale, update, sibling isolation, transformed targeting, and composition pixels.                                 | This is Canvas transformation, not layout.                                                                                         |
| `clip`           | **Trusted.** `nonzero`/`evenodd`, cumulative nested intersection, transform/update/empty clip, and matching render/hit geometry.                                                       | No retained clip object is exposed publicly.                                                                                       |
| `layer`          | **Trusted.** Persistent prop/root/dimension updates, global paint/target order, nested transforms/clips/bounds, shared root interaction state, cursor parity, and cascading cleanup.   | Requires browser `OffscreenCanvas`; render caching remains shallow-prop based.                                                     |

The full rules are in the [style](./design/style-system-contract.md) and
[drawing](./design/drawing-components-contract.md) contracts. Eleven focused
drawing/composition lessons cover all eleven exports in the Studio.

### Style and layout

| Public API                        | Confidence and supported behavior                                                                                                                                                        | Known boundary                                                                           |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Style protocol and box resolution | **Trusted.** Required closed component styles, no legacy runtime aliases, number/percentage/auto parsing, finite diagnostics, content-box resolution, and local spread reuse are direct. | No cascade, inheritance, margin, selectors, or complete CSS parser.                      |
| `absolute`                        | **Trusted.** Definite direct-child size, number/percentage left/top, padding, clipping, source order, nested percentage resolution, and identity across reflow.                          | No right/bottom anchors, automatic size, or normal-flow participation.                   |
| `overlay`                         | **Trusted.** Shared allocation, start/center/end/stretch alignment, self overrides, oversized alignment, clipping, and source-order overlap.                                             | Definite child size is required; no z-index.                                             |
| `flow`                            | **Trusted.** Horizontal/vertical sequential placement, optional wrapping, numeric gaps, line cross sizing, alignment, pure measurement, and used-size rendering.                         | CRC-native, not CSS inline layout; no baseline, reverse, or justification.               |
| `flex`                            | **Trusted.** Row/column, nowrap/wrap, grow/shrink with explicit main minimums, numeric gaps, distribution, item alignment, align-content, and DOM-oracle parity for the accepted matrix. | Reverse/order/baseline/auto margins/percentage gaps and advanced intrinsic cases reject. |
| `grid`                            | **Trusted.** Explicit fixed/percentage/fractional tracks, one-based starts/spans, overlap, numeric gaps, alignment, clipping, and DOM-oracle parity.                                     | No implicit/automatic placement, content tracks, repeat/minmax, named areas, or subgrid. |
| `measureElement` / `crcLayoutBox` | **Trusted.** Isolated pure measurement, cycle diagnostics, text and custom measurement, explicit image sizing, stable local observation, and no scheduling/ownership.                    | Natural image measurement and ambiguous intrinsic layout report unsupported diagnostics. |

### Hooks and interaction

| Public API           | Confidence and supported behavior                                                                                                                                                                                                                                               | Known boundary                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Built-in event props | **Trusted.** Pointer, mouse, touch, wheel, keyboard/focus, editing/composition, clipboard, and drag/drop handlers share topmost geometry, temporary capture/target/bubble paths, cancellation, logical related targets, pointer capture, mutation isolation, and exact cleanup. | Native non-coordinate Canvas input has no logical target without future/optional focus/input integration.                     |
| `crcEventTarget`     | **Trusted.** One grouped custom target owns explicit `Path2D` geometry, handlers, cursor/focus metadata, captured transforms/clips, paint order, stable rerender identity, pointer capture, and exact teardown.                                                                 | Geometry is required and never inferred from returned descendants; focus metadata is inert without an optional future policy. |
| `crcEventListener`   | **Trusted.** One non-geometric component registration participates in capture/bubble traversal and common-ancestor activation without becoming a hit target.                                                                                                                    | It owns no drawing or implicit geometry.                                                                                      |
| `crcEvent`           | **Trusted.** Path-bound calls retain stable legacy mouse targets; pathless calls retain ordered mouse-only Canvas observers after logical propagation with mutation/error isolation and cleanup.                                                                                | The pathless observer payload remains the narrow shipped `{ x, y, originalEvent }` shape.                                     |
| `crcCursor`          | **Trusted.** Target cursor, Canvas-wide defaults, multiple-default precedence, rerender/removal fallback, external style takeover, layer parity, and exact owned cleanup.                                                                                                       | Cursor style is inline Canvas state; it is not an accessibility substitute.                                                   |
| `crcState`           | **Trusted.** Stable slot/setter, value and functional updates, coalescing, identity reset, parent updates, and inert stale/dead setters.                                                                                                                                        | Functions passed to the setter are updaters, not function-valued state.                                                       |
| `crcMemo`            | **Trusted.** Strict shallow dependency identity, length/value change, factory errors, and hook-order rules.                                                                                                                                                                     | `NaN` recomputes; `+0` and `-0` compare equal under strict `!==`.                                                             |
| `crcRef`             | **Trusted.** Stable mutable object, initializer-on-mount, no render on mutation, multiple slots, and remount boundaries.                                                                                                                                                        | Refs are runtime values, not DOM refs.                                                                                        |
| `crcWhenChanged`     | **Trusted.** Mount/change/every-render setup, cleanup-before-next, throwing/void replacement, exactly-once removal/root cleanup, and setter-during-cleanup safety.                                                                                                              | It is synchronous during render, not a deferred effect.                                                                       |
| `crcRectPath`        | **Trusted.** Effective geometry and pixel-grid dependencies preserve/replace memo identity correctly.                                                                                                                                                                           | Uses the same hook-order rules as other hooks.                                                                                |
| `crcLinePath`        | **Trusted.** Every coordinate and `closePath` participates in identity and construction.                                                                                                                                                                                        | Empty/single-point Canvas semantics are preserved.                                                                            |
| `crcSvgPath`         | **Trusted.** Exact data identity and platform parse/error delegation.                                                                                                                                                                                                           | No CRC-side validation or normalization.                                                                                      |
| `crcLayoutBox`       | **Trusted.** Stable readonly local allocation, exact resize/reflow values, and context diagnostics.                                                                                                                                                                             | Observation is render-only and does not itself schedule an update.                                                            |

See the [runtime/hook contract](./design/runtime-hooks-contract.md),
[user-event contract](./design/user-events-contract.md), retained [mouse
geometry/legacy contract](./design/mouse-interaction-contract.md), and ownership
documents for exact rules.

### Types, packages, scenarios, and builds

| Area                   | Current confidence                                                                                                                                                                                                                    | Remaining boundary                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Public TypeScript API  | **Trusted.** Declarations compile under strict Bundler and NodeNext consumers. Positives/negatives cover style schemas, lengths, layouts, measurement, observation, runtime, hooks, events, and controllers. Private subpaths reject. | `@crc/types` remains a deliberately empty compatibility package until a concrete need justifies it.                 |
| Package build          | **Trusted.** esbuild ESM/source maps plus TypeScript declarations load in Node and the browser. Source/built smoke visuals match and built gallery guards reject source leakage.                                                      | Output is ESM-only; new formats need an explicit requirement.                                                       |
| Scenario catalog       | **Trusted.** Recursive filesystem/Vite discovery, source markers, identity/action checks, unique metadata, and the generated [scenario index](./scenario-index.md) are required.                                                      | Publication remains a later adapter.                                                                                |
| Local Studio           | **Trusted.** Twenty-eight learner routes and fifteen deterministic laboratories share canonical public source with headless tests, including four layout lessons and the user-event contract laboratory.                              | This is an internal Studio, not yet a published documentation site.                                                 |
| Continuous integration | **Configured.** One workflow maps static, packed-package, browser/visual, lifecycle, and performance structure to a stable aggregate `Trust gate` for PRs, pushes to `main`, and manual runs.                                         | Hosted green status and selecting the aggregate in branch protection require pushing and repository administration. |

## Historical Plan 003 verification snapshot

The Plan 003 closure revision was verified on 2026-08-18 with Node v26.7.0,
pnpm 11.21.0, Playwright 1.62.1, and Chrome for Testing 151.0.7922.34. The
documented release environment remains Node 24.15+ on the Node 24 LTS line; the
Node 26 run is recorded honestly and does not replace that support policy or
claim to verify later user-event work.

| Check                            | Recorded result                                                                                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Aggregate browser suite          | 49 files; 457 passed and 2 documented opt-in timing skips                                                                                                          |
| Static and package               | Catalog 28 lessons/14 labs, typecheck, ESLint/Prettier, package builds, source/built Studio, strict packed Bundler/NodeNext/runtime/no-source consumers all passed |
| Visual and built smoke           | Visual safeguard passed; five inspected full-page Studio baselines matched; built-package smoke passed 1/1                                                         |
| Lifecycle                        | 2 files and 11 tests passed                                                                                                                                        |
| Default structural performance   | 1 file; 5 passed and 2 controlled timing cases skipped                                                                                                             |
| Controlled reference performance | 1 file and all 7 tests passed with finite reported measurements                                                                                                    |

The Studio visual baselines intentionally changed because every full-page view
now includes the four-route Layout navigation and lesson captures show the
style-only source. The first aggregate run caught this stale evidence; all five
actuals were inspected before updating, and the normal comparison then matched
5/5. Vite reported the known shared static/dynamic import warning for the layout
laboratory and chunk-size advisories for Monaco/editor bundles. Neither warning
changed runtime or verification behavior.

In the single controlled reference run, sparse/miss 10,000-region dispatch was
2.4 ms median and 3.5/3.7 ms p95 respectively, below the documented spatial-index
trigger. Environment-sensitive timing remains observation, not a default
correctness budget. Exact remaining metrics are preserved in the Plan 003 field
note.

## Running locally

### Prerequisites

Use Node 24.15.0 or newer on the Node 24 LTS line. The repository pins pnpm 11.21.0.

```sh
nvm install 24
nvm use 24
corepack enable
pnpm install --frozen-lockfile
```

If Chromium is absent, install it once with `pnpm exec playwright install chromium` (`--with-deps` on a fresh Linux machine).

### Open the interactive studio

```sh
pnpm playground
```

Open <http://localhost:5173/#/examples> for the 28 learner lessons.
Deterministic browser fixtures live separately at
<http://localhost:5173/#/testing>, and legacy `#/scenarios` URLs redirect there.
To exercise package output instead of source aliases, use
`pnpm playground:built`.

### Verification commands

```sh
corepack pnpm@11.21.0 trust
```

See the [trust-gate guide](./testing/trust-gate.md) for clean-checkout setup, visual policy, and performance cadence.

## Accepted or deferred work

- Built-in focus/input policy, a public input adapter, keyboard navigation,
  accessibility, hidden editable DOM, JSX, new drawing primitives,
  advanced/deferred layout features, publication, and a polished docs renderer
  remain outside the current contract.
- TFC-06 measurements do not justify a spatial index: the optimized linear resolver remains under its recorded triggers.
- Wall-clock performance runs remain environment-controlled and opt-in; deterministic workload/counter assertions run on every normal suite.
- `origin/jess/tests-for-utils` and richer JSX/playground branches were reviewed selectively; useful current-contract evidence was recreated without merging stale toolchain or unrelated feature work.
- Hosted workflow confirmation and branch-protection selection remain external repository administration after this branch is pushed.
