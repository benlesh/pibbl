import {
  PHYSICS_2D_LAB_ACTION_IDS,
  getLearningExampleBySlug,
  getLearningExampleRoute,
  getScenarioRoute,
  loadScenario,
  physics2DLabScenarioEntry,
  type Physics2DLabState,
  type ScenarioController,
} from "@crc/scenarios";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  installSchedulerDriverForTest,
  ManualSchedulerDriver,
} from "../src/lib/scheduler/testing.js";
import { loadLearningSource } from "../../../playground/src/learning-sources";
import { loadScenarioSource } from "../../../playground/src/scenario-sources";

const EXPECTED_ACTION_IDS = [
  "settle",
  "impulse",
  "cross-sensor",
  "move-platform",
  "query",
  "disable-handoff",
  "transfer-animation",
  "reenable-handoff",
  "remove-owner",
] as const;

let driver: ManualSchedulerDriver;
let restoreDriver: () => void;
let hostTime: number;
const controllers = new Set<ScenarioController<Physics2DLabState>>();

beforeEach(() => {
  document.body.replaceChildren();
  driver = new ManualSchedulerDriver();
  restoreDriver = installSchedulerDriverForTest(driver);
  hostTime = 0;
});

afterEach(async () => {
  for (const controller of controllers) await controller.dispose();
  controllers.clear();
  restoreDriver();
  document.body.replaceChildren();
});

function flushAfter(milliseconds = 50): void {
  hostTime += milliseconds;
  expect(driver.pendingHostFrames).toBe(1);
  driver.flush(hostTime);
}

async function perform(
  controller: ScenarioController<Physics2DLabState>,
  action: (typeof EXPECTED_ACTION_IDS)[number],
): Promise<void> {
  await controller.perform(action);
}

describe("public 2D physics laboratory", () => {
  it("registers public sources and drives the shared physics controller through ownership handoff", async () => {
    const learning = getLearningExampleBySlug("physics-2d");
    expect(learning).toMatchObject({
      slug: "physics-2d",
      section: "composition",
      api: [
        "PhysicsWorld2D",
        "dynamicBody2D",
        "staticBody2D",
        "collider2D",
        "crcPhysicsBody2D",
        "crcRef",
        "crcState",
        "setPointerCapture",
        "disableBody2D",
        "teleportBody2D",
        "enableBody2D",
        "setLinearVelocity2D",
      ],
      source: {
        path: "packages/scenarios/src/learning/composition/physics-2d.example.tsx",
      },
    });
    expect(learning && getLearningExampleRoute(learning)).toBe(
      "#/examples/composition/physics-2d",
    );
    expect(getScenarioRoute(physics2DLabScenarioEntry)).toBe(
      "#/testing/physics-2d",
    );
    expect(physics2DLabScenarioEntry).toMatchObject({
      metadata: { id: "first-class-physics-2d", slug: "physics-2d" },
      canvas: { width: 480, height: 240 },
      source: {
        id: "first-class-physics-2d-laboratory-example",
        marker:
          "PHYSICS_2D_LAB_SOURCE_ID = 'first-class-physics-2d-laboratory-example'",
        path: "packages/scenarios/src/physics-2d-lab.example.tsx",
      },
    });
    expect(PHYSICS_2D_LAB_ACTION_IDS).toEqual(EXPECTED_ACTION_IDS);
    expect(
      physics2DLabScenarioEntry.actions.map((action) => action.id),
    ).toEqual(EXPECTED_ACTION_IDS);

    if (!learning) throw new Error("Missing physics-2d learning example.");
    const [learningSource, labSource] = await Promise.all([
      loadLearningSource(learning),
      loadScenarioSource(physics2DLabScenarioEntry),
    ]);
    for (const source of [learningSource, labSource]) {
      expect(source).toMatch(/from ["']@crc\/core["']/u);
      expect(source).toMatch(/from ["']@crc\/physics\/2d["']/u);
      expect(source).not.toMatch(
        /@crc\/(?:core|physics)\/(?:internal|lib|src)\b/u,
      );
      expect(source).not.toMatch(
        /ManualSchedulerDriver|installSchedulerDriverForTest|setInterval/u,
      );
    }

    const canvas = document.createElement("canvas");
    canvas.width = physics2DLabScenarioEntry.canvas.width;
    canvas.height = physics2DLabScenarioEntry.canvas.height;
    canvas.style.cssText = "display:block;width:480px;height:240px";
    document.body.appendChild(canvas);
    const definition = await loadScenario(physics2DLabScenarioEntry);
    const controller = await definition.mount({ canvas });
    controllers.add(controller);

    flushAfter(0);
    flushAfter();
    expect(controller.getState()).toMatchObject({
      owner: "mounted",
      lastAction: "mount",
      worldRevision: expect.any(Number),
      bodies: {
        circle: {
          generation: 1,
          enabled: true,
          sleeping: false,
        },
        box: { generation: 1, enabled: true },
        ellipse: { generation: 1, enabled: true },
        capsule: { generation: 1, enabled: true },
        polygon: { generation: 1, enabled: true },
        star: { generation: 1, enabled: true },
        platform: { generation: 1, enabled: true },
        sensorMover: { generation: 1, enabled: true },
        handoff: { generation: 1, enabled: true },
      },
    });
    expect(controller.getState().worldRevision).toBeGreaterThan(0);
    expect(
      Object.values(controller.getState().bodies).every(
        (body) => body.presentationOffset <= 0.01,
      ),
    ).toBe(true);

    await perform(controller, "settle");
    expect(driver.pendingHostFrames).toBe(1);
    flushAfter();
    expect(controller.getState().bodies.circle.sleeping).toBe(true);

    await perform(controller, "impulse");
    expect(driver.pendingHostFrames).toBe(1);
    flushAfter();
    expect(
      controller.getState().bodies.circle.linearVelocity[0],
    ).toBeGreaterThan(0);
    expect(controller.getState().bodies.circle.sleeping).toBe(false);

    await perform(controller, "cross-sensor");
    expect(driver.pendingHostFrames).toBe(1);
    for (let index = 0; index < 3; index += 1) flushAfter();
    expect(controller.getState().overlaps).toEqual([
      "sensor>sensor-mover:start",
      "sensor-mover>sensor:start",
    ]);
    expect(controller.getState().contacts.slice(0, 2)).toEqual([
      "ground>left-wall:start",
      "ground>right-wall:start",
    ]);

    const platformStart = controller.getState().bodies.platform.position[0];
    await perform(controller, "move-platform");
    expect(driver.pendingHostFrames).toBe(1);
    flushAfter(0);
    flushAfter(300);
    flushAfter(300);
    expect(controller.getState().bodies.platform.position[0]).toBeGreaterThan(
      platformStart + 80,
    );

    await perform(controller, "query");
    expect(controller.getState().queryTags).toEqual(
      expect.arrayContaining(["ground", "platform", "sensor"]),
    );

    await perform(controller, "disable-handoff");
    expect(driver.pendingHostFrames).toBe(1);
    flushAfter();
    expect(controller.getState().bodies.handoff.enabled).toBe(false);
    expect(
      controller.getState().bodies.handoff.presentationOffset,
    ).toBeLessThanOrEqual(0.01);

    const handoffStart = controller.getState().bodies.handoff.position[0];
    await perform(controller, "transfer-animation");
    expect(driver.pendingHostFrames).toBe(1);
    flushAfter(0);
    flushAfter(250);
    expect(controller.getState().bodies.handoff.enabled).toBe(false);
    flushAfter(250);
    expect(driver.pendingHostFrames).toBe(1);
    flushAfter(1);
    expect(controller.getState().bodies.handoff).toMatchObject({
      enabled: true,
      linearVelocity: [0, 0],
    });
    expect(controller.getState().bodies.handoff.position[0]).toBeGreaterThan(
      handoffStart + 30,
    );

    await perform(controller, "reenable-handoff");
    expect(driver.pendingHostFrames).toBe(1);
    flushAfter();
    expect(controller.getState().bodies.handoff.enabled).toBe(true);

    const generation = controller.getState().bodies.handoff.generation;
    await perform(controller, "remove-owner");
    expect(driver.pendingHostFrames).toBe(1);
    flushAfter();
    expect(controller.getState()).toMatchObject({
      owner: "removed",
      lastAction: "remove-owner",
      bodies: { handoff: { generation } },
    });

    await controller.reset();
    expect(driver.pendingHostFrames).toBe(1);
    flushAfter();
    expect(controller.getState()).toMatchObject({
      owner: "mounted",
      lastAction: "reset",
      contacts: [],
      overlaps: [],
      queryTags: [],
    });
  });
});
