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
import { Rectangle, Text, crc, crcState } from "@crc/core";

function Scene() {
  const [count, setCount] = crcState(0);
  return [
    <Rectangle
      style={{ width: 240, height: 120, fill: "#2563eb", cursor: "pointer" }}
      onClick={() => setCount((value) => value + 1)}
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

The optional `@crc/webgl` package uses these same JSX entries and the same
element, scheduler, and event identities. `@crc/core/internal` is a
version-coupled friend seam reserved for matching official CRC packages; it is
not supported for application imports and has no independent compatibility
promise.

The optional `@crc/particles` package also shares this runtime. Its root entry
adds Canvas particle components and systems; its `./webgl` entry contributes
instanced particle recipes through the official WebGL scene seam.

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

For transparent 3D composition, use the [WebGL islands
guide](../../docs/site/learn/guides/webgl-islands.md) and install the matching
`@crc/webgl` release.
