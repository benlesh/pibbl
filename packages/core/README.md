# @crc/core

The ESM Canvas 2D component runtime for CRC, with an automatic JSX runtime and
an equivalent `createElement` API. It has no React dependency and generates no
DOM.

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@crc/core"
  }
}
```

```tsx
import { Rectangle, Text, crc, useSignal } from "@crc/core";

function Scene() {
  const count = useSignal(0);
  return [
    <Rectangle
      style={{ width: 240, height: 120, fill: "#2563eb", cursor: "pointer" }}
      onClick={() => count.update((value) => value + 1)}
    />,
    <Text style={{ x: 20, y: 20, fill: "white" }}>Clicks: {count}</Text>,
  ];
}

const controller = crc(document.querySelector("canvas")!, <Scene />);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
```

`@crc/core/jsx-runtime` and `@crc/core/jsx-dev-runtime` are compiler-facing
automatic-runtime entries. Normal application imports come from `@crc/core`.
Use only documented exports; `@crc/core/lib/*` and source subpaths are private
and blocked by the package export map.

`defineRenderLayer()` mounts an external renderer as one CRC composition,
layout, scheduling, event, focus, and teardown boundary. The optional
`@crc/three` package specializes that public lifecycle for ordinary Three.js
scenes without introducing another JSX runtime or scene graph.

Particles, visualization, textures, and physics ship in this package under
`@crc/core/particles`, `@crc/core/viz`, `@crc/core/textures`, and
`@crc/core/physics/2d`. Import only the features you use; the root does not
re-export them. Each feature shares the same runtime and scheduler.

Pure geometry is available from `@crc/core/physics/2d/geometry`. That entry and
core drawing do not load or initialize Rapier. The physics entry includes private precompiled Rapier WASM
and JS bindings; consumers do not install Rapier. There is no root physics
barrel. `@crc/core/internal` remains private to official integrations.

Drawing and layout values use closed, local `style` objects. Styles do not
cascade or inherit. Structural containers accept recursive synchronous
children; `Text` separately accepts textual children, including numeric zero.
State and root updates are animation-frame coalesced, rendering is synchronous,
and controller disposal is idempotent.

Drawing primitives participate in coordinate targeting by default, including
when they have no handler. Use `pointerEvents="none"` for decorative paint that
must pass input through. Handler props on `Group`, `Clip`, `Layer`, and layout
containers are propagation listeners and do not create structural hit boxes.

Start with the repository [quick start](../../README.md), then use the
[configuration guide](../../docs/site/learn/guides/configure-jsx.md), complete
[non-JSX guide](../../docs/site/learn/guides/author-without-jsx.md), [API
overview](../../docs/site/api/index.md), [feature
inventory](../../docs/library-status.md), and normative [design
contracts](../../docs/design/runtime-hooks-contract.md).

For transparent 3D composition, use the [Three.js integration
guide](../../docs/site/learn/guides/three-js.md) and install `@crc/three` plus
`three`.
