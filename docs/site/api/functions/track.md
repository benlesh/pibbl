---
id: api-function-track
title: track
summary: Binds an animation definition to a writable signal output.
kind: api
slug: track
apiCategory: function
symbols: [track]
relatedTypes: [CRCAnimationDefinition, CRCAnimationProgram, WritableSignal]
---

# track

`track(output, definition)` returns an immutable
[`CRCAnimationProgram`](#/api/types/canvas-runtime#crcanimationprogram). An accepted
run leases the writable output for its entire lifetime, including surrounding
waits. Competing writers fail unless playback requests replacement explicitly.

Related types: [`CRCAnimationDefinition`](#/api/types/canvas-runtime#crcanimationdefinition),
[`CRCAnimationProgram`](#/api/types/canvas-runtime#crcanimationprogram), and
[`WritableSignal`](#/api/types/canvas-runtime#writablesignal).
