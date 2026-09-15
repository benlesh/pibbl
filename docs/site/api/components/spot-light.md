---
id: api-component-spot-light
title: SpotLight
summary: Emits inverse-square illumination inside a transformed cone.
kind: api
slug: spot-light
apiCategory: component
symbols: [SpotLight]
relatedTypes: [SpotLightProps, SpotLightStyle, CRCWebGLTransformStyle]
---

# SpotLight

```tsx
import { SpotLight } from "@crc/webgl";

<SpotLight
  style={{
    color: "#f8fafc",
    intensity: 18,
    range: 10,
    translateY: 3,
    rotationXDegrees: -35,
    innerConeAngleDegrees: 18,
    outerConeAngleDegrees: 32,
  }}
/>;
```

`SpotLight` emits along transformed local `-Z`. Cone values are half-angles:
the inner angle defaults to `0`, the outer angle to `45`, and both must lie
between `0` and `90` with inner no greater than outer. Equal angles create a
hard cone. Group scale changes pose only, never range, intensity, or cone
angles.

[`SpotLightProps`](#/api/types/webgl#spotlightprops) has no component-specific
fields. [`SpotLightStyle`](#/api/types/webgl#spotlightstyle) uses the shared
[`CRCWebGLTransformStyle`](#/api/types/webgl#crcwebgltransformstyle).
