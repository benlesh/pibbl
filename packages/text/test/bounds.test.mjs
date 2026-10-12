import { test } from "node:test";
import assert from "node:assert/strict";
import { PathGeometry } from "@pibbl/core";
import { inkBounds } from "../dist/testing.mjs";
const near = (actual, expected, tolerance = 1e-10) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} != ${expected}`,
  );
test("quadratic and cubic bounds use extrema rather than control hulls", () => {
  const quadratic = new PathGeometry();
  quadratic.moveTo(0, 0);
  quadratic.quadraticCurveTo(10, 20, 20, 0);
  assert.deepEqual(inkBounds(quadratic), { x: 0, y: 0, width: 20, height: 10 });
  const cubic = new PathGeometry();
  cubic.moveTo(0, 0);
  cubic.bezierCurveTo(0, 20, 20, 20, 20, 0);
  const bounds = inkBounds(cubic);
  near(bounds.x, 0);
  near(bounds.y, 0);
  near(bounds.width, 20);
  near(bounds.height, 15);
  const inflected = new PathGeometry();
  inflected.moveTo(0, 0);
  inflected.bezierCurveTo(1, 1, 2, -1, 3, 0);
  const b = inkBounds(inflected);
  near(b.y, -Math.sqrt(3) / 6);
  near(b.height, Math.sqrt(3) / 3);
});
test("moves add no ink; close segments and negative coordinates are included", () => {
  const path = new PathGeometry();
  path.moveTo(1000, 1000);
  assert.equal(inkBounds(path), null);
  path.moveTo(-10, -5);
  path.lineTo(2, 3);
  path.closePath();
  assert.deepEqual(inkBounds(path), { x: -10, y: -5, width: 12, height: 8 });
});
test("analytic cubic bounds enclose independently sampled curves across deterministic inputs", () => {
  let seed = 12345;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return (seed / 2 ** 32 - 0.5) * 2000;
  };
  for (let c = 0; c < 80; c++) {
    const p = Array.from({ length: 8 }, random);
    const path = new PathGeometry();
    path.moveTo(p[0], p[1]);
    path.bezierCurveTo(...p.slice(2));
    const b = inkBounds(path);
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (let i = 0; i <= 1000; i++) {
      const t = i / 1000,
        u = 1 - t;
      const x =
        u ** 3 * p[0] +
        3 * u * u * t * p[2] +
        3 * u * t * t * p[4] +
        t ** 3 * p[6];
      const y =
        u ** 3 * p[1] +
        3 * u * u * t * p[3] +
        3 * u * t * t * p[5] +
        t ** 3 * p[7];
      assert.ok(
        x >= b.x - 1e-9 &&
          x <= b.x + b.width + 1e-9 &&
          y >= b.y - 1e-9 &&
          y <= b.y + b.height + 1e-9,
      );
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    // Sampled extrema converge to the analytic bounds, rather than merely
    // fitting inside an excessively large control-point bounding rectangle.
    near(b.x, minX, 0.01);
    near(b.y, minY, 0.01);
    near(b.x + b.width, maxX, 0.01);
    near(b.y + b.height, maxY, 0.01);
  }
});
