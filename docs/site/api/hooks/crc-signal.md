---
id: api-hook-crc-signal
title: crcSignal
summary: Owns one writable signal for a mounted component hook slot.
kind: api
slug: crc-signal
apiCategory: hook
symbols: [crcSignal]
relatedTypes: [WritableSignal, SignalOptions]
---

# crcSignal

`crcSignal(initialValue, options?)` is render-only and returns one stable
[`WritableSignal`](#/api/types/canvas-runtime#writablesignal) owned by the current
component hook slot. Its graph edges and writer ownership are released when the
component identity disappears.

See [Use signals and animation](#/learn/guides/signals-and-animation).

Related types: [`WritableSignal`](#/api/types/canvas-runtime#writablesignal)
and [`SignalOptions`](#/api/types/canvas-runtime#signaloptions).
