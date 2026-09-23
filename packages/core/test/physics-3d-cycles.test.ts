import {
  loadScenario,
  physics3DScenarioEntry,
  type Physics3DState,
  type ScenarioController,
} from "@crc/scenarios";
import { crc, createElement, signal, type CRCController } from "@crc/core";
import { Group3D, WebGLLayer } from "@crc/webgl";
import {
  PhysicsWorld3D,
  crcPhysicsBody3D,
  crcPhysicsWorld3D,
  disableBody3D,
  dynamicBody3D,
  enableBody3D,
  setLinearVelocity3D,
  teleportBody3D,
  wakeBody3D,
  type CRCPhysicsBodyHandle3D,
  type CRCPhysicsWorldHandle3D,
} from "@crc/physics/3d";
import {
  requirePhysicsWorld3DController,
  snapshotPhysicsWorld3DControllerForTest,
} from "../../physics/src/lib/3d/runtime/controller.js";
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
  it("keeps the public scene sound through ten representative real remounts", async () => {
    const canvas = document.createElement("canvas");
    canvas.width = physics3DScenarioEntry.canvas.width;
    canvas.height = physics3DScenarioEntry.canvas.height;
    document.body.appendChild(canvas);
    controller = await (
      await loadScenario(physics3DScenarioEntry)
    ).mount({ canvas });
    flushAll();

    let previousGeneration =
      controller.getState().bodies["drop-cube"].generation;
    for (let cycle = 0; cycle < 10; cycle += 1) {
      await controller.perform("grab");
      await controller.perform("drag");
      await controller.perform("throw");
      await controller.perform("teleport");
      await controller.perform("disable");
      await controller.perform("remove");
      flushAll();
      expect(controller.getState().bodies["drop-cube"].generation).toBe(0);
      await controller.perform("remount");
      flushAll();
      await controller.perform("re-enable");
      flushAll();
      const state = controller.getState();
      expect(state.bodies["drop-cube"].generation).toBeGreaterThan(
        previousGeneration,
      );
      previousGeneration = state.bodies["drop-cube"].generation;
    }
    expect(controller.getState()).toMatchObject({
      dropMounted: true,
      grabbed: false,
      bodies: { "drop-cube": { enabled: true } },
    });

    const selected = controller.getState().bodies["drop-cube"];
    expect(selected.generation).toBe(11);
    expect([...selected.position, ...selected.orientation]).toSatisfy(
      (values: readonly number[]) => values.every(Number.isFinite),
    );
    expect(Math.hypot(...selected.linearVelocity)).toBeLessThanOrEqual(8.01);

    await controller.dispose();
    controller = undefined;
    expect(driver.pendingHostFrames).toBe(0);
  }, 60_000);

  it("performs 1,000 real minimal add/remove/adopt cycles with exact generation and ownership bounds", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    document.body.appendChild(canvas);
    const mounted = signal(true);
    let body!: CRCPhysicsBodyHandle3D;
    let world!: CRCPhysicsWorldHandle3D;
    const Capture = () => {
      world = crcPhysicsWorld3D();
      return undefined;
    };
    const Body = () => {
      body = crcPhysicsBody3D();
      return createElement(Group3D, {
        children: undefined,
        physics: dynamicBody3D({
          handle: body,
          enabled: false,
          mass: 1,
          collider: false,
        }),
      });
    };
    const Selected = () =>
      mounted.get() ? createElement(Body, {}) : undefined;
    const runtime: CRCController = crc(
      canvas,
      createElement(WebGLLayer, {
        camera: {
          type: "perspective",
          position: [0, 0, 5],
          lookAt: [0, 0, 0],
          up: [0, 1, 0],
          fieldOfViewDegrees: 45,
          near: 0.1,
          far: 10,
        },
        style: { width: 16, height: 16 },
        children: createElement(PhysicsWorld3D, {
          gravity: [0, 0, 0],
          children: [createElement(Capture, {}), createElement(Selected, {})],
        }),
      }),
      { pixelRatio: 1 },
    );
    flushAll();
    const worldController = requirePhysicsWorld3DController(world);
    const ownership = (
      worldController as unknown as {
        readonly kernel: {
          readonly counters: Readonly<Record<string, number>>;
        };
      }
    ).kernel.counters;
    const baseline = snapshotPhysicsWorld3DControllerForTest(worldController);
    let previousGeneration = body.generation.get();
    expect(previousGeneration).toBe(1);

    for (let cycle = 0; cycle < 1_000; cycle += 1) {
      const stale = body;
      enableBody3D(stale);
      teleportBody3D(stale, {
        position: [cycle % 7, 1, -1],
        orientation: [0, 0, 0, 1],
      });
      setLinearVelocity3D(stale, [1, 2, 3]);
      wakeBody3D(stale);
      disableBody3D(stale);
      mounted.set(false);
      flushAll();
      expect(() => wakeBody3D(stale)).toThrow(
        /live CRC physics 3D body handle/u,
      );

      mounted.set(true);
      flushAll();
      const generation = body.generation.get();
      expect(generation).toBeGreaterThan(previousGeneration);
      previousGeneration = generation;
    }

    const after = snapshotPhysicsWorld3DControllerForTest(worldController);
    expect(previousGeneration).toBe(1_001);
    expect(after.kernel.counters.liveBodies).toBe(
      baseline.kernel.counters.liveBodies,
    );
    expect(after.kernel.counters.liveColliders).toBe(0);
    expect(after.kernel.counters.liveProxies).toBe(0);
    expect(after.kernel.counters.bodyAllocations).toBe(
      baseline.kernel.counters.bodyAllocations + 1_000,
    );
    expect(after.kernel.counters.bodyReleases).toBe(
      baseline.kernel.counters.bodyReleases + 1_000,
    );

    runtime.dispose();
    expect(driver.pendingHostFrames).toBe(0);
    expect(ownership).toMatchObject({
      liveBodyStores: 0,
      liveColliderStores: 0,
      liveBroadPhases: 0,
      liveContactCaches: 0,
      liveSolvers: 0,
      liveBodies: 0,
      liveColliders: 0,
      liveProxies: 0,
      liveContacts: 0,
    });
  }, 120_000);
});
