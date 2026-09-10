---
id: api-function-define-primitive
title: definePrimitive
summary: Defines a capability-bearing CRC platform component.
kind: api
slug: define-primitive
apiCategory: function
symbols: [definePrimitive]
relatedTypes: [Canvas, PrimitiveCapabilities, PrimitiveRender]
---

# definePrimitive

```ts
import { definePrimitive } from "@crc/core";
```

`definePrimitive(render, capabilities?)` creates a CRC primitive component from a [`PrimitiveRender`](#/api/types/styles#primitiverender) callback and optional [`PrimitiveCapabilities`](#/api/types/styles#primitivecapabilities),
with private style normalization, resolution, and optional measurement
capabilities. Use it for component-library primitives, not ordinary application
components: invoking its returned component outside the CRC renderer throws.

```ts
const Dot = definePrimitive(function renderDot(props) {
  // paint with the active CRC Canvas context
});
```

The exact generic contracts are in the Elements and components type reference;
primitive painting receives CRC's active [`Canvas`](#/api/types/canvas-runtime#canvas) context.
See [Custom components and primitives](#/learn/guides/custom-components-and-primitives).
