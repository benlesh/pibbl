---
id: api-component-point-light
title: PointLight
summary: Emits spherical inverse-square illumination from a transformed position.
kind: api
slug: point-light
apiCategory: component
symbols: [PointLight]
relatedTypes: [PointLightProps, PointLightStyle, CRCWebGLTransformStyle]
---

# PointLight

```tsx
import { PointLight } from "@crc/webgl";

<PointLight
  style={{ color: "#fb923c", intensity: 12, range: 8, translateY: 2 }}
/>;
```

`PointLight` emits in every direction from its transformed origin with
inverse-square attenuation. `color` defaults to white and `intensity` defaults
to `1`. Optional `range` must be finite and positive; when omitted the light is
unbounded. A containing `Group3D` transforms the origin, but its scale does not
alter range or intensity.

[`PointLightProps`](#/api/types/webgl#pointlightprops) has no
component-specific fields. [`PointLightStyle`](#/api/types/webgl#pointlightstyle)
uses the shared [`CRCWebGLTransformStyle`](#/api/types/webgl#crcwebgltransformstyle).
