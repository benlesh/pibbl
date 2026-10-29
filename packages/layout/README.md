# `@pibbl/layout`

> **ALPHA — NOT FOR PRODUCTION USE.** This package is versioned with the Pibbl
> alpha release and its API may change before a stable release.

`@pibbl/layout` gives framework authors a renderer-neutral, owned Pibbl layout
boundary. The native layout engine is Pibbl's default layout runtime. This package
uses the same version-matched native kernel without importing Canvas, signals,
hooks, or the frame scheduler. `prepareLayout()` uses the embedded module, so
Node hosts need neither a DOM nor a separate layout-WASM asset server.

The package exposes the supported owned-tree and versioned Yoga migration
contracts. It diagnoses unsupported source or style behavior instead of selecting
an alternate JavaScript layout engine.

```ts
import { createLayoutTree, prepareLayout } from "@pibbl/layout";

await prepareLayout();
const tree = createLayoutTree();
const label = tree.createNode({ style: { width: 120, height: 24 } });
const root = tree.createNode({ style: { flexDirection: "row", gap: 8 } });
tree.appendChild(root, label);
const snapshot = tree.calculateLayout({ root, width: 640, height: 480 });
const box = snapshot.getBox(label);
tree.dispose();
```

Handles belong to exactly one tree. Trees reject cross-tree handles, cycles, stale
handles, and mutation after disposal. Snapshots are immutable and remain readable
until their tree is disposed. The caller owns painting, event routing, scheduling,
and any content revisions used by measurement callbacks.

Use `layout: 'grid'` with `gridTemplateColumns`, `gridTemplateRows`, explicit
starts and spans, configured implicit tracks, `gridAutoFlow`, `minmax`,
`fitContent`, and fixed, `auto-fill`, or `auto-fit` repeats. Grid intrinsic
tracks request an explicit paired `measureIntrinsic()` result; ordinary final-box
measurement uses `measure(constraints)`. The native tree owns placement, track
resolution, spans, and automatic cells. It never calls application callbacks
outside a synchronous `calculateLayout()` pass.

See [`examples/yoga32-migration.mts`](./examples/yoga32-migration.mts) for a renderer-free recursive conversion into an owned tree with immutable resize snapshots. It demonstrates the supported migration boundary; it does not claim a drop-in Yoga compatibility API.

Yoga migration is intentionally separate:

```ts
import {
  analyzeYoga32Tree,
  assertYoga32Converted,
  convertYoga32Style,
} from "@pibbl/layout";

const result = convertYoga32Style({ flex_direction: "row", width: 240 });
const style = assertYoga32Converted(result);
const report = analyzeYoga32Tree(sourceTree, { useWebDefaults: false });
```

Both conversion and analysis return every diagnostic. Unsupported inputs, including
Yoga reference-baseline flags, are diagnosed rather than ignored or translated to
a different baseline policy.
