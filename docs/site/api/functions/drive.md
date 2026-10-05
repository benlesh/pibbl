---
id: api-function-drive
title: drive
summary: Creates a program that drives a writable signal with an animation definition.
kind: api
slug: drive
apiCategory: function
symbols: [drive]
relatedTypes: [PibblAnimationDefinition, PibblAnimationProgram, WritableSignal]
---

# drive

`drive(output, definition)` returns an immutable
[`PibblAnimationProgram`](#/api/types/canvas-runtime#pibblanimationprogram). An accepted
run leases the writable output for its entire lifetime, including surrounding
waits. Competing writers fail unless playback requests replacement explicitly.

Creating this program does not update the signal or start playback. Pass it to
`usePlayback`, then call `play()` to run it. The signal is the destination, not
an observed input.

```ts
import { drive, tween, usePlayback, useSignal } from "@pibbl/core";

// Call inside a Pibbl component; invoke the returned function from an event handler.
function useMovement() {
  const x = useSignal(0);
  const movement = drive(x, tween({ from: 0, to: 100, duration: 300 }));
  const playback = usePlayback(movement);
  return { x, start: () => playback.play() };
}
```

`drive` replaces the former `track` name; there is no compatibility alias.

Related types: [`PibblAnimationDefinition`](#/api/types/canvas-runtime#pibblanimationdefinition),
[`PibblAnimationProgram`](#/api/types/canvas-runtime#pibblanimationprogram), and
[`WritableSignal`](#/api/types/canvas-runtime#writablesignal).
