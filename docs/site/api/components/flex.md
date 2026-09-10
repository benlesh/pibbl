---
id: api-component-flex
title: Flex
summary: Arranges direct children with CRC's explicit Flexbox subset.
kind: api
slug: flex
apiCategory: component
symbols: [Flex]
---

# Flex

```ts
import { Flex, Rectangle } from "@crc/core";
```

`Flex` uses `FlexProps` and `FlexStyle`; direct children can supply
`FlexItemStyle`. It accepts recursive `CRCNode` children and resolves finite
allocations before rendering. Reverse ordering, advanced intrinsic sizing,
margins, and scrolling are outside the supported subset.

```tsx
<Flex style={{ width: 300, height: 80, flexDirection: "row", gap: 12 }}>
  <Rectangle style={{ width: 80, height: 60, fill: "#2563eb" }} />
  <Rectangle style={{ width: 80, height: 60, fill: "#f59e0b" }} />
</Flex>
```

Explore the [Flex live example](#/examples/layout/flex).
