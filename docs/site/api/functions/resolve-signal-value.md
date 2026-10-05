---
id: api-function-resolve-signal-value
title: resolveSignalValue
summary: Resolves one plain-or-signal component input.
kind: api
slug: resolve-signal-value
apiCategory: function
symbols: [resolveSignalValue]
relatedTypes: [Signal, SignalValue]
---

# resolveSignalValue

`resolveSignalValue(value)` returns a plain value unchanged or reads one Pibbl
signal with `get()`. It resolves exactly one level: it does not inspect arrays,
objects, functions, or a signal returned by another signal.

When called during component evaluation, the receiving component owns the
dependency. Outside a tracked evaluation it behaves like an ordinary snapshot
read.

Related types: [`Signal`](#/api/types/canvas-runtime#signal) and
[`SignalValue`](#/api/types/signal-inputs#signalvalue).
