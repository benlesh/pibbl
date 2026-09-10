---
id: api-function-layout-diagnostic
title: LayoutDiagnostic and layoutDiagnostic
summary: Creates contextual errors for invalid style, geometry, and layout values.
kind: api
slug: layout-diagnostic
apiCategory: function
symbols: [LayoutDiagnostic, layoutDiagnostic]
---

# LayoutDiagnostic and layoutDiagnostic

```ts
import { LayoutDiagnostic, layoutDiagnostic } from "@crc/core";
```

`LayoutDiagnostic` is the runtime error class for contextual layout failures.
`layoutDiagnostic(input)` constructs the same error. Both expose component,
property, supplied value, algorithm, and optional constraints, preserving a
useful diagnostic when public geometry or style validation fails.

```ts
throw layoutDiagnostic({
  property: "width",
  value: -1,
  reason: "must be nonnegative",
});
```

Its input/context types belong to the Layout type reference.
