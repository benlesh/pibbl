---
id: api-component-flex
title: Flex
summary: Arranges direct children with CRC's explicit Flexbox subset.
kind: api
slug: flex
apiCategory: component
symbols: [Flex]
relatedTypes: [CRCNode, FlexItemStyle, FlexProps, FlexStyle]
---

# Flex

```ts
import { Flex, Rectangle } from "@crc/core";
```

`Flex` uses [`FlexProps`](#/api/types/layout#flexprops) and [`FlexStyle`](#/api/types/layout#flexstyle); direct children can supply
[`FlexItemStyle`](#/api/types/layout#flexitemstyle). It accepts recursive [`CRCNode`](#/api/types/elements-components#crcnode) children and resolves finite
allocations before rendering. Reverse ordering, advanced intrinsic sizing,
margins, and scrolling are outside the supported subset.

```tsx
<Flex style={{ width: 300, height: 80, flexDirection: "row", gap: 12 }}>
  <Rectangle style={{ width: 80, height: 60, fill: "#2563eb" }} />
  <Rectangle style={{ width: 80, height: 60, fill: "#f59e0b" }} />
</Flex>
```

Explore the [Flex live example](#/examples/layout/flex).
