---
id: api-function-pibbl-sync
title: pibblSync
summary: Mounts synchronously with the separately embedded layout binary.
kind: api
slug: pibbl-sync
apiCategory: function
symbols: [pibblSync]
relatedTypes: [PibblConfig, PibblController, PibblNode]
---

# pibblSync

```tsx
import { Rectangle } from "@pibbl/core";
import { pibblSync } from "@pibbl/core/sync";

const controller = pibblSync(
  document.querySelector("canvas")!,
  <Rectangle style={{ width: 160, height: 80, fill: "#2563eb" }} />,
);
// Later: controller.dispose();
```

The root is a [PibblNode](#/api/types/elements-components#pibblnode), configuration
uses [PibblConfig](#/api/types/canvas-runtime#pibblconfig), and the return value is
[PibblController](#/api/types/canvas-runtime#pibblcontroller).

`pibblSync(canvas, root, config?): PibblController` synchronously prepares the
embedded version of the same generated layout binary and mounts or updates the
canvas. It does not fetch or wait for a Promise. Use this separate entry for
intentionally synchronous or offline hosts. The root package does not re-export
this operation or include its embedded bytes in asynchronous-only bundles.

If [prepareLayoutEngine](#/api/functions/prepare-layout-engine) or an earlier
[pibbl](#/api/functions/pibbl) call has prepared the compatible module, synchronous
mounting reuses it without decoding or compiling again. Compiled code is shared;
mutable layout instances and memory remain owned by their respective mounts.

Initialization and mount failures throw synchronously. An already aborted caller
throws `AbortError`. New same-canvas requests supersede older pending requests;
existing live mounts retain their stable controller and originally captured
surface/lifetime configuration. Disposing the live mount invalidates a pending
update so it cannot resurrect the released mount. Importing the sync entry alone
performs no decoding, compilation, instantiation or scheduling.
