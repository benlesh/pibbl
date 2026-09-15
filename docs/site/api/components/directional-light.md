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
while scale does not change intensity. `castShadow` defaults to `true` and uses
one orthographic 2D depth view when the layer enables shadows and the scene has
eligible casters and receivers. That shadow attenuates only this light's
diffuse contribution. Color alpha scales RGB contribution only.

[`DirectionalLightProps`](#/api/types/webgl#directionallightprops) has no
component-specific fields. [`DirectionalLightStyle`](#/api/types/webgl#directionallightstyle)
uses the shared [`CRCWebGLTransformStyle`](#/api/types/webgl#crcwebgltransformstyle).
