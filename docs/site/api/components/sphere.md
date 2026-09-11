---
id: api-component-sphere
title: Sphere
summary: Draws and ray-picks a deterministic indexed sphere in a WebGL island.
kind: api
slug: sphere
apiCategory: component
symbols: [Sphere]
relatedTypes: [CRCWebGLTransformStyle, SphereProps, SphereStyle]
---

# Sphere

```ts
import { Sphere } from "@crc/webgl";
```

`Sphere` uses deterministic indexed sphere geometry centered at the local
origin. `style.radius` defaults to `0.5` and must be finite and positive. It
also accepts the [`Mesh`](#/api/components/mesh) transform, color, opacity, and
cursor style plus event/focus props.
Its public surface is [`SphereProps`](#/api/types/webgl#sphereprops) with
[`SphereStyle`](#/api/types/webgl#spherestyle), including the shared
[`CRCWebGLTransformStyle`](#/api/types/webgl#crcwebgltransformstyle).

```tsx
<Sphere
  style={{ radius: 0.75, translateX: 1.2, color: "#22c55e" }}
  onClick={() => console.log("sphere selected")}
/>
```

The same committed model transform drives paint, picking, and projected focus
bounds. `pointerEvents="none"` keeps the sphere visible but removes it from hit
and focus participation.
