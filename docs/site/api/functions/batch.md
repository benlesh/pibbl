---
id: api-function-batch
title: batch
summary: Groups synchronous signal writes into one notification wave.
kind: api
slug: batch
apiCategory: function
symbols: [batch]
relatedTypes: [Signal, WritableSignal]
---

# batch

`batch(callback)` runs a synchronous callback and returns its result. Writes are
readable immediately, nested batches share the outer batch, and affected
consumers are notified at most once when the outer callback exits.

If the callback throws, completed writes remain committed and notifications
flush before the callback error is rethrown. Pibbl event dispatches use the same
batching boundary automatically.

Related types: [`Signal`](#/api/types/canvas-runtime#signal) and
[`WritableSignal`](#/api/types/canvas-runtime#writablesignal).
