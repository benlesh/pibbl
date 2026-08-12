# @crc/core

The public runtime, hooks, mouse interaction, and drawing components for CRC (Canvas Rendering Components).

```ts
import { crc, defineComp, rect } from "@crc/core";

const Scene = defineComp(() =>
  rect({
    x: 20,
    y: 20,
    width: 120,
    height: 80,
    fillStyle: "#2563eb",
  }),
);

const controller = crc(document.querySelector("canvas")!, Scene({}));
controller.dispose();
```

The package publishes ESM runtime code, source maps, and TypeScript declarations. Use only documented root exports; internal `@crc/core/lib/*` subpaths are intentionally not exported.

See the repository [README](../../README.md), [feature inventory](../../docs/library-status.md), and [scenario gallery guide](../../docs/testing/scenario-gallery.md).
