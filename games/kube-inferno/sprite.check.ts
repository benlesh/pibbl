import { test } from "node:test";
import assert from "node:assert/strict";
import { framePlacement } from "./sprite-geometry.ts";
test("irregular trimmed frames preserve the same logical anchor without stretching", () => {
  const a = framePlacement(
    {
      x: 4,
      y: 7,
      width: 60,
      height: 80,
      offsetX: 20,
      offsetY: 10,
      sourceWidth: 100,
      sourceHeight: 100,
    },
    200,
    300,
    100,
    100,
  );
  const b = framePlacement(
    {
      x: 103,
      y: 40,
      width: 90,
      height: 60,
      offsetX: 5,
      offsetY: 30,
      sourceWidth: 100,
      sourceHeight: 100,
    },
    200,
    300,
    100,
    100,
  );
  assert.deepEqual(a, { x: 170, y: 210, width: 60, height: 80 });
  assert.deepEqual(b, { x: 155, y: 230, width: 90, height: 60 });
});

test("atlas ground anchors put the contact point on the world platform", () => {
  const frame = {
    x: 0,
    y: 0,
    width: 512,
    height: 512,
    offsetX: 0,
    offsetY: 0,
    sourceWidth: 512,
    sourceHeight: 512,
    anchorX: 0.5,
    anchorY: 0.85,
  };
  const placed = framePlacement(frame, 200, 300, 190, 190);
  assert.equal(placed.y + 190 * 0.85, 300);
  assert.equal(placed.x + 190 * 0.5, 200);
});
