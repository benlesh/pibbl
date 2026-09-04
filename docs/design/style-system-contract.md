# CRC style-system contract

Status: current implemented contract, updated for JSX-era authoring on
2026-09-03.

CRC has one typed, local, closed `style` prop. Geometry, paint, cursor,
transforms, clipping, image source, text layout, and layout participation live
there. Application data, handlers, and structural children are separate props;
text content belongs in `Text` children; `key` is element metadata.

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

`SystemStyle` contains only optional `custom`. Shared closed mixins include
`BoxStyle`, `LayoutItemStyle`, `FlexItemStyle`, `GridItemStyle`, `PaintStyle`,
and `CursorStyle`. Built-ins expose their supported intersections through
`RectStyle`, `PathStyle`, `SvgPathStyle`, `LineStyle`, `TextStyle`, `ImgStyle`,
`GStyle`, `ClipStyle`, `LayerStyle`, and layout styles. Unsupported members are
type errors.

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

| Component                        | Required/local style                                                       | Structural/program props                        |
| -------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------- |
| `Rectangle`                      | `width`, `height`; optional local geometry, paint, cursor, pixel alignment | Event/focus handlers/options                    |
| `Path`                           | `d: Path2D`; paint/cursor/interaction width                                | Event/focus props                               |
| `Line`                           | `coords`; stroke/opacity/cursor                                            | Event/focus props                               |
| `HorizontalLine`, `VerticalLine` | axis position, optional endpoints, shared line style                       | Event/focus props                               |
| `SvgPath`                        | `d: string`; paint/cursor/interaction width                                | Event/focus props                               |
| `Text`                           | position, box, font, paint, wrap, fit                                      | recursive textual `children`, event/focus props |
| `Image`                          | `src`; geometry, border, opacity, cursor                                   | event/focus props                               |
| `Group`                          | transform                                                                  | recursive `children`                            |
| `Clip`                           | `d`, optional fill rule                                                    | recursive `children`                            |
| `Layer`                          | optional dimensions/layout participation                                   | recursive `children`                            |
| Layout values                    | container box plus algorithm options                                       | recursive direct children                       |

There is no runtime compatibility adapter, alias, or fallback for top-level
visual fields, content in `TextStyle`, or callback-owned layer content.
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
stylesheets, CSS variables, computed DOM style, margin, scrolling, or a
complete CSS parser. CSS names are used only where behavior matches the
documented subset; CRC-native behavior uses names such as `rotationDegrees`,
`fit`, and `Flow`.

See the [layout contract](./layout-system-contract.md), [drawing
contract](./drawing-components-contract.md), and [custom primitive
guide](../guides/custom-components-and-primitives.md).
