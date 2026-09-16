---
id: api-component-hemisphere-light
title: HemisphereLight
summary: Blends sky and ground illumination across lit surface normals.
kind: api
slug: hemisphere-light
apiCategory: component
symbols: [HemisphereLight]
relatedTypes: [HemisphereLightProps, HemisphereLightStyle, CRCWebGLTransformStyle]
---

# HemisphereLight

```tsx
import { HemisphereLight } from "@crc/webgl";

<HemisphereLight
  style={{ skyColor: "#dbeafe", groundColor: "#312e81", intensity: 0.8 }}
/>;
```

`HemisphereLight` blends `groundColor` to `skyColor` using each lit surface's
normal. Both colors default to white and `intensity` defaults to `1`. Its local
`+Y` axis is transformed by containing `Group3D` rotations; group scale does
not change intensity. Color alpha scales RGB contribution only. Hemisphere
light never casts a shadow and is not darkened by a direct light's shadow.

[`HemisphereLightProps`](#/api/types/webgl#hemispherelightprops) has no
component-specific fields. [`HemisphereLightStyle`](#/api/types/webgl#hemispherelightstyle)
uses the shared [`CRCWebGLTransformStyle`](#/api/types/webgl#crcwebgltransformstyle).
