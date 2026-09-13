---
id: api-function-is-signal
title: isSignal
summary: Recognizes CRC writable, readonly, and computed signal values.
kind: api
slug: is-signal
apiCategory: function
symbols: [isSignal]
relatedTypes: [Signal]
---

# isSignal

`isSignal(value)` is a nominal runtime guard that narrows recognized CRC signal
objects to [`Signal<unknown>`](#/api/types/canvas-runtime#signal). It recognizes writable
signals, cached readonly views, and computed signals without accepting arbitrary
objects that merely expose a `get` method.

Related type: [`Signal`](#/api/types/canvas-runtime#signal).
