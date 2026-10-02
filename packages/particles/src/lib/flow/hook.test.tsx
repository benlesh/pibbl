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
  const { defineParticleEffect2D, useParticleSystem, Particles2D } =
    await import("../../index.js");
  const effect = defineParticleEffect2D({
    emitters: [
      {
        name: "smoke",
        capacity: 1,
        emission: [{ type: "burst", atMilliseconds: 0, count: 1 }],
        shape: { type: "point", position: [120, 160] },
        initial: { lifetimeMilliseconds: 10000, size: 8, color: "#ff0000" },
        renderer: { type: "circle" },
      },
    ],
  });
  let execution: string | undefined;
  function Root() {
    const field = useFlowField2D({
      bounds: { width: 240, height: 240 },
      resolution: [24, 24],
    });
    useFlowSource2D(field, {
      position: [120, 180],
      radius: 40,
      heat: 3,
      acceleration: [0, -200],
    });
    const system = useParticleSystem(effect, { autoplay: true, flow: field });
    execution = system.execution.get();
    return createElement(Particles2D, {
      system,
      pointerEvents: "none" as const,
      style: { width: 240, height: 240 },
    });
  }
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 240;
  document.body.appendChild(canvas);
  root = crc(canvas, createElement(Root, {}), { pixelRatio: 1 });
  driver.flush(0);
  for (let i = 1; i <= 90; i++) driver.flush((i * 1000) / 60);
  expect(execution).toBe("flow-canvas");
  const pixels = canvas.getContext("2d")!.getImageData(0, 0, 240, 240).data;
  let count = 0,
    totalY = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i]! > 200 && pixels[i + 3]! > 100) {
      count++;
      totalY += Math.floor(i / 4 / 240);
    }
  }
  expect(count).toBeGreaterThan(0);
  expect(totalY / count).toBeLessThan(150);
});

it("does not redraw smoke after a moving obstacle covers it", async () => {
  const { defineParticleEffect2D, useParticleSystem, Particles2D } =
    await import("../../index.js");
  const effect = defineParticleEffect2D({
    emitters: [
      {
        name: "smoke",
        capacity: 1,
        emission: [{ type: "burst", atMilliseconds: 0, count: 1 }],
        shape: { type: "point", position: [120, 160] },
        initial: { lifetimeMilliseconds: 10000, size: 8, color: "#ff0000" },
        renderer: { type: "circle" },
      },
    ],
  });
  const batch = { revision: 0, boxes: new Float64Array() };
  const obstacles = { read: () => batch };
  function Root() {
    const field = useFlowField2D({
      bounds: { width: 240, height: 240 },
      resolution: [24, 24],
      obstacles,
    });
    const system = useParticleSystem(effect, { autoplay: true, flow: field });
    return createElement(Particles2D, {
      system,
      style: { width: 240, height: 240 },
    });
  }
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 240;
  document.body.appendChild(canvas);
  root = crc(canvas, createElement(Root, {}), { pixelRatio: 1 });
  const painted = () =>
    canvas
      .getContext("2d")!
      .getImageData(0, 0, 240, 240)
      .data.some((value, index) => index % 4 === 3 && value > 0);
  for (let i = 0; i <= 3; i++) driver.flush((i * 1000) / 60);
  expect(painted()).toBe(true);
  batch.boxes = new Float64Array([120, 160, 20, 20, 0, 0, 0, 0, 120, 160]);
  batch.revision++;
  for (let i = 4; i <= 8; i++) driver.flush((i * 1000) / 60);
  expect(painted()).toBe(false);
  batch.boxes = new Float64Array();
  batch.revision++;
  for (let i = 9; i <= 15; i++) driver.flush((i * 1000) / 60);
  expect(painted()).toBe(false);
});

it("keeps the committed field intact when an obstacle read fails and recovers on the next frame", () => {
  let flow!: CRCFlowField2D;
  let fail = false;
  const failure = new Error("obstacle snapshot failed");
  const obstacles = {
    read() {
      if (fail) throw failure;
      return { revision: 0, boxes: new Float64Array(0) };
    },
  };
  function Root() {
    flow = useFlowField2D({
      bounds: { width: 100, height: 100 },
      resolution: [10, 10],
      obstacles,
    });
    useFlowSource2D(flow, {
      position: [50, 60],
      radius: 20,
      acceleration: [0, -100],
      heat: 1,
    });
    return null;
  }
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  root = crc(canvas, createElement(Root, {}));
  for (let i = 0; i < 10; i++) driver.flush((i * 1000) / 60);
  const points = new Float32Array([50, 50, 40, 60]),
    before = new Float32Array(4),
    after = new Float32Array(4);
  flow.sampleBatch(points, before, 2);
  const revision = flow.revision.get();
  fail = true;
  expect(() => driver.flush((10 * 1000) / 60)).toThrow(
    "obstacle snapshot failed",
  );
  flow.sampleBatch(points, after, 2);
  expect(after).toEqual(before);
  expect(flow.revision.get()).toBe(revision);
  fail = false;
  driver.flush((11 * 1000) / 60);
  flow.sampleBatch(points, after, 2);
  expect(flow.revision.get()).toBeGreaterThan(revision);
  expect(after).not.toEqual(before);
});

it("publishes obstacle-source replacement even when no simulation time passes", async () => {
  const { signal } = await import("@crc/core");
  const selected = signal({
    read: () => ({ revision: 0, boxes: new Float64Array(0) }),
  });
  let flow!: CRCFlowField2D;
  function Root() {
    flow = useFlowField2D({
      bounds: { width: 100, height: 100 },
      resolution: [10, 10],
      obstacles: selected.get(),
    });
    useFlowSource2D(flow, { position: [50, 50], radius: 10 });
    return null;
  }
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  root = crc(canvas, createElement(Root, {}));
  driver.flush(0);
  driver.flush(0);
  const previous = flow.revision.get();
  const replacement = new Float64Array([50, 50, 20, 20, 0, 20, 0, 0, 50, 50]);
  selected.set({ read: () => ({ revision: 0, boxes: replacement }) });
  driver.flush(0);
  driver.flush(0);
  const velocity = new Float32Array(2);
  flow.sampleBatch(new Float32Array([50, 50]), velocity, 1);
  expect(velocity[0]).toBe(20);
  expect(flow.revision.get()).toBe(previous + 1);
});

it("releases source clocks when disabled and transfers a source without leaving a stale registration", async () => {
  const { signal } = await import("@crc/core");
  const { snapshotRealmScheduler } =
    await import("../../../../core/src/lib/scheduler/testing.js");
  const enabled = signal(true),
    useSecond = signal(false);
  let first!: CRCFlowField2D, second!: CRCFlowField2D;
  const baseline = snapshotRealmScheduler().advanceParticipants;
  function Root() {
    first = useFlowField2D({
      bounds: { width: 100, height: 100 },
      resolution: [10, 10],
    });
    second = useFlowField2D({
      bounds: { width: 100, height: 100 },
      resolution: [10, 10],
    });
    useFlowSource2D(useSecond.get() ? second : first, {
      position: [50, 50],
      radius: 20,
      heat: 2,
      enabled,
    });
    return null;
  }
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  root = crc(canvas, createElement(Root, {}));
  driver.flush(0);
  driver.flush(20);
  expect(snapshotRealmScheduler().advanceParticipants).toBe(baseline + 1);
  useSecond.set(true);
  driver.flush(40);
  driver.flush(60);
  const firstRevision = first.revision.get(),
    secondRevision = second.revision.get();
  driver.flush(80);
  expect(first.revision.get()).toBe(firstRevision);
  expect(second.revision.get()).toBeGreaterThan(secondRevision);
  expect(snapshotRealmScheduler().advanceParticipants).toBe(baseline + 1);
  enabled.set(false);
  driver.flush(100);
  expect(snapshotRealmScheduler().advanceParticipants).toBe(baseline);
  expect(driver.pendingHostFrames).toBe(0);
  enabled.set(true);
  driver.flush(120);
  driver.flush(140);
  expect(snapshotRealmScheduler().advanceParticipants).toBe(baseline + 1);
  root.dispose();
  root.dispose();
  expect(snapshotRealmScheduler().advanceParticipants).toBe(baseline);
  expect(driver.pendingHostFrames).toBe(0);
});

it("reads the same committed physics motion regardless of sibling registration order", async () => {
  const { Fragment, Rectangle, signal } = await import("@crc/core");
  const {
    PhysicsWorld2D,
    crcPhysicsWorld2D,
    physicsObstacles2D,
    kinematicBody2D,
  } = await import("@crc/physics/2d");
  const position = signal<readonly [number, number]>([40, 45]);
  const sources: ReturnType<typeof physicsObstacles2D>[] = [];
  const fields: CRCFlowField2D[] = [];
  const readers = [0, 1].map((index) => ({
    read: () => sources[index]!.read(),
  }));
  function Body({ index }: { index: number }) {
    sources[index] = physicsObstacles2D(crcPhysicsWorld2D());
    return createElement(Rectangle, {
      physics: kinematicBody2D({ target: { position } }),
      style: { width: 20, height: 20 },
    });
  }
  function Field({ index }: { index: number }) {
    const field = useFlowField2D({
      bounds: { width: 100, height: 100 },
      resolution: [20, 20],
      obstacles: readers[index],
    });
    fields[index] = field;
    useFlowSource2D(field, {
      position: [50, 80],
      radius: 15,
      heat: 2,
      acceleration: [0, -100],
    });
    return null;
  }
  function Root() {
    return createElement(
      Fragment,
      {},
      createElement(
        PhysicsWorld2D,
        { gravity: [0, 0] },
        createElement(Body, { index: 0 }),
      ),
      createElement(Field, { index: 0 }),
      createElement(Field, { index: 1 }),
      createElement(
        PhysicsWorld2D,
        { gravity: [0, 0] },
        createElement(Body, { index: 1 }),
      ),
    );
  }
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  root = crc(canvas, createElement(Root, {}));
  driver.flush(0);
  const points = new Float32Array([30, 50, 50, 30, 70, 60, 50, 75]);
  const first = new Float32Array(8),
    second = new Float32Array(8);
  for (let frame = 1; frame <= 45; frame++) {
    position.set([40 + Math.sin(frame / 10) * 10, 45]);
    driver.flush((frame * 1000) / 60);
    fields[0]!.sampleBatch(points, first, 4);
    fields[1]!.sampleBatch(points, second, 4);
    expect(second).toEqual(first);
  }
  expect(first.some((value) => Math.abs(value) > 1)).toBe(true);
  expect(sources[0]!.read().boxes).toEqual(sources[1]!.read().boxes);
});

it("does not retain a source clock or usable field after its initial render fails", async () => {
  const { snapshotRealmScheduler } =
    await import("../../../../core/src/lib/scheduler/testing.js");
  const baseline = snapshotRealmScheduler().advanceParticipants;
  let flow!: CRCFlowField2D;
  function Root() {
    flow = useFlowField2D({
      bounds: { width: 100, height: 100 },
      resolution: [10, 10],
    });
    useFlowSource2D(flow, { position: [50, 50], radius: 20, heat: 2 });
    throw new Error("failed flow mount");
  }
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  root = crc(canvas, createElement(Root, {}));
  expect(() => driver.flush(0)).toThrow("failed flow mount");
  expect(snapshotRealmScheduler().advanceParticipants).toBe(baseline);
  expect(driver.pendingHostFrames).toBe(0);
  expect(() =>
    flow.sampleBatch(new Float32Array(2), new Float32Array(2), 1),
  ).toThrow(/disposed/);
});
