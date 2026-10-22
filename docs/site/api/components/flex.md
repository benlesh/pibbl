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
<Flex style={{ width: 300, height: 80, flexDirection: "row", gap: 12 }}>
  <Rectangle style={{ width: 80, height: 60, fill: "#2563eb" }} />
  <Rectangle style={{ width: 80, height: 60, fill: "#f59e0b" }} />
</Flex>
```

Explore the [Flex live example](#/examples/layout/flex).

The experimental `layout-wasm` Studio build additionally supports finite numeric
physical margins in nowrap rows and columns. `margin` sets all four edges;
`marginTop`, `marginRight`, `marginBottom` and `marginLeft` override individual
edges. Values use logical Canvas units and may be negative. Margins stay outside
paint and hit bounds. Normal JavaScript Flex, wrapped experimental Flex and other
layout families currently reject these fields. Percentage, auto and logical
margins remain unsupported.

```tsx
<Flex style={{ width: 100, height: 30 }}>
  <Rectangle style={{ width: 80, height: 20, margin: 5, fill: "#2563eb" }} />
  <Rectangle style={{ width: 80, height: 20, margin: 5, fill: "#f59e0b" }} />
</Flex>
```

In that experimental build each painted box is 40 units wide, with a 5-unit
outer margin on each side. See the [experimental public example](#/examples/layout/wasm-flex-text)
and choose Compare Text minimum; the lower right boxes toggle a negative margin.
