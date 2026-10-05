---
id: api-hook-use-scale
title: Scale hooks
summary: Read a named linear, categorical, or UTC scale with an explicit typed hook.
kind: api
slug: use-scale
apiCategory: hook
symbols: [useLinearScale, useBarScale, useUTCScale]
---

# Scale hooks

Import from `@pibbl/core/viz`. Each hook accepts only an ancestor scale ID and
returns a stable, shared readonly core signal:

```ts
useLinearScale(id: ScaleId): Signal<ResolvedLinearScale>;
useBarScale(id: ScaleId): Signal<ResolvedBandScale>;
useUTCScale(id: ScaleId): Signal<ResolvedUtcScale>;
```

Call `.get()` to read the immutable mapping and track its dependencies. Consumers
of the same provider and hook share signal identity across domain, range, and
allocation changes. Reading a different family throws when `.get()` is called.

Use the matching `LinearScale`, `BarScale`, or `UTCScale` provider. Nearest matching
IDs shadow ancestors. Unknown IDs, use outside component evaluation, and crossing
Layer boundaries throw. Keep hooks in ordinary stable call order.

Provider formulas use transactional core `useComputed`: successful traversal
commits updates; failed traversal rolls back candidate formulas. Core computed
signals release subscriptions when unobserved. There is no separate visualization
subscription loop. Each family has its own importable implementation; there is no
public `useScale` overload or family-selector argument.
