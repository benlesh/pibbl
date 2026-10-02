# CRC — Canvas Rendering Components

CRC is a small functional component runtime for the HTML Canvas 2D API, with a
public external-render-layer lifecycle and an optional first-class `@crc/three`
adapter for ordinary Three.js scenes. `@crc/core/particles` provides fixed-capacity
Canvas effects, and the `@crc/core/viz` subpath provides [composable data
visualization](docs/site/learn/guides/data-visualization.md).
JSX is the preferred authoring
syntax, but CRC has its own renderer, hooks, element brand, and lifecycle: it
does not depend on React and it does not create DOM nodes.

## Quick start

Install the runtime:

```sh
pnpm add @crc/core
```

Particles, visualization, textures, and physics are included in this installation
as optional subpath imports. Unused physics contributes no Rapier code or WASM
to a production bundle. See the [package migration guide](docs/site/learn/guides/package-migration.md).

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

<!-- docs:complete-snippet:start readme-poster -->

```tsx
import {
  Group,
  Rectangle,
  Text,
  crc,
  useSignal,
  type CRCNode,
} from "@crc/core";

interface PosterProps {
  initialMessage: string;
}

function Poster({ initialMessage }: PosterProps): CRCNode {
  const message = useSignal(initialMessage);

  return (
    <Group>
      <Rectangle
        style={{
          width: 400,
          height: 240,
          fill: "#1f4bd8",
          cursor: "pointer",
        }}
        onClick={() => message.set("CRC!")}
      />
      <Text
        pointerEvents="none"
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

<!-- docs:complete-snippet:end -->

Uppercase imports such as `Rectangle`, `Text`, and `Group` are Canvas
components, not HTML elements. `crc()` owns at most one live mount per Canvas.
Signal and root updates coalesce onto `requestAnimationFrame`; each frame is a
full synchronous Canvas traversal. `controller.dispose()` is idempotent.

Prefer ordinary `.tsx` files with the project-wide configuration above. A
single file can instead begin with `/** @jsxImportSource @crc/core */`. One
file has one JSX runtime, so mixed React/CRC applications keep their JSX trees
in separate files or use an explicit element constructor for the minority
tree.

Need to avoid JSX entirely? The complete [`createElement` guide](docs/site/learn/guides/author-without-jsx.md)
starts from installation and mounting and does not require the JSX guides.

## Learn CRC

- [Configure JSX](docs/site/learn/guides/configure-jsx.md)
- [Author without JSX](docs/site/learn/guides/author-without-jsx.md)
- [Understand components, props, and children](docs/site/learn/guides/components-props-and-children.md)
- [Style and draw](docs/site/learn/guides/style-and-draw.md)
- [Compose and lay out scenes](docs/site/learn/guides/compose-and-layout.md)
- [Manage state and lifecycle](docs/site/learn/guides/state-and-lifecycle.md)
- [Integrate Three.js](docs/site/learn/guides/three-js.md)
- [Create particle effects](docs/site/learn/guides/particle-effects.md)
- [Add focus and keyboard navigation](docs/site/learn/guides/focus-and-keyboard.md)
- [Create custom components and primitives](docs/site/learn/guides/custom-components-and-primitives.md)
- [Integrate with React](docs/site/learn/guides/react-integration.md)
- [Troubleshoot JSX](docs/site/learn/guides/jsx-troubleshooting.md)
- [Learn the basics: Build a diagram editor](docs/site/learn/tutorials/diagram-editor/index.md)
- [API overview](docs/site/api/index.md) and [complete type reference](docs/site/api/types/canvas-runtime.md)

The [JSX migration guide](docs/migrations/jsx-authoring-pivot.md) maps the
removed factory-first API, and the [Signals-centric migration
guide](docs/migrations/signals-centric-hooks.md) maps the removed overlapping
hooks. There are no compatibility aliases.

## Explore the examples

Install Node 24.15+ on the Node 24 LTS line and the repository-pinned pnpm,
then run:

```sh
corepack pnpm@11.21.0 install --frozen-lockfile
corepack pnpm@11.21.0 playground
```

Open <http://localhost:5173/#/examples>. The CRC Interactive Examples Studio
contains 61 focused lessons: 60 use JSX and one demonstrates the complete
non-JSX API. Every lesson pairs a live Canvas with editable, type-aware source.
The separate `#/testing` area contains 26 deterministic laboratories used by
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
- Signals and hooks: `signal`, `computed`, `batch`, `untracked`, `isSignal`,
  `resolveSignalValue`, `useSignal`, `useComputed`, `useConst`, `useReaction`,
  `useRef`, `useCanvasContext`, `useRectPath`, `useLinePath`, `useSvgPath`,
  `useEvent`, `useEventTarget`, `useEventListener`, `useCursor`, and
  `useLayoutBox`
- Platform extension: `definePrimitive`, `defineRenderLayer`, the render-layer
  lifecycle/interaction types, style resolution, and pure measurement types
- Optional Three.js composition from `@crc/three`: `defineThreeLayer` and its
  lifecycle, renderer, input, picking, and target types; scenes, cameras,
  objects, controls, loaders, materials, lights, shadows, and effects remain
  ordinary imports from `three` and `three/addons/*`
- Optional particle effects from `@crc/core/particles`: `Particles2D`,
  `useParticleSystem`, immutable 2D definitions, and direct descriptor
  factories
- Optional CRC-owned 2D physics from `@crc/core/physics/2d`, with
  renderer-independent `/2d/geometry` and `/3d/geometry` subpaths; there is no
  root `@crc/core/physics` barrel or renderer-coupled 3D runtime
- Compiler-only entries: `@crc/core/jsx-runtime` and
  `@crc/core/jsx-dev-runtime`

The connected `@crc/core` and `@crc/core/physics/2d` runtime surfaces share the
`@crc/core` JSX runtime, element brand, scheduler, and event system.
`@crc/three` uses the public render-layer lifecycle and peers on the
application's Three installation. Renderer-independent physics `/geometry`
entries do not initialize the runtime or Rapier. The exported
`@crc/core/internal` friend seam is reserved for matching official CRC packages
and is not an application compatibility promise.

See the [API overview](docs/site/api/index.md) and [grouped type reference](docs/site/api/types/canvas-runtime.md)
for every value and type export, and [CRC library status](docs/library-status.md)
for supported behavior and evidence.

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
Canvas drawing primitives and registered render-layer targets participate in
hit testing by default; `pointerEvents="none"` is the explicit
decorative/pass-through opt-out, while structural handler props add propagation
listeners without target geometry.
CRC does not generate semantic DOM descendants or an accessibility tree;
applications remain responsible for an equivalent accessible DOM experience.
There is no editable-input adapter, rich text, scrolling, complete CSS engine,
retained Canvas scene graph, automatic Canvas/Three subprimitive interleaving,
or image CORS policy. External renderers are one flattened Canvas paint entry;
their scene capabilities and limitations remain their own. Canvas/`Path2D`,
font, decoded-image, `OffscreenCanvas`, and WebGL behavior remain browser-owned.

Physics adds no manual step API or second clock. Renderer pointer picking and
authoritative physics queries are distinct; applications explicitly construct
world-space physics rays when an interaction needs both. CRC physics does not
include joints, vehicles, character controllers, debug rendering, public
replay/history, workers, or 2.5D collision.

## License

MIT
