---
id: api-hook-use-manipulation
title: useManipulation
summary: Creates component-owned move and resize interaction state.
kind: api
slug: use-manipulation
apiCategory: hook
symbols: [useManipulation]
relatedTypes: [PibblManipulationController, PibblManipulationOptions]
---

# useManipulation

```ts
import { useManipulation, useSignal } from "@pibbl/core";
```

`useManipulation(options)` creates one controller for the mounted component.
Pass a writable box signal and attach `controller.frameProps` to a
[`ManipulationFrame`](#/api/components/manipulation-frame). Descendant handles
start interactions; `active` and `snapshot` expose readonly signal state, and
`cancel()` restores the starting geometry for an active interaction.

```tsx
const box = useSignal({ left: 40, top: 32, width: 180, height: 100 });
const manipulation = useManipulation({ box, move: {}, resize: {} });
```

Related types: [PibblManipulationController](#/api/types/events#pibblmanipulationcontroller), [PibblManipulationOptions](#/api/types/events#pibblmanipulationoptions).
