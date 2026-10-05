---
id: api-component-manipulation-frame
title: ManipulationFrame
summary: Binds one manipulation controller to a positioned subtree.
kind: api
slug: manipulation-frame
apiCategory: component
symbols: [ManipulationFrame]
relatedTypes: [PibblManipulationController, PibblManipulationFrameProps]
---

# ManipulationFrame

```ts
import {
  ManipulationFrame,
  Rectangle,
  useManipulation,
  useSignal,
} from "@pibbl/core";
```

`ManipulationFrame` establishes the local box and coordinate space for one
controller. Spread `controller.frameProps` onto it. Handles for that controller
must be descendants of this frame, and a controller may attach to one frame.

```tsx
const box = useSignal({ left: 40, top: 32, width: 180, height: 100 });
const manipulation = useManipulation({ box });

<ManipulationFrame {...manipulation.frameProps}>
  <Rectangle style={{ width: 180, height: 100, fill: "#2563eb" }} />
</ManipulationFrame>;
```

Related types: [PibblManipulationController](#/api/types/events#pibblmanipulationcontroller), [PibblManipulationFrameProps](#/api/types/events#pibblmanipulationframeprops).
