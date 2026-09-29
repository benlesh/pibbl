---
id: guide-three-js
title: Use Three.js inside CRC
summary: Mount an ordinary Three.js scene in Canvas paint order while CRC owns scheduling, composition, events, focus, and cleanup.
kind: guide
slug: three-js
order: 65
keywords: [three.js, 3d, render layer, raycasting, focus, events]
exampleSlug: three-layer
---

# Use Three.js inside CRC

`@crc/three` is a thin integration, not a second 3D API. Your application
creates ordinary Three scenes, cameras, objects, materials, loaders, controls,
mixers, and composers. CRC contributes the boundary around them: Canvas paint
order, layout, clips, outer filters, one shared scheduler, event arbitration,
focus, component ownership, and teardown.

Install CRC, the adapter, and Three:

```sh
pnpm add @crc/core @crc/three three
```

Keep `@crc/core` as the JSX runtime. Three objects are created with the normal
Three API; CRC JSX only mounts the completed render layer.

## Define the layer once

Call [`defineThreeLayer`](#/api/functions/define-three-layer) at module scope.
It returns a reusable CRC component. One mounted component identity creates one
Three renderer and one application resource value.

```tsx
import { Rectangle, crc } from "@crc/core";
import { defineThreeLayer } from "@crc/three";
import {
  BoxGeometry,
  Mesh,
  MeshNormalMaterial,
  PerspectiveCamera,
  Scene,
} from "three";

const ProductScene = defineThreeLayer<
  { rotation: number },
  { scene: Scene; camera: PerspectiveCamera; product: Mesh }
>({
  create() {
    const scene = new Scene();
    const camera = new PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.z = 5;

    const product = new Mesh(
      new BoxGeometry(1.5, 1.5, 1.5),
      new MeshNormalMaterial(),
    );
    scene.add(product);
    return { scene, camera, product };
  },

  update(resources, props) {
    resources.product.rotation.y = props.rotation;
  },

  resize(resources, size) {
    resources.camera.aspect = size.width / size.height;
    resources.camera.updateProjectionMatrix();
  },

  dispose(resources) {
    resources.product.geometry.dispose();
    resources.product.material.dispose();
  },
});

function App() {
  return (
    <>
      <Rectangle style={{ width: 640, height: 360, fill: "#0f172a" }} />
      <ProductScene
        rotation={0.5}
        missBehavior="pass-through"
        style={{ width: 640, height: 360 }}
      />
    </>
  );
}

crc(document.querySelector("canvas")!, <App />);
```

`create()` runs once for a mounted identity. CRC component updates call
`update()` with current props instead of rebuilding the scene. `resize()` sees
logical and backing dimensions. Without a custom `render()`, the adapter calls
`renderer.render(resources.scene, resources.camera)`. `dispose()` releases the
application-owned resources; the adapter always releases its input bridge and
renderer.

## Share events without wrapping the scene graph

Visible Three geometry participates in CRC hit arbitration even when it has no
CRC handler. That is what prevents a covered Canvas rectangle from receiving a
click through a sphere or cube.

Return selected objects from `targets()` when they should become logical CRC
targets:

```text
targets(resources, props) {
  return [{
    object: resources.product,
    handlers: { onClick: props.onProductClick },
    cursor: "pointer",
    keyboardFocusable: true,
  }];
}
```

The default picker raycasts the Three scene. A hit on a registered object—or a
descendant of one—becomes that CRC target. A hit on other visible geometry
blocks lower Canvas paint. A raycast miss follows the component's
`missBehavior`:

- `"pass-through"` lets CRC test paint behind the layer;
- `"block"` consumes the coordinate without a target;
- `"target-layer"` targets the layer itself and can feed bridged controls.

CRC remains responsible for capture, target, and bubble propagation, pointer
capture, cursor selection, logical focus, keyboard activation, and source paint
order. Three's `EventDispatcher` is still useful for Three object lifecycles,
but it does not replace browser input arbitration.

## Use controls and animation on CRC's clock

Controls that expect a DOM element connect through `context.input`:

```text
create(context) {
  const scene = new Scene();
  const camera = new PerspectiveCamera();
  const controls = context.input.connect(
    element => new OrbitControls(camera, element),
  );
  return { scene, camera, controls };
}
```

Advance mixers, controls, simulations, or composers from the supplied
`render(resources, frame, context)` callback. Call `frame.invalidate()` only
when another frame is needed. Do not start a separate `requestAnimationFrame()`
loop or call `renderer.setAnimationLoop()` for a composited layer. Immersive XR
and AR presentation are outside this integration.

## Compose it like any other CRC paint entry

The complete Three frame is one transparent Canvas paint entry. CRC content can
paint before or after it. `Group`, `Clip`, layout components, and `style.filter`
apply outside the flattened bitmap. Individual Three objects cannot interleave
with individual CRC primitives; use multiple layers when separate Canvas paint
positions are required.

The [Three.js instancing example](#/examples/three/three-instancing)
adapts Three's open-source instancing/raycasting example and demonstrates
OrbitControls, registered targets, blocking instances, miss policies, logical
focus, clipping, filters, and later Canvas paint.
