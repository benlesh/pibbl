---
id: guide-webgl-islands
title: Add WebGL islands
summary: Compose interactive WebGL2 scenes inside CRC Canvas paint order with the same JSX, hooks, events, and scheduler.
kind: guide
slug: webgl-islands
order: 65
keywords: [webgl, 3d, mesh, camera, animation, picking]
exampleSlug: webgl-islands
---

# Add WebGL islands

`@crc/webgl` renders transparent WebGL2 islands inside an ordinary CRC Canvas
scene. A [`WebGLLayer`](#/api/components/webgl-layer) is one Canvas composition
entry: Canvas content can paint before or after it, while the island's own
children use WebGL depth.

Install the version-matched packages together:

```sh
pnpm add @crc/core @crc/webgl
```

Keep the JSX runtime configured as `@crc/core`. `@crc/webgl` adds components,
geometry, and hooks; it does not publish another element constructor, fragment,
JSX runtime, state hook, or event system.

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@crc/core"
  }
}
```

## Render a cube and sphere

```tsx
import { Rectangle, Text, crc, crcState } from "@crc/core";
import { Cube, Group3D, Sphere, WebGLLayer } from "@crc/webgl";

function Scene() {
  const [selected, setSelected] = crcState("none");

  return (
    <>
      <Rectangle
        style={{ width: 640, height: 360, fill: "#101827" }}
        onClick={() => setSelected("background")}
      />
      <WebGLLayer
        style={{ width: 640, height: 360 }}
        onClick={() => console.log("a WebGL descendant was clicked")}
      >
        <Group3D
          style={{ rotationYDegrees: 20 }}
          onClick={() => console.log("the selected object is in this group")}
        >
          <Cube
            style={{ size: 1.3, translateX: -0.9, color: "#8b5cf6" }}
            onClick={() => setSelected("cube")}
          />
          <Sphere
            style={{ radius: 0.7, translateX: 0.9, color: "#22c55e" }}
            onClick={() => setSelected("sphere")}
          />
        </Group3D>
      </WebGLLayer>
      <Text
        pointerEvents="none"
        style={{ x: 24, y: 24, fill: "white", font: "600 18px sans-serif" }}
      >
        Selected: {selected}
      </Text>
    </>
  );
}

crc(document.querySelector("canvas")!, <Scene />);
```

The omitted camera is exactly:

```ts
const defaultCamera = {
  type: "perspective",
  position: [0, 0, 5],
  lookAt: [0, 0, 0],
  up: [0, 1, 0],
  fieldOfViewDegrees: 50,
  near: 0.1,
  far: 1000,
} as const;
```

Its aspect ratio follows the layer's logical width and height. Backing density
does not change the camera, and CRC does not inspect scene bounds or
automatically frame objects. WebGL world Y points up and the default camera
looks toward negative Z; Canvas Y still points down outside the raster island.

Supply one explicit perspective camera when the scene needs another view:

```tsx
<WebGLLayer
  camera={{
    type: "perspective",
    position: [3, 2, 7],
    lookAt: [0, 0, 0],
    up: [0, 1, 0],
    fieldOfViewDegrees: 42,
    near: 0.1,
    far: 200,
  }}
  style={{ width: 640, height: 360 }}
>
  <Cube style={{ size: 2, color: "#38bdf8" }} />
</WebGLLayer>
```

Camera numbers must be finite. The field of view is between 0 and 180 degrees,
`near` is positive, and `far` is greater than `near`. Position and look-at must
differ, while `up` must be nonzero and non-collinear with the view direction.

## Transform and draw geometry

[`Group3D`](#/api/components/group-3d) is a nonpainting transform and event
propagation boundary. Translation and rotation default to zero, scale defaults
to one, negative scale is supported, and zero or non-finite scale is invalid.
Its fixed transform order is translation × Z rotation × Y rotation × X
rotation × scale. Child transforms follow the parent transform.

[`Cube`](#/api/components/cube) defaults to size `1`.
[`Sphere`](#/api/components/sphere) defaults to radius `0.5`.
[`Mesh`](#/api/components/mesh) draws an immutable triangle geometry descriptor:

```tsx
import { Mesh, createWebGLGeometry } from "@crc/webgl";

const triangle = createWebGLGeometry({
  positions: [-1, -1, 0, 1, -1, 0, 0, 1, 0],
});

const mark = (
  <Mesh
    geometry={triangle}
    style={{ color: "#f97316", opacity: 0.9, translateZ: -1 }}
    onClick={() => console.log("triangle")}
  />
);
```

[`createWebGLGeometry`](#/api/functions/create-webgl-geometry) copies the input,
so later mutations to the caller's arrays cannot change paint or picking.
Positions are a nonempty finite XYZ list. Non-indexed vertex counts and index
counts must be divisible by three; supplied indices must be nonnegative integers
within the vertex range.

`Mesh`, `Cube`, and `Sphere` use an unlit solid color. `color` defaults to white
and must be a concrete browser-accepted Canvas color. `opacity` defaults to one
and stays between zero and one. Opacity affects pixels, not hit geometry.

## Understand paint order and targeting

Canvas and WebGL drawing primitives participate in coordinate targeting by
default, even without a handler or cursor. The topmost matching geometry can
therefore block a target behind it. Set `pointerEvents="none"` on decorative
Canvas or WebGL drawing when input should pass through.

The `WebGLLayer` background is different: empty transparent island space is a
miss and lets a lower Canvas target win. A hit on default-participating WebGL
geometry selects the nearest supported object by depth; source order breaks an
equal-depth tie. Setting `pointerEvents="none"` on an object skips that object,
while setting it on `WebGLLayer` disables picking for the complete island.

`Group`, `Clip`, `Layer`, layout containers, `WebGLLayer`, and `Group3D` accept
handler props as listener-only propagation ancestors. They never create a
rectangular target: an empty part of a group or allocation does not select it.
When a WebGL leaf wins, its capture/target/bubble path crosses the private
WebGL-to-Canvas bridge and includes the listener ancestors that actually contain
it. Pointer capture, related targets, cursor selection, focus, keyboard input,
touch, wheel, editing, clipboard, and drag/drop then use CRC's normal event
machinery.

CRC internally resolves every paint candidate as miss, block, or target. A
Canvas path uses its declared geometry, a nested Canvas layer delegates to its
child ledger, and a WebGL layer maps the root point into its committed camera
and scene picker. The default WebGL picker uses geometry ray intersections; it
does not read pixels or run a hidden GPU ID pass.

Focus-managed geometry-backed WebGL targets derive directional-navigation
bounds from their clipped 3D bounds projected into the logical layer. An
explicit `keyboardNavigationBounds` is a layer-local 2D override. Custom-hit
primitives need that explicit override when they should participate in arrow
navigation.

See the [default pointer-participation migration](../../../migrations/default-pointer-participation.md)
when upgrading a scene that expected passive paint to click through.

## Animate through the shared scheduler

[`crcAnimationFrame`](#/api/hooks/crc-animation-frame) returns the current CRC
frame timestamp and keeps its component rendering while mounted:

```tsx
import { Cube, Group3D, crcAnimationFrame } from "@crc/webgl";

function Spinner() {
  const timestamp = crcAnimationFrame();
  return (
    <Group3D style={{ rotationYDegrees: (timestamp / 30) % 360 }}>
      <Cube style={{ color: "#a78bfa" }} />
    </Group3D>
  );
}
```

Multiple callers coalesce through core's scheduler, and Canvas and WebGL
components in the same root observe one timestamp. Static islands request no
continuing frames. An unchanged island may reuse its committed bitmap and pick
ledger without rerunning child components; state, props, camera, size, density,
focus metadata, resource generation, or context generation invalidates the
appropriate cache.

## Define a raw WebGL primitive

[`defineWebGLPrimitive`](#/api/functions/define-webgl-primitive) creates a
WebGL-only platform component. Its render callback can read the current
[`CRCWebGLContext`](#/api/types/webgl#crcwebglcontext) directly or through
[`crcWebGLContext`](#/api/hooks/crc-webgl-context). The snapshot includes the
WebGL2 context, camera and model matrices, logical/backing viewports, density,
timestamp, context generation, and component-owned `resources.use(...)`.

Every definition must declare one hit capability:

- `geometry` returns a `CRCWebGLGeometry` used for draw-matched ray picking;
- `custom` synchronously returns `null` for a miss or a finite nonnegative ray
  distance for a hit;
- `none` declares a decorative primitive and fixes its public participation to
  `pointerEvents="none"`.

A raw-context primitive must set every WebGL state value it depends on. CRC
restores its framework baseline after the callback, so bindings and enable flags
do not survive between primitives. Extension-specific state outside CRC's
baseline remains the primitive's responsibility and should be restored in
`finally`. Use `context.resources.use(create, release, deps)` for programs,
buffers, textures, vertex arrays, framebuffers, and related context-owned
resources. Never share a GPU object between `WebGLLayer` contexts.

The draw callback and hit resolver are synchronous. A resolver must not invoke
hooks, render components, mutate CRC state, retain its input snapshot, perform
asynchronous work, or infer hits from later GPU readback. Custom WebGL
primitives do not accept Canvas `style.filter`; apply a core filter to the
receiving `WebGLLayer` instead.

## Construct the same scene without JSX

Use core's `createElement`; there is no WebGL-specific constructor:

```ts
import { crc, createElement } from "@crc/core";
import { Cube, Group3D, WebGLLayer } from "@crc/webgl";

const scene = createElement(
  WebGLLayer,
  { style: { width: 320, height: 180 }, children: null },
  createElement(
    Group3D,
    { style: { rotationYDegrees: 25 }, children: null },
    createElement(Cube, { style: { size: 1.4, color: "#22d3ee" } }),
  ),
);

crc(document.querySelector("canvas")!, scene);
```

## Composition and platform limits

A `WebGLLayer` owns one persistent WebGL2 `OffscreenCanvas`, context, committed
`ImageBitmap`, and matched pick ledger. A new image/ledger pair becomes live
only after WebGL traversal, bitmap transfer, and parent Canvas composition all
succeed. Replacement closes the previous bitmap. Context loss removes stale
paint, pick, and GPU generations; restoration schedules an ordinary rebuild.
Removal and root disposal detach listeners and release each owned generation.

The island is one flattened Canvas paint entry. Canvas primitives cannot appear
inside it, WebGL primitives cannot render outside it, and an external Canvas
primitive cannot be interleaved between two objects in the same island. Use two
`WebGLLayer` passes for `WebGL back → Canvas → WebGL front`.

Outer Canvas layout, `Group` transforms, `Clip`, alpha/compositing, and
`style.filter` apply to the completed island bitmap. A filter on `WebGLLayer`
therefore affects the whole island after its WebGL draw/depth pass and does not
change picking or focus geometry. The initial package has one perspective
camera per island and no WebGL1 fallback, multiple viewports, lighting/material
system, loader, retained scene graph, worker renderer, WebGPU backend, or
cross-context GPU sharing.

The package uses the version-coupled `@crc/core/internal` friend entry to keep
one element brand, scheduler, and event root. That entry is reserved for
matching official CRC packages and is not an application compatibility promise.

Explore the [WebGL islands live example](#/examples/composition/webgl-islands)
and the [`@crc/webgl` API types](#/api/types/webgl).
