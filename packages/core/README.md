# @pibbl/core

> **ALPHA — NOT FOR PRODUCTION USE.** Pibbl 0.0.2 is experimental. APIs may change or be removed without notice. Use it only for evaluation and experimentation.

The ESM Canvas 2D component runtime for Pibbl, with an automatic JSX runtime and
an equivalent `createElement` API. It has no React dependency. Drawing stays on
Canvas; opt-in `HtmlBox` regions host application-owned DOM content.

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@pibbl/core"
  }
}
```

```tsx
import { Rectangle, Text, pibbl, useSignal } from "@pibbl/core";

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

const controller = pibbl(document.querySelector("canvas")!, <Scene />);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
```

`@pibbl/core/jsx-runtime` and `@pibbl/core/jsx-dev-runtime` are compiler-facing
automatic-runtime entries. Normal application imports come from `@pibbl/core`.
Use only documented exports; `@pibbl/core/lib/*` and source subpaths are private
and blocked by the package export map.

`defineRenderLayer()` mounts an external renderer as one Pibbl composition,
layout, scheduling, event, focus, and teardown boundary. The optional
`@pibbl/three` package specializes that public lifecycle for ordinary Three.js
scenes without introducing another JSX runtime or scene graph.

Particles, visualization, textures, and physics ship in this package under
`@pibbl/core/particles`, `@pibbl/core/viz`, `@pibbl/core/textures`, and
`@pibbl/core/physics/2d`. Import only the features you use; the root does not
re-export them. Each feature shares the same runtime and scheduler.

Pure geometry is available from `@pibbl/core/physics/2d/geometry`. That entry and
core drawing do not load or initialize Rapier. The physics entry includes private precompiled Rapier WASM
and JS bindings; consumers do not install Rapier. There is no root physics
barrel. `@pibbl/core/internal` remains private to official integrations.

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
guide](../../docs/site/learn/guides/three-js.md) and install `@pibbl/three` plus
`three`.
