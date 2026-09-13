---
id: api-function-signal
title: signal
summary: Creates a writable value with explicit reads and updates.
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
dependencies. Signals never unwrap implicitly, including in JSX and styles.

See [Use signals and animation](#/learn/guides/signals-and-animation).

Related types: [`Signal`](#/api/types/canvas-runtime#signal),
[`WritableSignal`](#/api/types/canvas-runtime#writablesignal), and
[`SignalOptions`](#/api/types/canvas-runtime#signaloptions).
