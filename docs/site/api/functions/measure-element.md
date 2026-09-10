---
id: api-function-measure-element
title: measureElement
summary: Purely asks an opt-in primitive for a constrained measurement.
kind: api
slug: measure-element
apiCategory: function
symbols: [measureElement]
relatedTypes: [CanvasMeasurementService, Constraints, MeasureResult]
---

# measureElement

```ts
import {
  createElement,
  measureElement,
  Rectangle,
  type CanvasMeasurementService,
  type Constraints,
} from "@crc/core";
```

`measureElement(element, constraints, service)` measures one element through
its opt-in primitive capability. It is pure: it cannot render or acquire
runtime resources. Components without a measure capability return an
`unsupported` result, and cyclic measurement dependencies are rejected.

```ts
const element = createElement(Rectangle, {
  style: { width: 120, height: 60, fill: "#2563eb" },
});
const constraints: Constraints = {
  minWidth: 0,
  maxWidth: 240,
  minHeight: 0,
  maxHeight: 120,
};
const measurementService: CanvasMeasurementService = {
  measureText: () => ({}) as TextMetrics,
};
const result = measureElement(element, constraints, measurementService);
```

[`Constraints`](#/api/types/layout#constraints) and a [`CanvasMeasurementService`](#/api/types/layout#canvasmeasurementservice) describe the call; its result is a [`MeasureResult`](#/api/types/layout#measureresult). Use declared boxes for ordinary layout rather than assuming visual primitives
have intrinsic dimensions.
