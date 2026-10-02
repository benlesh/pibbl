import { afterEach, beforeEach, expect, it } from "vitest";
import { crc, createElement } from "@crc/core";
import {
  useFlowField2D,
  useFlowSource2D,
  type CRCFlowField2D,
} from "../../index.js";
import { clearSharedState } from "../../../../core/src/lib/global-state.js";
import {
  installSchedulerDriverForTest,
  ManualSchedulerDriver,
} from "../../../../core/src/lib/scheduler/testing.js";
let driver: ManualSchedulerDriver;
let restore: () => void;
let root: ReturnType<typeof crc> | undefined;
beforeEach(() => {
  driver = new ManualSchedulerDriver();
  restore = installSchedulerDriverForTest(driver);
});
afterEach(() => {
  root?.dispose();
  root = undefined;
  clearSharedState();
  restore();
  document.body.replaceChildren();
});
it("owns one shared flow clock and releases it with its mount", () => {
  let flow!: CRCFlowField2D;
  function Root() {
    flow = useFlowField2D({
      bounds: { width: 240, height: 240 },
      resolution: [24, 24],
    });
    useFlowSource2D(flow, {
      position: [120, 180],
      radius: 25,
      acceleration: [0, -200],
      heat: 3,
    });
    return null;
  }
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  root = crc(canvas, createElement(Root, {}));
  driver.flush(0);
  for (let i = 1; i <= 120; i++) driver.flush((i * 1000) / 60);
  const output = new Float32Array(2);
  flow.sampleBatch(new Float32Array([120, 160]), output, 1);
  expect(output[1]).toBeLessThan(-1);
  expect(driver.pendingHostFrames).toBe(1);
  root.dispose();
  expect(driver.pendingHostFrames).toBe(0);
  expect(() => flow.sampleBatch(new Float32Array(2), output, 1)).toThrow(
    /disposed/,
  );
});


it("advects rendered particles through the public flow binding", async () => {
  const { defineParticleEffect2D, useParticleSystem, Particles2D } = await import("../../index.js");
  const effect = defineParticleEffect2D({ emitters: [{
    name: "smoke", capacity: 1,
    emission: [{ type: "burst", atMilliseconds: 0, count: 1 }],
    shape: { type: "point", position: [120, 160] },
    initial: { lifetimeMilliseconds: 10000, size: 8, color: "#ff0000" },
    renderer: { type: "circle" },
  }] });
  let execution: string | undefined;
  function Root() {
    const field = useFlowField2D({ bounds: { width: 240, height: 240 }, resolution: [24, 24] });
    useFlowSource2D(field, { position: [120, 180], radius: 40, heat: 3, acceleration: [0, -200] });
    const system = useParticleSystem(effect, { autoplay: true, flow: field });
    execution = system.execution.get();
    return createElement(Particles2D, { system, pointerEvents: "none" as const, style: { width: 240, height: 240 } });
  }
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 240;
  document.body.appendChild(canvas);
  root = crc(canvas, createElement(Root, {}), { pixelRatio: 1 });
  driver.flush(0);
  for (let i = 1; i <= 90; i++) driver.flush(i * 1000 / 60);
  expect(execution).toBe("flow-canvas");
  const pixels = canvas.getContext("2d")!.getImageData(0, 0, 240, 240).data;
  let count = 0, totalY = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i]! > 200 && pixels[i + 3]! > 100) { count++; totalY += Math.floor(i / 4 / 240); }
  }
  expect(count).toBeGreaterThan(0);
  expect(totalY / count).toBeLessThan(150);
});

it("does not redraw smoke after a moving obstacle covers it", async () => {
  const { defineParticleEffect2D, useParticleSystem, Particles2D } = await import("../../index.js");
  const effect = defineParticleEffect2D({ emitters: [{
    name: "smoke", capacity: 1,
    emission: [{ type: "burst", atMilliseconds: 0, count: 1 }],
    shape: { type: "point", position: [120, 160] },
    initial: { lifetimeMilliseconds: 10000, size: 8, color: "#ff0000" },
    renderer: { type: "circle" },
  }] });
  const batch = { revision: 0, boxes: new Float64Array() };
  const obstacles = { read: () => batch };
  function Root() {
    const field = useFlowField2D({ bounds: { width: 240, height: 240 }, resolution: [24, 24], obstacles });
    const system = useParticleSystem(effect, { autoplay: true, flow: field });
    return createElement(Particles2D, { system, style: { width: 240, height: 240 } });
  }
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 240;
  document.body.appendChild(canvas);
  root = crc(canvas, createElement(Root, {}), { pixelRatio: 1 });
  const painted = () => canvas.getContext("2d")!.getImageData(0, 0, 240, 240).data.some((value, index) => index % 4 === 3 && value > 0);
  for (let i = 0; i <= 3; i++) driver.flush(i * 1000 / 60);
  expect(painted()).toBe(true);
  batch.boxes = new Float64Array([120, 160, 20, 20, 0, 0, 0, 0, 120, 160]);
  batch.revision++;
  for (let i = 4; i <= 8; i++) driver.flush(i * 1000 / 60);
  expect(painted()).toBe(false);
  batch.boxes = new Float64Array();
  batch.revision++;
  for (let i = 9; i <= 15; i++) driver.flush(i * 1000 / 60);
  expect(painted()).toBe(false);
});
