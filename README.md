# CRC — Canvas Rendering Components

CRC is a small functional component runtime for the HTML Canvas 2D API. It provides scheduled rendering, hook state, mouse-region interaction, transforms, clipping, offscreen layers, and composable drawing primitives without requiring JSX.

## Quick start

```ts
import { crc, defineComp, rect, text } from "@crc/core";

const Scene = defineComp(() => [
  rect({
    x: 24,
    y: 24,
    width: 180,
    height: 96,
    fillStyle: "#2563eb",
    cursor: "pointer",
    onClick: () => console.log("clicked"),
  }),
  text({
    text: "Hello, Canvas",
    x: 48,
    y: 58,
    font: "20px sans-serif",
    fillStyle: "white",
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

Open <http://localhost:5173/>. The gallery includes a baseline walkthrough, five documentation-candidate drawing lessons, and trusted interaction, geometry, performance, lifecycle, and hook laboratories. Every displayed example is the same public-API source exercised by headless Chromium.

To exercise built package output instead of source aliases:

```sh
corepack pnpm@11.21.0 playground:built
```

## Public surface

- Runtime: `crc`, `defineComp`, `CRCController`
- Drawing: `rect`, `path`, `line`, `horizontalLine`, `verticalLine`, `svgPath`, `text`, `img`, `g`, `clip`, `layer`
- Hooks: `crcState`, `crcMemo`, `crcRef`, `crcWhenChanged`, `crcRectPath`, `crcLinePath`, `crcSvgPath`, `crcEvent`, `crcCursor`

The current supported behavior and limitations are indexed in [CRC library status](docs/library-status.md). Detailed contracts cover [drawing](docs/design/drawing-components-contract.md), [runtime and hooks](docs/design/runtime-hooks-contract.md), [mouse interaction](docs/design/mouse-interaction-contract.md), and [resource ownership](docs/design/runtime-resource-ownership.md).

## Contributing

After installing dependencies and Chromium, run the repository trust gate:

```sh
corepack pnpm@11.21.0 exec playwright install chromium
corepack pnpm@11.21.0 trust
```

The individual verification commands remain available in `package.json`. See the [trust-gate guide](docs/testing/trust-gate.md) for clean-checkout setup, performance cadence, visual failure safeguards, and CI mapping.

## Deliberate boundaries

CRC currently supports mouse interaction only. Pointer/touch, keyboard focus, DOM accessibility, JSX, layout, rich text, image CORS policy, and a published documentation site are not part of the current package contract. Canvas/`Path2D` parsing, font rasterization, decoded-image edges, and `OffscreenCanvas` availability remain browser/platform behavior.

## License

MIT
