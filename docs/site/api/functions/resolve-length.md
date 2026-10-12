---
id: api-function-resolve-length
title: resolveLength
summary: Resolves a numeric, percentage, or auto public length.
kind: api
slug: resolve-length
apiCategory: function
symbols: [resolveLength]
relatedTypes: [Length]
---

# resolveLength

```ts
import { resolveLength } from "@pibbl/core";
```

`resolveLength(value, reference, property, context?)` resolves a public [`Length`](#/api/types/layout#length) and returns a finite logical
number or `undefined` for `"auto"`. Numeric values must be finite; percentages
need a definite nonnegative reference. Invalid input produces a contextual
`LayoutDiagnostic`.

```ts
const width = resolveLength("50%", 320, "width"); // 160
```

See [Style and draw](#/learn/guides/style-and-draw) for local style usage.
