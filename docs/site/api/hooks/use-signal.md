---
id: api-hook-use-signal
title: useSignal
summary: Owns one writable signal for a mounted component hook slot.
kind: api
slug: use-signal
apiCategory: hook
symbols: [useSignal]
relatedTypes: [WritableSignal, SignalOptions]
---

# useSignal

`useSignal(initialValue, options?)` is render-only and returns one stable
[`WritableSignal`](#/api/types/canvas-runtime#writablesignal) owned by the current
component hook slot. Its graph edges and writer ownership are released when the
component identity disappears.

See [Use signals and animation](#/learn/guides/signals-and-animation).

Related types: [`WritableSignal`](#/api/types/canvas-runtime#writablesignal)
and [`SignalOptions`](#/api/types/canvas-runtime#signaloptions).
