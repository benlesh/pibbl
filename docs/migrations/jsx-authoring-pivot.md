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

## Current component definitions

```tsx
function Card({ active, style }: CardProps) {
  return <Rectangle style={{ ...style, fill: active ? "gold" : "navy" }} />;
}
```

Ordinary composites receive one props object. If a layout parent allocates the
component, keep its specified style in props and read the finite local result
with `crcLayoutBox()`. For custom immediate painting, use
`crcCanvasContext()`. Reserve `definePrimitive()` for platform-level
normalization, resolution, and pure measurement.

## Text and children

Move legacy style-owned content to recursive textual children:

```tsx
<Text style={{ x: 20, y: 20 }}>Count: {count}</Text>
```

`Layer` no longer takes a render callback. All structural containers take
ordinary recursive children. Arrays, finite synchronous iterables, conditionals,
and fragments flatten predictably. Non-empty raw text or nonzero numbers are
invalid outside `Text`; zero remains visible inside `Text`.

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
[non-JSX guide](../guides/without-jsx.md).

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
