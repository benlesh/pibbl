---
id: api-component-rotation-handle
title: RotationHandle
summary: Adds a rotation handle outside a manipulation frame.
kind: api
slug: rotation-handle
apiCategory: component
symbols: [RotationHandle]
relatedTypes: [CRCRotationHandleProps]
---

# RotationHandle

`RotationHandle` rotates its controller around the frame center. It sits 24 CSS pixels beyond the top edge and uses an 8 CSS-pixel visual with a default 24 CSS-pixel hit region. Provide a writable radians signal and enable `rotate` on the controller.

```tsx
<RotationHandle controller={manipulation} />
```

Related types: [CRCRotationHandleProps](#/api/types/events#crcrotationhandleprops).
