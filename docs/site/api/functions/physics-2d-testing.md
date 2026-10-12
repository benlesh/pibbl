---
id: api-function-physics-2d-testing
title: 2D physics test harness
summary: Isolated deterministic host-frame control for public 2D physics compositions.
kind: api
slug: physics-2d-testing
apiCategory: function
symbols: [createPhysicsTestHarness2D]
keywords: [physics, testing, deterministic, agentic]
---

# 2D physics test harness

```ts
import { createPhysicsTestHarness2D } from "@pibbl/core/physics/2d/testing";
import type {
  PibblPhysicsTestHarness2D,
  PibblPhysicsTestHarness2DOptions,
} from "@pibbl/core/physics/2d/testing";
```

`createPhysicsTestHarness2D` mounts a public Pibbl root with a deterministic
manual host-frame driver. It lets tests and coding agents observe public handles
and state without importing private world storage.

```text
function createPhysicsTestHarness2D<Observation>(
  options: PibblPhysicsTestHarness2DOptions<Observation>,
): PibblPhysicsTestHarness2D<Observation>;
```

### `PibblPhysicsTestHarness2DOptions`

```text
interface PibblPhysicsTestHarness2DOptions<Observation> {
  readonly canvas: HTMLCanvasElement;
  readonly root: () => PibblNode;
  readonly observe: () => Observation;
}
```

The caller owns the canvas; disposal never removes it. `root()` creates the
initial and reset composition. `observe()` should read public application
state. External fixtures are not reset automatically.

### `PibblPhysicsTestHarness2D`

```text
interface PibblPhysicsTestHarness2D<Observation> {
  readonly pendingFrames: number;
  flush(): boolean;
  advanceFrames(count: number, milliseconds?: number): number;
  act<Result>(callback: () => Result): Result;
  observe(): Observation;
  reset(): void;
  dispose(): void;
}
```

`flush()` delivers one requested host frame at current host time. `advanceFrames`
uses `1000 / 60` milliseconds by default and returns the host callbacks it ran;
it does not promise an equal number of physics ticks because fixed-step worlds
may take zero, one, or several ticks per host frame. `act()` runs a state action
then flushes one frame without moving host time. `reset()` remounts while time
remains monotonic; `dispose()` is idempotent and restores the previous driver.

The harness requires an isolated Pibbl realm and rejects creation while another
Pibbl root is mounted, because Pibbl has one realm scheduler. See the
[2D physics guide](#/learn/guides/physics-2d) for the public world and handle
API under test.
