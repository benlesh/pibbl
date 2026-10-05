# Filter factory migration

Status: implemented, 2026-10-01.

Filters are now opaque factory values imported from @pibbl/core/filters. The former
object descriptors are not accepted, including values with a type, kind, or
filter-like shape. This is intentionally source-breaking so unused filter
engines can be omitted from an application bundle.

Before:

```tsx
<Group style={{ filter: { type: "blur", radius: 2 } }} />
```

After:

```tsx
import { blur, dropShadow } from "@pibbl/core/filters";

<Group
  style={{
    filter: [
      blur({ radius: 2 }),
      dropShadow({ offsetX: 2, offsetY: 3, blurRadius: 1, color: "#0008" }),
    ],
  }}
/>;
```

A single factory result and a readonly ordered list are both supported. Lists
run forward in the order written. An empty list remains a direct-path no-op.
Import PibblFilter from @pibbl/core, and import individual option types with their
factory from @pibbl/core/filters.

Use the new optional displacement effect only with a mounted texture paint:

```tsx
import { Group, useTexture } from "@pibbl/core";
import { displacement } from "@pibbl/core/filters";
import { waterWaves } from "@pibbl/core/textures";

const water = useTexture(waterWaves({ speed: 0.7 }));
const map = water.paint({ mode: "repeat", tileWidth: 96, tileHeight: 96 });

<Group
  style={{
    filter: displacement({
      map,
      strength: 4,
      region: { x: 0, y: 0, width: 320, height: 180 },
    }),
  }}
>
  {children}
</Group>;
```

strength is a logical pixel distance and must be finite and nonnegative. region
requires finite positive dimensions. A zero strength still validates the map but
performs no raster borrow or GPU work. Raw Canvas sources and ordinary
lookalike objects are not texture maps.

The migration does not change interaction: filters and displacement affect
appearance only. Layout, measurement, hit areas, pointer coordinates, focus,
physics, and application animation semantics keep their unfiltered geometry.

There is no compatibility alias, descriptor adapter, arbitrary shader API, or
CPU fallback. Native filters need browser OffscreenCanvas and Canvas filter;
nonzero displacement needs OffscreenCanvas WebGL2. Handle those render errors
in the same way as other browser capability errors.
