# Pibbl — Canvas Rendering Components

> **ALPHA — NOT FOR PRODUCTION USE.** Pibbl 0.0.1 is experimental. APIs may change or be removed without notice. Use it only for evaluation and experimentation.

Pibbl is a small functional component runtime for the HTML Canvas 2D API, with a
public external-render-layer lifecycle and an optional first-class `@pibbl/three`
adapter for ordinary Three.js scenes. `@pibbl/core/particles` provides fixed-capacity
Canvas effects, and the `@pibbl/core/viz` subpath provides [composable data
visualization](docs/site/learn/guides/data-visualization.md).
JSX is the preferred authoring
syntax, but Pibbl has its own renderer, hooks, element brand, and lifecycle: it
does not depend on React. Canvas drawing stays on Canvas; opt-in `HtmlBox`
regions host application-owned DOM content.

## Alpha packages

Version `0.0.1` is an **alpha release, not for production use**, including when
installed through the `latest` or `next` npm tag.

- `pibbl` mirrors all `@pibbl/core` entry points and shares its runtime instance.
- `@pibbl/core` contains the Canvas runtime and optional feature subpaths.
- `@pibbl/three` integrates ordinary Three.js scenes.
- `@pibbl/text` provides text shaping and outlines.

## Quick start

Install the runtime:

```sh
pnpm add @pibbl/core
```

Particles, visualization, textures, and physics are included in this installation
as optional subpath imports. Unused physics contributes no Rapier code or WASM
to a production bundle. See the [package migration guide](docs/site/learn/guides/package-migration.md).

Configure TypeScript's automatic JSX runtime:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@pibbl/core"
  }
}
```

Create a Canvas and a Pibbl scene:

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
  pibbl,
  useSignal,
  type PibblNode,
} from "@pibbl/core";

interface PosterProps {
  initialMessage: string;
}

function Poster({ initialMessage }: PosterProps): PibblNode {
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
        onClick={() => message.set("Pibbl!")}
      />
      <Text
        pointerEvents="none"
        style={{
          left: 200,
          top: 100,
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
const controller = pibbl(canvas, <Poster initialMessage="Hello" />);

// Release listeners, frames, hooks, layers, and the mount when the page leaves.
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
```

<!-- docs:complete-snippet:end -->

Uppercase imports such as `Rectangle`, `Text`, and `Group` are Canvas
components, not HTML elements. `pibbl()` owns at most one live mount per Canvas.
Signal and root updates coalesce onto `requestAnimationFrame`; each frame is a
full synchronous Canvas traversal. `controller.dispose()` is idempotent.

Prefer ordinary `.tsx` files with the project-wide configuration above. A
single file can instead begin with `/** @jsxImportSource @pibbl/core */`. One
file has one JSX runtime, so mixed React/Pibbl applications keep their JSX trees
in separate files or use an explicit element constructor for the minority
tree.

Need to avoid JSX entirely? The complete [`createElement` guide](docs/site/learn/guides/author-without-jsx.md)
starts from installation and mounting and does not require the JSX guides.

## Learn Pibbl

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
corepack pnpm@11.21.0 build
corepack pnpm@11.21.0 website
```

Open <http://localhost:4321/playground/>. Documentation, API search, examples,
and the editable live preview share one website. API details incorporate JSDoc
and link to the exact source snapshot used for the build.

The legacy Studio remains a private development and verification tool:
`corepack pnpm@11.21.0 studio:dev` serves its test laboratories at
<http://localhost:5173/#/testing>. It is not needed to run or deploy the website.

To exercise built package output instead of source aliases:

```sh
corepack pnpm@11.21.0 playground:built
```

## Public surface

- Runtime and authoring: `pibbl`, `createElement`, `Fragment`, `PibblElement`,
  `PibblComponent`, `PibblNode`, and `PibblController`
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
- Optional Three.js composition from `@pibbl/three`: `defineThreeLayer` and its
  lifecycle, renderer, input, picking, and target types; scenes, cameras,
  objects, controls, loaders, materials, lights, shadows, and effects remain
  ordinary imports from `three` and `three/addons/*`
- Optional particle effects from `@pibbl/core/particles`: `Particles2D`,
  `useParticleSystem`, immutable 2D definitions, and direct descriptor
  factories
- Optional Pibbl-owned 2D physics from `@pibbl/core/physics/2d`, with
  renderer-independent `/2d/geometry` and `/3d/geometry` subpaths; there is no
  root `@pibbl/core/physics` barrel or renderer-coupled 3D runtime
- Compiler-only entries: `@pibbl/core/jsx-runtime` and
  `@pibbl/core/jsx-dev-runtime`

The connected `@pibbl/core` and `@pibbl/core/physics/2d` runtime surfaces share the
`@pibbl/core` JSX runtime, element brand, scheduler, and event system.
`@pibbl/three` uses the public render-layer lifecycle and peers on the
application's Three installation. Renderer-independent physics `/geometry`
entries do not initialize the runtime or Rapier. The exported
`@pibbl/core/internal` friend seam is reserved for matching official Pibbl packages
and is not an application compatibility promise.

See the [API overview](docs/site/api/index.md) and [grouped type reference](docs/site/api/types/canvas-runtime.md)
for every value and type export, and [Pibbl library status](docs/library-status.md)
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

Pibbl supports explicit Canvas targets and DOM-aligned pointer, mouse, touch,
wheel, keyboard/focus, editing/composition, clipboard, and drag/drop event
facades. Optional focus policies use the Canvas as the one native focus host.
Canvas drawing primitives and registered render-layer targets participate in
hit testing by default; `pointerEvents="none"` is the explicit
decorative/pass-through opt-out, while structural handler props add propagation
listeners without target geometry.
Pibbl does not generate semantic DOM descendants or an accessibility tree;
applications remain responsible for an equivalent accessible DOM experience.
There is no editable-input adapter, rich text, scrolling, complete CSS engine,
retained Canvas scene graph, automatic Canvas/Three subprimitive interleaving,
or image CORS policy. External renderers are one flattened Canvas paint entry;
their scene capabilities and limitations remain their own. Canvas/`Path2D`,
font, decoded-image, `OffscreenCanvas`, and WebGL behavior remain browser-owned.

Physics adds no manual step API or second clock. Renderer pointer picking and
authoritative physics queries are distinct; applications explicitly construct
world-space physics rays when an interaction needs both. Pibbl physics does not
include joints, vehicles, character controllers, debug rendering, public
replay/history, workers, or 2.5D collision.

## License

MIT
