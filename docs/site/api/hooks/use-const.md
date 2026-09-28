---
id: api-hook-use-const
title: useConst
summary: Creates one untracked mount-lifetime value without graph participation.
kind: api
slug: use-const
apiCategory: hook
symbols: [useConst]
---

# useConst

`useConst(create)` runs `create` once for a mounted component hook slot and
returns that same direct value on later renders. The factory runs untracked, so
signal reads inside it are snapshots rather than component dependencies.

Use it for mount-lifetime values such as typed arrays or immutable helpers. It
does not create a signal, schedule work, or provide automatic cleanup.
