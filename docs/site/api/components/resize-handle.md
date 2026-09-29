---
id: api-component-resize-handle
title: ResizeHandle
summary: Adds one CSS-pixel resize target to a manipulation frame.
kind: api
slug: resize-handle
apiCategory: component
symbols: [ResizeHandle]
relatedTypes: [CRCResizeHandleProps, CRCResizePosition]
---

# ResizeHandle

```ts
import { ResizeHandle, useManipulation, useSignal } from "@crc/core";
```

`ResizeHandle` draws a small frame-corner or frame-edge control and uses a
CSS-pixel hit target. Its `position` selects the edge or corner; `hitSize`
defaults to 24 CSS pixels.

```tsx
const box = useSignal({ left: 40, top: 32, width: 180, height: 100 });
const manipulation = useManipulation({ box, resize: {} });

<ResizeHandle controller={manipulation} position="bottom-right" />;
```

Related types: [CRCResizeHandleProps](#/api/types/events#crcresizehandleprops), [CRCResizePosition](#/api/types/events#crcresizeposition).
