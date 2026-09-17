import {
  PHYSICS_3D_BODY_IDS,
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
  "settle",
  "query",
  "grab",
  "drag",
  "throw",
  "teleport",
  "disable",
  "authored-move",
  "re-enable",
] as const satisfies readonly Physics3DAction[];

interface ReplayResult {
  readonly final: Physics3DState;
  readonly after: Readonly<Record<Physics3DAction, Physics3DState>>;
}

async function replay(): Promise<ReplayResult> {
  const canvas = document.createElement("canvas");
  canvas.width = physics3DScenarioEntry.canvas.width;
  canvas.height = physics3DScenarioEntry.canvas.height;
  document.body.appendChild(canvas);
  const controller = await (
    await loadScenario(physics3DScenarioEntry)
  ).mount({ canvas });
  flushPending();
  const after = {} as Record<Physics3DAction, Physics3DState>;
  for (const action of TAPE) {
    await controller.perform(action);
    if (action === "settle") {
      for (let batch = 0; batch < 12; batch += 1) {
        hostTime += (8 * 1000) / 60;
        driver.flush(hostTime);
      }
    } else {
      flushPending(1);
    }
    after[action] = controller.getState();
  }
  const final = controller.getState();
  await controller.dispose();
  canvas.remove();
  return { final, after };
}

describe("public 3D physics laboratory replay", () => {
  it("replays identical public action tapes with identical semantic ordering and poses", async () => {
    const first = await replay();
    const second = await replay();
    const eventsByKind = (state: Physics3DState) => ({
      actions: state.eventLog.filter((event) =>
        /^(?:action:|query:|grab:|drag:|throw:|teleport$|disable$|authored-move$|re-enable:)/u.test(
          event,
        ),
      ),
      sensors: state.eventLog.filter((event) => event.startsWith("sensor>")),
    });
    expect(eventsByKind(first.final)).toEqual({
      actions: [
        "action:settle",
        "query:heightfield",
        "grab:disable",
        "drag:authored",
        expect.stringMatching(/^throw:/u),
        "teleport",
        "disable",
        "authored-move",
        "re-enable:zero",
      ],
      sensors: [
        "sensor>heightfield:start",
        "sensor>heightfield:end",
        "sensor>heightfield:start",
      ],
    });
    expect(first.final.contacts.slice(0, 6)).toEqual([
      "floor>slider-cube:start",
      "slider-cube>floor:start",
      "triangle-mesh>ellipsoid:start",
      "ellipsoid>triangle-mesh:start",
      "obstacle>bounce-sphere:start",
      "bounce-sphere>obstacle:start",
    ]);
    expect(first.final.sensorOverlaps).toEqual(["heightfield"]);
    expect(first.final.queryTag).toBe("heightfield");
    expect(first.final.queryPoint).not.toBeNull();
    expect(first.final.queryPoint?.[0]).toBeCloseTo(3.6, 6);
    expect(first.final.queryPoint?.[1]).toBeCloseTo(-1.375, 6);
    expect(first.final.queryPoint?.[2]).toBeCloseTo(-2.6, 6);
    expect(second.final.eventLog).toEqual(first.final.eventLog);
    expect(second.final.contacts).toEqual(first.final.contacts);
    expect(second.final.sensorOverlaps).toEqual(first.final.sensorOverlaps);
    expectEquivalentState(second.final, first.final);

    for (const id of PHYSICS_3D_BODY_IDS) {
      expect(first.final.bodies[id].generation, id).toBeGreaterThan(0);
    }
    const beforeGrab = first.after.query.bodies["drop-cube"];
    const afterGrab = first.after.grab.bodies["drop-cube"];
    expect(
      vectorDistance(afterGrab.position, beforeGrab.position),
    ).toBeLessThan(0.5);
    expect(
      quaternionDot(afterGrab.orientation, beforeGrab.orientation),
    ).toBeGreaterThan(0.99999);
    expect(first.final.compoundAligned).toBe(true);
  });
});

function expectEquivalentState(
  actual: Physics3DState,
  expected: Physics3DState,
): void {
  expect(actual.lastAction).toBe(expected.lastAction);
  expect(actual.worldRevision).toBe(expected.worldRevision);
  expect(actual.dropMounted).toBe(expected.dropMounted);
  expect(actual.grabbed).toBe(expected.grabbed);
  for (const id of PHYSICS_3D_BODY_IDS) {
    const actualBody = actual.bodies[id];
    const expectedBody = expected.bodies[id];
    expect(actualBody.generation, id).toBe(expectedBody.generation);
    expect(actualBody.enabled, id).toBe(expectedBody.enabled);
    expect(actualBody.sleeping, id).toBe(expectedBody.sleeping);
    for (const [actualValues, expectedValues] of [
      [actualBody.position, expectedBody.position],
      [actualBody.orientation, expectedBody.orientation],
      [actualBody.linearVelocity, expectedBody.linearVelocity],
      [
        actualBody.angularVelocityDegreesPerSecond,
        expectedBody.angularVelocityDegreesPerSecond,
      ],
    ] as const) {
      for (let component = 0; component < actualValues.length; component += 1) {
        expect(
          actualValues[component],
          `${id}[${String(component)}]`,
        ).toBeCloseTo(expectedValues[component]!, 6);
      }
    }
  }
}

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

function quaternionDot(
  first: readonly number[],
  second: readonly number[],
): number {
  return Math.abs(
    first[0]! * second[0]! +
      first[1]! * second[1]! +
      first[2]! * second[2]! +
      first[3]! * second[3]!,
  );
}
