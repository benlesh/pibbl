import {
  loadScenario,
  physics3DScenarioEntry,
  type Physics3DState,
  type ScenarioController,
} from "@crc/scenarios";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  installSchedulerDriverForTest,
  ManualSchedulerDriver,
} from "../src/lib/scheduler/testing.js";

let driver: ManualSchedulerDriver;
let restoreDriver: () => void;
let hostTime: number;
let controller: ScenarioController<Physics3DState> | undefined;

beforeEach(() => {
  document.body.replaceChildren();
  driver = new ManualSchedulerDriver();
  restoreDriver = installSchedulerDriverForTest(driver);
  hostTime = 0;
});

afterEach(async () => {
  await controller?.dispose();
  controller = undefined;
  restoreDriver();
  document.body.replaceChildren();
});

function flushPending(maximum = 3): void {
  for (
    let count = 0;
    count < maximum && driver.pendingHostFrames > 0;
    count += 1
  ) {
    hostTime += 1000 / 60;
    driver.flush(hostTime);
  }
}

describe("public 3D physics laboratory controls", () => {
  it("drives query, grab/drag/throw, pose authority, sleep, and remount through public actions", async () => {
    const canvas = document.createElement("canvas");
    canvas.width = physics3DScenarioEntry.canvas.width;
    canvas.height = physics3DScenarioEntry.canvas.height;
    document.body.appendChild(canvas);
    controller = await (
      await loadScenario(physics3DScenarioEntry)
    ).mount({ canvas });
    flushPending();

    expect(controller.getState()).toMatchObject({
      dropMounted: true,
      grabbed: false,
      compoundAligned: true,
    });

    await controller.perform("query");
    flushPending();
    expect(controller.getState()).toMatchObject({
      queryTag: "heightfield",
      queryPoint: expect.any(Array),
    });

    await controller.perform("teleport");
    flushPending(1);
    const presentedBeforeGrab = controller.getState().bodies["drop-cube"];
    expect(presentedBeforeGrab.orientation).not.toEqual([0, 0, 0, 1]);

    await controller.perform("grab");
    flushPending();
    const grabbed = controller.getState();
    expect(grabbed).toMatchObject({
      grabbed: true,
      bodies: { "drop-cube": { enabled: false } },
    });
    expectQuaternionEquivalent(
      grabbed.bodies["drop-cube"].orientation,
      presentedBeforeGrab.orientation,
    );
    expect(
      vectorDistance(
        grabbed.bodies["drop-cube"].position,
        presentedBeforeGrab.position,
      ),
    ).toBeLessThanOrEqual(0.2);

    await controller.perform("drag");
    flushPending();
    const dragged = controller.getState().bodies["drop-cube"];
    expect(dragged.position).toEqual([-2.4, 5.3, 0.8]);
    expectQuaternionEquivalent(
      dragged.orientation,
      presentedBeforeGrab.orientation,
    );

    await controller.perform("throw");
    flushPending();
    const thrown = controller.getState();
    expect(thrown.grabbed).toBe(false);
    expect(thrown.bodies["drop-cube"].enabled).toBe(true);
    expect(
      Math.hypot(...thrown.bodies["drop-cube"].linearVelocity),
    ).toBeLessThanOrEqual(8.01);
    expectQuaternionEquivalent(
      thrown.bodies["drop-cube"].orientation,
      presentedBeforeGrab.orientation,
    );

    await controller.perform("disable");
    flushPending();
    await controller.perform("authored-move");
    flushPending();
    expect(controller.getState().bodies["drop-cube"]).toMatchObject({
      enabled: false,
      position: [-1.6, 4.8, 1.2],
    });

    await controller.perform("re-enable");
    flushPending();
    expect(controller.getState().bodies["drop-cube"].enabled).toBe(true);

    await controller.perform("sleep");
    flushPending();
    expect(controller.getState().bodies["drop-cube"].sleeping).toBe(true);
    await controller.perform("wake");
    flushPending();
    expect(controller.getState().bodies["drop-cube"].sleeping).toBe(false);

    await controller.perform("remove");
    flushPending();
    expect(controller.getState()).toMatchObject({
      dropMounted: false,
      bodies: { "drop-cube": { enabled: false, generation: 0 } },
    });
    await controller.perform("remount");
    flushPending();
    expect(controller.getState()).toMatchObject({
      dropMounted: true,
      bodies: { "drop-cube": { enabled: true, generation: 2 } },
    });
  });
});

function vectorDistance(
  first: readonly number[],
  second: readonly number[],
): number {
  return Math.hypot(
    first[0]! - second[0]!,
    first[1]! - second[1]!,
    first[2]! - second[2]!,
  );
}

function expectQuaternionEquivalent(
  actual: readonly number[],
  expected: readonly number[],
): void {
  const dot = Math.abs(
    actual[0]! * expected[0]! +
      actual[1]! * expected[1]! +
      actual[2]! * expected[2]! +
      actual[3]! * expected[3]!,
  );
  expect(dot).toBeCloseTo(1, 5);
}
