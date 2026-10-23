---
id: api-function-define-primitive
title: definePrimitive
summary: Defines a capability-bearing Pibbl platform component.
kind: api
slug: define-primitive
apiCategory: function
symbols: [definePrimitive]
relatedTypes: [Canvas, PrimitiveCapabilities, PrimitiveRender]
---

# definePrimitive

```ts
import { definePrimitive } from "@pibbl/core";
```

`definePrimitive(render, capabilities?)` creates a Pibbl primitive component from a [`PrimitiveRender`](#/api/types/styles#primitiverender) callback and optional [`PrimitiveCapabilities`](#/api/types/styles#primitivecapabilities),
with private style normalization, resolution, and optional measurement
capabilities. Use it for component-library primitives, not ordinary application
components: invoking its returned component outside the Pibbl renderer throws.

```ts
const Dot = definePrimitive(function renderDot(props) {
  // paint with the active Pibbl Canvas context
});
```

The exact generic contracts are in the Elements and components type reference;
primitive painting receives Pibbl's active [`Canvas`](#/api/types/canvas-runtime#canvas) context.
See [Custom components and primitives](#/learn/guides/custom-components-and-primitives).

The experimental `measureIntrinsic` capability returns both intrinsic content
sizes through [IntrinsicSizesResult](#/api/types/layout#intrinsicsizesresult).
Its first consumer is a direct custom primitive in a finite nowrap Flex row.
Ordinary `measure` remains unchanged. Providers are pure and use the existing
receiver dependency and teardown transaction. Mutable nested inputs and changes
to the provider's own style conservatively remeasure; unrelated sibling paint
can reuse a successful snapshot.
