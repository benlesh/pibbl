---
id: api-types-elements-components
title: Elements and component types
summary: CRC's branded element protocol, component props, and path-constructor inputs.
kind: api
slug: elements-components
apiCategory: types
typeDomain: elements-components
symbols:
  [
    AbsoluteProps,
    ArcPathOptions,
    ArcProps,
    CirclePathOptions,
    CircleProps,
    ClipProps,
    CRCComponent,
    CRCContainerChild,
    CRCElement,
    CRCElementType,
    CRCEmptyNode,
    CRCKey,
    CRCNode,
    CRCNodeInput,
    CRCPhysics2DPropExtension,
    CRCPrimitiveComponent,
    CRCRenderResult,
    CRCTextChild,
    CRCTextInput,
    EllipsePathOptions,
    EllipseProps,
    FocusManagementProps,
    GroupProps,
    HorizontalLineProps,
    ImageProps,
    KeyboardNavigationProps,
    LayerProps,
    LinePathOptions,
    LineProps,
    OverlayProps,
    PathProps,
    PolygonPathOptions,
    PolygonProps,
    RectanglePathOptions,
    RectangleProps,
    RegularPolygonNumericSize,
    RegularPolygonPathOptions,
    RegularPolygonPathPosition,
    RegularPolygonProps,
    RoundedCornerPathOptions,
    StarPathOptions,
    StarProps,
    SvgPathOptions,
    SvgPathProps,
    TextFit,
    TextProps,
    VerticalLineProps,
    WedgePathOptions,
    WedgeProps,
  ]
keywords: [JSX, element, component, props, Path2D]
---

# Elements and component types

CRC components are synchronous functions over a branded recursive element
protocol. Component pages describe each runtime value; this page owns their
type contracts and the pure `create*Path` option objects.

## AbsoluteProps

`AbsoluteProps` accepts recursive `CRCNode` children for `Absolute`.

## ArcPathOptions

`ArcPathOptions` supplies numeric radius, center, radian sweep, and optional
direction to `createArcPath`; invalid numeric structure throws `RangeError`.

## ArcProps

`ArcProps` is the public input for the open, stroke-only `Arc` component.

## CirclePathOptions

`CirclePathOptions` supplies a nonnegative numeric radius and optional center
to `createCirclePath`.

## CircleProps

`CircleProps` is the public input for the `Circle` drawing component.

## ClipProps

`ClipProps` supplies a `Path2D`, fill rule, and recursive `CRCNode` children
to `Clip`.

## CRCComponent

`CRCComponent<P>` is a synchronous `(props: P) => CRCNode | void` function.
Components do not return promises and use normal function identity for runtime
state ownership.

## CRCContainerChild

`CRCContainerChild` aliases the recursive node contract accepted by container
components such as `Group`, `Layer`, and the layout components.

## CRCElement

`CRCElement<P>` is CRC's immutable branded descriptor with a component `type`,
readonly `props`, and an optional normalized key. Construct it with JSX or
`createElement`, not object literals.

## CRCElementType

`CRCElementType<P>` is the supported vocabulary of synchronous CRC component
types accepted by element construction.

## CRCEmptyNode

`CRCEmptyNode` is `false | true | null | undefined | "" | 0`. These values
render no CRC output inside a recursive node structure.

## CRCKey

`CRCKey` is `string | number`; element construction normalizes it to a string
and never delivers it through component props.

## CRCNode

`CRCNode` is one element, an empty node, a recursive readonly array, or a
finite synchronous iterable. Infinite iterables are unsupported.

## CRCNodeInput

`CRCNodeInput` is the component-owned authoring grammar for structural
children and component results. It accepts `CRCNode`, direct signals that
replace one complete resolved node structure, and recursive arrays or finite
iterables containing those inputs. Signal results are resolved one level only.

## CRCPhysics2DPropExtension

`CRCPhysics2DPropExtension` is the empty declaration-merging base used by the
optional official 2D physics package to type supported Canvas component props.

## CRCPrimitiveComponent

`CRCPrimitiveComponent` is the capability-bearing component type created by
`definePrimitive` for platform/component-library authors.

## CRCRenderResult

`CRCRenderResult` is `CRCNode | void`, the output permitted from a synchronous
CRC component.

## CRCTextChild

`CRCTextChild` is recursive textual content for `Text`: strings, numbers,
booleans, nullish values, readonly arrays, and finite synchronous iterables.

## CRCTextInput

`CRCTextInput` is the `Text` authoring grammar. It accepts `CRCTextChild`,
direct signals that replace one complete resolved text structure, and recursive
arrays or finite iterables containing those inputs. It does not unwrap signals
inside a structure returned by another signal.

## EllipsePathOptions

`EllipsePathOptions` supplies numeric nonnegative radii, optional center, and
finite radian rotation to `createEllipsePath`.

## EllipseProps

`EllipseProps` is the public input for the rotated `Ellipse` component.

## FocusManagementProps

`FocusManagementProps` wraps one recursive `CRCNode` subtree and enables
logical Canvas focus without generating semantic DOM.

## GroupProps

`GroupProps` accepts recursive `CRCNode` children for transformed composition.

## HorizontalLineProps

`HorizontalLineProps` is the public input for the allocation-aware horizontal
line helper.

## ImageProps

`ImageProps` is the public input for the browser-decoded `Image` component.

## KeyboardNavigationProps

`KeyboardNavigationProps` wraps recursive `CRCNode` children in a transparent
directional-navigation boundary inside focus management.

## LayerProps

`LayerProps` accepts recursive `CRCNode` children for a persistent offscreen
CRC instance; browser `OffscreenCanvas` support is required.

## LinePathOptions

`LinePathOptions` supplies finite numeric coordinates and optional `closePath`
to `createLinePath`.

## LineProps

`LineProps` is the public input for the ordered polyline `Line` component.

## OverlayProps

`OverlayProps` accepts recursive `CRCNode` children for shared-box placement.

## PathProps

`PathProps` requires a caller-owned `Path2D` for the `Path` drawing component.

## PolygonPathOptions

`PolygonPathOptions` supplies finite numeric coordinates and optional numeric
corner radii to `createPolygonPath`.

## PolygonProps

`PolygonProps` is the public input for the closed numeric-coordinate polygon.

## RectanglePathOptions

`RectanglePathOptions` supplies signed numeric dimensions, optional position,
and numeric corner radii to `createRectanglePath`.

## RectangleProps

`RectangleProps` is the public input for the local rectangle component.

## RegularPolygonNumericSize

`RegularPolygonNumericSize` is the exact-one numeric size union for generated
regular polygon paths: circumradius, inradius, or side length.

## RegularPolygonPathOptions

`RegularPolygonPathOptions` combines integer sides, one numeric size mode,
optional position/rotation, and numeric corner options for the pure creator.

## RegularPolygonPathPosition

`RegularPolygonPathPosition` supplies the optional numeric center and rotation
shared by regular-polygon path construction.

## RegularPolygonProps

`RegularPolygonProps` is the public input for the generated regular polygon.

## RoundedCornerPathOptions

`RoundedCornerPathOptions` supplies numeric `cornerRadius` and `cornerRadii`
for the pure rectangle and polygon path constructors.

## StarPathOptions

`StarPathOptions` supplies integer points, ordered nonnegative radii, optional
position/rotation, and numeric corners to `createStarPath`.

## StarProps

`StarProps` is the public input for the generated concave `Star` component.

## SvgPathOptions

`SvgPathOptions` supplies SVG `d` text to the browser-parsed pure path creator.

## SvgPathProps

`SvgPathProps` is the public input for browser-parsed `SvgPath` geometry.

## TextFit

`TextFit` describes the supported local text fitting behavior; text shaping,
rasterization, and measurement remain browser behavior.

## TextProps

`TextProps` accepts recursive `CRCTextChild` content and the local text style.

## VerticalLineProps

`VerticalLineProps` is the public input for the allocation-aware vertical line.

## WedgePathOptions

`WedgePathOptions` supplies numeric circular-sweep values to the center-closed
`createWedgePath` function.

## WedgeProps

`WedgeProps` is the public input for the center-closed `Wedge` component.
