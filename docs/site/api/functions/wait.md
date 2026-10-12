---
id: api-function-wait
title: wait
summary: Adds a finite duration to an animation program without writing a value.
kind: api
slug: wait
apiCategory: function
symbols: [wait]
relatedTypes: [PibblAnimationProgram]
---

# wait

`wait(duration)` returns an immutable program that advances local time without
writing signals. Output writer leases remain held across waits in an active
composed run.

Related type: [`PibblAnimationProgram`](#/api/types/canvas-runtime#pibblanimationprogram).
