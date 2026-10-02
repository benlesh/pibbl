import { afterEach, expect, it } from "vitest";
import { crc, Rectangle, type Texture } from "@crc/core";
import {
  tendrils,
  lightning,
  useTexture,
  type TendrilsMessage,
  type LightningMessage,
} from "@crc/textures";
import {
  ManualSchedulerDriver,
  installSchedulerDriverForTest,
} from "../../core/src/lib/scheduler/testing.js";

let cleanup = () => {};
afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

it("composes independent electric fills, shares pixels, and routes typed contact commands without a second loop", () => {
  const driver = new ManualSchedulerDriver();
  const restore = installSchedulerDriverForTest(driver);
  let threads!: Texture<TendrilsMessage>, sparks!: Texture<LightningMessage>;
  function Scene() {
    threads = useTexture(
      tendrils({
        seed: 42,
        sources: [{ id: "idle", point: { x: 0.8, y: 0.8 }, weight: 0.1 }],
      }),
      {
        resolution: { width: 160, height: 160 },
      },
    );
    sparks = useTexture(
      lightning({ seed: 42, active: false, contactCore: true }),
      { resolution: { width: 160, height: 160 } },
    );
    return (
      <>
        <Rectangle style={{ width: 160, height: 160, fill: threads }} />
        <Rectangle style={{ width: 160, height: 160, fill: sparks }} />
        <Rectangle style={{ x: 160, width: 160, height: 160, fill: threads }} />
        <Rectangle style={{ x: 160, width: 160, height: 160, fill: sparks }} />
      </>
    );
  }
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 160;
  document.body.append(canvas);
  const controller = crc(canvas, <Scene />);
  cleanup = () => {
    controller.dispose();
    restore();
  };
  driver.flush(0);
  const ctx = canvas.getContext("2d")!;
  const pixels = (x = 0) => [...ctx.getImageData(x, 0, 160, 160).data];
  const idle = pixels();
  expect(idle.some((v, i) => i % 4 === 3 && v > 0)).toBe(true);
  expect(ctx.getImageData(0, 0, 1, 1).data[3]).toBe(0);
  expect(pixels(160)).toEqual(idle);
  threads.send({
    type: "upsert-source",
    source: { id: "7", point: { x: 0.8, y: 0.3 }, weight: 100 },
  });
  sparks.send({
    type: "connect",
    id: "7",
    positive: { x: 0.8, y: 0.3 },
    negative: { x: 0.72, y: 0.24 },
  });
  for (let i = 1; i <= 20; i++) driver.flush(i * 16);
  const contact = ctx.getImageData(128, 48, 1, 1).data;
  expect(contact[0]).toBeGreaterThan(200);
  expect(contact[3]).toBeGreaterThan(200);
  expect(pixels()).not.toEqual(idle);
  expect(pixels(160)).toEqual(pixels());
  threads.send({ type: "remove-source", id: "7" });
  sparks.send({ type: "disconnect", id: "7" });
  threads.send({ type: "pause", paused: true });
  sparks.send({ type: "pause", paused: true });
  driver.flush(336);
  // A frame requested by the earlier disconnect in this batch drains once.
  driver.flush(352);
  expect(driver.pendingHostFrames).toBe(0);
  threads.send({ type: "reset" });
  sparks.send({ type: "reset" });
  driver.flush(368);
  expect(pixels()).toEqual(idle);
  controller.dispose();
  controller.dispose();
  expect(driver.pendingHostFrames).toBe(0);
});

it("moves an ordinary source with its existing id while paused without scheduling animation", () => {
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
        sources: [{ id: "site", point: { x: 0.8, y: 0.8 }, weight: 1 }],
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
  texture.send({ type: "pause", paused: true });
  driver.flush(16);
  texture.send({
    type: "upsert-source",
    source: { id: "site", point: { x: 0.8, y: 0.2 }, weight: 1 },
  });
  driver.flush(32);
  const pixels = canvas.getContext("2d")!.getImageData(202, 49, 6, 6).data;
  expect([...pixels].some((v, i) => i % 4 === 3 && v > 50)).toBe(true);
  expect(driver.pendingHostFrames).toBe(0);
});

it("replaces the source collection and enables small terminal crackles through typed commands", () => {
  const driver = new ManualSchedulerDriver();
  const restore = installSchedulerDriverForTest(driver);
  let texture!: Texture<TendrilsMessage>;
  function Scene() {
    texture = useTexture(
      tendrils({
        seed: 42,
        count: 1,
        branching: 0,
        glow: 0,
        sources: [{ id: "outer", point: { x: 0.9, y: 0.5 }, weight: 1 }],
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
  texture.send({ type: "pause", paused: true });
  driver.flush(16);
  const extent = () => {
    const data = canvas.getContext("2d")!.getImageData(0, 0, 256, 256).data;
    let radius = 0,
      count = 0;
    for (let y = 0; y < 256; y++)
      for (let x = 0; x < 256; x++) {
        if (data[(y * 256 + x) * 4 + 3] > 10) {
          radius = Math.max(radius, Math.hypot(x - 128, y - 128));
          count++;
        }
      }
    return { radius, count };
  };
  expect(extent().radius).toBeGreaterThan(99);
  texture.send({
    type: "set-sources",
    sources: [{ id: "inner", point: { x: 0.72, y: 0.5 }, weight: 1 }],
  });
  driver.flush(32);
  const interior = extent();
  expect(interior.radius).toBeLessThan(90);
  texture.send({ type: "configure", crackle: 1 });
  driver.flush(48);
  expect(extent().count).toBeGreaterThan(interior.count + 15);
});

it("continues upward from the released contact instead of returning to its old idle endpoint", () => {
  const driver = new ManualSchedulerDriver();
  const restore = installSchedulerDriverForTest(driver);
  let texture!: Texture<TendrilsMessage>;
  function Scene() {
    texture = useTexture(
      tendrils({
        seed: 42,
        count: 1,
        rise: 1,
        branching: 0,
        glow: 0,
        sources: [{ id: "idle", point: { x: 0.3, y: 0.8 }, weight: 0.1 }],
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
    source: { id: "1", point: { x: 0.8, y: 0.7 }, weight: 100 },
  });
  for (let i = 1; i <= 30; i++) driver.flush(i * 50);
  const tip = () => {
    const d = canvas.getContext("2d")!.getImageData(0, 0, 256, 256).data;
    for (let x = 255; x > 140; x--)
      for (let y = 0; y < 256; y++)
        if (d[(y * 256 + x) * 4 + 3] > 50) return { x, y };
    throw new Error("Missing filament tip");
  };
  const before = tip();
  texture.send({ type: "remove-source", id: "1" });
  for (let i = 31; i <= 36; i++) driver.flush(i * 50);
  const after = tip();
  expect(after.x).toBeGreaterThan(before.x - 10);
  expect(after.y).toBeLessThan(before.y - 1);
});
