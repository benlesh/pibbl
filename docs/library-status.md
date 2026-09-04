# CRC library status and feature inventory

_Current feature inventory refreshed 2026-09-03 after the JSX component
authoring pivot. Historical totals remain evidence only for their named dated
revision; run the trust gate for current results._

## At a glance

CRC is a scheduled immediate-mode Canvas 2D component runtime. Its preferred
surface is automatic JSX over opaque branded elements; `createElement` is the
complete non-JSX equivalent. Ordinary components are synchronous functions.
Descriptive drawing, composition, layout, and focus policy values are the only
current component vocabulary. CRC has no React dependency and creates no DOM.

Current evidence covers source/built/packed package boundaries, Bundler and
NodeNext declarations, both compiler entries, mixed CRC/React type boundaries,
42 learning lessons, 16 deterministic laboratories, semantic and geometry
assertions, browser behavior, lifecycle ownership, Studio builds, and guarded
visual baselines. Controlled wall-clock budgets remain opt-in; deterministic
workload structure is always checked.

“Trusted” below means the supported behavior, boundaries, errors, updates, and
teardown have executable evidence. It does not mean CRC supplies semantic DOM,
an accessibility tree, hidden editing controls, rich text, scrolling, or
complete CSS.

## Public feature inventory

### Authoring, runtime, and identity

| Feature                      | Supported contract                                                                                                                                                                             | Boundary                                                                           |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Automatic JSX                | **Trusted.** Root and compiler subpaths provide branded elements, module-scoped JSX types, source metadata, required props/style/children checks, and no lowercase intrinsics.                 | One file has one JSX runtime; the classic transform is not documented.             |
| `createElement`              | **Trusted.** Same descriptors and runtime behavior as JSX; null props, variadic-child precedence, keys, arrays, text, policies, and mounting are covered.                                      | Direct component calls do not create elements.                                     |
| Plain functions              | **Trusted.** One props argument, synchronous node/void return, function identity, hook lifecycle, arbitrary recursive return nodes, and error recovery are covered.                            | Async/Promise components reject.                                                   |
| `CRCElement` / `CRCNode`     | **Trusted.** Opaque global-symbol brand, nominal typing, key normalization/removal, development freezing/source, recursive arrays/finite iterables/empty roots, and foreign-element rejection. | Iterables must be finite. Raw non-empty text/nonzero numbers belong inside `Text`. |
| Fragments, lists, keys       | **Trusted.** Transparent arrays/unkeyed fragments, keyed-fragment scope, duplicate diagnostics, keyed reorder, and unkeyed occurrence identity are direct contracts.                           | Keys preserve identity only under the same parent.                                 |
| `crc(canvas, root, config?)` | **Trusted.** One live mount, coalesced latest-root updates, fixed/responsive surfaces, stable controller, abort, idempotent disposal, and stale-controller safety.                             | Mount configuration belongs to the first live mount.                               |
| Hooks and failure            | **Trusted.** Slot order, state/memo/ref/change cleanup, path/event/cursor hooks, Canvas/layout accessors, fail-closed cleanup, and valid retry are covered.                                    | Earlier pixels in a failing frame are not rolled back.                             |

### Drawing and composition

| Values                                   | Supported contract                                                                                                                                                                               | Boundary                                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `Rectangle`, `Path`, `SvgPath`           | **Trusted.** Closed explicit style, Canvas geometry/paint, opacity, pixel alignment where supported, interactions, transforms, clips, layers, and platform path parsing.                         | `Path2D` parsing and signed/degenerate Canvas behavior are browser-owned.                  |
| `Line`, `HorizontalLine`, `VerticalLine` | **Trusted.** Polyline and helper defaults, updates, pixel modes, empty/one-point behavior, transforms/clips, and stroke hit geometry.                                                            | A single move does not paint a point.                                                      |
| `Text`                                   | **Trusted.** Recursive textual children including zero, one-shot iterable materialization, exact concatenation, wrapping/fit/clipping, shared measurement/paint, multiline targets, and updates. | Font metrics/rasterization are platform-dependent; elements are invalid textual content.   |
| `Image`                                  | **Trusted.** Source generations, success/error/race/removal, inert late callbacks, natural/explicit dimensions, opacity, border, and pixel alignment.                                            | Decode/CORS/taint are browser behavior; natural size is not pure measurement.              |
| `Group`                                  | **Trusted.** Nested translation, scale, rotation/origin, skew, zero/negative scale, sibling isolation, and matching target transforms.                                                           | Canvas transformation is not layout.                                                       |
| `Clip`                                   | **Trusted.** Multi-child `nonzero`/`evenodd` clips, cumulative intersections, updates, and identical paint/hit geometry.                                                                         | No retained clip object is public.                                                         |
| `Layer`                                  | **Trusted.** Multi-child persistent offscreen instance, one-shot direct iterable input, cache invalidation/hits, density, global paint/target/focus order, and cascading cleanup.                | Requires browser `OffscreenCanvas`; retained equality is intentionally shallow/structural. |

### Style, layout, and extension

| Feature                           | Supported contract                                                                                                                                                    | Boundary                                                                                 |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Explicit local style              | **Trusted.** Closed per-component schemas, specified/normalized/resolved stages, finite diagnostics, no legacy aliases, and no content/structural leakage into style. | No cascade, inheritance, selectors, margin, or complete CSS parser.                      |
| `Absolute`                        | **Trusted.** Definite child size, number/percentage offsets, padding, clipping, nesting, source order, and identity across reflow.                                    | No right/bottom anchors or automatic placement.                                          |
| `Overlay`                         | **Trusted.** Shared allocation, container/self alignment, stretch/oversize behavior, clipping, and overlap order.                                                     | Definite child size; no z-index.                                                         |
| `Flow`                            | **Trusted.** Horizontal/vertical sequential layout, optional wrapping, gaps, alignment, pure measurement, and used-size rendering.                                    | CRC-native; no inline shaping, reverse, justification, or baseline.                      |
| `Flex`                            | **Trusted.** Supported row/column, nowrap/wrap, grow/shrink/minimums, gaps, distribution/alignment, and DOM-oracle parity.                                            | Reverse/order/baseline/auto margins/percentage gaps and advanced intrinsic cases reject. |
| `Grid`                            | **Trusted.** Explicit fixed/percentage/fractional tracks, one-based starts/spans, gaps, alignment, overlap, clipping, and DOM-oracle parity.                          | No implicit/auto placement, content tracks, repeat/minmax, areas, or subgrid.            |
| `measureElement` / `crcLayoutBox` | **Trusted.** Pure isolated measurement, cycles, text/custom measurement, explicit image size, stable finite local allocations, and no ownership.                      | Plain components and ambiguous intrinsic layout report unsupported.                      |
| `crcCanvasContext`                | **Trusted.** Current isolated context during render, no hook slot, save/restore and failure behavior.                                                                 | Unavailable outside rendering and during pure measurement.                               |
| `definePrimitive`                 | **Trusted.** Reserved program props, required/optional specified style, normalize/resolve/measure capabilities, finite allocation enforcement, and private metadata.  | Platform extension only; ordinary components should use plain functions.                 |

### Events, focus, and accessibility boundary

| Feature                               | Supported contract                                                                                                                                                                                                         | Boundary                                                                                             |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Built-in event props                  | **Trusted.** DOM-aligned pointer, mouse, touch, wheel, keyboard/focus, editing/composition, clipboard, and drag/drop facades with propagation, cancellation, related targets, and pointer capture.                         | Native non-coordinate input needs a current logical target.                                          |
| `crcEventTarget` / `crcEventListener` | **Trusted.** Explicit geometry, transforms/clips, stable target identity, propagation listeners, focus metadata, mutation isolation, and exact teardown.                                                                   | Geometry is never inferred from returned descendants.                                                |
| `crcEvent` / `crcCursor`              | **Trusted.** Geometric legacy hook behavior, pathless Canvas observers/default cursors, target precedence, replacement, and exact ownership.                                                                               | Pathless observer payload remains the narrow shipped mouse shape.                                    |
| `FocusManagement`                     | **Trusted.** Transparent exactly-one-child policy, one Canvas host, candidate enrollment, logical focus events/snapshots, source-order Tab, press focus, activation, focus-visible state, layer invalidation, and cleanup. | Keyboard interaction does not create semantics or an accessibility tree.                             |
| `KeyboardNavigation`                  | **Trusted.** Transparent directional boundaries, finite geometry ranking, nested containment, prevented keys, and source-order Tab independence.                                                                           | Directional mode does not wrap or escape an inner boundary edge.                                     |
| Accessibility                         | **Explicit application boundary.** Guidance requires an equivalent semantic DOM experience synchronized with the Canvas model.                                                                                             | CRC generates no semantic descendants, roles, names, editing controls, or assistive-technology tree. |

### Packages, Studio, and verification

| Area                | Current confidence                                                                                                                                                                 | Boundary                                                               |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Public declarations | **Trusted.** Exact source/built/Studio export-name parity, 112 root type imports, compiler namespaces, strict positive/negative TSX, and mixed-runtime barriers.                   | `@crc/types` remains a deliberately minimal compatibility package.     |
| Package output      | **Trusted.** ESM runtime/declarations/maps, shared compiler chunks, packed no-source consumers, blocked private imports, and focus tree shaking.                                   | ESM-only; another format needs an explicit requirement.                |
| Studio              | **Trusted.** TSX automatic runtime, source/built execution, exact declaration bundle, 42 lessons and 16 labs, editing diagnostics, and catalog/source identity.                    | Internal Studio, not a hosted documentation product.                   |
| Documentation       | **Checked.** Required guide set, links, API export inventory, example extensions, current-vocabulary scan, configuration markers, and compile-backed examples run in `docs:check`. | Prose cannot replace browser/runtime evidence.                         |
| CI                  | **Configured.** Static/docs, packed package, browser/visual, lifecycle, and structural performance jobs feed one aggregate trust result.                                           | Hosted status and branch protection require repository administration. |

## Documentation acceptance matrix

Every documentation obligation in the approved JSX authoring design maps to a
current guide/contract and executable repository evidence. `docs:check`
validates the guide paths, links, example extensions, API inventory, and
configuration/vocabulary markers; typecheck and scenario/browser gates execute
the referenced code.

| Approved documentation item                                              | Current guide or contract                                                                                                                                | Executable example/evidence                                                                                             |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Complete interactive JSX quick start, mount, scheduled updates, disposal | [JSX quick start](./guides/jsx-quick-start.md), [runtime contract](./design/runtime-hooks-contract.md)                                                   | [`getting-started.example.tsx`](../packages/scenarios/src/learning/start/getting-started.example.tsx)                   |
| TypeScript automatic runtime and package exports                         | [Configuring JSX](./guides/configuring-jsx.md), [API reference](./api-reference.md)                                                                      | [`playground/package-consumer/jsx.tsx`](../playground/package-consumer/jsx.tsx)                                         |
| No React dependency and compiler-only runtime entries                    | [Configuring JSX](./guides/configuring-jsx.md), [React and CRC](./guides/react-interop.md)                                                               | [`verify-packed-consumer.mjs`](../tooling/verify-packed-consumer.mjs)                                                   |
| Vite/esbuild setup                                                       | [Configuring JSX](./guides/configuring-jsx.md)                                                                                                           | [`tooling/docs-fixtures/automatic-runtime.crc.jsx`](../tooling/docs-fixtures/automatic-runtime.crc.jsx)                 |
| Babel automatic runtime and JavaScript setup                             | [Configuring JSX](./guides/configuring-jsx.md)                                                                                                           | [`tooling/docs-fixtures/automatic-runtime.crc.jsx`](../tooling/docs-fixtures/automatic-runtime.crc.jsx)                 |
| Components, props, events, and explicit local style                      | [Components, props, and style](./guides/components-props-and-style.md), [style contract](./design/style-system-contract.md)                              | [`getting-started.example.tsx`](../packages/scenarios/src/learning/start/getting-started.example.tsx)                   |
| Arbitrary interpolation, finite iterables, invalid children              | [Children, text, lists, and keys](./guides/children-text-lists-and-keys.md), [runtime contract](./design/runtime-hooks-contract.md)                      | [`children.test.ts`](../packages/core/src/lib/element/children.test.ts)                                                 |
| Fragments, lists, conditionals, and keys                                 | [Children, text, lists, and keys](./guides/children-text-lists-and-keys.md)                                                                              | [`fragment.test.tsx`](../packages/core/src/lib/element/fragment.test.tsx)                                               |
| Text children, zero, whitespace, wrapping, fit, interpolation            | [Children, text, lists, and keys](./guides/children-text-lists-and-keys.md), [drawing contract](./design/drawing-components-contract.md)                 | [`text.example.tsx`](../packages/scenarios/src/learning/drawing/text.example.tsx)                                       |
| Layout and specified style versus local allocation                       | [Layout, groups, clips, and layers](./guides/layout-groups-clips-and-layers.md), [layout contract](./design/layout-system-contract.md)                   | [`flex.example.tsx`](../packages/scenarios/src/learning/layout/flex.example.tsx)                                        |
| `Group`, `Clip`, multi-child `Layer`                                     | [Layout, groups, clips, and layers](./guides/layout-groups-clips-and-layers.md), [drawing contract](./design/drawing-components-contract.md)             | [`layer.example.tsx`](../packages/scenarios/src/learning/composition/layer.example.tsx)                                 |
| State, immediate lifecycle, React differences, failure, disposal         | [State, lifecycle, and React differences](./guides/state-lifecycle-and-react-differences.md), [runtime contract](./design/runtime-hooks-contract.md)     | [`runtime-hooks.example.tsx`](../packages/scenarios/src/runtime-hooks.example.tsx)                                      |
| Ordinary composite and `crcCanvasContext` painter                        | [Custom components and primitives](./guides/custom-components-and-primitives.md)                                                                         | [`crc-canvas-context.test.tsx`](../packages/core/src/lib/hooks/crc-canvas-context.test.tsx)                             |
| Full `definePrimitive` normalize/resolve/measure extension               | [Custom components and primitives](./guides/custom-components-and-primitives.md), [style contract](./design/style-system-contract.md)                    | [`define-primitive.test.tsx`](../packages/core/src/lib/define-primitive.test.tsx)                                       |
| Complete non-JSX API                                                     | [Authoring without JSX](./guides/without-jsx.md)                                                                                                         | [`create-element-authoring.example.tsx`](../packages/scenarios/src/learning/start/create-element-authoring.example.tsx) |
| One runtime per file and mixed React/CRC project                         | [React and CRC](./guides/react-interop.md), [Configuring JSX](./guides/configuring-jsx.md)                                                               | [`mixed-runtime/react-host.tsx`](../playground/package-consumer/mixed-runtime/react-host.tsx)                           |
| Wrong-runtime diagnostics and source metadata                            | [JSX troubleshooting](./guides/jsx-troubleshooting.md)                                                                                                   | [`foreign-runtime-diagnostics.test.tsx`](../packages/core/src/lib/element/foreign-runtime-diagnostics.test.tsx)         |
| Focus and directional keyboard policies                                  | [Focus, keyboard, and accessibility](./guides/focus-keyboard-and-accessibility.md), [focus contract](./design/focus-and-keyboard-navigation-contract.md) | [`focus-management.example.tsx`](../packages/scenarios/src/learning/keyboard-focus/focus-management.example.tsx)        |
| Accessibility limitations and application responsibility                 | [Canvas accessibility guidance](./design/canvas-accessibility-guidance.md), [focus guide](./guides/focus-keyboard-and-accessibility.md)                  | [`focus-navigation.example.tsx`](../packages/scenarios/src/focus-navigation.example.tsx)                                |
| Complete public values/types and compiler entries                        | [API reference](./api-reference.md)                                                                                                                      | [`final-public-vocabulary.tsx`](../packages/core/type-tests/final-public-vocabulary.tsx)                                |
| One-time breaking migration with no aliases                              | [JSX authoring pivot](./migrations/jsx-authoring-pivot.md)                                                                                               | [`public-api.test.ts`](../packages/core/src/lib/focus/public-api.test.ts)                                               |

## Running locally

Use Node 24.15.0 or newer on the Node 24 LTS line and pnpm 11.21.0:

```sh
corepack pnpm@11.21.0 install --frozen-lockfile --strict-peer-dependencies
corepack pnpm@11.21.0 exec playwright install chromium
corepack pnpm@11.21.0 playground
corepack pnpm@11.21.0 trust
```

See the [trust-gate guide](./testing/trust-gate.md) for command/evidence
semantics.

## Historical evidence and current deferrals

Completed numbered plans, approved dated designs, architecture records, and
field notes preserve their original terminology, totals, and environment. They
are not current API guidance. In particular, the Plan 003 closure snapshot and
earlier 265/294-test statements are revision-specific and must not be reported
as current without a fresh reproducing run.

Current deferrals include semantic DOM/accessibility generation, hidden
editing controls, rich text, margin/scrolling, Grid auto placement, advanced
intrinsic CSS sizing, reverse/reordered Flexbox, a retained scene graph,
workers/WebGL, public scrolling/virtualization, and library-owned image CORS
policy. The [accepted/deferred follow-ups](./follow-ups.md) record measured
triggers and remaining external administration.
