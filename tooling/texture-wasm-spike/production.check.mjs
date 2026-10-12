import { test } from "node:test";
import assert from "node:assert/strict";
import { InkSimulation } from "../../packages/core/src/features/textures/lib/simulation.ts";
import { InkSimulation as Reference } from "./reference-simulation.ts";
import { materialField } from "../../packages/core/src/features/textures/lib/material-field.ts";
import { materialField as reference } from "./reference-material-field.ts";
test("production kernels preserve the original seeded fields, brush effects, and fixed steps", () => {
  for (const seed of [0, 42, 4294967295]) {
    for (const preset of ["spots", "stripes"]) {
      const actual = new InkSimulation({ width: 64, height: 40, seed, preset }),
        expected = new Reference(64, 40, seed, preset);
      assert.deepEqual(actual.a, expected.a);
      assert.deepEqual(actual.b, expected.b);
      actual.paint(30, 20, 12, 0.8);
      expected.paint(30, 20, 12, 0.8);
      for (const steps of [1, 8, 23]) {
        actual.advance(steps);
        expected.advance(steps);
        assert.deepEqual(actual.a, expected.a);
        assert.deepEqual(actual.b, expected.b);
      }
      actual.dispose();
      expected.dispose();
    }
    for (const kind of ["marble", "paper", "cellular"]) {
      const field = materialField(64, 40, kind, seed, 6, 0.65),
        expected = reference(64, 40, kind, seed, 6, 0.65);
      assert.ok(field.every((v, i) => Math.abs(v - expected[i]) < 1e-6));
    }
  }
});

test("static WASM fields preserve edge and numeric behavior at boundary dimensions and parameters", () => {
  for (const [width, height, seed, scale, detail] of [
    [8, 8, 0, 1, 0],
    [17, 31, 0xffffffff, 32, 1],
    [8, 1024, 91, 3.5, 0.7],
    [512, 512, 42, 6, 0.65],
  ])
    for (const kind of ["marble", "paper", "cellular"]) {
      const actual = materialField(width, height, kind, seed, scale, detail);
      const expected = reference(width, height, kind, seed, scale, detail);
      assert.ok(
        actual.every(
          (v, i) => Number.isFinite(v) && Math.abs(v - expected[i]) < 1e-6,
        ),
        kind,
      );
      for (let y = 0; y < height; y++)
        assert.ok(
          Math.abs(actual[y * width] - actual[y * width + width - 1]) < 1e-6,
        );
      for (let x = 0; x < width; x++)
        assert.ok(
          Math.abs(actual[x] - actual[(height - 1) * width + x]) < 1e-6,
        );
    }
});
