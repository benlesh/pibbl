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
children declare one frame-local 3D scene. CRC composes the complete successful
scene first, settles its render and pick data, renders its WebGL passes, and
then composites and transactionally commits one bitmap to Canvas.

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

[`Group3D`](#/api/components/group-3d) is a nonpainting transform and listener
scope. It changes the composed model transform for its descendants and adds
event propagation ancestry, but contributes no independent pixels or hit
geometry. Translation and rotation default to zero, scale defaults to one,
negative scale is supported, and zero or non-finite scale is invalid. Its fixed
transform order is translation × Z rotation × Y rotation × X rotation × scale.
Child transforms follow the parent transform.

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
and stays between zero and one. Final raster alpha is parsed color alpha
multiplied by `opacity`. Opacity affects pixels, not hit or focus geometry.

## Add a custom shape

`Mesh` plus `createWebGLGeometry` is the custom-shape extension path. An
ordinary component can translate application props into a declarative mesh:

```tsx
import { Mesh, createWebGLGeometry } from "@crc/webgl";

const markerGeometry = createWebGLGeometry({
  positions: [-0.5, -0.5, 0, 0.5, -0.5, 0, 0, 0.5, 0],
});

function Marker({ x }: { x: number }) {
  return <Mesh geometry={markerGeometry} style={{ translateX: x }} />;
}
```

The immutable geometry is shared by rasterization, ray picking, and projected
focus bounds. Application components do not receive raw WebGL access, custom
shader or hit callbacks, or ownership of the renderer's GPU handles.

## Understand paint order and targeting

Child source order establishes CRC identity, event ancestry, global focus
order, and stable tie-break indices. It is not an irrevocable GPU draw sequence:
after the whole scene composes successfully, the renderer sees every submitted
object and plans two raster queues.

Opaque objects render first in source order with depth testing and depth writes.
Transparent objects then sort back-to-front by their transformed geometry
bounds-center depth, using source order only to break equal-depth ties; they
retain depth testing but disable depth writes. Standard source-alpha blending
uses each object's final color × opacity alpha. Exactly zero-alpha objects enter
neither raster queue, but their declared geometry remains pickable and can keep
projected focus bounds unless `pointerEvents="none"` opts out.

This is deterministic object-level transparency, not order-independent
transparency. Intersecting or very large transparent meshes can still reveal
the limitations of a single bounds-center sort.

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
and scene picker. The WebGL picker is derived from the same settled mesh
submissions used for rasterization. It uses geometry ray intersections rather
than transparent blend order and does not read pixels or run a hidden GPU ID
pass.

Focus-managed geometry-backed WebGL targets derive directional-navigation
bounds from their clipped 3D bounds projected into the logical layer. An
explicit `keyboardNavigationBounds` is a layer-local 2D override. Raster queue
sorting never changes source-order Tab navigation.

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
ledger and focus metadata in constant time without composing or settling a
scene, executing child components, issuing WebGL draws, or transferring another
bitmap. State, props, camera, size, density, focus metadata, or context
generation invalidates the appropriate cache. Animation changes ordinary
declarations before the layer composes, settles, and renders; it does not create
a second clock or independent draw loop.

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

A `WebGLLayer` owns one persistent WebGL2 `OffscreenCanvas`, context, renderer,
committed `ImageBitmap`, and matched pick/focus generation. A dirty frame has
four distinct stages:

1. **compose** — components evaluate once and Mesh/Cube/Sphere declarations
   append frame-local submissions without framebuffer changes or GPU-resource
   construction;
2. **settle** — CRC closes and validates the complete draft and derives raster,
   pick, and focus records from the same immutable submissions;
3. **render** — the layer renderer acquires its context-owned resources and
   issues the opaque and transparent WebGL passes; and
4. **Canvas composite and transactional commit** — CRC transfers one candidate
   bitmap, composites it into the parent Canvas, and commits the bitmap,
   picker, and focus metadata together.

A failure before Canvas commit publishes no partial bitmap/pick/focus
generation, but each stage has its own cleanup boundary. Composition failure
discards the CPU draft without opening a GPU-resource transaction. Settlement
or rendering failure rolls back candidate-only handles and preserves the prior
resident set internally. Successful rendering commits the candidate resident
set, including deletion of retired valid-generation handles, before bitmap
transfer begins. Transfer failure discards the completed render and
pick/focus-candidate metadata; when transfer succeeds but parent Canvas
composition fails, CRC also closes the uncommitted candidate bitmap. The error
then reaches CRC's broader fail-closed root teardown, which may release the
previous committed tuple and current resident set; that later release is not a
candidate-resource rollback. Successful replacement closes the previous
bitmap. Context loss invalidates handles without issuing deletion calls against
the lost generation, removes stale paint/pick/focus participation, and schedules
an ordinary reconstruction after restoration. Removal and root disposal detach
listeners, close bitmaps, and delete every still-live handle exactly once while
its context remains valid.

The island is one flattened Canvas paint entry. Canvas primitives cannot appear
inside it, WebGL primitives cannot render outside it, and an external Canvas
primitive cannot be interleaved between two objects in the same island. Use two
`WebGLLayer` passes for `WebGL back → Canvas → WebGL front`.

Outer Canvas layout, `Group` transforms, `Clip`, alpha/compositing, and
`style.filter` apply to the completed island bitmap. A filter on `WebGLLayer`
therefore affects the whole island after its settled WebGL passes and does not
change picking or focus geometry. The initial package has one perspective
camera per island and no WebGL1 fallback, multiple viewports, lighting,
materials, textures, environment maps, shadows, emissive surfaces, glow/bloom,
post-processing API, loader, retained scene graph, worker renderer, WebGPU
backend, or cross-context GPU sharing.

The package uses the version-coupled `@crc/core/internal` friend entry to keep
one element brand, scheduler, and event root. That entry is reserved for
matching official CRC packages and is not an application compatibility promise.

Explore the [WebGL islands live example](#/examples/composition/webgl-islands)
and the [`@crc/webgl` API types](#/api/types/webgl).
