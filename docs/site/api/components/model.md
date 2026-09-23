---
id: api-component-model
title: Model
summary: Instances one opaque imported WebGL asset as a single event and focus target.
kind: api
slug: model
apiCategory: component
symbols: [Model]
relatedTypes: [CRCWebGLAsset, CRCWebGLTransformStyle, ModelProps, ModelStyle]
---

# Model

```ts
import { Model } from "@crc/webgl";
```

`Model` synchronously submits every primitive in one opaque
[`CRCWebGLAsset`](#/api/types/webgl#crcwebglasset) in stable asset order. One
Model instance is one event and focus target even when its asset contains
multiple primitives. It is valid only inside
[`WebGLLayer`](#/api/components/webgl-layer).

Its public input is [`ModelProps`](#/api/types/webgl#modelprops) with
[`ModelStyle`](#/api/types/webgl#modelstyle), including the shared
[`CRCWebGLTransformStyle`](#/api/types/webgl#crcwebgltransformstyle).

The instance transform applies outside each asset primitive transform. Optional
`color` and `opacity` multiply imported base color and alpha, while omitted
`castShadow` and `receiveShadow` preserve imported/default shadow behavior.
`pointerEvents="none"` opts the complete model out of coordinate targeting.
