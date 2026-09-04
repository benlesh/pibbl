# CRC — Canvas Rendering Components

CRC is a small functional component runtime for the HTML Canvas 2D API. JSX is
the preferred authoring syntax, but CRC has its own renderer, hooks, element
brand, and lifecycle: it does not depend on React and it does not create DOM
nodes.

## Quick start

Install the runtime:

```sh
pnpm add @crc/core
```

Configure TypeScript's automatic JSX runtime:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@crc/core"
  }
}
```

Create a Canvas and a CRC scene:

```html
<canvas id="poster" width="400" height="240"></canvas>
<script type="module" src="/src/poster.tsx"></script>
```

```tsx
import { Group, Rectangle, Text, crc, crcState, type CRCNode } from "@crc/core";

interface PosterProps {
  initialMessage: string;
}

function Poster({ initialMessage }: PosterProps): CRCNode {
  const [message, setMessage] = crcState(initialMessage);

  return (
    <Group>
      <Rectangle
        style={{
          width: 400,
          height: 240,
          fill: "#1f4bd8",
          cursor: "pointer",
        }}
        onClick={() => setMessage("CRC!")}
      />
      <Text
        style={{
          x: 200,
          y: 100,
          fill: "#fff",
          font: "800 48px sans-serif",
          textAlign: "center",
        }}
      >
        {message}
      </Text>
    </Group>
  );
}

const canvas = document.querySelector<HTMLCanvasElement>("#poster")!;
const controller = crc(canvas, <Poster initialMessage="Hello" />);

// Release listeners, frames, hooks, layers, and the mount when the page leaves.
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
```

Uppercase imports such as `Rectangle`, `Text`, and `Group` are Canvas
components, not HTML elements. `crc()` owns at most one live mount per Canvas.
State and root updates coalesce onto `requestAnimationFrame`; each frame is a
full synchronous Canvas traversal. `controller.dispose()` is idempotent.

Prefer ordinary `.tsx` files with the project-wide configuration above. A
single file can instead begin with `/** @jsxImportSource @crc/core */`. One
file has one JSX runtime, so mixed React/CRC applications keep their JSX trees
in separate files or use an explicit element constructor for the minority
tree.

Need to avoid JSX entirely? The complete [`createElement` guide](docs/guides/without-jsx.md)
starts from installation and mounting and does not require the JSX guides.

## Learn the API

- [JSX quick start](docs/guides/jsx-quick-start.md)
- [Compiler and JavaScript configuration](docs/guides/configuring-jsx.md)
- [Components, props, events, and local style](docs/guides/components-props-and-style.md)
- [Children, text, fragments, lists, and keys](docs/guides/children-text-lists-and-keys.md)
- [Layout, groups, clips, and layers](docs/guides/layout-groups-clips-and-layers.md)
- [State, lifecycle, disposal, and React differences](docs/guides/state-lifecycle-and-react-differences.md)
- [Custom components, Canvas painting, and primitives](docs/guides/custom-components-and-primitives.md)
- [React coexistence](docs/guides/react-interop.md)
- [JSX troubleshooting](docs/guides/jsx-troubleshooting.md)
- [Focus, keyboard navigation, and accessibility](docs/guides/focus-keyboard-and-accessibility.md)
- [Complete API reference](docs/api-reference.md)

The [one-time migration guide](docs/migrations/jsx-authoring-pivot.md) maps the
removed factory-first API to the current surface. There are no compatibility
aliases.

## Explore the examples

Install Node 24.15+ on the Node 24 LTS line and the repository-pinned pnpm,
then run:

```sh
corepack pnpm@11.21.0 install --frozen-lockfile
corepack pnpm@11.21.0 playground
```

Open <http://localhost:5173/#/examples>. The CRC Interactive Examples Studio
contains 42 focused lessons: 41 use JSX and one demonstrates the complete
non-JSX API. Every lesson pairs a live Canvas with editable, type-aware source.
The separate `#/testing` area contains 16 deterministic laboratories used by
browser verification. Old `#/scenarios` URLs redirect there.

To exercise built package output instead of source aliases:

```sh
corepack pnpm@11.21.0 playground:built
```

## Public surface

- Runtime and authoring: `crc`, `createElement`, `Fragment`, `CRCElement`,
  `CRCComponent`, `CRCNode`, and `CRCController`
- Drawing: `Rectangle`, `Path`, `Line`, `HorizontalLine`, `VerticalLine`,
  `SvgPath`, `Text`, and `Image`
- Composition and layout: `Group`, `Clip`, `Layer`, `Absolute`, `Overlay`,
  `Flow`, `Flex`, `Grid`, and `measureElement`
- Focus policies: `FocusManagement` and `KeyboardNavigation`
- Hooks: `crcState`, `crcMemo`, `crcRef`, `crcWhenChanged`, `crcCanvasContext`,
  `crcRectPath`, `crcLinePath`, `crcSvgPath`, `crcEvent`, `crcEventTarget`,
  `crcEventListener`, `crcCursor`, and `crcLayoutBox`
- Platform extension: `definePrimitive` plus style-resolution and pure
  measurement types
- Compiler-only entries: `@crc/core/jsx-runtime` and
  `@crc/core/jsx-dev-runtime`

See the [API reference](docs/api-reference.md) for every value and type export,
and [CRC library status](docs/library-status.md) for supported behavior and
evidence.

## Contributing

After installing dependencies and Chromium, run the repository trust gate:

```sh
corepack pnpm@11.21.0 exec playwright install chromium
corepack pnpm@11.21.0 trust
```

The gate checks documentation links, export coverage, current example
extensions, snippets, stale authoring vocabulary, catalogs, declarations,
packages, Studio modes, browser behavior, lifecycle ownership, and visual
safeguards. See the [trust-gate guide](docs/testing/trust-gate.md).

## Deliberate boundaries

CRC supports explicit Canvas targets and DOM-aligned pointer, mouse, touch,
wheel, keyboard/focus, editing/composition, clipboard, and drag/drop event
facades. Optional focus policies use the Canvas as the one native focus host.
CRC does not generate semantic DOM descendants or an accessibility tree;
applications remain responsible for an equivalent accessible DOM experience.
There is no editable-input adapter, rich text, scrolling, complete CSS engine,
retained scene graph, WebGL renderer, or image CORS policy. Canvas/`Path2D`,
font, decoded-image, and `OffscreenCanvas` behavior remain browser-owned.

## License

MIT
