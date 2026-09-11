# CRC style-system contract

Status: current implemented contract, updated for first-class filters on
2026-09-08.

CRC has one typed, local, closed `style` prop. Geometry, paint, cursor,
transforms, clipping, image source, text layout, and layout participation live
there. Application data, handlers, and structural children are separate props;
text content belongs in `Text` children; `key` is element metadata.

Filters are framework-owned local style and remain closed to the descriptor
vocabulary below.

```tsx
const cardPaint = {
  fill: "#17324d",
  stroke: "#8dd8ff",
  strokeWidth: 2,
} as const;

const card = (
  <Rectangle
    style={{ ...cardPaint, x: 16, y: 16, width: 180, height: 80 }}
    onClick={() => selectCard()}
  />
);
```

This vocabulary is CSS-familiar, not CSS. Styles do not cascade or inherit.
There are no selectors, stylesheets, specificity, ambient parent styles,
computed DOM values, class names, variables, or media/container queries. Reuse
is ordinary JavaScript object composition.

## Public style model

`SystemStyle` contains optional `custom` and the framework-owned `filter`:

```ts
interface SystemStyle {
  custom?: unknown;
  filter?: CRCFilter | readonly CRCFilter[];
}
```

Shared closed mixins include `BoxStyle`, `LayoutItemStyle`, `FlexItemStyle`,
`GridItemStyle`, `PaintStyle`, and `CursorStyle`. Built-ins expose their
supported intersections through `RectStyle`, `PathStyle`, `SvgPathStyle`,
`LineStyle`, `TextStyle`, `ImgStyle`, `GStyle`, `ClipStyle`, `LayerStyle`, and
layout styles. Every primitive style therefore accepts `filter`; unsupported
members remain type errors.

`style.custom` is application-owned metadata. CRC does not interpret or
inherit it. It is not an escape hatch for arbitrary top-level keys.

Plain functions receive their specified `style` in props. A layout parent may
inspect a direct child's style but never substitutes its finite allocation into
those props; the component reads that through `crcLayoutBox()`.

Platform components defined with `definePrimitive` have three immutable stages:

1. **Specified:** exact author input in the element props.
2. **Normalized:** pure defaults and syntax expansion, independent of parent
   allocation.
3. **Resolved:** allocation-aware, finite values supplied to the primitive
   renderer.

Normalization, resolution, and measurement do not render children or acquire
runtime resources. Diagnostics name the component, property, supplied value,
algorithm, constraints, and reason. A declared percentage or `auto` requires an
explicit resolver; a resolved style type cannot retain allocation syntax.
Unresolved percentages, unresolved `auto`, non-finite numeric geometry, and
malformed allocation syntax reject before a primitive render callback runs.

Filter normalization is also framework-owned. CRC removes `filter` before a
custom primitive's `normalizeStyle` and `resolveStyle` callbacks, validates it
from the authoritative specified or pre-normalized style, and attaches the
canonical readonly descriptor list to the final resolved style. Custom style
callbacks therefore cannot discard or reinterpret filters. Pure measurement
ignores filters: it neither validates browser raster capabilities nor allocates
offscreen surfaces, and the measured size is unchanged.

## Filter descriptors

One descriptor is a one-item list. A readonly list runs in declaration order;
`[]` is exactly a no-op, performs no offscreen capture, and requires no filter
capability. CRC copies and freezes normalized descriptors without mutating the
caller-owned descriptor or array.

The root package exports `CRCFilter` and all ten named descriptor types. This is
the complete function and numeric contract:

| Descriptor type                      | Fields and normalization                                                                                                                                                 | Native unit/function                   |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| `blur` (`CRCBlurFilter`)             | `radius` must be finite and nonnegative. It is a Gaussian standard deviation in local logical units.                                                                     | Density-scaled `px` in `blur()`        |
| `brightness` (`CRCBrightnessFilter`) | `amount` must be finite and nonnegative; values above `1` are preserved.                                                                                                 | Unitless ratio in `brightness()`       |
| `contrast` (`CRCContrastFilter`)     | `amount` must be finite and nonnegative; values above `1` are preserved.                                                                                                 | Unitless ratio in `contrast()`         |
| `dropShadow` (`CRCDropShadowFilter`) | Signed `offsetX`/`offsetY` must be finite. `blurRadius` defaults to `0`, must be finite and nonnegative, and is a Gaussian standard deviation. `color` must be concrete. | Density-scaled `px` in `drop-shadow()` |
| `grayscale` (`CRCGrayscaleFilter`)   | `amount` must be finite and nonnegative; values above `1` clamp to `1`.                                                                                                  | Unitless ratio in `grayscale()`        |
| `hueRotate` (`CRCHueRotateFilter`)   | `degrees` may be any finite number and is not modulo-normalized.                                                                                                         | `deg` in `hue-rotate()`                |
| `invert` (`CRCInvertFilter`)         | `amount` must be finite and nonnegative; values above `1` clamp to `1`.                                                                                                  | Unitless ratio in `invert()`           |
| `opacity` (`CRCOpacityFilter`)       | `amount` must be finite and nonnegative; values above `1` clamp to `1`.                                                                                                  | Unitless ratio in `opacity()`          |
| `saturate` (`CRCSaturateFilter`)     | `amount` must be finite and nonnegative; values above `1` are preserved.                                                                                                 | Unitless ratio in `saturate()`         |
| `sepia` (`CRCSepiaFilter`)           | `amount` must be finite and nonnegative; values above `1` clamp to `1`.                                                                                                  | Unitless ratio in `sepia()`            |

Amounts are ratios, so `1` means 100 percent. `blur.radius` and
`dropShadow.blurRadius` deliberately use filter-function standard-deviation
semantics, not CSS `box-shadow` blur-radius semantics. Drop-shadow color syntax
is accepted only when the active browser's Canvas filter parser accepts it;
`currentColor`, `var(...)`, system/contextual colors, and other contextual
references reject. Diagnostics identify `filter`, a list index when present,
the failing field, received value, and component before its render callback.

CRC compiles the complete nonempty list once for one native Canvas filter
operation. `style.opacity` remains the primitive's existing paint-alpha
behavior; an `opacity` filter is a separate ordered effect over the combined
raster and can differ where paint overlaps.

## Length and box rules

`Percentage` is an exact `${number}%` string. `Length` is a finite number,
percentage, or `"auto"`. Exact decimal forms such as `"50%"`, `".5%"`, and
`"-10%"` parse where the property permits signed values. Whitespace, suffixes,
scientific notation, malformed strings, and non-finite results reject.

- Size and placement percentages resolve once against the containing content
  allocation. Root logical units come from the fixed/responsive Canvas surface;
  physical backing pixels do not affect style resolution.
- Padding and gaps are finite nonnegative numbers, never percentages.
- Allocation size, min/max, padding, gaps, and growth factors are nonnegative;
  minimum greater than maximum is an error.
- `width` and `height` specify a content box. Min/max clamp content before
  numeric padding is added. Padding can reduce content to zero, not below.
- There is no margin. Parent placement uses `left`/`top`; drawing-local geometry
  uses `x`/`y` (`x1`/`x2` or `y1`/`y2` for line helpers).
- Primitive rectangle/image geometry retains signed Canvas semantics outside
  nonnegative layout allocation.
- `"auto"` is accepted only on documented measurement paths. Local offsets,
  parent offsets, and Grid tracks reject it.

## Style-only built-in migration

This table is the exact final field/default reference. Every drawing or
composition style also accepts the documented compatible `BoxStyle` and
`LayoutItemStyle` fields; the required fields below override optional inherited
box declarations. See the direct [old-to-final migration
matrix](../migrations/jsx-authoring-pivot.md#field-level-style-and-structure-replacements)
for every removed field and structural form.

| Component        | Final component-specific local style fields                                                                                                                                                                                                   | Defaults and required fields                                                                                                                                                                                              | Structural/program props                        |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `Rectangle`      | `style.width`, `style.height`, `style.x`, `style.y`, `style.fill`, `style.stroke`, `style.strokeWidth`, `style.opacity`, `style.cursor`, `style.alignToPixelGrid`, `style.lineInteractionWidth`                                               | `style.width` and `style.height` required; `style.x = 0`, `style.y = 0`; omitted pixel alignment preserves input                                                                                                          | Event/focus handlers/options                    |
| `Path`           | `style.d: Path2D`, `style.fill`, `style.stroke`, `style.strokeWidth`, `style.opacity`, `style.cursor`, `style.lineInteractionWidth`                                                                                                           | `style.d` required; interaction width uses `style.strokeWidth`, then `0`, when omitted                                                                                                                                    | Event/focus props                               |
| `Line`           | `style.coords`, `style.stroke`, `style.strokeWidth`, `style.opacity`, `style.cursor`, `style.lineInteractionWidth`                                                                                                                            | `style.coords` required; interaction width uses `style.strokeWidth`, then `0`, when omitted                                                                                                                               | Event/focus props                               |
| `HorizontalLine` | `style.y`, `style.x1`, `style.x2`, `style.stroke`, `style.strokeWidth`, `style.opacity`, `style.cursor`, `style.alignToPixelGrid`, `style.lineInteractionWidth`                                                                               | `style.y` required; `style.x1 = 0`, `style.x2 = allocation width`; omitted pixel alignment preserves input                                                                                                                | Event/focus props                               |
| `VerticalLine`   | `style.x`, `style.y1`, `style.y2`, `style.stroke`, `style.strokeWidth`, `style.opacity`, `style.cursor`, `style.alignToPixelGrid`, `style.lineInteractionWidth`                                                                               | `style.x` required; `style.y1 = 0`, `style.y2 = allocation height`; omitted pixel alignment preserves input                                                                                                               | Event/focus props                               |
| `SvgPath`        | `style.d: string`, `style.fill`, `style.stroke`, `style.strokeWidth`, `style.opacity`, `style.cursor`, `style.lineInteractionWidth`                                                                                                           | `style.d` required; interaction width uses `style.strokeWidth`, then `0`, when omitted                                                                                                                                    | Event/focus props                               |
| `Text`           | `style.x`, `style.y`, `style.width`, `style.height`, `style.lineHeight`, `style.wrap`, `style.fit`, `style.font`, `style.textBaseline`, `style.textAlign`, `style.fill`, `style.stroke`, `style.strokeWidth`, `style.opacity`, `style.cursor` | `style.x = 0`, `style.y = 0`, `style.lineHeight = 13`, `style.wrap = false`, `style.fit = "visible"`, `style.font = "13px sans-serif"`, `style.textBaseline = "top"`, `style.textAlign = "left"`, `style.strokeWidth = 0` | Recursive textual `children`, event/focus props |
| `Image`          | `style.src`, `style.x`, `style.y`, `style.width`, `style.height`, `style.stroke`, `style.strokeWidth`, `style.opacity`, `style.cursor`, `style.alignToPixelGrid`                                                                              | `style.src` required; `style.x = 0`, `style.y = 0`; omitted dimensions use loaded natural size, otherwise `0`; omitted pixel alignment preserves input                                                                    | Event/focus props                               |
| `Group`          | `style.scaleX`, `style.scaleY`, `style.rotationDegrees`, `style.rotationOrigin`, `style.translateX`, `style.translateY`, `style.skewX`, `style.skewY`                                                                                         | scales default `1`; rotation, translation, and skew default `0`; rotation origin defaults `[0, 0]`                                                                                                                        | Recursive `children`                            |
| `Clip`           | `style.d: Path2D`, `style.fillRule`                                                                                                                                                                                                           | `style.d` required; `style.fillRule = "nonzero"`                                                                                                                                                                          | Recursive `children`                            |
| `Layer`          | `style.width`, `style.height`                                                                                                                                                                                                                 | Each omitted dimension uses the current logical Canvas allocation                                                                                                                                                         | Recursive `children`                            |
| Layout values    | Container box fields plus the contract-specific algorithm fields                                                                                                                                                                              | See the layout contract's exact defaults                                                                                                                                                                                  | Recursive direct children                       |

There is no runtime compatibility adapter, alias, or fallback for top-level
visual fields, content in `TextStyle`, or a render element/descriptor prop for
layer content.
JavaScript receives the same strict resolution and child diagnostics as
TypeScript.

`opacity: 0` suppresses paint without removing separately registered target
geometry. Image generations remain keyed by `style.src`; source races,
load/error settlement, source replacement, removal, and disposal retain exact
resource ownership. Explicit image dimensions establish geometry before load
and after failure, while each omitted natural dimension remains zero until a
successful load supplies it. `Group` transforms retain the order documented in
the drawing contract.

## Deliberate exclusions

CRC does not implement cascade, inheritance, selectors, specificity,
stylesheets, CSS variables, computed DOM style, margin, scrolling, or a complete
CSS parser. CSS names are used only where behavior matches the documented
subset; CRC-native behavior uses names such as `rotationDegrees`, `fit`, and
`Flow`.

Filters do not accept raw CSS strings, `url()`/SVG filter graphs,
`backdrop-filter`, or `boxShadow`/CSS box-shadow semantics.

See the [layout contract](./layout-system-contract.md), [drawing
contract](./drawing-components-contract.md), and [custom primitive
guide](../site/learn/guides/custom-components-and-primitives.md).

## Rounded drawing style

`RoundedCornerStyle` is a closed reusable style capability for `Rectangle`,
`Polygon`, `RegularPolygon`, and `Star`:

```ts
interface RoundedCornerStyle {
  cornerRadius?: Exclude<Length, "auto">;
  cornerRadii?: readonly (Exclude<Length, "auto"> | null | undefined)[];
}
```

`cornerRadius` and each present `cornerRadii` entry resolve as nonnegative
finite numeric geometry. They use the smaller current width/height percentage
basis, matching circular radius behavior; `"auto"` is invalid. At index `i`,
`cornerRadii?.[i] ?? cornerRadius ?? 0` provides nullish fallback, so literal
zero is a deliberate sharp override. Arrays longer than the component's actual
corner count reject rather than silently truncate.

`RegularPolygonStyle` is a discriminated union: it requires `sides`, optional
`cx`, `cy`, and `rotation`, and exactly one of `circumradius`, `inradius`, or
`sideLength`. `StarStyle` requires `points`, `outerRadius`, and `innerRadius`.
Their centers and size/radius fields describe local drawing geometry, while
`BoxStyle` and `LayoutItemStyle` still describe allocation and placement. The
numeric creator option types deliberately do not accept `Length`, paint,
cursor, event, or layout fields.
