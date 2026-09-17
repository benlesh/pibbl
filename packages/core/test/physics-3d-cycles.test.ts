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

function flushAll(maximum = 4): void {
  for (
    let count = 0;
    count < maximum && driver.pendingHostFrames > 0;
    count += 1
  ) {
    hostTime += 1000 / 60;
    driver.flush(hostTime);
  }
}

describe("public 3D physics laboratory ownership cycles", () => {
  it("coalesces 1,000 command/remount tapes and still releases and recreates the selected body exactly", async () => {
    const canvas = document.createElement("canvas");
    canvas.width = physics3DScenarioEntry.canvas.width;
    canvas.height = physics3DScenarioEntry.canvas.height;
    document.body.appendChild(canvas);
    controller = await (
      await loadScenario(physics3DScenarioEntry)
    ).mount({ canvas });
    flushAll();

    for (let cycle = 0; cycle < 1_000; cycle += 1) {
      await controller.perform("grab");
      await controller.perform("drag");
      await controller.perform("throw");
      await controller.perform("teleport");
      await controller.perform("disable");
      await controller.perform("remove");
      await controller.perform("remount");
      await controller.perform("re-enable");
    }
    expect(driver.pendingHostFrames).toBe(1);
    flushAll();
    expect(controller.getState()).toMatchObject({
      dropMounted: true,
      grabbed: false,
      bodies: { "drop-cube": { enabled: true } },
    });

    await controller.perform("remove");
    flushAll();
    expect(controller.getState().bodies["drop-cube"]).toMatchObject({
      enabled: false,
      generation: 0,
    });
    await controller.perform("remount");
    flushAll();
    expect(controller.getState().bodies["drop-cube"]).toMatchObject({
      enabled: true,
      generation: 2,
    });

    await controller.dispose();
    controller = undefined;
    expect(driver.pendingHostFrames).toBe(0);
  });
});
