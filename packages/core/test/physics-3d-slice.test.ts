import {
  PHYSICS_3D_ACTION_IDS,
  PHYSICS_3D_BODY_IDS,
  getScenarioRoute,
  loadScenario,
  physics3DScenarioEntry,
  type Physics3DState,
  type ScenarioController,
} from "@crc/scenarios";
import { WebGLLayerController } from "../../webgl/src/lib/layer-controller.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import physics3DSource from "../../scenarios/src/physics-3d.example.tsx?raw";
import {
  installSchedulerDriverForTest,
  ManualSchedulerDriver,
} from "../src/lib/scheduler/testing.js";

let driver: ManualSchedulerDriver;
let restoreDriver: () => void;
let hostTime: number;
const controllers = new Set<ScenarioController<Physics3DState>>();

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
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function flushAfter(milliseconds = 1000 / 60): void {
  hostTime += milliseconds;
  expect(driver.pendingHostFrames).toBe(1);
  driver.flush(hostTime);
}

describe("public first-class 3D physics browser slice", () => {
  it("registers one public-only Studio source with reset, drop, impulse, and query actions", () => {
    expect(getScenarioRoute(physics3DScenarioEntry)).toBe(
      "#/testing/physics-3d",
    );
    expect(physics3DScenarioEntry).toMatchObject({
      metadata: {
        id: "first-class-physics-3d",
        slug: "physics-3d",
      },
      canvas: { width: 480, height: 300 },
      source: {
        id: "first-class-physics-3d-example",
        marker: "PHYSICS_3D_SOURCE_ID = 'first-class-physics-3d-example'",
        path: "packages/scenarios/src/physics-3d.example.tsx",
      },
    });
    expect(PHYSICS_3D_ACTION_IDS).toEqual([
      "reset",
      "drop",
      "impulse",
      "query",
    ]);
    expect(physics3DScenarioEntry.actions.map((action) => action.id)).toEqual(
      PHYSICS_3D_ACTION_IDS,
    );
    expect(physics3DSource).toMatch(/from ["']@crc\/core["']/u);
    expect(physics3DSource).toMatch(/from ["']@crc\/webgl["']/u);
    expect(physics3DSource).toMatch(/from ["']@crc\/physics\/3d["']/u);
    expect(physics3DSource).not.toMatch(
      /\/(?:internal|lib|src)(?:\/|["'])|requestAnimationFrame|set(?:Timeout|Interval)|ManualSchedulerDriver/u,
    );
  });

  it("advances CPU physics, presentation, queries, and WebGL generations on one host frame", async () => {
    const render = vi.spyOn(
      WebGLLayerController.prototype,
      "renderRetainedChild",
    );
    const canvas = document.createElement("canvas");
    canvas.width = physics3DScenarioEntry.canvas.width;
    canvas.height = physics3DScenarioEntry.canvas.height;
    canvas.style.cssText = "display:block;width:480px;height:300px";
    document.body.appendChild(canvas);
    const definition = await loadScenario(physics3DScenarioEntry);
    const controller = await definition.mount({ canvas });
    controllers.add(controller);

    flushAfter(0);
    const firstPixels = pixelSignature(canvas);
    const layer = render.mock.instances[0] as WebGLLayerController;
    const uniformMatrix = vi.spyOn(layer.gl, "uniformMatrix4fv");
    flushAfter(0);
    expect(pixelSignature(canvas)).toEqual(firstPixels);
    expect(firstPixels.nonTransparentPixels).toBeGreaterThan(0);
    expect(firstPixels.maximumRgbChannel).toBeGreaterThan(96);
    const initial = controller.getState();
    expect(Object.keys(initial.bodies)).toEqual([...PHYSICS_3D_BODY_IDS]);
    expect(Object.values(initial.bodies).every((body) =>
      body.enabled && body.generation === 1
    )).toBe(true);
    expect(initial.bodies["drop-cube"].position).toEqual([-4.2, 6, 0]);
    expect(initial.compoundAligned).toBe(true);

    expect(layer.committedGeneration).toBeGreaterThan(0);
    const initialCommitted = (layer as unknown as {
      committed?: { pickLedger: { entries: readonly unknown[] } };
    }).committed;
    expect(initialCommitted?.pickLedger.entries.length).toBeGreaterThanOrEqual(10);

    let sawBounce = false;
    let sawContact = false;
    let previousBounceVelocity = initial.bodies["bounce-sphere"].linearVelocity[1];
    for (let frame = 0; frame < 180; frame += 1) {
      flushAfter();
      const state = controller.getState();
      const velocity = state.bodies["bounce-sphere"].linearVelocity[1];
      sawBounce ||= previousBounceVelocity < -0.5 && velocity > 0.5;
      previousBounceVelocity = velocity;
      sawContact ||= state.contacts.some((entry) => entry.includes("floor"));
    }
    const settled = controller.getState();
    expect(settled.bodies["drop-cube"].position[1]).toBeLessThan(
      initial.bodies["drop-cube"].position[1],
    );
    expect(sawContact).toBe(true);
    expect(sawBounce).toBe(true);
    expect(Math.abs(settled.bodies["slider-cube"].linearVelocity[0])).toBeLessThan(3);
    expect(settled.compoundAligned).toBe(true);

    const committed = (layer as unknown as {
      committed?: {
        pickLedger: {
          entries: readonly {
            componentName: string;
            model: Readonly<Float32Array>;
            keyboardNavigationPoints?: readonly Readonly<{
              x: number;
              y: number;
            }>[];
            target: {
              keyboardNavigationPoints?: readonly Readonly<{
                x: number;
                y: number;
              }>[];
            };
          }[];
        };
      };
    }).committed;
    const dropPose = settled.bodies["drop-cube"].position;
    const dropEntry = committed?.pickLedger.entries.find((entry) =>
      entry.componentName === "Cube" &&
      Math.abs(entry.model[12]! - dropPose[0]) < 1e-4 &&
      Math.abs(entry.model[13]! - dropPose[1]) < 1e-4 &&
      Math.abs(entry.model[14]! - dropPose[2]) < 1e-4
    );
    expect(dropEntry).toBeDefined();
    expect(dropEntry?.keyboardNavigationPoints?.length).toBeGreaterThan(0);
    expect(dropEntry?.target.keyboardNavigationPoints).toBe(
      dropEntry?.keyboardNavigationPoints,
    );
    expect(uniformMatrix.mock.calls.some((call) =>
      sameMatrix(call[2] as Float32List, dropEntry!.model)
    )).toBe(true);

    await controller.perform("impulse");
    flushAfter();
    flushAfter();
    expect(Math.hypot(
      ...controller.getState().bodies["drop-cube"].angularVelocityDegreesPerSecond,
    )).toBeGreaterThan(0);

    await controller.perform("query");
    expect(controller.getState()).toMatchObject({
      queryTag: "floor",
      queryPoint: expect.any(Array),
      lastAction: "query",
    });

    const beforeLossY = controller.getState().bodies["drop-cube"].position[1];
    layer.canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    expect(layer.committedGeneration).toBeUndefined();
    await controller.perform("drop");
    flushAfter();
    for (let frame = 0; frame < 12; frame += 1) flushAfter();
    expect(controller.getState().bodies["drop-cube"].position[1]).toBeLessThan(6);
    expect(controller.getState().bodies["drop-cube"].position[1]).not.toBe(beforeLossY);

    layer.canvas.dispatchEvent(new Event("webglcontextrestored"));
    flushAfter();
    expect(layer.committedGeneration).toBeGreaterThan(0);

    await controller.reset();
    expect(driver.pendingHostFrames).toBe(1);
    flushAfter();
    expect(controller.getState()).toMatchObject({
      lastAction: "reset",
      contacts: [],
      queryTag: null,
      queryPoint: null,
    });

    await controller.dispose();
    controllers.delete(controller);
    expect(driver.pendingHostFrames).toBe(0);
  });
});

function pixelSignature(canvas: HTMLCanvasElement): Readonly<{
  hash: number;
  nonTransparentPixels: number;
  maximumRgbChannel: number;
}> {
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("Expected a Canvas 2D context.");
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let hash = 0x811c9dc5;
  let nonTransparentPixels = 0;
  let maximumRgbChannel = 0;
  for (let index = 0; index < pixels.length; index += 1) {
    hash = Math.imul(hash ^ pixels[index]!, 0x01000193);
    if (index % 4 === 3 && pixels[index] !== 0) nonTransparentPixels += 1;
    if (index % 4 !== 3) {
      maximumRgbChannel = Math.max(maximumRgbChannel, pixels[index]!);
    }
  }
  return Object.freeze({
    hash: hash >>> 0,
    nonTransparentPixels,
    maximumRgbChannel,
  });
}

function sameMatrix(
  left: Float32List,
  right: Readonly<ArrayLike<number>>,
): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (Math.abs(left[index]! - right[index]!) > 1e-6) return false;
  }
  return true;
}
