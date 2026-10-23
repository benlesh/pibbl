---
id: api-types-layout
title: Layout types
summary: Declared-box, measurement, and explicit layout-component contracts.
kind: api
slug: layout
apiCategory: types
typeDomain: layout
symbols:
  [
    AbsoluteStyle,
    BoxStyle,
    CanvasMeasurementService,
    Constraints,
    Edges,
    EdgeValues,
    FlexItemStyle,
    FlexMargin,
    FlexProps,
    FlexStyle,
    FlowProps,
    FlowStyle,
    GridItemStyle,
    GridProps,
    GridStyle,
    GridTrack,
    LayoutBox,
    LayoutDiagnosticContext,
    LayoutDiagnosticInput,
    LayoutItemStyle,
    Length,
    IntrinsicAxisConstraints,
    IntrinsicConstraints,
    IntrinsicMeasureInput,
    IntrinsicSizesResult,
    MeasureInput,
    MeasureResult,
    OverlayStyle,
    Percentage,
    ResolvedBoxStyle,
    Size,
  ]
keywords: [layout, box, flex, grid, measurement]
---

# Layout types

Pibbl layout is opt-in and immediate-mode. Parents inspect normalized direct-child
styles, resolve finite allocations, and render one child descriptor at a time;
they do not retain drawing commands. Style is local and never cascades.

## AbsoluteStyle

`AbsoluteStyle` is the declared container style for `Absolute`, including its
finite box and the independent `left`/`top` placement vocabulary for children.

## BoxStyle

`BoxStyle` is the shared declared-box vocabulary: dimensions, min/max limits,
padding, layout borders, and the local inputs needed to resolve a finite box. Its optional
`boxSizing` policy defaults to `"content-box"`; `"border-box"` includes padding and layout borders
in dimensions, min/max and Flex basis. Percentages resolve before combined insets are
subtracted, and the outer border-box size floors at total axis padding plus borders. Painted
strokes remain independent. See [`resolveBox`](#/api/functions/resolve-box).

## CanvasMeasurementService

`CanvasMeasurementService` supplies the caller-owned Canvas measurement
operation used by pure `measureElement`; it cannot render or acquire runtime
resources.

## Constraints

`Constraints` defines finite minimum and maximum width/height limits for
layout resolution and pure measurement.

## Edges

`Edges` is the normalized finite top/right/bottom/left edge record.

## EdgeValues

`EdgeValues<T extends number | Percentage = number>` supplies one scalar or
independent physical edges; omitted sides resolve to zero. `padding` uses
`EdgeValues<number | Percentage>`. In experimental allocated Flex, every padding
percentage uses the containing content width, including top/bottom, before
border-box conversion. Raw root/other-parent and intrinsic percentage padding
remain unsupported. `borderWidth` and `normalizeEdges` keep numeric defaults.

## FlexItemStyle

Optional numeric `aspectRatio` is outer width divided by outer height for finite
Flex items, including wrapped lines. Final per-line main allocation derives cross size, overriding explicit
cross size and stretch; cross bounds may break the ratio. Supply a definite main
dimension or basis. Intrinsic main sizing, other layout families and
root ratio sizing remain outside this contract.

`FlexItemStyle` is the direct-child participation style consumed by a `Flex`
parent; it does not create a CSS cascade.

## FlexMargin

`FlexMargin = number | Percentage | "auto"` describes physical and logical margin
edges. Experimental finite Flex supports main-axis auto margins in all
four directions and LTR/RTL. Physical left/right apply to rows; top/bottom apply
to columns. Inline start/end map through the receiving direction and support
row main-axis auto margins. Auto edges are zero during flexible sizing, then
each actual nowrap/wrapped line divides its positive remaining main space among
its own auto slots before `justifyContent`. With no positive
space they remain zero and existing main alignment applies. Finite nowrap/wrapped
rows support physical top/bottom cross auto with an explicit numeric child height,
excluding wrap-reverse and aspect sizing. Cross auto overrides alignment and uses
the item’s own line height. Column/reversed cross axes, automatic child cross size,
shorthand and intrinsic auto margins remain unsupported; the normal build retains
its experimental-margin diagnostic. Numeric/percentage precedence is unchanged.

## FlexProps

`FlexProps` accepts recursive `PibblNode` children for Pibbl's supported Flexbox
subset.

## FlexStyle

`FlexStyle` is the declared container style for `Flex`. Reverse/reordered
flexing, advanced intrinsic sizing, margins, and scrolling are outside the normal build.
Experimental finite allocated Flex accepts `gap`, `rowGap`, and `columnGap` as
`number | Percentage`. Column percentages use content width; row percentages use
content height, including column Flex. Intrinsic/max-only percentage-gap owners
remain unsupported.

## FlowProps

`FlowProps` accepts recursive `PibblNode` children for sequential flow layout.

## FlowStyle

`FlowStyle` configures the direction, wrapping, and declared box for `Flow`.

## GridItemStyle

`GridItemStyle` is the direct-child placement style consumed by an explicit
`Grid` parent.

## GridProps

`GridProps` accepts recursive `PibblNode` children for explicit-track grid layout.

## GridStyle

`GridStyle` configures the declared box and explicit tracks for `Grid`; CSS
auto-placement and advanced intrinsic sizing are not supported.

## GridTrack

`GridTrack` describes one explicit Grid track in Pibbl's supported subset.

## LayoutBox

`LayoutBox` is the stable readonly child-local allocation available during
render through `useLayoutBox`.

## LayoutDiagnosticContext

`LayoutDiagnosticContext` carries component and algorithm context for a public
layout/style validation failure.

## LayoutDiagnosticInput

`LayoutDiagnosticInput` is the structured public input accepted by
`layoutDiagnostic` to identify property, supplied value, and optional
constraints.

## LayoutItemStyle

`LayoutItemStyle` is the shared direct-child participation vocabulary for
Absolute, Overlay, Flex, and Grid parents.

## Length

`Length` is Pibbl's public numeric/percentage/`"auto"` length vocabulary.
Resolution requires a definite percentage basis when a percentage is used.

## MeasureInput

`MeasureInput` describes an opt-in primitive's pure measurement request.

## MeasureResult

`MeasureResult` is the result of `measureElement` and distinguishes supported
measurement from an unsupported primitive capability.

## OverlayStyle

`OverlayStyle` is the declared shared-allocation style for `Overlay` children.

## Percentage

`Percentage` is the public percentage-length form. It resolves only against a
definite nonnegative reference dimension.

## ResolvedBoxStyle

`ResolvedBoxStyle` is the finite box result with its resolved border/content
geometry after box-style validation.

## Size

`Size` is the finite width/height record used by layout and measurement.

`style.borderWidth` reserves finite nonnegative layout insets, using a number or
physical `{ top, right, bottom, left }` edges. It defaults to zero and does not
paint. Padding and borders combine once: content-box40×30 with padding10 and
borderWidth2 occupies64×54; border-box64×54 preserves40×30 content.
`strokeWidth` remains independent paint. Percentage/logical border aliases are
not supported. Layer raster sizing retains its separate width/height policy.

Flex alignment values include `start` and `end` on `FlexStyle.justifyContent`,
`alignItems`, `alignContent`, and `FlexItemStyle.alignSelf`. These keep their
physical LTR edges under experimental main/cross reversal; `flex-start` and
`flex-end` follow the reversed Flex axes. Experimental `FlexStyle.layoutDirection?: "ltr" | "rtl"` inherits through layout contexts and Layers, defaults to LTR at a root, and permits explicit LTR override. RTL mirrors row main and column cross placement; logical margin and padding edges are specified below; logical borders remain unsupported.

`LayoutItemStyle.marginStart` and `.marginEnd`, also included in `FlexItemStyle`,
are `number | Percentage` in experimental Flex. They map through inherited
direction, or a child Flex’s explicit direction. Logical edges override physical
edges and the uniform `margin` shorthand; zero is explicit and property order
does not matter. Signed percentages use the containing Flex content width.
Other layout families and normal JavaScript Flex reject these margins.

`BoxStyle.paddingStart` and `.paddingEnd` are nonnegative `number | Percentage`
values in experimental box layout. They override the mapped physical `padding`
edge, including zero, independently of property order. Direction is inherited or
comes from a child Flex’s explicit `layoutDirection`. Percentage reference is the
containing Flex content width; raw/intrinsic percentages remain unsupported.
Layer raster sizing keeps its separate padding-independent policy. Explore
[logical padding](#/examples/layout/wasm-logical-padding).

Experimental `BoxStyle.borderStartWidth?: number` and `borderEndWidth?: number`
map through the receiving box’s direction and override the corresponding physical
`borderWidth` edge, including zero, independently of declaration order. Values
must be finite nonnegative numbers; percentages are unsupported. A child Flex’s
explicit direction overrides inheritance. Allocation canonicalizes logical widths
before content-box/border-box conversion and inset floors. These widths reserve
layout space; painted strokes remain independent. Layer’s own raster dimensions
and child origin retain their existing physical-border behavior. Raw logical
border inputs remain ineligible for frozen allocation caching.

## IntrinsicAxisConstraints

One available axis is `{ kind: "bounded", min, max }` or
`{ kind: "unbounded", min }`, in logical units.

## IntrinsicConstraints

Explicit `width` and `height` availability for an intrinsic query.

## IntrinsicMeasureInput

`measureIntrinsic` receives resolved `props`, normalized `style`, tagged
`constraints` and the pure Canvas measurement `service`. The first experimental
consumer is a direct custom primitive in a finite nowrap Flex row.

## IntrinsicSizesResult

Returns `{ status: "measured", minContent, maxContent }` with content-box sizes,
or `{ status: "unsupported", reason }`. Dimensions are finite and nonnegative;
minimum width cannot exceed preferred width. Heights describe the content at the
corresponding intrinsic width and need not be ordered. Existing `measure` is
unchanged. A definite basis and explicit `minWidth: 0` avoid intrinsic queries.
