# CRC layout-system contract

Status: current implemented contract, updated for settled WebGL scenes on
2026-09-13.

CRC provides dedicated `Absolute`, `Overlay`, `Flow`, `Flex`, and `Grid`
components. They arrange direct branded `CRCElement` children into declared
boxes, then traverse those children through the normal immediate-mode renderer.
Layout does not build a retained display list and never speculatively renders a
child to discover its size.

Each layout component accepts recursive `CRCNode` children. Arrays, finite
synchronous iterables, and unkeyed fragments flatten at the receiving layout
boundary; keyed fragments remain direct identity items. Iterables are required
to be finite; infinite iterables are unsupported and CRC does not promise to
detect them. Unsupported child values and duplicate sibling keys fail with
contextual errors.

Every layout component is itself a normal component: it can be nested inside
another layout, transformed by `Group`, clipped by `Clip`, or rendered through
a `Layer`. `WebGLLayer` is a layout-participating Canvas composition primitive;
its WebGL descendants do not become layout items in the parent Canvas
algorithm. Source order remains Canvas composition order and reverse Canvas
order remains coordinate-event target order. Within one WebGL scene, child
source order establishes identity and tie-break indices while settled opaque
and transparent queues determine raster order.

## Shared box, placement, and overflow rules

Layout container `width` and `height` are content-box lengths. When omitted,
they consume the current finite allocation. Padding defaults to zero and
`overflow` defaults to `"visible"`. `overflow: "clip"` clips paint and target
geometry to the content box; it does not create scrolling.

A child's parent-relative placement lives in its own specified style:

- `left` and `top` are parent placement offsets and default to zero where used;
- `alignSelf` and `justifySelf` override a container alignment where supported;
- `flexBasis`, `flexGrow`, and `flexShrink` are consumed only by Flex;
- Grid consumes one-based starts and positive spans.

`WebGLLayerStyle` accepts the shared box and layout-item fields. Each omitted
layer dimension uses its current finite logical allocation; an explicit or
allocated width and height must resolve to positive finite values. A
`WebGLLayer` has no intrinsic measurement capability, so an automatic sizing
path must supply a definite size rather than rendering WebGL children to
discover one.

The runtime places one private wrapper per direct child. The wrapper preserves
the original brand, component type, props, key, compiler source metadata,
policy metadata, and identity hint while translating the child's allocation.
Keyed children survive reflow; unkeyed same-type children retain
occurrence-order identity, and keyed siblings do not consume unkeyed occurrence
slots. A placed child's `useLayoutBox()` is the stable, readonly local box
`{ x: 0, y: 0, width, height }`; reading it never schedules an update. Plain
component props retain their exact specified style; the finite used allocation
is exposed separately through `useLayoutBox()`.

Layout container and item style fields accept signal-valued replacements.
Mounted parent inspection may resolve a child's style before the receiving
child evaluates. CRC records those source nodes in a transaction-local
provision keyed by the child's stable primitive receiver token. The successful
child generation adopts and deduplicates that provision; failure, abort,
removal, disposal, or an unclaimed provision releases it without changing the
last successful dependency generation.

Pure `measureElement()` performs the same declared shallow resolution inside
`untracked()`. It creates no renderer consumer, receiver provision, persistent
edge, wrapper signal, or runtime resource. Plain layout props and style fields
create no provision or shallow copy.

Percentages resolve once against the containing content allocation, not again
against the child's final local allocation. The mounted logical viewport from
the [Canvas surface contract](./canvas-surface-contract.md) is the root
containing allocation. Fixed viewports are independent of backing density;
responsive viewports use the current CSS content-box dimensions. All resolved
coordinates and dimensions delivered to Canvas are finite.

Declared boxes control allocation and interaction geometry; drawing may still
paint outside its declared box when overflow is visible. A container does not
silently clip paint merely because a child overflows or uses negative local
geometry.

## Absolute

`Absolute` anchors every direct child independently. Container size defaults to
the current allocation; padding is zero and overflow is visible.

| Item input        | Behavior                                                                    |
| ----------------- | --------------------------------------------------------------------------- |
| `left`, `top`     | finite number or percentage; default zero                                   |
| `width`, `height` | required definite number or percentage in the current public implementation |
| source order      | paint order; later overlap is topmost for coordinate targeting              |

Local primitive `x` and `y` remain independent of `left` and `top`. Absolute
does not implement normal flow, margins, right/bottom anchoring, or automatic
placement.

## Overlay

`Overlay` puts direct children into the same content allocation. Container
`alignItems` and `justifyItems` accept `start`, `center`, `end`, or `stretch` and
default to `stretch`. Child `alignSelf`/`justifySelf` may use `auto` to defer to
the container or choose a supported alignment.

| Alignment | Used position/size                                           |
| --------- | ------------------------------------------------------------ |
| `start`   | leading edge; declared size                                  |
| `center`  | centered; oversized items may receive a negative offset      |
| `end`     | trailing edge; oversized items may receive a negative offset |
| `stretch` | fills the available axis; result clamps at zero              |

Overlay children currently require definite width and height before alignment.
It does not implement z-index: source order is the single paint and target
order.

## Flow

`Flow` is CRC-native sequential layout rather than CSS inline formatting.

| Container field  | Supported values and default                  |
| ---------------- | --------------------------------------------- |
| `direction`      | `horizontal` (default), `vertical`            |
| `wrap`           | boolean, default `false`                      |
| `gap`, `lineGap` | finite nonnegative numbers, default `0`       |
| `alignItems`     | `start` (default), `center`, `end`, `stretch` |
| item `alignSelf` | `auto`, `start`, `center`, `end`, `stretch`   |

Items are processed in source order. A finite main-axis bound wraps before an
item only when the current line is nonempty and adding the item plus gap would
exceed that bound. Each line's cross size is its maximum item cross size.
Children need definite dimensions or supported pure measurement. Stretch
clamps at zero. Flow has no CSS inline text shaping, justification, reverse
direction, margin collapsing, or baseline alignment.

## Flex

`Flex` implements a deliberately bounded CSS-compatible subset.

| Container field              | Supported values and default                                                                             |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| `flexDirection`              | `row` (default), `column`                                                                                |
| `flexWrap`                   | `nowrap` (default), `wrap`                                                                               |
| `justifyContent`             | `flex-start` (default), `flex-end`, `center`, `space-between`, `space-around`, `space-evenly`            |
| `alignItems`                 | `stretch` (default), `flex-start`, `flex-end`, `center`                                                  |
| `alignContent`               | `stretch` (default), `flex-start`, `flex-end`, `center`, `space-between`, `space-around`, `space-evenly` |
| `gap`, `rowGap`, `columnGap` | finite nonnegative numbers; axis values override `gap`; default `0`                                      |
| item fields                  | `flexBasis: auto`, `flexGrow: 0`, `flexShrink: 1`, `alignSelf: auto` by default                          |

Basis may be a definite number/percentage or pure measured `auto`. Whenever an
item can shrink or uses measured/automatic basis, it must declare `minWidth` in
a row or `minHeight` in a column. CRC does not invent the browser's automatic
minimum size. Lines collect in source order, hypothetical sizes choose grow or
shrink mode, and iterative freeze/redistribution enforces min/max constraints.
Negative remaining space keeps CSS-compatible alignment fallbacks for the
accepted subset.

Reverse directions, `wrap-reverse`, `order`, baseline alignment, auto margins,
percentage gaps, and advanced intrinsic sizing are rejected. Pure intrinsic
measurement of a Flex container is supported only for exact, simple nowrap
cases with allocation-independent tracks/items; wrap, percentage-dependent,
growth-dependent, and otherwise ambiguous cases report unsupported measurement
instead of approximating.

## Grid

`Grid` implements explicit tracks and explicit placement only. Both
`gridTemplateColumns` and `gridTemplateRows` must be nonempty.

| Feature   | Supported contract                                                                                                         |
| --------- | -------------------------------------------------------------------------------------------------------------------------- |
| tracks    | finite nonnegative numbers, exact unsigned decimal percentages, and nonnegative decimal `fr` values                        |
| gaps      | finite nonnegative numeric `gap`, `rowGap`, `columnGap`; no percentages                                                    |
| placement | positive one-based `gridColumnStart` and `gridRowStart`; optional positive spans default to one                            |
| alignment | container `alignItems`/`justifyItems` and child self overrides: `start`, `center`, `end`, `stretch`; defaults stretch/auto |
| overlap   | allowed; source order controls paint and topmost targeting                                                                 |

Fixed tracks, percentages, and gaps are subtracted first. Fractional unit size
is `max(0, remaining) / max(1, totalFr)`, so a total fraction below one leaves
unused free space. An area that extends beyond the explicit track matrix is an
error. Children use definite sizes, stretch, or a supported pure measurement.

Grid rejects missing starts, implicit tracks, auto placement, dense packing,
automatic/content tracks, `minmax`, `repeat`, subgrid, percentage gaps, named
areas, end-line syntax, and `order`. It never silently approximates these CSS
features.

## Pure measurement

`measureElement(element, constraints, service)` and the optional
`definePrimitive` `measure` capability answer a layout sizing question without
render work. Measurement:

- receives normalized style, program props, finite/indefinite constraints, and
  a Canvas text-measurement service;
- returns intrinsic content size, not a border box including the component's
  own padding;
- may recursively measure children through the supplied service;
- cannot call hooks, context accessors, observe a layout box, paint, register
  interaction targets, or acquire runtime resources;
- cannot create image generations;
- cannot traverse a WebGL island, request WebGL animation, compose or settle a
  WebGL scene, or acquire GPU/bitmap resources;
- detects direct and indirect cycles and restores all temporary runtime state
  after success or failure.

Definite dimensions bypass measurement. Built-in `Text` measurement shares the
same wrapping/layout calculation used to paint. `Image` measurement supports
only explicit dimensions; natural image measurement is intentionally
unavailable because it would acquire asynchronous resources. A custom
`definePrimitive` value used in an automatic sizing path must provide a pure
`measure` capability or receive an actionable unsupported diagnostic naming the
axis and child. Plain function components expose no intrinsic measurement
capability and therefore need a definite allocation on that path.

## Composition, failure, and ownership

The geometry equation is ancestor Canvas transform × layout placement × child
transform × local geometry. Paint paths, clipping, layers, and coordinate
regions use that same composition, including fractional and negative local
offsets.

Layout inspection normalizes only direct child style and never invokes render,
hooks, or ownership. Child style is normalized once; measured used sizes are
passed to the eventual render without renormalizing the original specified
style. A thrown render or duplicate-key failure releases targets, handlers,
cursors, image generations, offscreen layers, and component refs exactly once.
Repeated reflow does not accumulate owners.

Offscreen Canvas layers and WebGL islands share the root interaction ledger, so
nested layout still participates in one global Canvas composition/target order.
`Clip` and layout overflow constraints apply identically to pixels and
coordinate geometry. A complete WebGL island occupies one Canvas paint
position; layout cannot interleave an external Canvas child between objects in
that flattened settled scene.

## Deliberate exclusions

CRC layout does not promise a complete CSS formatting engine. Deferred features
include margin, scrolling, auto-placement Grid, implicit tracks, advanced CSS
intrinsic sizing, reverse/reordered Flexbox, baseline alignment, percentage
gaps, auto margins, DOM overlays/accessibility, a retained scene graph, workers,
multiple WebGL viewports/cameras, and a public virtualization API. Applications can window large datasets
and pass the visible descriptors to CRC; the library does not own the records or
scroll model.

Public JSX layout evidence lives in
`packages/core/src/lib/layout/layout-jsx.test.tsx`, the five Studio layout
lessons, DOM-oracle compatibility suites, and deterministic layout laboratory.
See the [style contract](./style-system-contract.md), [user-event
contract](./user-events-contract.md), and [runtime resource ownership
contract](./runtime-resource-ownership.md).

## 3D physics and layout

Layout treats a `WebGLLayer` as one ordinary allocated Canvas item and does not inspect its inner physics scene. Authored placement at body creation or re-enable seeds world-local pose, but layout is not a continuing constraint on an enabled dynamic body; physics presentation is applied inside the already allocated island and never changes Canvas measurement or allocation.

## Responsive style inspection

`style.when` selects local patches against the parent's established content box
before direct-child normalization, measurement eligibility checks, and allocation.
The prepared normalized style and query eligibility travel with that occurrence's
private clones; rendering does not rematch against the final allocated size.
Queries in an inner primitive returned by a placed plain component instead use
that component's incoming allocation. Outer placement props remain raw in plain
functions. Query-free styles retain the existing allocation path.

Nonempty queries on an item that needs mounted intrinsic measurement are
unsupported, including descendants inspected by a measure callback. Give the
item a definite allocation and adapt inside it. Standalone top-level measurement
can use finite maxima on every queried axis; indefinite unqueried axes are
allowed subject to existing measurement support. The eligibility preflight for
indefinite standalone constraints can scan rules before selection, without
repeating signal reads or adding mounted layout passes.

The [responsive styles guide](../site/learn/guides/responsive-styles.md) explains
the placement/content distinction and its observable refactoring consequence.

## Component manipulation

`ManipulationFrame` presents one writable finite box as a freely positioned
allocation. A nested `Flex`, `Flow`, or `Grid` consumes that allocation and
reflows on resize; the frame's handles are chrome rather than layout items.
The outer direct layout parent still owns its child's placement, so a frame with
authored `left` or `top` is invalid directly under `Flex`, `Flow`, or `Grid` in
development/test execution and has no production placement effect. See the
[component-manipulation contract](./component-manipulation-contract.md).
