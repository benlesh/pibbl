---
id: api-hook-use-reaction
title: useReaction
summary: Owns signal-driven imperative setup and exact cleanup in Complete.
kind: api
slug: use-reaction
apiCategory: hook
symbols: [useReaction]
relatedTypes: [PibblReactionOptions]
---

# useReaction

`useReaction(setup, dependencies?, options?)` owns an imperative setup and its
optional cleanup for one mounted component hook slot. Setup runs in Complete
only after a successful render. Synchronous signal reads inside setup become
reaction dependencies without making the component a render consumer.

The dependency array lists captured non-signal values and uses `Object.is`.
Before replacement or final release, Pibbl clears and invokes the exact current
cleanup once. Signal writes are forbidden during setup and cleanup.

Related type:
[`PibblReactionOptions`](#/api/types/canvas-runtime#pibblreactionoptions).
