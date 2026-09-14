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
the origin. Those children declare one frame-local scene: CRC composes the
whole successful tree, settles immutable raster/pick/focus records, renders the
planned WebGL passes, and only then composites and transactionally commits the
candidate to Canvas.

The root package exports:

- composition and drawing: `WebGLLayer`, `Group3D`, `Mesh`, `Cube`, `Sphere`;
- geometry and custom shapes: `createWebGLGeometry` with `Mesh`;
- animation: `crcAnimationFrame`;
- the public camera, vector, geometry, transform, and component prop/style
  types used by those values.

Drawing geometry participates in hit testing by default. Empty transparent
island background passes through; `pointerEvents="none"` skips an individual
object, or the complete island when set on `WebGLLayer`. `WebGLLayer` and
`Group3D` handler props are propagation listeners without independent hit
boxes. Geometry-backed focus targets use projected bounds.

`Group3D` is a transform/listener scope rather than a draw call. Build a custom
shape by creating immutable triangle data with `createWebGLGeometry` and
returning `Mesh` from an ordinary component. The layer renderer owns programs,
buffers, and vertex arrays for one context generation and derives rendering,
picking, and projected focus from the same settled mesh submissions.

Child source order establishes identity, event/focus order, and exact ties, not
an irrevocable GPU sequence. Opaque objects render first in source order with
depth writes. Transparent objects use an object-level bounds-center sort
back-to-front with depth testing and no depth writes. Final alpha is parsed
color alpha multiplied by opacity. Exactly zero-alpha geometry skips raster
queues but remains pick/focus eligible unless `pointerEvents="none"` opts out.

Canvas filters apply outside the completed island through
`WebGLLayer.style.filter`; inner WebGL objects reject them. The complete
island is one flattened Canvas entry, so Canvas content cannot appear between
two objects inside the same WebGL pass. There is no Canvas child support inside
an island, WebGL1 fallback, multiple cameras/viewports per layer, retained scene
graph, lighting, materials, textures, environments, shadows, emissive or glow
effects, worker renderer, WebGPU backend, or cross-context GPU-resource sharing.

This package peer-depends on the same `@crc/core` release and consumes the
version-coupled `@crc/core/internal` friend seam. Applications must not import
that reserved entry and receive no compatibility promise for it.

Read [Add WebGL islands](../../docs/site/learn/guides/webgl-islands.md), the
[API overview](../../docs/site/api/index.md), and the [WebGL type
reference](../../docs/site/api/types/webgl.md).
