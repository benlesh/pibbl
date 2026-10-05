import { afterEach, expect, it } from "vitest";
import { signal, withSignalWriteForbidden } from "../signals/graph";
import {
  installSchedulerDriverForTest,
  ManualSchedulerDriver,
} from "../scheduler/testing";
import { claimGeometryGeneration, restoreReleasedGesture } from "./ownership";
import type { PibblManipulationActive } from "./controller-types";

let release: (() => void) | undefined;
afterEach(() => release?.());
it("does not clear a newer gesture when an old guarded rollback reaches Begin", () => {
  const driver = new ManualSchedulerDriver();
  release = installSchedulerDriverForTest(driver);
  const box = signal({ left: 60, top: 50, width: 100, height: 80 });
  const active = signal<PibblManipulationActive | null>({
    operation: "move",
    handle: null,
    pointerId: 1,
  });
  claimGeometryGeneration(box);
  withSignalWriteForbidden("render guard", () =>
    restoreReleasedGesture({
      box,
      active,
      before: {
        box: { left: 40, top: 50, width: 100, height: 80 },
        rotation: 0,
      },
    }),
  );
  claimGeometryGeneration(box);
  const newer = { operation: "move" as const, handle: null, pointerId: 1 };
  active.set(newer);
  driver.flush(1);
  expect(box.get().left).toBe(60);
  expect(active.get()).toBe(newer);
});
