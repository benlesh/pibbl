import { test } from "node:test";
import assert from "node:assert/strict";
import { mapViewport, screenToWorld } from "./map-viewport.ts";

test("wide and tall windows use one scale and center the logical map", () => {
  assert.deepEqual(mapViewport(1000, 400), {
    scale: 400 / 720,
    left: (1000 - 1200 * (400 / 720)) / 2,
    top: 0,
  });
  assert.deepEqual(mapViewport(400, 700), { scale: 1 / 3, left: 0, top: 230 });
});
test("pointer targeting reverses fitting, pan and zoom together", () => {
  for (const [width, height] of [
    [1000, 400],
    [400, 700],
    [390, 234],
  ]) {
    const v = mapViewport(width, height),
      camera = { x: 30, y: 78, zoom: 0.88 };
    const x = v.left + (510 * camera.zoom + camera.x) * v.scale;
    const y = v.top + (355 * camera.zoom + camera.y) * v.scale;
    const world = screenToWorld(x, y, width, height, camera);
    assert.ok(Math.abs(world.x - 510) < 1e-9);
    assert.ok(Math.abs(world.y - 355) < 1e-9);
  }
});
