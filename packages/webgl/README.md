# `@crc/webgl`

WebGL2 islands for the CRC Canvas component runtime.

Install the matching releases together:

```sh
pnpm add @crc/core @crc/webgl
```

Configure the one JSX runtime from core:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@crc/core"
  }
}
```

```tsx
import { Rectangle, Text, crc } from "@crc/core";
import { Cube, Group3D, Sphere, WebGLLayer } from "@crc/webgl";

const scene = (
  <>
    <Rectangle
      pointerEvents="none"
      style={{ width: 480, height: 300, fill: "#101827" }}
    />
    <WebGLLayer style={{ width: 480, height: 300 }}>
      <Group3D style={{ rotationYDegrees: 25 }}>
        <Cube style={{ size: 1.2, translateX: -0.8, color: "#8b5cf6" }} />
        <Sphere style={{ radius: 0.6, translateX: 0.8, color: "#22c55e" }} />
      </Group3D>
    </WebGLLayer>
    <Text pointerEvents="none" style={{ x: 20, y: 20, fill: "white" }}>
      Canvas overlay
    </Text>
  </>
);

const controller = crc(document.querySelector("canvas")!, scene);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
```

`WebGLLayer` owns one persistent transparent WebGL2 `OffscreenCanvas` and
composites one committed `ImageBitmap` into the normal Canvas paint order. Its
children use the same branded elements, synchronous component functions, hooks,
keys, event propagation, logical focus, and coalesced scheduler as core. An
omitted camera uses the documented perspective view at `[0, 0, 5]` looking at
the origin.

The root package exports:

- composition and drawing: `WebGLLayer`, `Group3D`, `Mesh`, `Cube`, `Sphere`;
- geometry and extension: `createWebGLGeometry`, `defineWebGLPrimitive`,
  `crcWebGLContext`;
- animation: `crcAnimationFrame`;
- the public camera, vector, geometry, transform, primitive, context, and
  component prop/style types used by those values.

Drawing geometry participates in hit testing by default. Empty transparent
island background passes through; `pointerEvents="none"` skips an individual
object, or the complete island when set on `WebGLLayer`. `WebGLLayer` and
`Group3D` handler props are propagation listeners without independent hit
boxes. Geometry-backed focus targets use projected bounds.

Custom primitives must pair draw code with geometry/custom hit behavior or
declare decorative `none` participation. Raw callbacks own all WebGL state they
depend on and acquire GPU handles with `context.resources.use(...)`. CRC
restores its baseline around callbacks and deterministically releases resources
on dependency change, component removal, context loss, render failure, layer
removal, or root disposal.

Canvas filters apply outside the completed island through
`WebGLLayer.style.filter`; inner WebGL primitives reject them. The complete
island is one flattened Canvas entry, so Canvas content cannot appear between
two objects inside the same WebGL pass. There is no Canvas child support inside
an island, WebGL1 fallback, multiple cameras/viewports per layer, retained scene
graph, material/lighting engine, worker renderer, WebGPU backend, or
cross-context GPU-resource sharing.

This package peer-depends on the same `@crc/core` release and consumes the
version-coupled `@crc/core/internal` friend seam. Applications must not import
that reserved entry and receive no compatibility promise for it.

Read [Add WebGL islands](../../docs/site/learn/guides/webgl-islands.md), the
[API overview](../../docs/site/api/index.md), and the [WebGL type
reference](../../docs/site/api/types/webgl.md).
