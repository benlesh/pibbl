# Migrating to JSX-era authoring

CRC made an intentionally breaking authoring pivot before release. The old
factory-first values, wrapper, element aliases, focus enhancer functions, and
structural props were removed. There are no deprecated compatibility exports
or runtime aliases: migrate every construction site in one change.

## Authoring replacements

Every old form below has its current replacement on the same row.

| Removed form                                 | Current form                                                                      |
| -------------------------------------------- | --------------------------------------------------------------------------------- |
| `defineComp(function Card() {})`             | `function Card() {}`                                                              |
| `rect({ style })`                            | `<Rectangle style={style} />` or `createElement(Rectangle, { style })`            |
| `path({ style })`                            | `<Path style={style} />` or `createElement(Path, { style })`                      |
| `svgPath({ style })`                         | `<SvgPath style={style} />` or `createElement(SvgPath, { style })`                |
| `line({ style })`                            | `<Line style={style} />` or `createElement(Line, { style })`                      |
| `horizontalLine({ style })`                  | `<HorizontalLine style={style} />`                                                |
| `verticalLine({ style })`                    | `<VerticalLine style={style} />`                                                  |
| `text({ style: { text: value, ...style } })` | `<Text style={style}>{value}</Text>`                                              |
| `TextStyle.text`                             | `Text` children typed as `CRCTextChild`                                           |
| `img({ style })`                             | `<Image style={style} />`                                                         |
| `g({ style, children })`                     | `<Group style={style}>{children}</Group>`                                         |
| `clip({ style, children })`                  | `<Clip style={style}>{children}</Clip>`                                           |
| `layer({ style, render })`                   | `<Layer style={style}>{children}</Layer>`                                         |
| `absolute({ style, children })`              | `<Absolute style={style}>{children}</Absolute>`                                   |
| `overlay({ style, children })`               | `<Overlay style={style}>{children}</Overlay>`                                     |
| `flow({ style, children })`                  | `<Flow style={style}>{children}</Flow>`                                           |
| `flex({ style, children })`                  | `<Flex style={style}>{children}</Flex>`                                           |
| `grid({ style, children })`                  | `<Grid style={style}>{children}</Grid>`                                           |
| `withFocusManagement(scene)`                 | `<FocusManagement>{scene}</FocusManagement>`                                      |
| `withKeyboardNavigation(scene, options)`     | `<KeyboardNavigation {...options}>{scene}</KeyboardNavigation>`                   |
| `CompEl`                                     | `CRCElement`                                                                      |
| `CompFn`                                     | `CRCComponent` or `PrimitiveRender`                                               |
| `ComponentInput`                             | Component props or `PrimitiveInput`                                               |
| `ComponentCapabilities`                      | `PrimitiveCapabilities`                                                           |
| `FalsyNodes`                                 | `CRCEmptyNode`                                                                    |
| `RectProps`                                  | `RectangleProps`                                                                  |
| `ImgProps`                                   | `ImageProps`                                                                      |
| `GProps`                                     | `GroupProps`                                                                      |
| `CompRefs`                                   | No public structural replacement; use `CRCRef` for component-owned mutable values |
| callable component factory                   | JSX or `createElement(Component, props)`                                          |

Imported built-in values are now descriptive and uppercase. A direct call such
as the removed factory shape is not supported; platform values intentionally
throw when invoked outside the renderer.

## Field-level style and structure replacements

This is the complete field-level migration from the former top-level visual
and structural inputs to the final JSX-era API. Each removed value and its
replacement share one row; there is no runtime alias or fallback.

| Former component | Removed field/form     | Final replacement                             | Final behavior/default                                     |
| ---------------- | ---------------------- | --------------------------------------------- | ---------------------------------------------------------- |
| `rect`           | `x`                    | Removed                                      | Removed; use `left`                                  |
| `rect`           | `y`                    | Removed                                      | Removed; use `top`                                  |
| `rect`           | `width`                | `Rectangle` `style.width`                     | Required                                                   |
| `rect`           | `height`               | `Rectangle` `style.height`                    | Required                                                   |
| `rect`           | `fillStyle`            | `Rectangle` `style.fill`                      | Same fill value                                            |
| `rect`           | `strokeStyle`          | `Rectangle` `style.stroke`                    | Same stroke value                                          |
| `rect`           | `lineWidth`            | `Rectangle` `style.strokeWidth`               | Same stroke width                                          |
| `rect`           | `alpha`                | `Rectangle` `style.opacity`                   | Multiplies the current Canvas alpha                        |
| `rect`           | `cursor`               | `Rectangle` `style.cursor`                    | Same cursor value                                          |
| `rect`           | `alignToPixelGrid`     | `Rectangle` `style.alignToPixelGrid`          | Omission preserves exact input geometry                    |
| `path`           | `path`                 | `Path` `style.d`                              | Required `Path2D`                                          |
| `path`           | `fillStyle`            | `Path` `style.fill`                           | Same fill value                                            |
| `path`           | `strokeStyle`          | `Path` `style.stroke`                         | Same stroke value                                          |
| `path`           | `lineWidth`            | `Path` `style.strokeWidth`                    | Same stroke width                                          |
| `path`           | `alpha`                | `Path` `style.opacity`                        | Multiplies the current Canvas alpha                        |
| `path`           | `cursor`               | `Path` `style.cursor`                         | Same cursor value                                          |
| `path`           | `lineInteractionWidth` | `Path` `style.lineInteractionWidth`           | Defaults to `style.strokeWidth`, then `0`                  |
| `line`           | `coords`               | `Line` `style.coords`                         | Required ordered polyline coordinates                      |
| `line`           | `strokeStyle`          | `Line` `style.stroke`                         | Same stroke value                                          |
| `line`           | `lineWidth`            | `Line` `style.strokeWidth`                    | Same stroke width                                          |
| `line`           | `cursor`               | `Line` `style.cursor`                         | Same cursor value                                          |
| `line`           | `lineInteractionWidth` | `Line` `style.lineInteractionWidth`           | Defaults to `style.strokeWidth`, then `0`                  |
| `horizontalLine` | `y`                    | `HorizontalLine` `style.y`                    | Required                                                   |
| `horizontalLine` | `left`                 | `HorizontalLine` `style.x1`                   | Optional; defaults to `0`                                  |
| `horizontalLine` | `right`                | `HorizontalLine` `style.x2`                   | Optional; defaults to the allocation width                 |
| `horizontalLine` | `strokeStyle`          | `HorizontalLine` `style.stroke`               | Same stroke value                                          |
| `horizontalLine` | `lineWidth`            | `HorizontalLine` `style.strokeWidth`          | Same stroke width                                          |
| `horizontalLine` | `cursor`               | `HorizontalLine` `style.cursor`               | Same cursor value                                          |
| `horizontalLine` | `alignToPixelGrid`     | `HorizontalLine` `style.alignToPixelGrid`     | Omission preserves exact input geometry                    |
| `horizontalLine` | `lineInteractionWidth` | `HorizontalLine` `style.lineInteractionWidth` | Defaults to `style.strokeWidth`, then `0`                  |
| `verticalLine`   | `x`                    | `VerticalLine` `style.x`                      | Required                                                   |
| `verticalLine`   | `top`                  | `VerticalLine` `style.y1`                     | Optional; defaults to `0`                                  |
| `verticalLine`   | `bottom`               | `VerticalLine` `style.y2`                     | Optional; defaults to the allocation height                |
| `verticalLine`   | `strokeStyle`          | `VerticalLine` `style.stroke`                 | Same stroke value                                          |
| `verticalLine`   | `lineWidth`            | `VerticalLine` `style.strokeWidth`            | Same stroke width                                          |
| `verticalLine`   | `cursor`               | `VerticalLine` `style.cursor`                 | Same cursor value                                          |
| `verticalLine`   | `alignToPixelGrid`     | `VerticalLine` `style.alignToPixelGrid`       | Omission preserves exact input geometry                    |
| `verticalLine`   | `lineInteractionWidth` | `VerticalLine` `style.lineInteractionWidth`   | Defaults to `style.strokeWidth`, then `0`                  |
| `svgPath`        | `d`                    | `SvgPath` `style.d`                           | Required string path data                                  |
| `svgPath`        | `fillStyle`            | `SvgPath` `style.fill`                        | Same fill value                                            |
| `svgPath`        | `strokeStyle`          | `SvgPath` `style.stroke`                      | Same stroke value                                          |
| `svgPath`        | `lineWidth`            | `SvgPath` `style.strokeWidth`                 | Same stroke width                                          |
| `svgPath`        | `alpha`                | `SvgPath` `style.opacity`                     | Multiplies the current Canvas alpha                        |
| `svgPath`        | `cursor`               | `SvgPath` `style.cursor`                      | Same cursor value                                          |
| `text`           | `text`                 | `Text` recursive textual `children`           | Numeric zero remains visible; empty values add no content  |
| `text`           | `x`                    | Removed                                      | Removed; use `left`                                  |
| `text`           | `y`                    | Removed                                      | Removed; use `top`                                  |
| `text`           | `maxWidth`             | `Text` `style.width`                          | Optional text box width                                    |
| `text`           | `maxHeight`            | `Text` `style.height`                         | Optional text box height                                   |
| `text`           | `lineHeight`           | `Text` `style.lineHeight`                     | Defaults to `13`                                           |
| `text`           | `wordWrap`             | `Text` `style.wrap`                           | Defaults to `false`                                        |
| `text`           | `overflow`             | `Text` `style.fit`                            | Defaults to `"visible"`                                    |
| `text`           | `font`                 | `Text` `style.font`                           | Defaults to `"13px sans-serif"`                            |
| `text`           | `textBaseline`         | `Text` `style.textBaseline`                   | Defaults to `"top"`                                        |
| `text`           | `textAlign`            | `Text` `style.textAlign`                      | Defaults to `"left"`                                       |
| `text`           | `fillStyle`            | `Text` `style.fill`                           | Same fill value                                            |
| `text`           | `strokeStyle`          | `Text` `style.stroke`                         | Same stroke value                                          |
| `text`           | `lineWidth`            | `Text` `style.strokeWidth`                    | Defaults to `0` when omitted                               |
| `text`           | `alpha`                | `Text` `style.opacity`                        | Multiplies the current Canvas alpha                        |
| `text`           | `cursor`               | `Text` `style.cursor`                         | Same cursor value                                          |
| `img`            | `src`                  | `Image` `style.src`                           | Required                                                   |
| `img`            | `x`                    | Removed                                      | Removed; use `left`                                  |
| `img`            | `y`                    | Removed                                      | Removed; use `top`                                  |
| `img`            | `width`                | `Image` `style.width`                         | Omission uses loaded natural width, otherwise `0`          |
| `img`            | `height`               | `Image` `style.height`                        | Omission uses loaded natural height, otherwise `0`         |
| `img`            | `strokeStyle`          | `Image` `style.stroke`                        | Same border stroke value                                   |
| `img`            | `lineWidth`            | `Image` `style.strokeWidth`                   | Same border width                                          |
| `img`            | `alpha`                | `Image` `style.opacity`                       | Multiplies the current Canvas alpha                        |
| `img`            | `cursor`               | `Image` `style.cursor`                        | Same cursor value                                          |
| `img`            | `alignToPixelGrid`     | `Image` `style.alignToPixelGrid`              | Omission preserves exact input geometry                    |
| `g`              | `scaleX`               | `Group` `style.scaleX`                        | Defaults to `1`                                            |
| `g`              | `scaleY`               | `Group` `style.scaleY`                        | Defaults to `1`                                            |
| `g`              | `rotate`               | `Group` `style.rotationDegrees`               | Clockwise degrees; transform order is unchanged            |
| `g`              | `rotateOrigin`         | `Group` `style.rotationOrigin`                | Defaults to `[0, 0]`                                       |
| `g`              | `x`                    | `Group` `style.translateX`                    | Defaults to `0`                                            |
| `g`              | `y`                    | `Group` `style.translateY`                    | Defaults to `0`                                            |
| `g`              | `skewX`                | `Group` `style.skewX`                         | Defaults to `0`                                            |
| `g`              | `skewY`                | `Group` `style.skewY`                         | Defaults to `0`                                            |
| `g`              | structural `children`  | `Group` recursive `children`                  | Transform order remains scale, rotation, translation, skew |
| `clip`           | `path`                 | `Clip` `style.d`                              | Required `Path2D`                                          |
| `clip`           | `fillRule`             | `Clip` `style.fillRule`                       | Defaults to `"nonzero"`                                    |
| `clip`           | structural `children`  | `Clip` recursive `children`                   | Children retain source order                               |
| `layer`          | `width`                | `Layer` `style.width`                         | Omission uses the current logical Canvas allocation        |
| `layer`          | `height`               | `Layer` `style.height`                        | Omission uses the current logical Canvas allocation        |
| `layer`          | structural `render`    | `Layer` recursive `children`                  | render element/descriptor prop removed; children retained  |

## Current component definitions

```tsx
function Card({ active, style }: CardProps) {
  return <Rectangle style={{ ...style, fill: active ? "gold" : "navy" }} />;
}
```

Ordinary composites receive one props object. If a layout parent allocates the
component, keep its specified style in props and read the finite local result
with `useLayoutBox()`. For custom immediate painting, use
`useCanvasContext()`. Reserve `definePrimitive()` for platform-level
normalization, resolution, and pure measurement.

## Text and children

Move legacy style-owned content to recursive textual children:

```tsx
<Text style={{ x: 20, y: 20 }}>Count: {count}</Text>
```

`Layer` no longer takes a render element/descriptor prop. All structural
containers take ordinary recursive children. Arrays, finite synchronous
iterables, conditionals, and fragments flatten predictably. Non-empty raw text
or nonzero numbers are invalid outside `Text`; zero remains visible inside
`Text`.

Use `key` on repeated siblings. Unkeyed fragments and arrays are transparent;
an explicit `<Fragment key={id}>` creates a descendant identity scope.

## Compiler configuration

Set the automatic runtime:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@crc/core"
  }
}
```

Or place `/** @jsxImportSource @crc/core */` before imports in an individual
CRC file. CRC publishes `@crc/core/jsx-runtime` and
`@crc/core/jsx-dev-runtime`; do not import compiler constructors from the root.
The package does not depend on React.

One file has one JSX runtime. Split mixed React and CRC JSX into separate files
or keep the dominant runtime's JSX and construct the minority CRC tree with
`createElement as createCRCElement`.

## Non-JSX migration

Projects that do not want JSX still migrate to the same final values:

```ts
createElement(
  Group,
  null,
  createElement(Rectangle, { style: { width: 200, height: 100 } }),
  createElement(Text, { style: { x: 20, y: 20 } }, "CRC"),
);
```

The exact signature is `createElement(type, props, ...children)`. It replaces
all direct factory calls and is not a compatibility shim. See the standalone
[non-JSX guide](../site/learn/guides/author-without-jsx.md).

## Verification checklist

1. Remove every obsolete root import and direct component call.
2. Rename built-ins to the descriptive values above.
3. Convert ordinary component definitions to plain synchronous functions.
4. Move text to `Text` children and layer content to `Layer` children.
5. Convert focus enhancers to transparent policy elements.
6. Configure exactly one automatic JSX runtime per file, or use
   `createElement` throughout a non-JSX file.
7. Keep visual/layout values under explicit local `style`.
8. Run typecheck, package-consumer, scenario, documentation, and browser gates.

Historical plans and dated field notes retain the old vocabulary as evidence
of what existed when they were written. They are not current API guidance.
