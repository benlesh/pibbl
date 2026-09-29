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
import { ResizeHandle } from "@crc/core";
```

`ResizeHandle` draws a small frame-corner or frame-edge control and uses a
CSS-pixel hit target. Its `position` selects the edge or corner; `hitSize`
defaults to 24 CSS pixels.

```tsx
<ResizeHandle controller={manipulation} position="bottom-right" />
```
