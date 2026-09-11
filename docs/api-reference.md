# CRC API reference

This reference describes the supported public package boundary. Import normal
runtime values and types from `@crc/core`. The automatic JSX compiler imports
its constructors from the two explicit compiler subpaths. Imports below
`@crc/core/lib/*` or `@crc/core/src/*` are unsupported and blocked.

## Package entries

### `@crc/core`

The root contains 77 runtime values and 173 type exports.

<!-- root-values:start -->

`Absolute`, `Arc`, `Circle`, `Clip`, `Ellipse`, `Flex`, `Flow`,
`FocusManagement`, `Fragment`, `Grid`, `Group`, `HorizontalLine`, `Image`,
`KeyboardNavigation`, `Layer`, `LayoutDiagnostic`, `Line`, `Overlay`, `Path`,
`Polygon`, `Rectangle`, `RegularPolygon`, `Star`, `SvgPath`, `Text`,
`VerticalLine`, `Wedge`, `computed`, `crc`,
`crcCanvasContext`, `crcCursor`, `crcEvent`,
`crcEventListener`, `crcEventTarget`, `crcLayoutBox`, `crcLinePath`, `crcMemo`,
`crcPlayback`, `crcRectPath`, `crcRef`, `crcSignal`, `crcState`, `crcSvgPath`,
`crcTransition`, `crcWhenChanged`,
`createArcPath`, `createCirclePath`, `createElement`, `createEllipsePath`,
`createLinePath`, `createPolygonPath`, `createRectanglePath`,
`createRegularPolygonPath`, `createStarPath`, `createSvgPath`,
`createWedgePath`, `defineAnimation`, `definePrimitive`, `easing`, `isSignal`,
`keyframes`, `layoutDiagnostic`, `marker`, `measureElement`, `normalizeEdges`,
`parallel`, `repeat`, `resolveBox`, `resolveLength`, `sequence`, `signal`,
`spring`, `stepper`, `track`, `tween`, `untracked`, `wait`

<!-- root-values:end -->

<!-- root-types:start -->

`AbsoluteProps`, `AbsoluteStyle`, `ArcPathOptions`, `ArcProps`, `ArcStyle`,
`BoxStyle`, `CRCAnimationDefinition`, `CRCAnimationOptions`,
`CRCAnimationProgram`, `CRCAnimationRepeatDirection`,
`CRCAnimationRepeatOptions`, `CRCAnimationSampleInput`, `CRCBlurFilter`,
`CRCBrightnessFilter`, `CRCClipboardEvent`,
`CRCComponent`, `CRCCompositionEvent`, `CRCConfig`, `CRCContainerChild`,
`CRCContrastFilter`, `CRCController`, `CRCDragEvent`, `CRCDropShadowFilter`,
`CRCEasing`, `CRCElement`, `CRCElementType`, `CRCEmptyNode`,
`CRCEvent`, `CRCEventCapturePropName`, `CRCEventHandler`, `CRCEventHandlers`,
`CRCEventMap`, `CRCEventPhase`, `CRCEventPropName`, `CRCEventTarget`,
`CRCEventTargetOptions`, `CRCEventTargetSnapshot`, `CRCEventType`, `CRCFilter`,
`CRCFit`, `CRCFixedViewportConfig`, `CRCFocusEvent`, `CRCGrayscaleFilter`,
`CRCHueRotateFilter`, `CRCInputEvent`, `CRCInterpolator`, `CRCInvertFilter`,
`CRCKey`, `CRCKeyframesOptions`, `CRCKeyboardEvent`,
`CRCKeyboardNavigationOptions`, `CRCLogicalMouseEvent`, `CRCMouseEvent`,
`CRCMouseEventListener`, `CRCNode`, `CRCOpacityFilter`, `CRCPixelRatio`,
`CRCPointerEvent`, `CRCPlayback`, `CRCPlaybackEvent`, `CRCPlaybackOptions`,
`CRCPlaybackStatus`, `CRCPrimitiveComponent`, `CRCRef`, `CRCRenderResult`,
`CRCResponsiveViewportConfig`, `CRCSaturateFilter`, `CRCSepiaFilter`,
`CRCSpringOptions`, `CRCSpringTransitionOptions`, `CRCStepperOptions`,
`CRCTextChild`, `CRCTouchEvent`, `CRCTweenOptions`,
`CRCTweenTransitionOptions`, `CRCWheelEvent`,
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
`RoundedCornerStyle`, `Signal`, `SignalEquals`, `SignalOptions`, `Size`,
`SpecifiedStyle`, `StateUpdater`,
`StarPathOptions`, `StarProps`, `StarStyle`, `StrokeStyle`,
`StyleResolutionContext`, `SvgPathOptions`, `SvgPathProps`, `SvgPathStyle`,
`SystemStyle`,
`TextFit`, `TextProps`, `TextStyle`, `VerticalLineProps`, `VerticalLineStyle`,
`WedgePathOptions`, `WedgeProps`, `WedgeStyle`, `WritableSignal`

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

### `@crc/core/internal`

This entry is reserved for official renderer packages released in lockstep
with the exact `@crc/core` version. It exports
`crcInternalCreateSignalConsumer`, `crcInternalCurrentFrame`,
`crcInternalCurrentRenderOwner`, `crcInternalQueueComplete`, and
`crcInternalRequestRendererWork`, plus `CRCInternalFrame`,
`CRCInternalRendererWorkKind`, `CRCInternalRenderOwner`, and
`CRCInternalSignalConsumer`.

This version-coupled friend entry is not a stable third-party API, does not
re-export the public root, and is intentionally unavailable in ordinary Studio
examples. It does not make `@crc/core/lib/*` or source paths supported.

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
| `Rectangle`      | `RectangleProps`, `RectStyle`                | Rectangle geometry, optional rounded corners, paint, events, and pixel alignment |
| `Circle`         | `CircleProps`, `CircleStyle`                 | Center/radius circle with fill, stroke, interaction, and focus geometry          |
| `Ellipse`        | `EllipseProps`, `EllipseStyle`               | Center/radii ellipse with optional radian rotation                               |
| `Arc`            | `ArcProps`, `ArcStyle`                       | Open stroke-only circular sweep                                                  |
| `Wedge`          | `WedgeProps`, `WedgeStyle`                   | Filled/stroked center-closed circular sector                                     |
| `Polygon`        | `PolygonProps`, `PolygonStyle`               | Closed ordered numeric coordinate path with optional rounded corners             |
| `RegularPolygon` | `RegularPolygonProps`, `RegularPolygonStyle` | Generated regular closed polygon with one size mode and optional rounded corners |
| `Star`           | `StarProps`, `StarStyle`                     | Generated concave alternating outer-tip/inner-valley silhouette                  |
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

The shape styles use local logical geometry and the existing box and layout-item
fields. They accept the applicable event/focus props plus `cursor`, `opacity`,
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
- `RegularPolygonStyle` requires integer `sides >= 3` and exactly one of
  `circumradius`, `inradius`, or `sideLength`; `cx`/`cy` default to `0` and
  finite `rotation` defaults to `-Math.PI / 2`. For `n = sides`, the normalized
  circumradius is `R`, `inradius / Math.cos(Math.PI / n)`, or
  `sideLength / (2 * Math.sin(Math.PI / n))`, respectively. Vertices advance
  clockwise in Canvas coordinates.
- `StarStyle` requires integer `points >= 3`, nonnegative `outerRadius` and
  `innerRadius`, and `innerRadius <= outerRadius`. `points` counts outer tips;
  its default rotation is also `-Math.PI / 2`, and clockwise traversal
  alternates outer even-index tips with inner odd-index valleys. It is one
  concave outline, not crossing triangles.

`RoundedCornerStyle` is shared by `Rectangle`, `Polygon`, `RegularPolygon`,
and `Star`. `cornerRadius` is the default; at corner index `i`,
`cornerRadii?.[i] ?? cornerRadius ?? 0` selects the radius. Thus literal `0`
keeps that corner sharp, while a sparse hole, `undefined`, or `null` falls back.
`cornerRadii` cannot exceed the actual corner count. Component radii may be
lengths and resolve percentages against the smaller current percentage-basis
dimension; numeric creator radii are logical Canvas units. Rectangle delegates
signed-box corner remapping and native radius scaling to Canvas; polygonal
rounding globally scales adjacent tangent demands that do not fit an edge.

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
the Wedge center, Polygon point extrema, or generated RegularPolygon/Star
vertex extrema. These drawing leaves do not infer intrinsic
`measureElement` dimensions; layouts that need size must declare a box.
Transforms, clips, layers, and source paint order use the shared drawing
pipeline.

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

Shapes do not add rounded Arc/Wedge/Line joins, Circle/Ellipse corner behavior,
automatic rounded clipping for arbitrary leaves, elliptical or CSS slash radii,
smoothing/interpolation, chart/data semantics, annular sectors, compound or
crossing stars, a generic shape registry/builder, new paint effects, or
retained geometry.

## Numeric path creators

The ten `create*Path` functions are public, pure constructors for reuse in a
`Path`, `Clip`, or caller-owned Canvas operation. Each takes its dedicated
options object, returns a fresh `Path2D`, and owns no render state, events, or
cache. Except for SVG path data, creator geometry is finite numeric logical
Canvas units—creators do not accept `Length`, percentages, or `"auto"`.

| Creator                    | Options                                                                                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `createRectanglePath`      | `RectanglePathOptions`: `width`, `height`, optional `x`, `y`, `cornerRadius`, `cornerRadii`; width/height remain signed.                  |
| `createCirclePath`         | `CirclePathOptions`: nonnegative `radius`, optional `cx`, `cy`.                                                                           |
| `createEllipsePath`        | `EllipsePathOptions`: nonnegative `radiusX`/`radiusY`, optional `cx`, `cy`, finite `rotation`.                                            |
| `createArcPath`            | `ArcPathOptions`: nonnegative `radius`, finite `startAngle`/`endAngle`, optional `cx`, `cy`, `counterclockwise`.                          |
| `createWedgePath`          | `WedgePathOptions`: the same dedicated circular-sweep options, center-closed for partial sweeps.                                          |
| `createLinePath`           | `LinePathOptions`: numeric `coords` and optional `closePath`.                                                                             |
| `createPolygonPath`        | `PolygonPathOptions`: numeric `coords`, optional `cornerRadius`/`cornerRadii`.                                                            |
| `createRegularPolygonPath` | `RegularPolygonPathOptions`: integer `sides >= 3`, exactly one numeric size field, optional position/rotation and corner options.         |
| `createStarPath`           | `StarPathOptions`: integer `points >= 3`, nonnegative ordered `outerRadius`/`innerRadius`, optional position/rotation and corner options. |
| `createSvgPath`            | `SvgPathOptions`: string `d`, parsed by the browser `Path2D` constructor.                                                                 |

Creator structural and numeric errors throw `RangeError` with the offending
option path; component style-resolution failures instead use contextual
`LayoutDiagnostic`. Malformed SVG path data retains browser `Path2D` parsing
behavior. Valid empty cases include zero circle/arc/wedge radius, either zero
ellipse axis, zero arc/wedge span, fewer than three Polygon points, zero
RegularPolygon size, either zero Star radius, and sharp (`0`) corner radii.
For exact rounding, sweep, bounds, and validation rules, see the
[drawing-components contract](./design/drawing-components-contract.md).

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
- `crcSignal(initialValue, options?)` → one mount-owned `WritableSignal<T>`
- `crcPlayback(program, options?)` → one stable component-owned `CRCPlayback`
- `crcTransition(target, options)` → one stable readonly presented-value signal
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

## Signals

- `signal(initialValue, options?)` returns a `WritableSignal<T>` with explicit
  `get()`, `set(value)`, `update(updater)`, and cached `asReadonly()`.
- `computed(compute, options?)` returns a lazy cached readonly `Signal<T>` with
  dynamic synchronous dependencies.
- `untracked(read)` performs synchronous reads without collecting
  dependencies; it does not disable write guards.
- `isSignal(value)` narrows recognized writable, readonly, and computed signal
  objects to `Signal<unknown>`.

`SignalOptions<T>` accepts `equals?: SignalEquals<T>` and `debugName?: string`.
Equality defaults to `Object.is`. `set()` treats functions as data;
`update()` is the explicit functional-update operation. Signals never unwrap
implicitly: read with `get()`, including in JSX or style construction. Writes
are forbidden while a component, primitive render callback, or computed
function is executing, even when the candidate would compare equal.

See the [signals and scheduling
contract](./design/signals-and-scheduling-contract.md) for computed graph,
component-consumer, six-phase realm scheduler, Layer revision, error-isolation,
ownership, and friend-entry rules.

## Animation

Animation has three explicit layers: definitions describe typed values over
local time, programs bind definitions to writable signals and compose work,
and `crcPlayback` gives a mounted hook slot ownership of a running program.
There is no free `play(program)` export and no animation object is accepted as
an ordinary style value.

The definition constructors are:

- `tween(options)` for duration/easing interpolation. Numbers interpolate
  linearly by default; every other value requires `CRCInterpolator<T>`.
- `keyframes(options)` for two or more values with optional nondecreasing
  offsets and one easing or one easing per segment.
- `spring(options)` for a number-only analytic damped oscillator.
- `defineAnimation(options)` for a synchronous custom seekable sampler.
- `stepper(options)` for owned fixed-step state such as acceleration and
  velocity.

`easing` is a frozen object containing `linear`, `easeIn`, `easeOut`,
`easeInOut`, `cubicBezier`, and `steps`; it is not itself a function. The
associated types are `CRCEasing`, `CRCInterpolator`,
`CRCAnimationDefinition`, `CRCTweenOptions`, `CRCKeyframesOptions`,
`CRCSpringOptions`, `CRCAnimationOptions`, `CRCAnimationSampleInput`, and
`CRCStepperOptions`.

Programs are created with `track`, `sequence`, `parallel`, `wait`, `marker`,
and `repeat`. They are opaque immutable `CRCAnimationProgram` values.
`CRCAnimationRepeatOptions` chooses a positive iteration count or infinity and
an optional `CRCAnimationRepeatDirection`. An accepted run leases every output
for its whole lifetime. Another owner conflicts unless replacement is explicit;
direct `set` and `update` on a leased output throw.

`crcPlayback(program, options?)` returns `CRCPlayback`. Its readonly `status`
and `currentTime` are signals. Controls are `play`, `pause`, `resume`, `cancel`,
`finish`, `seek`, `reverse`, and `setPlaybackRate`. Controls enqueue immutable
commands for the next Begin phase. `CRCPlaybackOptions` configures autoplay,
conflict policy, a debug name, `onEvent`, and `onError`.
`CRCPlaybackStatus` enumerates `idle`, `scheduled`, `running`, `paused`,
`finished`, `cancelled`, and `disposed`; `CRCPlaybackEvent` describes start,
iteration, marker, finish, and cancel milestones delivered during Complete
after committed rendering.

`crcTransition` has a number-only spring overload using
`CRCSpringTransitionOptions` and a generic tween overload using
`CRCTweenTransitionOptions<T>`. Omitted `initial` presents the target without
mount animation. A distinct initial value queues entrance motion after the
mounting render succeeds; later unequal targets retarget from the last
committed presented value. Read the returned signal explicitly:

```tsx
function MovingCard({ targetX }: { targetX: number }) {
  const x = crcTransition(targetX, { type: "spring", initial: 0 });
  return <Rectangle style={{ x: x.get(), width: 48, height: 32 }} />;
}
```

All playback shares the realm scheduler's Begin, Advance, Commit, Plan,
Render, and Complete phases. See the [signals and animation
guide](./guides/signals-and-animation.md) for authoring patterns and the
[animation contract](./design/animation-contract.md) for defaults, validation,
ordering, determinism, Layer guidance, and failure/teardown semantics.

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
public hook value types. `Signal`, `WritableSignal`, `SignalOptions`, and
`SignalEquals` describe public signal values and configuration.
