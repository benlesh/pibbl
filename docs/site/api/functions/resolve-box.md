---
id: api-function-resolve-box
title: resolveBox
summary: Resolves a declared local box against finite constraints.
kind: api
slug: resolve-box
apiCategory: function
symbols: [resolveBox]
---

# resolveBox

```ts
import { resolveBox } from "@crc/core";
```

`resolveBox(style, constraints, context?)` resolves public `BoxStyle` into a
`ResolvedBoxStyle` with border and content boxes. It applies min/max lengths,
padding, and finite constraint validation, and raises `LayoutDiagnostic` for
impossible or indefinite inputs.

```ts
const box = resolveBox({ width: "50%", padding: 12 }, constraints);
```

It is a public layout helper, not a retained layout engine.
