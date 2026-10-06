---
id: api-hook-use-scale
title: Scale hooks
summary: Read a named positional scale with its dedicated typed hook.
kind: api
slug: use-scale
apiCategory: hook
symbols: [useLinearScale, useBarScale, useUTCScale]
---

# Scale hooks

Import from `@pibbl/core/viz`. Each hook accepts only an ancestor scale ID and
returns a stable, shared readonly core signal:

```ts
import type { Signal } from "@pibbl/core";
import type {
  ScaleId,
  ResolvedLinearScale,
  ResolvedBandScale,
  ResolvedUtcScale,
  ResolvedLogScale,
  ResolvedSymlogScale,
  ResolvedPointScale,
} from "@pibbl/core/viz";
declare function useLinearScale(id: ScaleId): Signal<ResolvedLinearScale>;
declare function useBarScale(id: ScaleId): Signal<ResolvedBandScale>;
declare function useUTCScale(id: ScaleId): Signal<ResolvedUtcScale>;
declare function useLogScale(id: ScaleId): Signal<ResolvedLogScale>;
declare function useSymlogScale(id: ScaleId): Signal<ResolvedSymlogScale>;
declare function usePointScale(id: ScaleId): Signal<ResolvedPointScale>;
```

Call `.get()` to read the immutable mapping and track its dependencies. Consumers
of the same provider and hook share signal identity across domain, range, and
allocation changes. Reading a different family throws when `.get()` is called.

Use the matching `LinearScale`, `BarScale`, `UTCScale`, `LogScale`, `SymlogScale`,
or `PointScale` provider. The [log](#/api/components/log-scale) and
[symlog/point](#/api/components/symlog-point-scales) references describe their
family-specific mappings and hooks. Nearest matching
IDs shadow ancestors. Unknown IDs, use outside component evaluation, and crossing
Layer boundaries throw. Keep hooks in ordinary stable call order.

Provider formulas use transactional core `useComputed`: successful traversal
commits updates; failed traversal rolls back candidate formulas. Core computed
signals release subscriptions when unobserved. There is no separate visualization
subscription loop. Each family has its own importable implementation; there is no
public `useScale` overload or family-selector argument.
