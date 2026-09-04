# CRC layout-system contract

Status: current implemented contract, updated for JSX-era authoring on
2026-09-03.

`Absolute`, `Overlay`, `Flow`, `Flex`, and `Grid` arrange direct branded
`CRCElement` children into declared boxes, then return placed descriptors to
the ordinary synchronous traversal. Layout does not build a retained display
list and never renders a child to discover size.

Each layout value accepts recursive `CRCNode` children. Arrays, finite
synchronous iterables, and unkeyed fragments flatten once at the receiving
render or measurement boundary. Keyed fragments remain direct identity items.
Unsupported nodes and duplicate keys receive contextual errors.

A layout component is itself a normal platform component. It can be nested,
transformed by `Group`, clipped by `Clip`, or rendered in `Layer`. Source order
remains paint order and reverse source order remains coordinate target order.

## Shared box, placement, and overflow

Container `width`/`height` are content-box lengths. When omitted, they consume
the current finite allocation. Padding defaults zero; `overflow` defaults
`"visible"`. `overflow: "clip"` clips both paint and target geometry to the
content box and does not add scrolling.

A direct child's parent-facing allocation values live in its own specified
style:

- `left`/`top` are parent offsets;
- `alignSelf`/`justifySelf` override supported container alignment;
- `flexBasis`/`flexGrow`/`flexShrink` belong to Flex;
- Grid consumes one-based starts and positive spans.

CRC normalizes direct-child style without invoking the child. A private placed
clone retains the original brand, type, props, key, source metadata, policy
metadata, and identity hint. The wrapper translates allocation, applies
overflow clipping, publishes the stable child-local
`{ x: 0, y: 0, width, height }`, and traverses the original child. Plain
component props retain their exact specified style; `crcLayoutBox()` exposes
the used allocation.

Percentages resolve once against the containing content allocation. Fixed root
viewports use logical dimensions independent of density; responsive roots use
the current CSS content box. All geometry sent to Canvas is finite. Visible
overflow can paint outside an allocation and never retroactively changes it.

## Absolute

`Absolute` independently anchors every direct child. Container dimensions
default to the current allocation.

| Item              | Contract                                     |
| ----------------- | -------------------------------------------- |
| `left`, `top`     | Finite number or percentage; default zero    |
| `width`, `height` | Required definite number or percentage       |
| order             | Source paint order; later overlap is topmost |

Drawing-local `x`/`y` remain separate. Right/bottom anchors, automatic size,
margin, and normal-flow participation are not implemented.

## Overlay

`Overlay` gives every child the same content allocation. Container
`alignItems`/`justifyItems` accept `start`, `center`, `end`, or `stretch` and
default to stretch. Child self values may use `auto` to defer.

Start uses the leading edge, center/end can give oversized items negative
offsets, and stretch fills the axis with a result clamped at zero. Children
currently need definite dimensions. There is no z-index; source order is the
only paint/target order.

## Flow

`Flow` is CRC-native sequential layout, not CSS inline formatting.

| Field             | Values/default                                |
| ----------------- | --------------------------------------------- |
| `direction`       | `horizontal` (default) or `vertical`          |
| `wrap`            | boolean, default false                        |
| `gap`, `lineGap`  | finite nonnegative number, default zero       |
| `alignItems`      | `start` (default), `center`, `end`, `stretch` |
| child `alignSelf` | `auto`, `start`, `center`, `end`, `stretch`   |

Items process in source order. A finite main bound wraps before an item only
when the line is nonempty and the next used size plus gap exceeds the bound.
Children need definite dimensions or supported pure measurement. There is no
baseline, justification, reverse direction, or margin collapsing.

## Flex

`Flex` implements a bounded CSS-compatible subset:

- `flexDirection`: `row` or `column`;
- `flexWrap`: `nowrap` or `wrap`;
- `justifyContent`: start/end/center and the three `space-*` values;
- `alignItems`: stretch/start/end/center;
- `alignContent`: the supported cross-axis equivalents;
- finite numeric `gap`, `rowGap`, and `columnGap`;
- item `flexBasis`, `flexGrow`, `flexShrink`, and `alignSelf`.

Automatic/measured basis and shrink require an explicit main-axis minimum;
CRC does not invent the browser's automatic minimum. The algorithm collects
lines in source order and iteratively freezes/redistributes against min/max.
Reverse directions, wrap-reverse, order, baseline, auto margins, percentage
gaps, and advanced intrinsic cases reject. Intrinsic Flex measurement supports
only exact simple nowrap cases without allocation-dependent ambiguity.

## Grid

`Grid` requires nonempty explicit column and row tracks. Tracks accept finite
nonnegative numbers, exact percentages, and nonnegative decimal `fr` values.
Gaps are finite numeric values. Children require positive one-based row/column
starts and optional positive spans. Container/item alignment accepts
start/center/end/stretch. Overlap is allowed and source order wins.

Fixed tracks, percentages, and gaps are subtracted before fractional
distribution. Fraction size is `max(0, remaining) / max(1, totalFr)`, so a
fraction total below one can leave space. Placement outside the explicit matrix
is an error. There is no auto placement, implicit/content track, dense packing,
`repeat`, `minmax`, named area, subgrid, end-line syntax, or order.

## Pure measurement

`measureElement(element, constraints, service)` and a `definePrimitive`
`measure` capability answer sizing questions without render work. Measurement
receives program props, normalized style, constraints, a Canvas text service,
and a recursive measurement function. It returns intrinsic content size, not
the component's padded border box.

It cannot call hooks/context accessors, paint, register targets, load images,
or acquire resources. Direct/indirect cycles are diagnosed and temporary state
is restored. Definite dimensions bypass measurement. `Text` shares its
measurement/paint resolver; `Image` supports measurement only with explicit
dimensions. Plain functions and primitives without `measure` report
unsupported rather than rendering speculatively.

## Composition, failure, and ownership

Geometry composes as ancestor transform × layout placement × child transform ×
local geometry. Paint, clip, layer, and target paths use the same composition.
Repeated reflow does not accumulate owners. A thrown render or duplicate-key
failure releases resources exactly once under the fail-closed runtime contract.
Offscreen layers share the root interaction ledger and preserve global order.

## Deliberate exclusions and evidence

CRC does not promise a complete CSS formatting engine. Margin, scrolling,
auto-placement Grid, implicit tracks, advanced intrinsic sizing,
reverse/reordered Flexbox, baseline, percentage gaps, auto margins, DOM
accessibility overlays, retained scenes, workers, WebGL, and a public
virtualization API remain excluded.

Public JSX layout evidence lives in
`packages/core/src/lib/layout/layout-jsx.test.tsx`, the five Studio layout
lessons, DOM-oracle compatibility suites, and deterministic layout laboratory.
Completed Plan 003 documents retain the API at their dated revision as
historical evidence. See the [style](./style-system-contract.md) and
[runtime](./runtime-hooks-contract.md) contracts.
