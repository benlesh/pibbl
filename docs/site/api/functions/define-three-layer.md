---
id: api-function-define-three-layer
title: defineThreeLayer
summary: Defines a reusable Pibbl component around an application-owned Three.js scene.
kind: api
slug: define-three-layer
apiCategory: function
symbols: [defineThreeLayer]
relatedTypes:
  [PibblThreeLayerDefinition, PibblThreeLayerResources, PibblThreeTarget]
---

# defineThreeLayer

```ts
import { defineThreeLayer } from "@pibbl/three";
```

`defineThreeLayer()` builds on
[`defineRenderLayer`](#/api/functions/define-render-layer). It creates one
transparent `THREE.WebGLRenderer` per mounted Pibbl component identity and passes
that renderer through `PibblThreeLayerContext`.

The required `create(context, initialProps)` callback returns an application
[`PibblThreeLayerResources`](#/api/types/three#pibblthreelayerresources) object
containing a `THREE.Scene` and `THREE.Camera`. The complete
[`PibblThreeLayerDefinition`](#/api/types/three#pibblthreelayerdefinition) supports
optional
`update`, `resize`, `render`, `targets`, `pick`, and `dispose` callbacks define
the rest of the synchronous lifecycle. If `render` is omitted, the adapter
renders the returned scene and camera directly.

Objects returned from `targets()` use
[`PibblThreeTarget`](#/api/types/three#pibblthreetarget).

The returned Pibbl component accepts the definition's props plus the ordinary
render-layer style, event, focus, pointer, key, and `missBehavior` props. See
[the Three.js guide](#/learn/guides/three-js) for the complete lifecycle and
interaction model.
