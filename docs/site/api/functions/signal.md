---
id: api-function-signal
title: signal
summary: Creates a writable value for explicit reads or declared signal-valued inputs.
kind: api
slug: signal
apiCategory: function
symbols: [signal]
relatedTypes: [Signal, WritableSignal, SignalOptions]
---

# signal

`signal(initialValue, options?)` returns a [`WritableSignal`](#/api/types/canvas-runtime#writablesignal).
Read with `get()`, replace with `set(value)`, update from the current value with
`update(updater)`, and obtain a cached readonly view with `asReadonly()`.
Equality defaults to `Object.is`; `set()` treats functions as data.

Signal reads performed while a component evaluates become that component's
dependencies. Pibbl-provided components also resolve signals at declared
signal-valued props, style fields, and child inputs; the receiving component
then owns the dependency. Pibbl never deep-unwraps arbitrary application data.

See [Use signals and animation](#/learn/guides/signals-and-animation).

Related types: [`Signal`](#/api/types/canvas-runtime#signal),
[`WritableSignal`](#/api/types/canvas-runtime#writablesignal), and
[`SignalOptions`](#/api/types/canvas-runtime#signaloptions).
