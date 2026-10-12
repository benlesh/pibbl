---
id: api-component-focus-management
title: FocusManagement
summary: Opts a Pibbl subtree into logical Canvas focus management.
kind: api
slug: focus-management
apiCategory: component
symbols: [FocusManagement]
relatedTypes: [Canvas, PibblNode, FocusManagementProps]
---

# FocusManagement

```ts
import { FocusManagement, Rectangle } from "@pibbl/core";
```

`FocusManagement` uses [`FocusManagementProps`](#/api/types/elements-components#focusmanagementprops) and wraps one recursive
[`PibblNode`](#/api/types/elements-components#pibblnode) subtree. It installs the [`Canvas`](#/api/types/canvas-runtime#canvas) as the only native focus host and
adds logical focus events, source-order Tab traversal, press focus, activation,
and focus-visible modality. It does not generate semantic DOM or an
accessibility tree.

```tsx
<FocusManagement>
  <Rectangle style={{ width: 80, height: 32, fill: "#2563eb" }} />
</FocusManagement>
```

Try the [Focus management live example](#/examples/focus-and-keyboard/focus-management).
