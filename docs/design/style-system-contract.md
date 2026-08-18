# CRC style-system contract

Status: implemented by Project Plan 003 on 2026-08-18.

CRC components have one typed, local `style` object for values that affect
geometry, paint, clipping, transforms, image source, text content, or layout.
Program props are reserved for event handlers and component-specific data that
does not describe the rendered result. `key` remains descriptor metadata.

This is a CSS-familiar vocabulary, not CSS itself. Styles do not cascade and
never inherit. There are no selectors, stylesheets, specificity rules, computed
DOM styles, or ambient parent styles. Reuse is ordinary JavaScript composition:
share a style object or helper and spread it into another local style.

```ts
const card = { fill: "#17324d", stroke: "#8dd8ff", strokeWidth: 2 };

rect({
  style: { ...card, x: 16, y: 16, width: 180, height: 80 },
  onClick: () => console.log("card"),
});
```

## Public style model

`SystemStyle` contains only the optional `custom` escape hatch. Box,
layout-item, paint, and cursor vocabulary lives in separate exported mixins;
each built-in explicitly combines the mixins it supports into a closed style
such as `RectStyle`, `TextStyle`, or `GStyle`. Unsupported members are type
errors. Custom components created with `defineComp` may define separate
specified, normalized, and resolved style types. A resolved style passed to a
render callback must contain only finite geometry: allocation-dependent
`Percentage` or `"auto"` values require an explicit resolver.

`style.custom` is the escape hatch for application-owned metadata. CRC does not
interpret or inherit it. Arbitrary top-level style keys are not a custom-data
escape hatch.

The style pipeline is:

1. specified style supplied by the caller;
2. optional pure normalization for defaults and syntax;
3. allocation-aware resolution to finite component input;
4. synchronous rendering under the component's local allocation.

Normalization and resolution do not render children or acquire runtime
resources. Unresolved percentages, unresolved `auto`, non-finite numeric
geometry, and malformed allocation syntax are rejected before a render callback
runs. Diagnostics name the component, property, value, algorithm, and relevant
constraints.

## Length and box rules

`Length` is a finite number, an exact decimal percentage string, or `"auto"`.
Examples of valid percentage syntax are `"50%"`, `".5%"`, and `"-10%"` where
the receiving property permits a signed value. Scientific notation, suffixes,
whitespace, malformed strings, and arithmetic that would resolve to a
non-finite result are rejected.

- Percentages for sizes and parent-placement offsets resolve against the
  containing content allocation exactly once. At the root, that allocation is
  the Canvas's intrinsic width and height.
- Padding and gaps are finite nonnegative numbers, never percentages.
- Allocation sizes, minimums, maximums, padding, gaps, and growth factors are
  nonnegative. A minimum greater than its maximum is an error.
- `width` and `height` describe the content box. Min/max clamp the content size
  before numeric padding is added. Padding that consumes the available box
  leaves a zero-sized content box rather than a negative one.
- Margin is not implemented. Parent placement uses `left` and `top`; primitive
  local geometry uses `x` and `y` (and `x1`/`x2` or `y1`/`y2` for line helpers).
- Primitive Canvas geometry keeps Canvas semantics, including signed rectangle
  and image dimensions where that component supports them. That is distinct
  from nonnegative layout allocation.

`"auto"` is meaningful only where a component or layout algorithm documents a
measurement path. Local `x` and `y`, parent `left` and `top`, and Grid track
syntax do not accept it.

## Style-only built-in migration

There is no runtime compatibility adapter, alias, or fallback for the former
visual props. JavaScript callers receive the same strict runtime boundary as
TypeScript callers. This is the complete before/after migration; fields not
listed as props after migration belong in `style`:

| Component        | Before: top-level visual props                                                                                                            | After: local style                                                                                                              | Renames and semantic changes                                                                                                                |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `rect`           | `x`, `y`, `width`, `height`, `fillStyle`, `strokeStyle`, `lineWidth`, `alpha`, `cursor`, `alignToPixelGrid`                               | `x?`, `y?`, `width`, `height`, `fill`, `stroke`, `strokeWidth`, `opacity`, `cursor`, `alignToPixelGrid`, `lineInteractionWidth` | `fillStyle` → `fill`; `strokeStyle` → `stroke`; `lineWidth` → `strokeWidth`; `alpha` → `opacity`; `x`/`y` are optional and default to zero. |
| `path`           | `path`, `fillStyle`, `strokeStyle`, `lineWidth`, `alpha`, `cursor`, `lineInteractionWidth`                                                | `d`, `fill`, `stroke`, `strokeWidth`, `opacity`, `cursor`, `lineInteractionWidth`                                               | `path` → `d`, plus the shared paint renames.                                                                                                |
| `line`           | `coords`, `strokeStyle`, `lineWidth`, `cursor`, `lineInteractionWidth`                                                                    | `coords`, `stroke`, `strokeWidth`, `opacity`, `cursor`, `lineInteractionWidth`                                                  | Shared stroke renames; `opacity` is now supported by the common paint language.                                                             |
| `horizontalLine` | `y`, `left?`, `right?`, `strokeStyle`, `lineWidth`, `cursor`, `alignToPixelGrid`, `lineInteractionWidth`                                  | `y`, `x1?`, `x2?`, `stroke`, `strokeWidth`, `opacity`, `cursor`, `alignToPixelGrid`, `lineInteractionWidth`                     | `left` → `x1` (default zero); `right` → `x2` (default allocation width); shared paint renames.                                              |
| `verticalLine`   | `x`, `top?`, `bottom?`, `strokeStyle`, `lineWidth`, `cursor`, `alignToPixelGrid`, `lineInteractionWidth`                                  | `x`, `y1?`, `y2?`, `stroke`, `strokeWidth`, `opacity`, `cursor`, `alignToPixelGrid`, `lineInteractionWidth`                     | `top` → `y1` (default zero); `bottom` → `y2` (default allocation height); shared paint renames.                                             |
| `svgPath`        | `d`, `fillStyle`, `strokeStyle`, `lineWidth`, `alpha`, `cursor`                                                                           | `d`, `fill`, `stroke`, `strokeWidth`, `opacity`, `cursor`, `lineInteractionWidth`                                               | String path data keeps `d`; shared paint renames.                                                                                           |
| `text`           | `text`, `x`, `y`, `maxWidth`, `maxHeight`, `lineHeight`, `wordWrap`, `overflow`, `font`, `textBaseline`, `textAlign`, paint/cursor fields | `text`, `x?`, `y?`, `width?`, `height?`, `lineHeight`, `wrap`, `fit`, `font`, `textBaseline`, `textAlign`, paint/cursor fields  | `maxWidth`/`maxHeight` → `width`/`height`; `wordWrap` → `wrap`; `overflow` → `fit`; shared paint renames; `x`/`y` default to zero.          |
| `img`            | `src`, `x`, `y`, `width?`, `height?`, `strokeStyle`, `lineWidth`, `alpha`, `cursor`, `alignToPixelGrid`                                   | `src`, `x?`, `y?`, `width?`, `height?`, `stroke`, `strokeWidth`, `opacity`, `cursor`, `alignToPixelGrid`                        | Shared paint renames; `x`/`y` default to zero; omitted dimensions remain natural-size and unavailable until load.                           |
| `g`              | `scaleX`, `scaleY`, `rotate`, `rotateOrigin`, `x`, `y`, `skewX`, `skewY`, plus structural `children`                                      | `scaleX`, `scaleY`, `rotationDegrees`, `rotationOrigin`, `translateX`, `translateY`, `skewX`, `skewY`; prop `children`          | `rotate` → `rotationDegrees`; `rotateOrigin` → `rotationOrigin`; `x`/`y` → `translateX`/`translateY`; transform order is unchanged.         |
| `clip`           | `path`, `fillRule`, plus structural `children`                                                                                            | `d`, `fillRule`; prop `children`                                                                                                | `path` → `d`; structural children remain props.                                                                                             |
| `layer`          | `width?`, `height?`, plus structural `render`                                                                                             | `width?`, `height?`; prop `render`                                                                                              | Dimensions move to style; the rendered descriptor remains a structural prop.                                                                |

Program props on these components are now handlers and structural values only:
`g` and `clip` receive `children`, while `layer` receives its `render` callback.

```ts
rect({ style: { x: 4, y: 5, width: 80, height: 30, fill: "navy" } });
path({ style: { d: new Path2D("M0 0h20v20z"), fill: "gold" } });
line({
  style: {
    coords: [
      [0, 0],
      [20, 10],
    ],
    stroke: "white",
  },
});
horizontalLine({ style: { y: 8, x1: 2, x2: 24, stroke: "white" } });
verticalLine({ style: { x: 8, y1: 2, y2: 24, stroke: "white" } });
svgPath({ style: { d: "M0 0h20v20z", fill: "tomato" } });
text({ style: { text: "CRC", x: 8, y: 24, font: "18px sans-serif" } });
img({ style: { src: "/mark.png", x: 8, y: 8, width: 32, height: 32 } });
g({ style: { translateX: 12, rotationDegrees: 10 }, children: [] });
clip({ style: { d: new Path2D("M0 0h40v40z") }, children: [] });
layer({ style: { width: 120, height: 80 }, render: () => [] });
```

`opacity: 0` suppresses paint but does not remove geometry that otherwise owns
an interaction region. Image source generations remain keyed by `style.src`;
source races, load/error settlement, removal, and disposal retain exact resource
ownership. Explicit image dimensions establish geometry before load and after
failure, while omitted natural dimensions remain zero until a successful load.

## Deliberate exclusions

CRC does not implement the cascade, inheritance, selectors, specificity,
stylesheets, CSS variables, media/container queries, margin, DOM computed style,
or runtime legacy aliases. CSS vocabulary is used where behavior is compatible;
CRC-native behavior uses distinct names such as `rotationDegrees`, `fit`, and
`Flow`.

See the [layout contract](./layout-system-contract.md),
[drawing contract](./drawing-components-contract.md), and
[runtime/hooks contract](./runtime-hooks-contract.md) for the consuming
algorithms and lifecycle boundaries.
