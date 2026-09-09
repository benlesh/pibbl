# CRC API reference

This reference describes the supported public package boundary. Import normal
runtime values and types from `@crc/core`. The automatic JSX compiler imports
its constructors from the two explicit compiler subpaths. Imports below
`@crc/core/lib/*` or `@crc/core/src/*` are unsupported and blocked.

## Package entries

### `@crc/core`

The root contains 58 runtime values and 151 type exports.

<!-- root-values:start -->

`Absolute`, `Arc`, `Circle`, `Clip`, `Ellipse`, `Flex`, `Flow`,
`FocusManagement`, `Fragment`, `Grid`, `Group`, `HorizontalLine`, `Image`,
`KeyboardNavigation`, `Layer`, `LayoutDiagnostic`, `Line`, `Overlay`, `Path`,
`Polygon`, `Rectangle`, `RegularPolygon`, `Star`, `SvgPath`, `Text`,
`VerticalLine`, `Wedge`, `crc`,
`crcCanvasContext`, `crcCursor`, `crcEvent`,
`crcEventListener`, `crcEventTarget`, `crcLayoutBox`, `crcLinePath`, `crcMemo`,
`crcRectPath`, `crcRef`, `crcState`, `crcSvgPath`, `crcWhenChanged`,
`createArcPath`, `createCirclePath`, `createElement`, `createEllipsePath`,
`createLinePath`, `createPolygonPath`, `createRectanglePath`,
`createRegularPolygonPath`, `createStarPath`, `createSvgPath`,
`createWedgePath`, `definePrimitive`, `layoutDiagnostic`, `measureElement`,
`normalizeEdges`, `resolveBox`, `resolveLength`

<!-- root-values:end -->

<!-- root-types:start -->

`AbsoluteProps`, `AbsoluteStyle`, `ArcPathOptions`, `ArcProps`, `ArcStyle`,
`BoxStyle`, `CRCBlurFilter`, `CRCBrightnessFilter`, `CRCClipboardEvent`,
`CRCComponent`, `CRCCompositionEvent`, `CRCConfig`, `CRCContainerChild`,
`CRCContrastFilter`, `CRCController`, `CRCDragEvent`, `CRCDropShadowFilter`,
`CRCElement`, `CRCElementType`, `CRCEmptyNode`,
`CRCEvent`, `CRCEventCapturePropName`, `CRCEventHandler`, `CRCEventHandlers`,
`CRCEventMap`, `CRCEventPhase`, `CRCEventPropName`, `CRCEventTarget`,
`CRCEventTargetOptions`, `CRCEventTargetSnapshot`, `CRCEventType`, `CRCFilter`,
`CRCFit`, `CRCFixedViewportConfig`, `CRCFocusEvent`, `CRCGrayscaleFilter`,
`CRCHueRotateFilter`, `CRCInputEvent`, `CRCInvertFilter`, `CRCKey`,
`CRCKeyboardEvent`, `CRCKeyboardNavigationOptions`, `CRCLogicalMouseEvent`,
`CRCMouseEvent`, `CRCMouseEventListener`, `CRCNode`, `CRCOpacityFilter`, `CRCPixelRatio`,
`CRCPointerEvent`, `CRCPrimitiveComponent`, `CRCRef`, `CRCRenderResult`,
`CRCResponsiveViewportConfig`, `CRCSaturateFilter`, `CRCSepiaFilter`,
`CRCTextChild`, `CRCTouchEvent`, `CRCWheelEvent`,
`Canvas`, `CanvasMeasurementService`, `CirclePathOptions`, `CircleProps`,
`CircleStyle`, `ClipProps`, `ClipStyle`, `Constraints`, `CursorStyle`,
`EdgeValues`, `Edges`, `EllipsePathOptions`, `EllipseProps`, `EllipseStyle`,
`FillStyle`, `FlexItemStyle`, `FlexProps`, `FlexStyle`,
`FlowProps`, `FlowStyle`, `FocusManagementProps`, `GStyle`,
`GridItemStyle`, `GridProps`, `GridStyle`, `GridTrack`, `GroupProps`,
`HorizontalLineProps`, `HorizontalLineStyle`, `ImageProps`, `ImgStyle`,
`KeyboardNavigationProps`, `LayerProps`, `LayerStyle`, `LayoutBox`,
`LayoutDiagnosticContext`, `LayoutDiagnosticInput`, `LayoutItemStyle`, `Length`,
`LinePathOptions`, `LineProps`, `LineStyle`, `MeasureInput`, `MeasureResult`,
`NormalizedStyle`,
`OverlayProps`, `OverlayStyle`, `PaintStyle`, `PathProps`, `PathStyle`,
`Percentage`, `PixelGridAlignment`, `PolygonPathOptions`, `PolygonProps`,
`PolygonStyle`,
`PrimitiveCapabilities`, `PrimitiveInput`, `PrimitiveInputOf`,
`PrimitiveProgramProps`, `PrimitiveRender`, `RectStyle`,
`RectanglePathOptions`, `RectangleProps`, `RegularPolygonNumericSize`,
`RegularPolygonPathOptions`, `RegularPolygonPathPosition`,
`RegularPolygonProps`, `RegularPolygonStyle`, `RenderingContext2D`,
`ResolvedBoxStyle`, `ResolvedStyle`, `RoundedCornerPathOptions`,
`RoundedCornerStyle`, `Size`, `SpecifiedStyle`, `StateUpdater`,
`StarPathOptions`, `StarProps`, `StarStyle`, `StrokeStyle`,
`StyleResolutionContext`, `SvgPathOptions`, `SvgPathProps`, `SvgPathStyle`,
`SystemStyle`,
`TextFit`, `TextProps`, `TextStyle`, `VerticalLineProps`, `VerticalLineStyle`,
`WedgePathOptions`, `WedgeProps`, `WedgeStyle`

<!-- root-types:end -->

### `@crc/core/jsx-runtime`

<!-- jsx-runtime-values:start -->

Runtime values: `Fragment`, `jsx`, `jsxs`.

<!-- jsx-runtime-values:end -->

The module also exports its local `JSX` namespace:

<!-- jsx-namespace-types:start -->

`Element`, `ElementType`, `ElementChildrenAttribute`, `IntrinsicAttributes`,
`IntrinsicElements`, `LibraryManagedAttributes`

<!-- jsx-namespace-types:end -->

`Element` is the branded `CRCElement`; `ElementType` is a synchronous CRC
component; `ElementChildrenAttribute` names `children`; `IntrinsicAttributes`
admits a string or numeric `key`; `IntrinsicElements` is empty; and
`LibraryManagedAttributes` maps primitive values to their specified-style
input. These are compiler-facing contracts. Do not call `jsx` or `jsxs`
directly in application code.

### `@crc/core/jsx-dev-runtime`

<!-- jsx-dev-runtime-values:start -->

Runtime values: `Fragment`, `jsxDEV`.

<!-- jsx-dev-runtime-values:end -->

It exports the same local `JSX` namespace. `jsxDEV` adds development-only
filename, line, and column metadata used in diagnostics. The root package does
not export any compiler constructor.

### `@crc/core/types`

This type-only entry preserves the package's explicit type entry. Most authors
should import types from `@crc/core` alongside values.

## Runtime and element protocol

### `crc(canvas, root, config?)`

Mounts or updates a `CRCNode` on an `HTMLCanvasElement` or `OffscreenCanvas`.
The first mount owns the configuration and returns a stable `CRCController`
with idempotent `dispose()`. A later call for the same Canvas queues the latest
root and returns that controller. A root may be one element, a fragment/list,
a finite synchronous iterable, or an empty node. Infinite iterables are
unsupported; CRC does not promise to detect them.

`CRCConfig` is either a fixed logical viewport with optional `fit`,
`pixelRatio`, and `signal`, or
`{ viewport: "responsive", pixelRatio?, signal? }`. Fixed
defaults capture the initial Canvas attributes, center with `contain`, and use
device density. See the [surface contract](./design/canvas-surface-contract.md).

### `createElement(type, props, ...children)`

Constructs an opaque branded `CRCElement`. `props` may be `null`. Variadic
children override `props.children`; zero variadic children preserve an
explicit children prop. `key` accepts `CRCKey` (`string | number`), is
normalized to a string, and is not delivered in props.

### `Fragment`

The explicit fragment value. Shorthand fragments are normally preferred;
import this value when a fragment needs a key. Unkeyed fragments are
transparent. A keyed fragment creates an identity scope.

### Element types

- `CRCElement<P>` is the immutable nominal descriptor with `type`, readonly
  `props`, and optional normalized `key`.
- `CRCComponent<P>` is a synchronous `(props: P) => CRCNode | void`.
- `CRCElementType<P>` is the supported component-type vocabulary.
- `CRCNode` is a `CRCElement`, an empty node, a recursive readonly array, or a
  finite synchronous iterable.
- `CRCEmptyNode` is `false | true | null | undefined | "" | 0`.
- `CRCContainerChild` aliases the container node contract.
- `CRCTextChild` is recursive textual content: strings, numbers, booleans,
  nullish values, readonly arrays, and finite synchronous iterables.
- `CRCRenderResult` is `CRCNode | void`.
- `CRCPrimitiveComponent`, `PrimitiveInputOf`, and the primitive types describe
  capability-bearing platform components.

## Drawing and composition values

All visual geometry is supplied under a closed local `style`. The corresponding
`Props` and `Style` exports give the exact compile-time contract.

| Value            | Props/style types                            | Purpose                                                                          |
| ---------------- | -------------------------------------------- | -------------------------------------------------------------------------------- |
| `Rectangle`      | `RectangleProps`, `RectStyle`                | Rectangle geometry, fill/stroke, pixel alignment, events, cursor, focus metadata |
| `Circle`         | `CircleProps`, `CircleStyle`                 | Center/radius circle with fill, stroke, interaction, and focus geometry          |
| `Ellipse`        | `EllipseProps`, `EllipseStyle`               | Center/radii ellipse with optional radian rotation                               |
| `Arc`            | `ArcProps`, `ArcStyle`                       | Open stroke-only circular sweep                                                  |
| `Wedge`          | `WedgeProps`, `WedgeStyle`                   | Filled/stroked center-closed circular sector                                     |
| `Polygon`        | `PolygonProps`, `PolygonStyle`               | Closed ordered numeric coordinate path                                           |
| `Path`           | `PathProps`, `PathStyle`                     | A required `Path2D` `d` with paint and interaction width                         |
| `SvgPath`        | `SvgPathProps`, `SvgPathStyle`               | Browser-parsed SVG path-data string                                              |
| `Line`           | `LineProps`, `LineStyle`                     | Ordered polyline coordinates                                                     |
| `HorizontalLine` | `HorizontalLineProps`, `HorizontalLineStyle` | Horizontal helper with allocation-aware default end                              |
| `VerticalLine`   | `VerticalLineProps`, `VerticalLineStyle`     | Vertical helper with allocation-aware default end                                |
| `Text`           | `TextProps`, `TextStyle`, `TextFit`          | Recursive textual children, paint, wrapping, fitting, and measurement            |
| `Image`          | `ImageProps`, `ImgStyle`                     | Async browser image source, geometry, border, and interaction                    |
| `Group`          | `GroupProps`, `GStyle`                       | Transform any recursive children                                                 |
| `Clip`           | `ClipProps`, `ClipStyle`                     | Clip recursive children with `Path2D` and fill rule                              |
| `Layer`          | `LayerProps`, `LayerStyle`                   | Persistent offscreen multi-child CRC instance                                    |

Drawing leaves reject children. `Text` accepts `CRCTextChild`; `Group`, `Clip`,
and `Layer` accept `CRCNode`.

The standard shape styles use local logical geometry and the existing box and
layout-item fields. All five accept event/focus props plus `cursor`, `opacity`,
`stroke`, `strokeWidth`, and `lineInteractionWidth`; all except the stroke-only
`Arc` also accept `fill`.

- `CircleStyle` requires `radius` and optionally accepts `cx` and `cy`.
- `EllipseStyle` requires `radiusX` and `radiusY`, and optionally accepts `cx`,
  `cy`, and finite `rotation` in radians.
- `ArcStyle` requires `radius`, finite radian `startAngle`, and finite radian
  `endAngle`; optional `cx`, `cy`, and `counterclockwise` select the Canvas arc
  direction. Its path remains open.
- `WedgeStyle` has the same geometry as `ArcStyle`, but partial sweeps close to
  the center. Full turns omit radial segments for a seam-free circular stroke;
  there is no `innerRadius`.
- `PolygonStyle` requires finite numeric `coords: [number, number][]`, connects
  them in order, and closes paths with at least three points. Shorter arrays
  are empty geometry, and tuple coordinates do not accept percentages.

The default center is `(0, 0)`, ellipse rotation is `0`, and arc/wedge direction
is clockwise (`counterclockwise: false`). Percentages for `cx`/`radiusX` use
the percentage-basis width; `cy`/`radiusY` use its height; circular `radius`
uses the smaller basis dimension. Radii must resolve to finite nonnegative
values. Negative radii, non-finite angles/rotation, invalid coordinates, and
indefinite percentage bases raise contextual `LayoutDiagnostic` errors. Zero
radii or angular span, and Polygon arrays with fewer than three points, are
safe empty geometry.

Direction, wrapping, and full-turn behavior follow `Path2D.arc`: a difference
of at least `2π` in the requested direction is a full circle. Shape paths
are shared exactly by paint and coordinate targeting. Stroke targeting honors
`lineInteractionWidth`; Wedge includes its radial edges on partial sweeps.
Caller-supplied `keyboardNavigationBounds` override the built-in deterministic
axis-aligned bounds from circle/rotated-ellipse extrema, swept arc cardinals,
the Wedge center, or Polygon point extrema. Transforms, clips, layers, and
source paint order use the shared drawing pipeline.

Standard shapes have no intrinsic `measureElement` capability and no
pixel-grid alignment. They do not add smoothing, interpolation, chart/data
semantics, annular sectors, rounded rectangles, a generic public shape builder,
or retained geometry.

## First-class filters

Every primitive style accepts
`filter?: CRCFilter | readonly CRCFilter[]`. One descriptor is normalized to a
one-item list; a readonly list executes in declaration order. An empty list is
exactly a no-op, performs no capture, and requires no offscreen/filter
capability. The public descriptor objects are:

| Type export / discriminator          | Fields and numeric behavior                                                                                                                                | Compiled unit/function               |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `CRCBlurFilter` / `blur`             | `radius`: finite, nonnegative Gaussian standard deviation                                                                                                  | Density-scaled `px`; `blur()`        |
| `CRCBrightnessFilter` / `brightness` | `amount`: finite, nonnegative; values above `1` preserved                                                                                                  | Unitless ratio; `brightness()`       |
| `CRCContrastFilter` / `contrast`     | `amount`: finite, nonnegative; values above `1` preserved                                                                                                  | Unitless ratio; `contrast()`         |
| `CRCDropShadowFilter` / `dropShadow` | `offsetX`, `offsetY`: signed finite; optional nonnegative finite `blurRadius` defaults `0` and is a Gaussian standard deviation; concrete `color` required | Density-scaled `px`; `drop-shadow()` |
| `CRCGrayscaleFilter` / `grayscale`   | `amount`: finite, nonnegative; values above `1` clamp to `1`                                                                                               | Unitless ratio; `grayscale()`        |
| `CRCHueRotateFilter` / `hueRotate`   | `degrees`: any finite value; not modulo-normalized                                                                                                         | `deg`; `hue-rotate()`                |
| `CRCInvertFilter` / `invert`         | `amount`: finite, nonnegative; values above `1` clamp to `1`                                                                                               | Unitless ratio; `invert()`           |
| `CRCOpacityFilter` / `opacity`       | `amount`: finite, nonnegative; values above `1` clamp to `1`                                                                                               | Unitless ratio; `opacity()`          |
| `CRCSaturateFilter` / `saturate`     | `amount`: finite, nonnegative; values above `1` preserved                                                                                                  | Unitless ratio; `saturate()`         |
| `CRCSepiaFilter` / `sepia`           | `amount`: finite, nonnegative; values above `1` clamp to `1`                                                                                               | Unitless ratio; `sepia()`            |

Amounts are ratios (`1` is 100 percent). `dropShadow.color` must be a concrete
CSS color accepted by the active browser's Canvas filter parser;
`currentColor`, `var(...)`, and contextual/system colors reject. The complete
list is compiled into one native Canvas filter operation without mutating the
caller-owned descriptors or array.

The receiving primitive and every descendant it returns are filtered as one
combined raster silhouette. Nested filters execute inside out. Receiving Group
transforms and receiving Clip geometry apply after their filter; descendant
transforms/clips are already inside the captured source and ancestor clips apply
to the completed result. A filter on `Layer` consumes the combined cached Layer
bitmap, while filters inside it use the child instance's pool. Filter pixels do
not change measurement, layout, hit/focus/navigation bounds, pointer
coordinates, cursor regions, or source paint order.

Nonempty filters require browser `OffscreenCanvas`, an Offscreen Canvas 2D
context, and supported native Canvas `filter` parsing. CRC provides no raw CSS
filter strings, `url()`/SVG filter graphs, `backdrop-filter`, `boxShadow`, DOM
Canvas fallback, or silent resolution reduction. See the [style
contract](./design/style-system-contract.md), [drawing contract](./design/drawing-components-contract.md),
and [surface contract](./design/canvas-surface-contract.md).

## Layout values

| Value      | Props/style types                                      | Purpose                                            |
| ---------- | ------------------------------------------------------ | -------------------------------------------------- |
| `Absolute` | `AbsoluteProps`, `AbsoluteStyle`                       | Independent `left`/`top` placement                 |
| `Overlay`  | `OverlayProps`, `OverlayStyle`                         | Shared allocation with alignment                   |
| `Flow`     | `FlowProps`, `FlowStyle`                               | Sequential horizontal/vertical layout and wrapping |
| `Flex`     | `FlexProps`, `FlexStyle`, `FlexItemStyle`              | Supported Flexbox subset                           |
| `Grid`     | `GridProps`, `GridStyle`, `GridItemStyle`, `GridTrack` | Explicit tracks and one-based placement            |

`BoxStyle`, `LayoutItemStyle`, `Length`, `Percentage`, `EdgeValues`,
`ResolvedBoxStyle`, `Constraints`, `Edges`, `LayoutBox`, and `Size` are the
shared declared-box vocabulary. `measureElement(element, constraints, service)`
returns `MeasureResult`. `resolveLength`, `normalizeEdges`, and `resolveBox` are
public pure helpers. Invalid resolution uses `LayoutDiagnostic`, its
`layoutDiagnostic` constructor helper, `LayoutDiagnosticInput`, and
`LayoutDiagnosticContext`.

## Focus policy values

- `FocusManagement` / `FocusManagementProps` installs one logical focus manager
  on exactly one element child without adding identity.
- `KeyboardNavigation` / `KeyboardNavigationProps` adds one transparent
  directional boundary. Its `CRCKeyboardNavigationOptions.mode` is exactly
  `"directional"` and requires a focus manager.

These policies do not create DOM or accessibility nodes. See the [focus and
accessibility guide](./guides/focus-keyboard-and-accessibility.md).

## Hooks

- `crcState(init?)` → readonly `[value, StateUpdater<T>]`
- `crcMemo(create, deps)` → memoized value under strict shallow dependency
  comparison
- `crcRef(init?)` → stable `CRCRef<T>` with mutable `current`
- `crcWhenChanged(callback, deps?)` → synchronous setup/replacement cleanup
- `crcCanvasContext()` → current isolated `RenderingContext2D`, render-only
- `crcLayoutBox()` → current stable readonly local `LayoutBox`, render-only
- `crcRectPath`, `crcLinePath`, `crcSvgPath` → memoized `Path2D` helpers
- `crcEvent`, `crcEventTarget`, `crcEventListener`, and `crcCursor` → event,
  explicit target/listener, and cursor ownership hooks

`Canvas` is the supported HTML/offscreen Canvas union;
`RenderingContext2D` is the corresponding 2D-context union.
`PixelGridAlignment` is `none`, `round`, `ceil`, or `floor`.

## Events

`CRCEventHandlers` maps every supported `onX` and `onXCapture` prop to its
typed facade. `CRCEventMap`, `CRCEventType`, `CRCEventHandler`,
`CRCEventPropName`, and `CRCEventCapturePropName` support generic event code.
`CRCEventPhase` represents capture, target, and bubble phases.

The facade family exports are `CRCEvent`, `CRCPointerEvent`,
`CRCLogicalMouseEvent`, `CRCTouchEvent`, `CRCWheelEvent`, `CRCKeyboardEvent`,
`CRCFocusEvent`, `CRCInputEvent`, `CRCCompositionEvent`, `CRCClipboardEvent`,
and `CRCDragEvent`. `CRCEventTarget` is CRC's opaque logical target interface.
`CRCEventTargetOptions` configures path/fill/stroke/cursor/focus/navigation
geometry, and `CRCEventTargetSnapshot` exposes logical focus state.

`CRCMouseEvent` and `CRCMouseEventListener` preserve the narrow pathless
Canvas-observer payload. See the [user-event contract](./design/user-events-contract.md).

## Style and primitive extension types

`SystemStyle` is the opt-in base with optional `custom` and framework-owned
`filter`. `SpecifiedStyle`, `NormalizedStyle`, and `ResolvedStyle` mark the
three immutable style stages.
`PaintStyle`, `CursorStyle`, `FillStyle`, and `StrokeStyle` expose common paint
vocabulary.

`definePrimitive(render, capabilities?)` defines a platform component.
`PrimitiveProgramProps`, `PrimitiveInput`, `PrimitiveInputOf`,
`PrimitiveRender`, and `PrimitiveCapabilities` model its public input and
private render/capability stages. `StyleResolutionContext` supplies allocation,
percentage basis, constraints, component, and algorithm. `MeasureInput`,
`MeasureResult`, and `CanvasMeasurementService` define pure measurement.

The complete worked example is in [custom components and
primitives](./guides/custom-components-and-primitives.md).

## Surface and controller types

`CRCController` has idempotent `dispose()`. `CRCConfig`,
`CRCFixedViewportConfig`, `CRCResponsiveViewportConfig`, `CRCFit`, and
`CRCPixelRatio` describe the root surface. `StateUpdater` and `CRCRef` are the
public hook value types.
