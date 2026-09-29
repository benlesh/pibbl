# CRC — Canvas Rendering Components

CRC is a small functional component runtime for the HTML Canvas 2D API, with an
optional `@crc/webgl` package for WebGL2 islands and `@crc/particles` for
fixed-capacity Canvas and instanced WebGL effects. The optional `@crc/viz` package
provides [composable data visualization](docs/site/learn/guides/data-visualization.md).
JSX is the preferred authoring
syntax, but CRC has its own renderer, hooks, element brand, and lifecycle: it
does not depend on React and it does not create DOM nodes.

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
- [Add WebGL islands](docs/site/learn/guides/webgl-islands.md)
- [Light WebGL scenes](docs/site/learn/guides/webgl-lighting.md)
- [Create particle effects](docs/site/learn/guides/particle-effects.md)
- [Add first-class 3D physics](docs/site/learn/guides/physics-3d.md)
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
contains 72 focused lessons: 71 use JSX and one demonstrates the complete
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
- Platform extension: `definePrimitive` plus style-resolution and pure
  measurement types
- Optional WebGL2 islands from `@crc/webgl`: `WebGLLayer`, `Group3D`, `Mesh`,
  `Cube`, `Sphere`, five analytic lights, `WebGLBackground`,
  `createWebGLGeometry`, `useAnimationFrame`, `useOrbitCamera`, and their public
  camera, orbit, geometry, material, shadow, transform, and component types
- Optional particle effects from `@crc/particles`: `Particles2D`,
  `useParticleSystem`, immutable 2D definitions, and direct descriptor
  factories; `@crc/particles/webgl` adds `Particles3D` and immutable 3D
  definitions without making WebGL a dependency of root-only consumers
- Optional CRC-owned physics from dimension-specific `@crc/physics/2d` and
  `@crc/physics/3d` entries, with renderer-independent `/geometry` subpaths;
  there is deliberately no root `@crc/physics` barrel
- Compiler-only entries: `@crc/core/jsx-runtime` and
  `@crc/core/jsx-dev-runtime`

The connected `@crc/core`, `@crc/webgl`, `@crc/physics/2d`, and
`@crc/physics/3d` runtime surfaces share the `@crc/core` JSX runtime, element
brand, scheduler, and event system. This does not describe `@crc/types` or the
renderer-independent physics `/geometry` entries. The exported
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
Canvas and WebGL drawing primitives participate in hit testing by default;
`pointerEvents="none"` is the explicit decorative/pass-through opt-out, while
structural handler props add propagation listeners without target geometry.
CRC does not generate semantic DOM descendants or an accessibility tree;
applications remain responsible for an equivalent accessible DOM experience.
There is no editable-input adapter, rich text, scrolling, complete CSS engine,
retained scene graph, WebGL1/WebGPU fallback, multi-camera island, Canvas/WebGL
subprimitive interleaving, public raw WebGL/shader extension, textures, image
environments/IBL, PBR, glow/bloom, area lights, cascaded/soft/contact/
transparent shadows, or image CORS policy. Inside one WebGL island, children
declare a settled scene; source order governs identity and ties while the
renderer plans genuine shadow-depth passes followed by opaque and transparent
color queues. Canvas/`Path2D`, font, decoded-image, `OffscreenCanvas`, and
WebGL2 behavior remain browser-owned.

Physics adds no manual step API or second clock. Renderer pointer picking and
authoritative physics queries are distinct; applications explicitly construct
world-space physics rays when an interaction needs both. CRC physics does not
include joints, vehicles, character controllers, debug rendering, public
replay/history, workers, or 2.5D collision.

## License

MIT
