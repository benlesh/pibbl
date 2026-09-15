---
id: api-component-directional-light
title: DirectionalLight
summary: Illuminates lit WebGL geometry with parallel rays from one direction.
kind: api
slug: directional-light
apiCategory: component
symbols: [DirectionalLight]
relatedTypes: [DirectionalLightProps, DirectionalLightStyle, CRCWebGLTransformStyle]
---

# DirectionalLight

```tsx
import { DirectionalLight } from "@crc/webgl";

<DirectionalLight
  style={{ color: "#ffffff", intensity: 1.2, rotationXDegrees: -45 }}
/>;
```

`DirectionalLight` emits parallel rays along transformed local `-Z`.
`color` defaults to white and finite nonnegative `intensity` defaults to `1`.
Translation has no effect; containing `Group3D` rotation changes direction,
while scale does not change intensity.

[`DirectionalLightProps`](#/api/types/webgl#directionallightprops) has no
component-specific fields. [`DirectionalLightStyle`](#/api/types/webgl#directionallightstyle)
uses the shared [`CRCWebGLTransformStyle`](#/api/types/webgl#crcwebgltransformstyle).
