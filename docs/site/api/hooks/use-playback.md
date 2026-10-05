---
id: api-hook-use-playback
title: usePlayback
summary: Owns command-driven animation playback for one mounted hook slot.
kind: api
slug: use-playback
apiCategory: hook
symbols: [usePlayback]
relatedTypes: [PibblPlayback, PibblPlaybackOptions, PibblAnimationProgram]
---

# usePlayback

`usePlayback(program, options?)` returns stable component-owned controls plus
readonly status and current-time signals. Commands enter the next Begin phase;
outputs publish atomically in Commit; milestones arrive in Complete after
rendering. Removing the component releases registrations, writer leases,
callbacks, commands, and stepper state, leaving retained controls inert.

See the [animation contract](../../../design/animation-contract.md).

Related types: [`PibblPlayback`](#/api/types/canvas-runtime#pibblplayback),
[`PibblPlaybackOptions`](#/api/types/canvas-runtime#pibblplaybackoptions), and
[`PibblAnimationProgram`](#/api/types/canvas-runtime#pibblanimationprogram).
