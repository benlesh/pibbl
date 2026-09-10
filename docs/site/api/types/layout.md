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

CRC layout is opt-in and immediate-mode. Parents inspect normalized direct-child
styles, resolve finite allocations, and render one child descriptor at a time;
they do not retain drawing commands. Style is local and never cascades.

## AbsoluteStyle

`AbsoluteStyle` is the declared container style for `Absolute`, including its
finite box and the independent `left`/`top` placement vocabulary for children.

## BoxStyle

`BoxStyle` is the shared declared-box vocabulary: dimensions, min/max limits,
padding, and the local inputs needed to resolve a finite box.

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

`EdgeValues` is the public shorthand accepted for edge values. A scalar applies
to all sides and omitted sides resolve to zero.

## FlexItemStyle

`FlexItemStyle` is the direct-child participation style consumed by a `Flex`
parent; it does not create a CSS cascade.

## FlexProps

`FlexProps` accepts recursive `CRCNode` children for CRC's supported Flexbox
subset.

## FlexStyle

`FlexStyle` is the declared container style for `Flex`. Reverse/reordered
flexing, advanced intrinsic sizing, margins, and scrolling are unsupported.

## FlowProps

`FlowProps` accepts recursive `CRCNode` children for sequential flow layout.

## FlowStyle

`FlowStyle` configures the direction, wrapping, and declared box for `Flow`.

## GridItemStyle

`GridItemStyle` is the direct-child placement style consumed by an explicit
`Grid` parent.

## GridProps

`GridProps` accepts recursive `CRCNode` children for explicit-track grid layout.

## GridStyle

`GridStyle` configures the declared box and explicit tracks for `Grid`; CSS
auto-placement and advanced intrinsic sizing are not supported.

## GridTrack

`GridTrack` describes one explicit Grid track in CRC's supported subset.

## LayoutBox

`LayoutBox` is the stable readonly child-local allocation available during
render through `crcLayoutBox`.

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

`Length` is CRC's public numeric/percentage/`"auto"` length vocabulary.
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
