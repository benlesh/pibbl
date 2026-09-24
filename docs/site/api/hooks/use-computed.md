---
id: api-hook-use-computed
title: useComputed
summary: Owns one lazy readonly computed signal for a mounted component hook slot.
kind: api
slug: use-computed
apiCategory: hook
symbols: [useComputed]
relatedTypes: [Signal, SignalOptions]
---

# useComputed

`useComputed(compute, dependencies?, options?)` returns one stable readonly
[`Signal`](#/api/types/canvas-runtime#signal) for a mounted component hook slot.
Signal reads inside `compute` are tracked dynamically. The optional dependency
array lists captured non-signal values and compares its positions with
`Object.is`.

The formula remains lazy. Dependency changes are adopted only after a
successful render, and result equality prevents unnecessary downstream
invalidation. A retained signal continues using its last successfully committed
formula after its owner is removed.

Related types: [`Signal`](#/api/types/canvas-runtime#signal) and
[`SignalOptions`](#/api/types/canvas-runtime#signaloptions).
