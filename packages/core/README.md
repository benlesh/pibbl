# @crc/core

The public runtime, hooks, mouse interaction, and drawing components for CRC (Canvas Rendering Components).

```ts
import { crc, defineComp, rect } from "@crc/core";

const Scene = defineComp(() =>
  rect({
    style: {
      x: 20,
      y: 20,
      width: 120,
      height: 80,
      fill: "#2563eb",
    },
  }),
);

const controller = crc(document.querySelector("canvas")!, Scene({}));
controller.dispose();
```

The package publishes ESM runtime code, source maps, and TypeScript declarations. Use only documented root exports; internal `@crc/core/lib/*` subpaths are intentionally not exported.

Drawing components whose closed schema has required fields take a required local
`style` object. A component whose entire style schema is optional may omit it;
this includes layout containers when their defaults are sufficient. Styles do
not cascade or inherit; compose shared objects explicitly. CRC includes
dedicated absolute, overlay, Flow, Flex, and explicit Grid components plus pure
opt-in measurement and local `crcLayoutBox` observation.

See the repository [README](../../README.md), [feature
inventory](../../docs/library-status.md), [style
contract](../../docs/design/style-system-contract.md), [layout
contract](../../docs/design/layout-system-contract.md), and [scenario gallery
guide](../../docs/testing/scenario-gallery.md).
