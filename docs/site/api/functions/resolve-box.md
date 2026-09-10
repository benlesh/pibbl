---
id: api-function-resolve-box
title: resolveBox
summary: Resolves a declared local box against finite constraints.
kind: api
slug: resolve-box
apiCategory: function
symbols: [resolveBox]
relatedTypes: [BoxStyle, Constraints, ResolvedBoxStyle]
---

# resolveBox

```ts
import { resolveBox, type Constraints } from "@crc/core";
```

`resolveBox(style, constraints, context?)` resolves public [`BoxStyle`](#/api/types/layout#boxstyle) into a
[`ResolvedBoxStyle`](#/api/types/layout#resolvedboxstyle) with border and content boxes. It applies min/max lengths,
padding, and finite constraint validation, and raises `LayoutDiagnostic` for
impossible or indefinite inputs.

```ts
const constraints: Constraints = {
  minWidth: 0,
  maxWidth: 320,
  minHeight: 0,
  maxHeight: 240,
};
const box = resolveBox({ width: "50%", padding: 12 }, constraints);
```

It accepts [`Constraints`](#/api/types/layout#constraints) and is a public layout helper, not a retained layout engine.
