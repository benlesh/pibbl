---
id: guide-machine-animation
title: Coordinate animations with machines
summary: Let state entry own playback and state exit cancel it while sprite frames remain ordinary signals.
kind: guide
slug: machine-animation
order: 64
keywords: [machines, animation, sprites, interruption, ownership]
---

# Machine-owned animation

Use a [state machine](#/learn/guides/state-machines) when events mean different
things in different states. Keep ordinary `sequence`, `parallel`, and `repeat`
programs for animation timing. A machine decides which program owns a run;
playback samples its outputs through Pibbl's existing scheduler.

```tsx
import { drive, repeat, useSignal } from "@pibbl/core";
import { defineMachine, useMachine } from "@pibbl/core/machines";
import { playAnimation } from "@pibbl/core/machines/animation";
import {
  Sprite,
  type SpriteFrame,
  type SpriteSheet,
} from "@pibbl/core/sprites";
import type { WritableSignal } from "@pibbl/core";

type Event = { type: "RUN" } | { type: "STOP" };
type Input = { frame: WritableSignal<SpriteFrame>; sheet: SpriteSheet };

const motion = defineMachine<{}, Event, Input>({
  initial: "idle",
  context: () => ({}),
  states: {
    idle: { on: { RUN: "running" } },
    running: {
      invoke: {
        task: playAnimation(({ input }) =>
          repeat(drive(input.frame, input.sheet.animations.walk), {
            iterations: Infinity,
          }),
        ),
      },
      exit: ({ input }) => input.frame.set(input.sheet.frames.standing),
      on: { STOP: "idle" },
    },
  },
});

function Character({ sheet }: { sheet: SpriteSheet }) {
  const frame = useSignal(sheet.frames.standing);
  const actor = useMachine(motion, { input: { frame, sheet } });
  return (
    <Sprite
      frame={frame}
      onClick={() =>
        actor.send({
          type: actor.snapshot.get().matches("running") ? "STOP" : "RUN",
        })
      }
    />
  );
}
```

A finite program resolves its task after the scheduler delivers completion; the
promise completion can select `invoke.onDone`. An infinite program lasts until
state exit. The adapter disposes only its owned playback. It does not silently
cancel unrelated animation writers.

State changes do not imply output blending. Concurrent programs writing different
signals are independent; conflicting writers still follow the animation runtime's
explicit conflict rules. A frame change does not send a machine event or rebuild
machine context.

For a game, keep session states (start, playing, game over) separate from character
states (idle, running, rising, falling). Physical contacts send Land and Fall;
keyboard input sends Move and Jump. Only grounded states handle Jump. Coin flight
and brick debris have their own lifetimes and survive locomotion changes.

A death animation finishing does not make a character alive. Keep the machine in
its dead state until session logic explicitly respawns it.
