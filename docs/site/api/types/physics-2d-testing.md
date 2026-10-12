---
id: api-types-physics-2d-testing
title: 2D physics test harness types
summary: Options and deterministic frame-control interface for @pibbl/core/physics/2d/testing.
kind: api
slug: physics-2d-testing
apiCategory: types
symbols: [PibblPhysicsTestHarness2D, PibblPhysicsTestHarness2DOptions]
keywords: [physics, testing, deterministic, agentic]
---

# 2D physics test harness types

Import these contracts with `type` from `@pibbl/core/physics/2d/testing`.

## `PibblPhysicsTestHarness2D`

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

`flush()` runs one requested host frame. `advanceFrames()` returns host frames
run, rather than promising an equal number of fixed physics ticks. `act()`
flushes a state action without moving host time. `reset()` remounts with
monotonic time; `dispose()` is idempotent and restores the scheduler driver.

Use `createPhysicsTestHarness2D` from the
[test-harness function page](#/api/functions/physics-2d-testing) and consult
the [2D physics guide](#/learn/guides/physics-2d) for public world and handle
composition.

## `PibblPhysicsTestHarness2DOptions`

```text
interface PibblPhysicsTestHarness2DOptions<Observation> {
  readonly canvas: HTMLCanvasElement;
  readonly root: () => PibblNode;
  readonly observe: () => Observation;
}
```

The caller owns `canvas`; harness disposal never removes it. `root()` creates
the initial and reset composition. `observe()` reads public application state.
External fixtures stay under the test's ownership and are not reset.
