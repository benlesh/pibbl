---
id: api-component-ambient-light
title: AmbientLight
summary: Adds uniform whole-scene illumination to lit WebGL geometry.
kind: api
slug: ambient-light
apiCategory: component
symbols: [AmbientLight]
relatedTypes: [AmbientLightProps, AmbientLightStyle]
---

# AmbientLight

```tsx
import { AmbientLight, WebGLLayer } from "@crc/webgl";

<WebGLLayer>
  <AmbientLight style={{ color: "#ffffff", intensity: 0.25 }} />
</WebGLLayer>;
```

`AmbientLight` adds the same color contribution everywhere in its
`WebGLLayer`. `color` defaults to white and `intensity` defaults to `1`.
Intensity is finite, nonnegative, dimensionless, and linear. Ambient light
ignores `Group3D` transforms and creates no interaction target. Color alpha
scales its RGB contribution; it does not change mesh alpha. Ambient light has
no direct-light depth view, never casts a shadow, and is not darkened by one.

[`AmbientLightProps`](#/api/types/webgl#ambientlightprops) has no
component-specific fields; [`AmbientLightStyle`](#/api/types/webgl#ambientlightstyle)
defines the color and intensity settings.
