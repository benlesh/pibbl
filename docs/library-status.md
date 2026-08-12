# CRC library status and feature inventory

_Snapshot refreshed: 2026-08-11, after the TFC-09 drawing confidence sweep._

## At a glance

CRC is a small functional component runtime over the HTML Canvas 2D API. It provides scheduled rendering, hook state, mouse-region interaction, transforms, cumulative clipping, globally ordered offscreen layers, and eleven drawing components. The project now has contract-driven browser evidence for every public export, a shared catalog of manual/headless scenarios, deterministic lifecycle ledgers, exact structural performance guards, strict package consumers, and reviewed visual comparisons.

The historical pre-plan baseline was 70 browser tests with four supported-behavior skips. After TFC-09 the complete suite has 250 passing tests; all four supported skips have been replaced or enabled. The only conditional tests are two explicitly opt-in TFC-06 wall-clock timing benchmarks; their deterministic structural counterparts run normally.

“Trusted” below means the applicable supported behavior, boundary cases, updates, errors, teardown, interaction, and visual output have deterministic evidence. It does not mean CRC adds browser capabilities that are outside its API, such as touch, keyboard focus, DOM accessibility, rich text, or image CORS control.

## Public feature inventory

### Runtime and component model

| Feature / API                 | Supported behavior and evidence                                                                                                                                                                                                                       | Known boundary                                                                                                                                |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `crc(canvas, root, options?)` | **Trusted.** Mount/update coalescing, latest-root retention, controller identity, mount-only signal, queued-frame safety, explicit/idempotent disposal, stale controller protection, 1,000-cycle release, and built-package use are direct contracts. | One Canvas owns one live mount. Updating with another signal does not replace the original lifetime.                                          |
| `defineComp`                  | **Trusted.** Public type/runtime contracts cover element creation, function identity, same-name functions, keyed and unkeyed siblings, falsy children, duplicate keys, removal, and root replacement.                                                 | Unkeyed same-type identity follows occurrence order; use a key for semantic identity.                                                         |
| Tree and hook sequencing      | **Trusted.** Function-plus-key identity, keyed reorder/insert/remove, hook-kind/count diagnostics, failed-render cleanup, Canvas/global restoration, and valid retry are direct.                                                                      | Conditional/reordered hooks are rejected. A failed render resets resources but does not roll back pixels already drawn earlier in that frame. |
| Scheduled updates             | **Trusted.** State/root permutations, frame cancellation, already-dequeued no-ops, parent update intent, and settle helpers are deterministic.                                                                                                        | Rendering remains `requestAnimationFrame` scheduled.                                                                                          |
| Teardown/resource model       | **Trusted.** Every native listener, registry entry, cursor token, component follower, layer instance, frame, image callback, hook cleanup, and mount map entry has one owner and exact release evidence.                                              | Garbage-collection timing is deliberately not a required oracle.                                                                              |

### Drawing components

| Public export    | Confidence and supported behavior                                                                                                                                                            | Known boundary                                                                                                                     |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `rect`           | **Trusted.** Fill/stroke/alpha, signed geometry, all pixel-grid modes, updates, cursor, common mouse events, transforms/clips/layers, and exact pixels.                                      | Canvas owns signed/degenerate path semantics.                                                                                      |
| `path`           | **Trusted.** Fill/stroke/combined/transparent paint, alpha zero, replacement, empty paths, line hit width, targeting, and exact pixels.                                                      | A `Path2D` is browser-owned geometry.                                                                                              |
| `line`           | **Trusted.** Multipoint styling/updates, empty and single-point no-pixel behavior, transforms/clips, line hit width, and exact pixels.                                                       | A single `moveTo` does not paint a point.                                                                                          |
| `horizontalLine` | **Trusted.** Full-Canvas/default and custom bounds, every pixel-grid mode, updates, and interaction parity with `line`.                                                                      | Pixel snapping follows effective stroke offset.                                                                                    |
| `verticalLine`   | **Trusted.** Same matrix as `horizontalLine`, including symmetric defaults and modes.                                                                                                        | Same as horizontal line.                                                                                                           |
| `svgPath`        | **Trusted.** Valid/empty/malformed browser delegation, fill/stroke/alpha, updates, interactions, transforms, and public example.                                                             | CRC does not add an SVG parser; Chromium can accept malformed data as empty or partial geometry.                                   |
| `text`           | **Trusted.** Fill/stroke/alpha, font/alignment/baseline, visible/ellipsis/squish/clip, wrapping/height truncation, exact Canvas calls, measured multiline hits, updates, and public example. | Glyph rasterization and text metrics depend on browser/font platform; no DOM rich text or accessibility semantics are synthesized. |
| `img`            | **Trusted.** Success/error/source race/removal, inert late callbacks, natural/explicit dimensions, alpha, border, pixel modes, aligned draw/hit geometry, updates, and exact stable pixels.  | Decode/CORS/taint behavior belongs to the browser. Explicit dimensions keep a geometry region before load and after failure.       |
| `g`              | **Trusted.** Nested translate/scale/rotate/origin/skew, zero/negative scale, update, sibling isolation, transformed targeting, and composition pixels.                                       | This is Canvas transformation, not layout.                                                                                         |
| `clip`           | **Trusted.** `nonzero`/`evenodd`, cumulative nested intersection, transform/update/empty clip, and matching render/hit geometry.                                                             | No retained clip object is exposed publicly.                                                                                       |
| `layer`          | **Trusted.** Persistent prop/root/dimension updates, global paint/target order, nested transforms/clips/bounds, shared root interaction state, cursor parity, and cascading cleanup.         | Requires browser `OffscreenCanvas`; render caching remains shallow-prop based.                                                     |

The full component rules and evidence mapping are in the [drawing-component contract](./design/drawing-components-contract.md). Five documentation-candidate lessons cover all eleven exports in the local gallery.

### Hooks and interaction

| Public API       | Confidence and supported behavior                                                                                                                                                                              | Known boundary                                                                                        |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `crcEvent`       | **Trusted.** Eight mouse event types, one reverse-paint-order logical target, transition-before-move, topmost overlap, accumulated geometry, pathless Canvas observers, mutation/error isolation, and cleanup. | Mouse-only. No capture/bubble phase, synthetic ancestor propagation, or public related-target object. |
| `crcCursor`      | **Trusted.** Target cursor, Canvas-wide defaults, multiple-default precedence, rerender/removal fallback, external style takeover, layer parity, and exact owned cleanup.                                      | Cursor style is inline Canvas state; it is not an accessibility substitute.                           |
| `crcState`       | **Trusted.** Stable slot/setter, value and functional updates, coalescing, identity reset, parent updates, and inert stale/dead setters.                                                                       | Functions passed to the setter are updaters, not function-valued state.                               |
| `crcMemo`        | **Trusted.** Strict shallow dependency identity, length/value change, factory errors, and hook-order rules.                                                                                                    | `NaN` recomputes; `+0` and `-0` compare equal under strict `!==`.                                     |
| `crcRef`         | **Trusted.** Stable mutable object, initializer-on-mount, no render on mutation, multiple slots, and remount boundaries.                                                                                       | Refs are runtime values, not DOM refs.                                                                |
| `crcWhenChanged` | **Trusted.** Mount/change/every-render setup, cleanup-before-next, throwing/void replacement, exactly-once removal/root cleanup, and setter-during-cleanup safety.                                             | It is synchronous during render, not a deferred effect.                                               |
| `crcRectPath`    | **Trusted.** Effective geometry and pixel-grid dependencies preserve/replace memo identity correctly.                                                                                                          | Uses the same hook-order rules as other hooks.                                                        |
| `crcLinePath`    | **Trusted.** Every coordinate and `closePath` participates in identity and construction.                                                                                                                       | Empty/single-point Canvas semantics are preserved.                                                    |
| `crcSvgPath`     | **Trusted.** Exact data identity and platform parse/error delegation.                                                                                                                                          | No CRC-side validation or normalization.                                                              |

See the [runtime/hook contract](./design/runtime-hooks-contract.md), [mouse interaction contract](./design/mouse-interaction-contract.md), and ownership documents for exact rules.

### Types, packages, scenarios, and builds

| Area                   | Current confidence                                                                                                                                                                                                                                  | Remaining boundary                                                                                                               |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Public TypeScript API  | **Trusted.** TypeScript 7 declarations compile under strict Bundler and NodeNext consumers. Positive inference and intentional errors cover runtime, hooks, components, events, and controller types. Private `@crc/core/lib/*` paths are rejected. | `@crc/types` remains a deliberately empty compatibility package until shared public types justify it.                            |
| Package build          | **Trusted.** esbuild ESM/source maps plus TypeScript declarations load in Node and the browser. Source/built smoke visuals match and built gallery guards reject source leakage.                                                                    | Output is ESM-only; new formats need an explicit requirement.                                                                    |
| Scenario catalog       | **Trusted through TFC-09.** Lazy identity-checked loaders, source markers, unique slugs/actions/learning orders, visibility/maturity, manual instructions, and source/built gallery adapters are validated.                                         | TFC-10 installs the final indexed manifest/trust gate and documentation handoff.                                                 |
| Local gallery          | **Trusted through TFC-09.** Thirteen cataloged scenarios share exact definitions with headless tests; five drawing lessons are readable documentation candidates.                                                                                   | This is an internal gallery, not yet a published documentation site.                                                             |
| Continuous integration | **Partial pending TFC-10.** Current PR jobs enforce browser tests, lint, and typecheck under Node 24/pnpm 11.                                                                                                                                       | TFC-10 adds package/source-built gallery/consumer/lifecycle/performance/catalog trust jobs and one documented aggregate command. |

## Current verification snapshot

Commands were run from the repository root on 2026-08-11 with Node 24.19.0 and pnpm 11.21.0 after TFC-09 implementation.

| Check                    | Result   | Evidence                                                                                                             |
| ------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------- |
| Complete browser suite   | **Pass** | 33 files; 250 passed and 2 opt-in timing skips.                                                                      |
| Supported-behavior skips | **Pass** | Zero. Historical nested clip, multiple layer, layer prop, and layer dimension skips are enabled/replaced.            |
| Typecheck                | **Pass** | TypeScript 7 `tsc --noEmit`.                                                                                         |
| Lint/format              | **Pass** | ESLint 10 plus direct Prettier checks.                                                                               |
| Package build            | **Pass** | ESM, declarations, and source maps for `@crc/core` and `@crc/types`.                                                 |
| Source gallery build     | **Pass** | Vite production build with all catalog/source adapters.                                                              |
| Built gallery build      | **Pass** | Vite built mode resolves package outputs without source leakage.                                                     |
| Public package consumer  | **Pass** | Strict Bundler, NodeNext, runtime export, controller, and private-subpath checks.                                    |
| Drawing visuals          | **Pass** | Five reviewed native 480×240 baselines; deliberate 20,694-pixel/max-delta-234 drill failed and normal run recovered. |

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

### Open the scenario gallery

```sh
pnpm playground
```

Open <http://localhost:5173/>. To exercise package output instead of source aliases, use `pnpm playground:built`.

### Verification commands

```sh
pnpm test:ci
pnpm typecheck
pnpm lint
pnpm build
pnpm playground:build
pnpm playground:build:built
pnpm test:package-consumer
```

TFC-10 consolidates these into the documented clean-checkout trust gate and CI jobs.

## Accepted or deferred work

- Pointer/touch, keyboard/focus, accessibility, drag/wheel, JSX, new primitives, layout, publication, and a polished docs renderer were outside this confidence phase.
- TFC-06 measurements do not justify a spatial index: the optimized linear resolver remains under its recorded triggers.
- Wall-clock performance runs remain environment-controlled and opt-in; deterministic workload/counter assertions run on every normal suite.
- `origin/jess/tests-for-utils` and richer JSX/playground branches were reviewed selectively; useful current-contract evidence was recreated without merging stale toolchain or unrelated feature work.
- TFC-10 owns the final CI handoff, risk closure, docs-readiness index, and future documentation brief.
