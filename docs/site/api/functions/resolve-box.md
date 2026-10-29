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
import { resolveBox, type Constraints } from "@pibbl/core";
```

`resolveBox(style, constraints, context?)` resolves public [`BoxStyle`](#/api/types/layout#boxstyle) into a
[`ResolvedBoxStyle`](#/api/types/layout#resolvedboxstyle) with border and content boxes. It applies min/max lengths,
the `boxSizing` policy, padding, and finite constraint validation, and raises `LayoutDiagnostic` for
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

`boxSizing: "content-box"` is the default. With `"border-box"`, dimensions and
bounds include padding and layout borders; percentages resolve before the insets are subtracted.
For example, width100/height30/padding10 yields an outer100×30 box and content80×10.
Content never becomes negative: width8 with padding10 yields outer20/content0 on
that axis, even when a declared maximum or parent bound is smaller. Opposing
min/max values remain errors. Painted stroke widths are independent of this box.

`style.borderWidth` reserves finite nonnegative layout insets, using a number or
physical `{ top, right, bottom, left }` edges. It defaults to zero and does not
paint. Padding and borders combine once: content-box40×30 with padding10 and
borderWidth2 occupies64×54; border-box64×54 preserves40×30 content.
`strokeWidth` remains independent paint. Percentage/logical border aliases are
not supported. Layer raster sizing retains its separate width/height policy.
