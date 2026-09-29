---
id: api-component-manipulable
title: Manipulable
summary: Composes a geometry controller, content frame, and standard handles.
kind: api
slug: manipulable
apiCategory: component
symbols: [Manipulable]
relatedTypes: [CRCManipulableProps]
---

# Manipulable

Bind `style` to a writable finite box signal. `draggable`, `resizable`, and `rotatable` accept booleans or their operation options; omitted operations are disabled. Rotation also requires a writable radians signal. Nested layouts consume the resized frame allocation.

```tsx
import { Manipulable, Rectangle, useSignal } from "@crc/core";

const box = useSignal({ left: 40, top: 32, width: 180, height: 100 });

function Card() {
  return <Rectangle style={{ width: 180, height: 100, fill: "#2563eb" }} />;
}

<Manipulable style={box} draggable resizable>
  <Card />
</Manipulable>
```

Use `useManipulation` with explicit handles when only part of the content should initiate dragging.

Related types: [CRCManipulableProps](#/api/types/events#crcmanipulableprops).
