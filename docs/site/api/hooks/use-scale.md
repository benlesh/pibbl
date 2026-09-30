---
id: api-hook-use-scale
title: useScale
summary: Reads the nearest named scale as a core readonly signal.
kind: api
slug: use-scale
apiCategory: hook
symbols: [useScale]
---

# useScale

Import `useScale` from `@crc/viz`. Call `useScale(id)` in a component to obtain
`Signal<ResolvedLinearScale>`, then call `.get()` where the dependency should be owned.
The returned signal has stable identity for that provider mount. Its immutable
value changes when the resolved domain, range, or local frame changes.

Use `useScale(id, "band")` for `Signal<ResolvedBandScale>`. The default family is
linear; reading a mismatched family throws an actionable error. Band snapshots
expose `bandwidth`, `step`, and category mapping instead of numeric inversion.

Lookup requires an enclosing matching [`Scale`](#/api/components/scale).
Unknown IDs and use outside component evaluation throw. Hooks must keep their
ordinary call order. IDs do not connect unrelated roots or cross Layer boundaries.

Scale formulas use core transactional `useComputed`: successful traversal commits
updates, failed traversal rolls back candidate formulas, and removal releases
consumer dependencies. There is no separate visualization subscription loop.

`useScale(id, "utc")` returns `Signal<ResolvedUtcScale>`.
`useScale(id, "continuous")` accepts either linear or UTC and returns
`Signal<ResolvedContinuousScale>`. Both retain numeric map/invert coordinates.
The default and explicit `"linear"` overloads still require a linear provider.
