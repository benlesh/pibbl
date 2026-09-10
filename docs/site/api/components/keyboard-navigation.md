---
id: api-component-keyboard-navigation
title: KeyboardNavigation
summary: Adds deterministic directional navigation inside a focus subtree.
kind: api
slug: keyboard-navigation
apiCategory: component
symbols: [KeyboardNavigation]
---

# KeyboardNavigation

```ts
import { FocusManagement, KeyboardNavigation, Rectangle } from "@crc/core";
```

`KeyboardNavigation` uses `KeyboardNavigationProps` and wraps recursive
`CRCNode` children. Place it inside `FocusManagement` to opt into deterministic
arrow-key movement among logical focus targets. It does not create native DOM
controls or infer an accessibility tree.

```tsx
<FocusManagement>
  <KeyboardNavigation mode="directional">
    <Rectangle style={{ width: 80, height: 32, fill: "#2563eb" }} />
  </KeyboardNavigation>
</FocusManagement>
```

See the [Directional navigation live example](#/examples/focus-and-keyboard/directional-navigation).
