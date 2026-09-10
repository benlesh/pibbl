---
id: api-function-normalize-edges
title: normalizeEdges
summary: Normalizes public edge shorthand to finite top/right/bottom/left values.
kind: api
slug: normalize-edges
apiCategory: function
symbols: [normalizeEdges]
relatedTypes: [Edges, EdgeValues]
---

# normalizeEdges

```ts
import { normalizeEdges } from "@crc/core";
```

`normalizeEdges(value, property, context?)` converts an [`EdgeValues`](#/api/types/layout#edgevalues) shorthand
into [`Edges`](#/api/types/layout#edges). A number applies to all four edges; omitted values become zero.
Every edge must be finite and nonnegative, otherwise a `LayoutDiagnostic`
identifies the source property and context.

```ts
const padding = normalizeEdges({ top: 8, left: 12 }, "padding");
```

The accepted types are documented under Layout and styles.
