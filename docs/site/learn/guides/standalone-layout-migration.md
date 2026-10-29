---
id: guide-standalone-layout-migration
title: Standalone layout migration
summary: Move an owned Yoga-style layout tree to Pibbl's renderer-neutral layout package.
kind: guide
slug: standalone-layout-migration
order: 165
keywords: [layout, Yoga, migration, standalone, snapshots]
---

`@pibbl/layout` is for framework authors who retain their renderer, events, and
scheduler. It owns one mutable layout tree and uses the same native layout kernel
as Pibbl core. It does not import Canvas rendering or create a scheduler.

```ts
import { createLayoutTree, prepareLayout } from "@pibbl/layout";

await prepareLayout();
const tree = createLayoutTree();
const sidebar = tree.createNode({ style: { width: 240, flexShrink: 0 } });
const root = tree.createNode({ style: { flexDirection: "row" } });
tree.appendChild(root, sidebar);

const snapshot = tree.calculateLayout({ root, width: 960, height: 640 });
applyGeometry(snapshot.getBox(sidebar));
tree.dispose();
```

A node belongs to exactly one tree and can have one parent. Insertions that would
create a cycle, cross-tree handles, or calls after disposal fail immediately.
Snapshots are immutable: retain one while applying geometry, then request another
after changing style or tree ownership.

## Keep intrinsic ownership explicit

The owned tree supports native Flex and Grid placement. A Grid node declares
`layout: 'grid'`, its templates, automatic tracks, source-order flow, and item
starts or spans. Use `measureIntrinsic()` for content contributions to intrinsic
Grid tracks and `measure(constraints)` when the native owner asks for a final
finite box. `fitContent(limit)`, `minmax`, and `repeat` records are ordinary
style data; `auto-fill` and `auto-fit` expand against the native owner's actual
axis, including a nested Grid allocation.

## Convert deliberately

Use the versioned Yoga converter before replacing old setters. It reports every
unsupported or ambiguous source property rather than dropping it.

```ts
import { analyzeYoga32Tree, convertYoga32Style } from "@pibbl/layout";

const style = convertYoga32Style(yogaStyle, {
  useWebDefaults: false,
  direction: "ltr",
  pointScaleFactor: 0,
});
const report = analyzeYoga32Tree(yogaTree, { useWebDefaults: false });
```

Yoga's `isReferenceBaseline` is deliberately unsupported. It changes source
selection and cannot be translated to a last-baseline request. Review the report,
then make an explicit application-level migration decision.
