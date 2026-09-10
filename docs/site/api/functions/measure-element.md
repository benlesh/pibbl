---
id: api-function-measure-element
title: measureElement
summary: Purely asks an opt-in primitive for a constrained measurement.
kind: api
slug: measure-element
apiCategory: function
symbols: [measureElement]
---

# measureElement

```ts
import { measureElement } from "@crc/core";
```

`measureElement(element, constraints, service)` measures one element through
its opt-in primitive capability. It is pure: it cannot render or acquire
runtime resources. Components without a measure capability return an
`unsupported` result, and cyclic measurement dependencies are rejected.

```ts
const result = measureElement(element, constraints, measurementService);
```

Use declared boxes for ordinary layout rather than assuming visual primitives
have intrinsic dimensions.
