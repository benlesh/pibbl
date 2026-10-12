import { expect, it, vi } from "vitest";
import { pibbl, Rectangle, useTexture } from "@pibbl/core";
import { tendrils, lightning } from "@pibbl/core/textures";
import {
  ManualSchedulerDriver,
  installSchedulerDriverForTest,
} from "../../../src/lib/scheduler/testing.js";
it("allocates fixed WASM memory for both electric generators and reuses it through animation", () => {
  const native = WebAssembly.Memory;
  const memory = vi
    .spyOn(WebAssembly, "Memory")
    .mockImplementation(function (options) {
      return new native(options);
    });
  const driver = new ManualSchedulerDriver(),
    restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement("canvas");
  document.body.append(canvas);
  function Scene() {
    const a = useTexture(
      tendrils({
        sources: [{ id: "a", point: { x: 0.8, y: 0.8 }, weight: 1 }],
      }),
    );
    const b = useTexture(lightning());
    return (
      <>
        <Rectangle style={{ width: 100, height: 100, fill: a }} />
        <Rectangle style={{ width: 100, height: 100, fill: b }} />
      </>
    );
  }
  const controller = pibbl(canvas, <Scene />);
  try {
    driver.flush(0);
    expect(memory).toHaveBeenCalledTimes(2);
    const buffers = memory.mock.results.map((result) => result.value.buffer);
    for (let i = 1; i <= 60; i++) driver.flush(i * 16);
    expect(memory).toHaveBeenCalledTimes(2);
    expect(memory.mock.results.map((result) => result.value.buffer)).toEqual(
      buffers,
    );
    for (const call of memory.mock.calls)
      expect(call[0].maximum).toBe(call[0].initial);
  } finally {
    controller.dispose();
    restore();
    memory.mockRestore();
    canvas.remove();
  }
  expect(driver.pendingHostFrames).toBe(0);
});

import { type Texture, type TextureRecipe } from "@pibbl/core";
import { tendrils as jsTendrils } from "../../../../../tooling/texture-wasm-spike/reference-electric/tendrils.js";
import { lightning as jsLightning } from "../../../../../tooling/texture-wasm-spike/reference-electric/lightning.js";
function replay(
  recipe: TextureRecipe<any>,
  commands: (frame: number, texture: Texture<any>) => void,
) {
  const driver = new ManualSchedulerDriver(),
    restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement("canvas");
  document.body.append(canvas);
  let texture!: Texture<any>;
  function Scene() {
    texture = useTexture(recipe, { resolution: { width: 128, height: 128 } });
    return <Rectangle style={{ width: 128, height: 128, fill: texture }} />;
  }
  const moves = vi.spyOn(OffscreenCanvasRenderingContext2D.prototype, "moveTo");
  const lines = vi.spyOn(OffscreenCanvasRenderingContext2D.prototype, "lineTo");
  const arcs = vi.spyOn(OffscreenCanvasRenderingContext2D.prototype, "arc");
  const snapshots: number[][] = [];
  const controller = pibbl(canvas, <Scene />);
  try {
    for (let frame = 0; frame <= 320; frame++) {
      moves.mockClear();
      lines.mockClear();
      arcs.mockClear();
      if (frame > 0) commands(frame, texture);
      if (driver.pendingHostFrames) driver.flush(frame * 50);
      if ([0, 1, 15, 21, 35, 41, 51, 61, 71, 121, 261, 320].includes(frame))
        snapshots.push(
          [
            ...moves.mock.calls.flat(),
            ...lines.mock.calls.flat(),
            ...arcs.mock.calls.flat(),
          ].map(Number),
        );
    }
  } finally {
    controller.dispose();
    restore();
    moves.mockRestore();
    lines.mockRestore();
    arcs.mockRestore();
    canvas.remove();
  }
  expect(driver.pendingHostFrames).toBe(0);
  return snapshots;
}
it("matches JS-reference tendril geometry through source edits, pause, boundary drift, release and rebirth", () => {
  const config = {
    seed: 42,
    count: 3,
    branching: 1,
    crackle: 0.8,
    rise: 1,
    boundary: [
      { x: 0.1, y: 0.1 },
      { x: 0.9, y: 0.2 },
      { x: 0.8, y: 0.9 },
      { x: 0.1, y: 0.9 },
    ],
    sources: [
      { id: "a", point: { x: 0.8, y: 0.8 }, weight: 0.1 },
      { id: "b", point: { x: 0.3, y: 0.7 }, weight: 1 },
    ],
  };
  const commands = (frame: number, t: Texture<any>) => {
    if (frame === 10)
      t.send({
        type: "upsert-source",
        source: { id: "b", point: { x: 0.4, y: 0.5 }, weight: 10 },
      });
    if (frame === 20) t.send({ type: "remove-source", id: "b" });
    if (frame === 40) t.send({ type: "pause", paused: true });
    if (frame === 50)
      t.send({
        type: "upsert-source",
        source: { id: "c", point: { x: 0.7, y: 0.3 }, weight: 2 },
      });
    if (frame === 60) t.send({ type: "pause", paused: false });
    if (frame === 70) t.send({ type: "remove-source", id: "c" });
  };
  const expected = replay(jsTendrils(config), commands),
    actual = replay(tendrils(config), commands);
  expect(actual.map((a) => a.length)).toEqual(expected.map((a) => a.length));
  actual.forEach((values, frame) =>
    values.forEach((value, i) =>
      expect(value).toBeCloseTo(expected[frame][i], 9),
    ),
  );
});
it("matches JS-reference lightning geometry through edge changes, released connections and slot reuse", () => {
  const config = {
    seed: 91,
    branching: 1,
    contactCore: true,
    edge: "top" as const,
  };
  const commands = (frame: number, t: Texture<any>) => {
    if (frame === 1)
      for (let i = 0; i < 4; i++)
        t.send({
          type: "connect",
          id: String(i),
          positive: { x: 0.2, y: 0.2 + i * 0.15 },
          negative: { x: 0.8, y: 0.7 },
        });
    if (frame === 10) t.send({ type: "disconnect", id: "0" });
    if (frame === 20) t.send({ type: "configure", edge: "right" });
    if (frame === 30)
      t.send({
        type: "connect",
        id: "new",
        positive: { x: 0.7, y: 0.3 },
        negative: { x: 0.9, y: 0.7 },
      });
    if (frame === 40) t.send({ type: "configure", edge: "bottom" });
    if (frame === 50) t.send({ type: "pause", paused: true });
    if (frame === 60) t.send({ type: "configure", edge: "left" });
    if (frame === 70) t.send({ type: "pause", paused: false });
  };
  const expected = replay(jsLightning(config), commands),
    actual = replay(lightning(config), commands);
  expect(actual.map((a) => a.length)).toEqual(expected.map((a) => a.length));
  actual.forEach((values, frame) =>
    values.forEach((value, i) =>
      expect(value).toBeCloseTo(expected[frame][i], 9),
    ),
  );
});
