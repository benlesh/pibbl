---
id: api-function-drive
title: drive
summary: Creates a program that drives a writable signal with an animation definition.
kind: api
slug: drive
apiCategory: function
symbols: [drive]
relatedTypes: [CRCAnimationDefinition, CRCAnimationProgram, WritableSignal]
---

# drive

`drive(output, definition)` returns an immutable
[`CRCAnimationProgram`](#/api/types/canvas-runtime#crcanimationprogram). An accepted
run leases the writable output for its entire lifetime, including surrounding
waits. Competing writers fail unless playback requests replacement explicitly.

Creating this program does not update the signal or start playback. Pass it to
`usePlayback`, then call `play()` to run it. The signal is the destination, not
an observed input.

```ts
import { drive, tween, usePlayback, useSignal } from "@crc/core";

// Call inside a CRC component; invoke the returned function from an event handler.
function useMovement() {
  const x = useSignal(0);
  const movement = drive(x, tween({ from: 0, to: 100, duration: 300 }));
  const playback = usePlayback(movement);
  return { x, start: () => playback.play() };
}
```

`drive` replaces the former `track` name; there is no compatibility alias.

Related types: [`CRCAnimationDefinition`](#/api/types/canvas-runtime#crcanimationdefinition),
[`CRCAnimationProgram`](#/api/types/canvas-runtime#crcanimationprogram), and
[`WritableSignal`](#/api/types/canvas-runtime#writablesignal).
