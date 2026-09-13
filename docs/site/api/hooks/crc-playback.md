---
id: api-hook-crc-playback
title: crcPlayback
summary: Owns command-driven animation playback for one mounted hook slot.
kind: api
slug: crc-playback
apiCategory: hook
symbols: [crcPlayback]
relatedTypes: [CRCPlayback, CRCPlaybackOptions, CRCAnimationProgram]
---

# crcPlayback

`crcPlayback(program, options?)` returns stable component-owned controls plus
readonly status and current-time signals. Commands enter the next Begin phase;
outputs publish atomically in Commit; milestones arrive in Complete after
rendering. Removing the component releases registrations, writer leases,
callbacks, commands, and stepper state, leaving retained controls inert.

See the [animation contract](../../../design/animation-contract.md).

Related types: [`CRCPlayback`](#/api/types/canvas-runtime#crcplayback),
[`CRCPlaybackOptions`](#/api/types/canvas-runtime#crcplaybackoptions), and
[`CRCAnimationProgram`](#/api/types/canvas-runtime#crcanimationprogram).
