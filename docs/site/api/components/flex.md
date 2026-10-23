---
id: api-component-flex
title: Flex
summary: Arranges direct children with Pibbl's explicit Flexbox subset.
kind: api
slug: flex
apiCategory: component
symbols: [Flex]
relatedTypes: [PibblNode, FlexItemStyle, FlexProps, FlexStyle]
---

# Flex

```ts
import { Flex, Rectangle } from "@pibbl/core";
```

`Flex` uses [`FlexProps`](#/api/types/layout#flexprops) and [`FlexStyle`](#/api/types/layout#flexstyle); direct children can supply
[`FlexItemStyle`](#/api/types/layout#flexitemstyle). It accepts recursive [`PibblNode`](#/api/types/elements-components#pibblnode) children and resolves finite
allocations before rendering. Reverse ordering, advanced intrinsic sizing,
scrolling are outside the normal supported subset.

```tsx
const basicFlex = (
  <Flex style={{ width: 300, height: 80, flexDirection: "row", gap: 12 }}>
    <Rectangle style={{ width: 80, height: 60, fill: "#2563eb" }} />
    <Rectangle style={{ width: 80, height: 60, fill: "#f59e0b" }} />
  </Flex>
);
```

Explore the [Flex live example](#/examples/layout/flex).

The experimental `layout-wasm` Studio build additionally supports finite numeric
physical margins in finite rows and columns, with nowrap or wrap. `margin` sets all four edges;
`marginTop`, `marginRight`, `marginBottom` and `marginLeft` override individual
edges. Values use logical Canvas units and may be negative. Margins stay outside
paint and hit bounds. Normal JavaScript Flex and other layout families currently reject these fields. Percentage, auto and logical
margins remain unsupported.

```tsx
const marginFlex = (
  <Flex style={{ width: 100, height: 30 }}>
    <Rectangle style={{ width: 80, height: 20, margin: 5, fill: "#2563eb" }} />
    <Rectangle style={{ width: 80, height: 20, margin: 5, fill: "#f59e0b" }} />
  </Flex>
);
```

In that experimental build each painted box is 40 units wide, with a 5-unit
outer margin on each side. See the [experimental public example](#/examples/layout/wasm-flex-text)
and choose Compare Text minimum; the lower right boxes toggle a negative margin and wrapping.

The same experimental build accepts `flexDirection: "row-reverse"` and
`"column-reverse"`, including finite wrapping. Main-axis placement reverses within
each line; source keys, paint/hit priority and tab order stay unchanged. Cross-line
stacking stays forward. `flex-start` and `flex-end` follow the selected main direction.
The experimental build also accepts `flexWrap: "wrap-reverse"`, including reversed
main axes. It reverses cross lines and cross start/end alignment while preserving
source order. Normal JavaScript Flex and RTL remain outside this experimental slice.
Use [Flip axes in the keyed collection example](#/examples/layout/wasm-flex-keyed-wrap)
to compare placement with its separate Reverse order control. Click either collection heading to flip cross lines.

`justifyContent`, `alignItems`, `alignContent`, and child `alignSelf` also accept
`"start"` and `"end"`. In current LTR layout these stay at left/top and
right/bottom respectively, including reversed axes and cross lines. In contrast,
`"flex-start"` and `"flex-end"` follow the selected Flex direction. Forward axes
accept these values in both builds. The keyed collection example's Cross edge
control demonstrates the distinction while cross lines are reversed.

When content overflows, `space-around` and `space-evenly` use physical LTR start,
including reversed axes and lines. Explicit `center` still centers overflow;
`space-between` falls back to direction-relative `flex-start`. This corrects the
former centered overflow for around/evenly in both JavaScript and experimental
WASM layout. The [comparison example](#/examples/layout/wasm-yoga-migration)
labels native Yoga's differing reversed-overflow results.

Finite Flex items also accept a positive finite `aspectRatio` (outer width / height).
Supply a definite main dimension or `flexBasis`. Each wrapped line solves its main
allocations first, then derives cross sizes; cross bounds may break the ratio.
Intrinsic main inference remains unsupported.

```tsx
const wrappedRatioFlex = (
  <Flex
    style={{
      width: 200,
      height: 200,
      flexWrap: "wrap",
      columnGap: 12,
      rowGap: 10,
      alignItems: "flex-start",
      alignContent: "flex-start",
    }}
  >
    {["A", "B", "C"].map((key) => (
      <Rectangle
        key={key}
        style={{
          width: 80,
          height: "auto",
          flexBasis: 80,
          flexGrow: 1,
          flexShrink: 0,
          minWidth: 0,
          aspectRatio: 2,
          fill: "#2563eb",
        }}
      />
    ))}
  </Flex>
);
```

In the experimental build, the first line has two94×47 boxes and the second has
one200×100 box. In the [comparison example](#/examples/layout/wasm-yoga-migration),
click Next section twice, then Next case + resize to inspect owner resizing and
row/column reversed wrapping with the same public style.

Experimental intrinsic measurement also accepts percentage child `width`,
`minWidth` and `maxWidth` in a nowrap column with an explicit numeric content
width. The measured child must be known Text, Flow, Grid, or a known nowrap
column. Percentages use the settled owner content width; border-box conversion
then subtracts the child's insets once. Percentage main sizes and indefinite or
percentage-dependent owners remain unsupported. In the
[nested-column example](#/examples/layout/wasm-flex-nested-intrinsic), toggle
50% paragraph cap and Toggle width; the following box and its click target move
together.
