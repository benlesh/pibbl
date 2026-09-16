---
id: api-component-webgl-background
title: WebGLBackground
summary: Sets the solid clear color behind one settled WebGL scene.
kind: api
slug: webgl-background
apiCategory: component
symbols: [WebGLBackground]
relatedTypes: [WebGLBackgroundProps, WebGLBackgroundStyle]
---

# WebGLBackground

```tsx
import { WebGLBackground } from "@crc/webgl";

<WebGLBackground style={{ color: "rgba(8, 15, 30, 0.9)" }} />;
```

`WebGLBackground` sets the color and alpha used by the layer's existing clear;
it adds no draw pass. A layer accepts at most one background, and its JSX
position does not affect rendering. Background pixels create no WebGL target,
so even an opaque background remains click-through. Omitting the component
preserves the transparent-island default. A translucent color composites its
clear alpha with lower Canvas content. The background neither illuminates the
scene nor participates in shadow, pick, or focus records.

[`WebGLBackgroundProps`](#/api/types/webgl#webglbackgroundprops) has no
component-specific fields; [`WebGLBackgroundStyle`](#/api/types/webgl#webglbackgroundstyle)
requires the concrete clear color.
