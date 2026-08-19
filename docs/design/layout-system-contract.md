# CRC layout-system contract

Status: implemented by Project Plan 003 on 2026-08-18.

CRC provides dedicated `absolute`, `overlay`, `flow`, `flex`, and `grid`
components. They arrange direct child descriptors into declared boxes, then
render those children through the normal immediate-mode traversal. Layout does
not build a retained display list and never speculatively renders a child to
discover its size.

Every layout component is itself a normal component: it can be nested inside
another layout, transformed by `g`, clipped, or rendered through a `layer`.
Source order remains paint order and reverse source order remains mouse target
order.

## Shared box, placement, and overflow rules

Layout container `width` and `height` are content-box lengths. When omitted,
they consume the current finite allocation. Padding defaults to zero and
`overflow` defaults to `"visible"`. `overflow: "clip"` clips paint and mouse
geometry to the content box; it does not create scrolling.

A child's parent-relative placement lives in its own style:

- `left` and `top` are parent placement offsets and default to zero where used;
- `alignSelf` and `justifySelf` override a container alignment where supported;
- `flexBasis`, `flexGrow`, and `flexShrink` are consumed only by Flex;
- Grid consumes one-based starts and positive spans.

The runtime places one private wrapper per direct child. The wrapper translates
the child's allocation but preserves the original component type, key, and
identity hint. Keyed children survive reflow; unkeyed same-type children retain
occurrence-order identity, and keyed siblings do not consume unkeyed occurrence
slots. A placed child's `crcLayoutBox` is the stable, readonly local box
`{ x: 0, y: 0, width, height }`; reading it never schedules an update.

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

`absolute` anchors every direct child independently. Container size defaults to
the current allocation; padding is zero and overflow is visible.

| Item input        | Behavior                                                                    |
| ----------------- | --------------------------------------------------------------------------- |
| `left`, `top`     | finite number or percentage; default zero                                   |
| `width`, `height` | required definite number or percentage in the current public implementation |
| source order      | paint order; later overlap is topmost for mouse targeting                   |

Local primitive `x` and `y` remain independent of `left` and `top`. Absolute
does not implement normal flow, margins, right/bottom anchoring, or automatic
placement.

## Overlay

`overlay` puts direct children into the same content allocation. Container
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
It does not implement z-index: source order is the single paint and target order.

## Flow

`flow` is CRC-native sequential layout rather than CSS inline formatting.

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

`flex` implements a deliberately bounded CSS-compatible subset.

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

`grid` implements explicit tracks and explicit placement only. Both
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

`measureElement` and the optional `defineComp` `measure` capability answer a
layout sizing question without render work. Measurement:

- receives normalized style, program props, finite/indefinite constraints, and
  a Canvas text-measurement service;
- returns intrinsic content size, not a border box including the component's
  own padding;
- may recursively measure children through the supplied service;
- cannot call hooks, observe a layout box, paint, register interaction regions,
  create image generations, or acquire runtime resources;
- detects direct and indirect cycles and restores all temporary runtime state
  after success or failure.

Definite dimensions bypass measurement. Built-in text measurement shares the
same wrapping/layout calculation used to paint. Image measurement supports only
explicit dimensions; natural image measurement is intentionally unavailable
because it would acquire asynchronous resources. Custom components used in an
automatic sizing path must provide a pure `measure` capability or receive an
actionable unsupported diagnostic naming the axis and child.

## Composition, failure, and ownership

The geometry equation is ancestor Canvas transform × layout placement × child
transform × local geometry. Paint paths, clipping, layers, and mouse regions use
that same composition, including fractional and negative local offsets.

Layout inspection normalizes only direct child style and never invokes render,
hooks, or ownership. Child style is normalized once; measured used sizes are
passed to the eventual render without renormalizing the original specified
style. A thrown render or duplicate-key failure releases regions, handlers,
cursors, image generations, offscreen layers, and component refs exactly once.
Repeated reflow does not accumulate owners.

Offscreen layers share the root interaction ledger, so nested layout still
participates in one global source paint/target order. Clip and layout overflow
constraints apply identically to pixels and mouse geometry.

## Deliberate exclusions

CRC layout does not promise a complete CSS formatting engine. Deferred features
include margin, scrolling, auto-placement Grid, implicit tracks, advanced CSS
intrinsic sizing, reverse/reordered Flexbox, baseline alignment, percentage
gaps, auto margins, DOM overlays/accessibility, a retained scene graph, workers,
WebGL, and a public virtualization API. Applications can window large datasets
and pass the visible descriptors to CRC; the library does not own the records or
scroll model.

See the [style contract](./style-system-contract.md),
[mouse contract](./mouse-interaction-contract.md), and
[runtime resource ownership contract](./runtime-resource-ownership.md).
