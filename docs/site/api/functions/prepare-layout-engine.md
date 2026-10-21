---
id: api-function-prepare-layout-engine
title: prepareLayoutEngine
summary: Fetches and compiles the external layout engine before mounting.
kind: api
slug: prepare-layout-engine
apiCategory: function
symbols: [prepareLayoutEngine]
relatedTypes: []
---

# prepareLayoutEngine

```ts
import { prepareLayoutEngine } from "@pibbl/core";

await prepareLayoutEngine();
```

`prepareLayoutEngine(): Promise<void>` fetches and compiles the external generated
layout WASM asset. It creates no mount, instance, arena, signal subscription or
animation frame. Concurrent callers share one attempt. A ready compatible module
is reused by both [pibbl](#/api/functions/pibbl) and
[pibblSync](#/api/functions/pibbl-sync).

A failed fetch, HTTP response, fingerprint check or compilation rejects with asset
and phase context. The failed attempt is evicted; a later call can retry. This
operation has no cancellation argument because it warms shared immutable code.
A mount can cancel its own wait through `PibblConfig.signal`.

Importing the package does not fetch or compile the engine. HTML preload with
matching URL and credentials can warm the network cache independently; it does not
compile WASM. Serve the emitted `.wasm` asset with the application, including its
deployment base path, with `application/wasm` MIME type. Fingerprint verification
uses Web Crypto, so deploy over HTTPS or a trusted localhost origin. External fetch follows normal CORS requirements; CSP must
permit the fetch and WebAssembly compilation. The asynchronous entry excludes the
separate embedded binary payload.
