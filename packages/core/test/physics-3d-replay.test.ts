import {
  loadScenario,
  physics3DScenarioEntry,
  type Physics3DAction,
  type Physics3DState,
} from "@crc/scenarios";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  installSchedulerDriverForTest,
  ManualSchedulerDriver,
} from "../src/lib/scheduler/testing.js";

let driver: ManualSchedulerDriver;
let restoreDriver: () => void;
let hostTime: number;

beforeEach(() => {
  document.body.replaceChildren();
  driver = new ManualSchedulerDriver();
  restoreDriver = installSchedulerDriverForTest(driver);
  hostTime = 0;
});

afterEach(() => {
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

const TAPE = [
  "query",
  "grab",
  "drag",
  "throw",
  "teleport",
  "disable",
  "authored-move",
  "re-enable",
] as const satisfies readonly Physics3DAction[];

async function replay(): Promise<Physics3DState> {
  const canvas = document.createElement("canvas");
  canvas.width = physics3DScenarioEntry.canvas.width;
  canvas.height = physics3DScenarioEntry.canvas.height;
  document.body.appendChild(canvas);
  const controller = await (
    await loadScenario(physics3DScenarioEntry)
  ).mount({ canvas });
  flushPending();
  for (const action of TAPE) {
    await controller.perform(action);
    flushPending(1);
  }
  const state = controller.getState();
  await controller.dispose();
  canvas.remove();
  return state;
}

describe("public 3D physics laboratory replay", () => {
  it("replays identical public action tapes with identical semantic ordering and poses", async () => {
    const first = await replay();
    const second = await replay();
    expect(second.eventLog).toEqual(first.eventLog);
    expect(second.contacts).toEqual(first.contacts);
    expect(second.queryTag).toBe(first.queryTag);
    expect(second.queryPoint).toEqual(first.queryPoint);
    expect(second.bodies["drop-cube"]).toEqual(first.bodies["drop-cube"]);
    expect(second.compoundAligned).toBe(true);
  });
});
