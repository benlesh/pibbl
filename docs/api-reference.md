# CRC API reference

This reference describes the supported public package boundary. Import normal
runtime values and types from `@crc/core`. The automatic JSX compiler imports
its constructors from the two explicit compiler subpaths. Imports below
`@crc/core/lib/*` or `@crc/core/src/*` are unsupported and blocked.

## Package entries

### `@crc/core`

The root contains 41 runtime values and 112 type exports.

<!-- root-values:start -->

`Absolute`, `Clip`, `Flex`, `Flow`, `FocusManagement`, `Fragment`, `Grid`,
`Group`, `HorizontalLine`, `Image`, `KeyboardNavigation`, `Layer`,
`LayoutDiagnostic`, `Line`, `Overlay`, `Path`, `Rectangle`, `SvgPath`, `Text`,
`VerticalLine`, `crc`, `crcCanvasContext`, `crcCursor`, `crcEvent`,
`crcEventListener`, `crcEventTarget`, `crcLayoutBox`, `crcLinePath`, `crcMemo`,
`crcRectPath`, `crcRef`, `crcState`, `crcSvgPath`, `crcWhenChanged`,
`createElement`, `definePrimitive`, `layoutDiagnostic`, `measureElement`,
`normalizeEdges`, `resolveBox`, `resolveLength`

<!-- root-values:end -->

<!-- root-types:start -->

`AbsoluteProps`, `AbsoluteStyle`, `BoxStyle`, `CRCClipboardEvent`,
`CRCComponent`, `CRCCompositionEvent`, `CRCConfig`, `CRCContainerChild`,
`CRCController`, `CRCDragEvent`, `CRCElement`, `CRCElementType`, `CRCEmptyNode`,
`CRCEvent`, `CRCEventCapturePropName`, `CRCEventHandler`, `CRCEventHandlers`,
`CRCEventMap`, `CRCEventPhase`, `CRCEventPropName`, `CRCEventTarget`,
`CRCEventTargetOptions`, `CRCEventTargetSnapshot`, `CRCEventType`, `CRCFit`,
`CRCFixedViewportConfig`, `CRCFocusEvent`, `CRCInputEvent`, `CRCKey`,
`CRCKeyboardEvent`, `CRCKeyboardNavigationOptions`, `CRCLogicalMouseEvent`,
`CRCMouseEvent`, `CRCMouseEventListener`, `CRCNode`, `CRCPixelRatio`,
`CRCPointerEvent`, `CRCPrimitiveComponent`, `CRCRef`, `CRCRenderResult`,
`CRCResponsiveViewportConfig`, `CRCTextChild`, `CRCTouchEvent`, `CRCWheelEvent`,
`Canvas`, `CanvasMeasurementService`, `ClipProps`, `ClipStyle`, `Constraints`,
`CursorStyle`, `EdgeValues`, `Edges`, `FillStyle`, `FlexItemStyle`, `FlexProps`,
`FlexStyle`, `FlowProps`, `FlowStyle`, `FocusManagementProps`, `GStyle`,
`GridItemStyle`, `GridProps`, `GridStyle`, `GridTrack`, `GroupProps`,
`HorizontalLineProps`, `HorizontalLineStyle`, `ImageProps`, `ImgStyle`,
`KeyboardNavigationProps`, `LayerProps`, `LayerStyle`, `LayoutBox`,
`LayoutDiagnosticContext`, `LayoutDiagnosticInput`, `LayoutItemStyle`, `Length`,
`LineProps`, `LineStyle`, `MeasureInput`, `MeasureResult`, `NormalizedStyle`,
`OverlayProps`, `OverlayStyle`, `PaintStyle`, `PathProps`, `PathStyle`,
`Percentage`, `PixelGridAlignment`, `PrimitiveCapabilities`, `PrimitiveInput`,
`PrimitiveInputOf`, `PrimitiveProgramProps`, `PrimitiveRender`, `RectStyle`,
`RectangleProps`, `RenderingContext2D`, `ResolvedBoxStyle`, `ResolvedStyle`,
`Size`, `SpecifiedStyle`, `StateUpdater`, `StrokeStyle`,
`StyleResolutionContext`, `SvgPathProps`, `SvgPathStyle`, `SystemStyle`,
`TextFit`, `TextProps`, `TextStyle`, `VerticalLineProps`, `VerticalLineStyle`

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
an iterable, or an empty node.

`CRCConfig` is either a fixed logical viewport with optional `fit` and
`pixelRatio`, or `{ viewport: "responsive", pixelRatio?, signal? }`. Fixed
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

`SystemStyle` is the opt-in base with optional `custom`. `SpecifiedStyle`,
`NormalizedStyle`, and `ResolvedStyle` mark the three immutable style stages.
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
