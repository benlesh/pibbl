---
id: api-function-computed
title: computed
summary: Creates a lazy cached readonly signal from dynamic dependencies.
kind: api
slug: computed
apiCategory: function
symbols: [computed]
relatedTypes: [Signal, SignalOptions]
---

# computed

`computed(compute, options?)` returns a readonly [`Signal`](#/api/types/canvas-runtime#signal).
It evaluates lazily, caches its value, and replaces its synchronous dependency
edges after each successful evaluation. Equality defaults to `Object.is`.

Computed functions cannot write signals, including equality no-ops, and cycles
are rejected with a diagnostic.

See the [signals and scheduling contract](../../../design/signals-and-scheduling-contract.md).

Related types: [`Signal`](#/api/types/canvas-runtime#signal),
[`SignalOptions`](#/api/types/canvas-runtime#signaloptions).
