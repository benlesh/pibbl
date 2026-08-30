# CRC — Canvas Rendering Components

CRC is a small functional component runtime for the HTML Canvas 2D API. It provides scheduled rendering, hook state, DOM-aligned user events, transforms, clipping, offscreen layers, and composable drawing primitives without requiring JSX.

## Quick start

```ts
import { crc, defineComp, rect, text } from "@crc/core";

const Scene = defineComp(() => [
  rect({
    style: {
      x: 24,
      y: 24,
      width: 180,
      height: 96,
      fill: "#2563eb",
      cursor: "pointer",
    },
    onClick: () => console.log("clicked"),
  }),
  text({
    style: {
      text: "Hello, Canvas",
      x: 48,
      y: 58,
      font: "20px sans-serif",
      fill: "white",
    },
  }),
]);

const canvas = document.querySelector("canvas")!;
const controller = crc(canvas, Scene({}));

// Later:
controller.dispose();
```

`crc()` mounts one component tree per Canvas and returns a stable controller. Updates are scheduled on the next animation frame. Components and hooks are ordinary TypeScript functions; drawing is performed by the browser's Canvas implementation.

## Explore the examples

Install Node 24.15+ and the repository-pinned pnpm, then run:

```sh
corepack pnpm@11.21.0 install --frozen-lockfile
corepack pnpm@11.21.0 playground
```

Open <http://localhost:5173/>. The CRC Interactive Examples Studio opens at
`#/examples` with 28 focused lessons: getting started, drawing and composition
primitives, supported user events, advanced interaction studies, and four
layout lessons covering absolute/overlay, Flow, Flex, and Grid. Each page pairs
a large live Canvas with editable, type-aware TypeScript, inline diagnostics,
automatic reruns, reset/copy/share/format controls, and focused practice prompts.

The exhaustive deterministic fixtures used by browser verification remain available under the visually separate `#/testing` area. Old `#/scenarios` links redirect there. Learning examples and test labs have separate catalogs, but both continue to exercise CRC through its public API.

To exercise built package output instead of source aliases:

```sh
corepack pnpm@11.21.0 playground:built
```

## Public surface

- Runtime: `crc`, `defineComp`, `CRCController`
- Drawing: `rect`, `path`, `line`, `horizontalLine`, `verticalLine`, `svgPath`, `text`, `img`, `g`, `clip`, `layer`
- Layout: `absolute`, `overlay`, `flow`, `flex`, `grid`, `measureElement`
- Hooks: `crcState`, `crcMemo`, `crcRef`, `crcWhenChanged`, `crcRectPath`, `crcLinePath`, `crcSvgPath`, `crcEvent`, `crcEventTarget`, `crcEventListener`, `crcCursor`, `crcLayoutBox`
- Types: component styles, `Length`, `Percentage`, box/layout-item styles, layout diagnostics, measurement inputs/results, controller contracts, and DOM-aligned event facades/handlers/targets

The current supported behavior and limitations are indexed in [CRC library
status](docs/library-status.md). Detailed contracts cover the [style
system](docs/design/style-system-contract.md), [layout
system](docs/design/layout-system-contract.md),
[drawing](docs/design/drawing-components-contract.md), [runtime and
hooks](docs/design/runtime-hooks-contract.md), [user
events](docs/design/user-events-contract.md), retained [mouse geometry and
legacy behavior](docs/design/mouse-interaction-contract.md), and [resource
ownership](docs/design/runtime-resource-ownership.md).

## Contributing

After installing dependencies and Chromium, run the repository trust gate:

```sh
corepack pnpm@11.21.0 exec playwright install chromium
corepack pnpm@11.21.0 trust
```

The individual verification commands remain available in `package.json`. See the [trust-gate guide](docs/testing/trust-gate.md) for clean-checkout setup, performance cadence, visual failure safeguards, and CI mapping.

## Deliberate boundaries

CRC supports pointer, mouse, touch, wheel, keyboard/focus,
editing/composition, clipboard, and drag/drop event facades with explicit
targets, propagation, cancellation, logical related targets, and pointer
capture. A plain Canvas has no logical target for native keyboard, focus,
editing, composition, or clipboard input without future/optional focus/input
integration, and CRC exposes no public input adapter or built-in focus policy.
DOM accessibility, hidden editable DOM, JSX, rich text, image CORS policy,
scrolling, a complete CSS formatting engine, and a published documentation site
are not part of the current package contract. Canvas/`Path2D` parsing, font
rasterization, decoded-image edges, and `OffscreenCanvas` availability remain
browser/platform behavior.

## License

MIT
