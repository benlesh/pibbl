import { afterEach, expect, it, vi } from "vitest";
import { crc, Rectangle, type Texture } from "@crc/core";
import { tendrils, useTexture, type TendrilsMessage } from "@crc/textures";
import {
  ManualSchedulerDriver,
  installSchedulerDriverForTest,
} from "../../core/src/lib/scheduler/testing.js";
let cleanup = () => {};
afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});
it("uses ordinary weighted sources for geometry and heavy manual contacts, then releases from the current point", () => {
  const driver = new ManualSchedulerDriver(),
    restore = installSchedulerDriverForTest(driver);
  let texture!: Texture<TendrilsMessage>;
  function Scene() {
    texture = useTexture(
      tendrils({
        seed: 42,
        count: 1,
        branching: 0,
        glow: 0,
        rise: 1,
        sources: [{ id: "corner", point: { x: 0.9, y: 0.9 }, weight: 1 }],
      }),
      { resolution: { width: 256, height: 256 } },
    );
    return (
      <>
        <Rectangle style={{ width: 256, height: 256, fill: texture }} />
        <Rectangle style={{ x: 256, width: 256, height: 256, fill: texture }} />
      </>
    );
  }
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  document.body.append(canvas);
  const controller = crc(canvas, <Scene />);
  cleanup = () => {
    controller.dispose();
    restore();
  };
  driver.flush(0);
  const ctx = canvas.getContext("2d")!;
  const alphaNear = (x: number, y: number) =>
    [...ctx.getImageData(x - 2, y - 2, 5, 5).data]
      .filter((_, i) => i % 4 === 3)
      .reduce((a, b) => a + b, 0);
  expect(alphaNear(230, 230)).toBeGreaterThan(50); // Outside the former circular perimeter.
  texture.send({
    type: "upsert-source",
    source: { id: "manual", point: { x: 0.8, y: 0.7 }, weight: 1000 },
  });
  for (let i = 1; i <= 30; i++) driver.flush(i * 50);
  expect(alphaNear(205, 179)).toBeGreaterThan(50);
  expect([...ctx.getImageData(0, 0, 256, 256).data]).toEqual([
    ...ctx.getImageData(256, 0, 256, 256).data,
  ]);
  texture.send({ type: "remove-source", id: "manual" });
  for (let i = 31; i <= 36; i++) driver.flush(i * 50);
  expect(alphaNear(205, 175)).toBeGreaterThan(50);
  texture.send({ type: "pause", paused: true });
  driver.flush(1850);
  expect(driver.pendingHostFrames).toBe(0);
  texture.send({ type: "reset" });
  driver.flush(1950);
  expect(alphaNear(230, 230)).toBeGreaterThan(50);
  controller.dispose();
  controller.dispose();
  expect(driver.pendingHostFrames).toBe(0);
});

it("keeps seeded output order-independent, validates updates atomically, and bounds raster work across consumers", () => {
  const driver = new ManualSchedulerDriver(),
    restore = installSchedulerDriverForTest(driver);
  const baseline = Array.from({ length: 512 }, (_, i) => ({
    id: `site:${i}`,
    point: { x: 0.15 + (i % 16) * 0.046, y: 0.15 + Math.floor(i / 16) * 0.022 },
    weight: (i % 9) + 1,
  }));
  let texture!: Texture<TendrilsMessage>;
  function Scene() {
    texture = useTexture(
      tendrils({
        seed: 43,
        count: 32,
        sources: baseline,
        rise: 1,
        crackle: 0.5,
      }),
      { resolution: { width: 128, height: 128 } },
    );
    return (
      <>
        <Rectangle style={{ width: 128, height: 128, fill: texture }} />
        <Rectangle style={{ x: 128, width: 128, height: 128, fill: texture }} />
      </>
    );
  }
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  document.body.append(canvas);
  const strokes = vi.spyOn(
    OffscreenCanvasRenderingContext2D.prototype,
    "stroke",
  );
  const readbacks = vi.spyOn(
    OffscreenCanvasRenderingContext2D.prototype,
    "getImageData",
  );
  const controller = crc(canvas, <Scene />);
  cleanup = () => {
    controller.dispose();
    strokes.mockRestore();
    readbacks.mockRestore();
    restore();
  };
  driver.flush(0);
  // 32 filaments × (main + 3 sparks + 3 forks + 2 branches) × 4 passes.
  // The second consumer does not rasterize again; 512 sites add no paint work.
  expect(strokes).toHaveBeenCalledTimes(1152);
  expect(readbacks).not.toHaveBeenCalled();
  const ctx = canvas.getContext("2d")!,
    pixels = () => [...ctx.getImageData(0, 0, 128, 128).data];
  const seeded = pixels();
  texture.send({ type: "pause", paused: true });
  driver.flush(16);
  texture.send({ type: "set-sources", sources: [...baseline].reverse() });
  driver.flush(32);
  texture.send({ type: "reset" });
  driver.flush(48);
  expect(pixels()).toEqual(seeded);
  const before = pixels();
  texture.send({ type: "set-sources", sources: [baseline[0], baseline[0]] });
  expect(() => driver.flush(64)).toThrow(/Duplicate/);
  expect(pixels()).toEqual(before);
  texture.send({
    type: "upsert-source",
    source: { id: "overflow", point: { x: 0.1, y: 0.1 }, weight: 1 },
  });
  expect(() => driver.flush(80)).toThrow(/512/);
  texture.send({ type: "reset" });
  driver.flush(96);
  expect(pixels()).toEqual(seeded);
  expect(driver.pendingHostFrames).toBe(0);
});

it("starts empty, treats zero-weight removal like source removal, and restores the current baseline on reset", () => {
  const driver = new ManualSchedulerDriver(),
    restore = installSchedulerDriverForTest(driver);
  let texture!: Texture<TendrilsMessage>;
  function Scene() {
    texture = useTexture(
      tendrils({ seed: 7, count: 1, branching: 0, glow: 0, rise: 1 }),
      { resolution: { width: 256, height: 256 } },
    );
    return <Rectangle style={{ width: 256, height: 256, fill: texture }} />;
  }
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  document.body.append(canvas);
  const controller = crc(canvas, <Scene />);
  cleanup = () => {
    controller.dispose();
    restore();
  };
  driver.flush(0);
  expect(driver.pendingHostFrames).toBe(0);
  const ctx = canvas.getContext("2d")!,
    pixels = () => [...ctx.getImageData(0, 0, 256, 256).data];
  const empty = pixels();
  texture.send({
    type: "set-sources",
    sources: [{ id: "base", point: { x: 0.8, y: 0.7 }, weight: 2 }],
  });
  driver.flush(16);
  expect(pixels()).not.toEqual(empty);
  texture.send({
    type: "upsert-source",
    source: { id: "base", point: { x: 0.8, y: 0.7 }, weight: 0 },
  });
  for (let i = 1; i <= 110; i++)
    if (driver.pendingHostFrames) driver.flush(16 + i * 50);
  expect(driver.pendingHostFrames).toBe(0);
  expect(pixels()).toEqual(empty);
  texture.send({ type: "reset" });
  driver.flush(6000);
  expect(pixels()).not.toEqual(empty);
  controller.dispose();
  texture.send({ type: "remove-source", id: "base" });
  expect(driver.pendingHostFrames).toBe(0);
});

it("reaches a heavy source before crawling through a dense cloud of weaker neighbors", () => {
  const driver = new ManualSchedulerDriver(),
    restore = installSchedulerDriverForTest(driver);
  let texture!: Texture<TendrilsMessage>;
  function Scene() {
    texture = useTexture(
      tendrils({
        seed: 42,
        count: 15,
        rise: 1,
        glow: 0,
        branching: 0,
        crackle: 1,
        sources: Array.from({ length: 100 }, (_, i) => ({
          id: `grid:${i}`,
          point: {
            x: 0.1 + (i % 10) * 0.08,
            y: 0.1 + Math.floor(i / 10) * 0.08,
          },
          weight: 0.1,
        })),
      }),
      { resolution: { width: 256, height: 256 } },
    );
    return <Rectangle style={{ width: 256, height: 256, fill: texture }} />;
  }
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  document.body.append(canvas);
  const controller = crc(canvas, <Scene />);
  cleanup = () => {
    controller.dispose();
    restore();
  };
  driver.flush(0);
  texture.send({
    type: "upsert-source",
    source: { id: "touch:1", point: { x: 0.76, y: 0.72 }, weight: 12 },
  });
  texture.send({
    type: "upsert-source",
    source: { id: "touch:2", point: { x: 0.24, y: 0.68 }, weight: 12 },
  });
  const core = (x: number, y: number) =>
    [...canvas.getContext("2d")!.getImageData(x - 2, y - 2, 5, 5).data]
      .filter((_, i) => i % 4 === 0)
      .some((v) => v > 210);
  for (let i = 1; i <= 14; i++) driver.flush(i * 50);
  expect(core(195, 184)).toBe(true);
  expect(core(61, 174)).toBe(true);
  texture.send({ type: "remove-source", id: "touch:1" });
  for (let i = 15; i <= 28; i++) driver.flush(i * 50);
  expect(core(61, 174)).toBe(true);
});
