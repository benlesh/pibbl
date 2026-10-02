import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InkSimulation } from '../../packages/textures/src/lib/simulation.ts';
import { InkSimulation as Reference } from './reference-simulation.ts';
import { materialField } from '../../packages/textures/src/lib/material-field.ts';
import { materialField as reference } from './reference-material-field.ts';
test('production kernels preserve the original seeded fields, brush effects, and fixed steps', () => {
  for (const seed of [0, 42, 4294967295]) {
    for (const preset of ['spots', 'stripes']) {
      const actual = new InkSimulation(64, 40, seed, preset), expected = new Reference(64, 40, seed, preset);
      assert.deepEqual(actual.a, expected.a);
      assert.deepEqual(actual.b, expected.b);
      actual.paint(30, 20, 12, .8); expected.paint(30, 20, 12, .8);
      for (const steps of [1, 8, 23]) {
        actual.advance(steps); expected.advance(steps);
        assert.deepEqual(actual.a, expected.a);
        assert.deepEqual(actual.b, expected.b);
      }
      actual.dispose(); expected.dispose();
    }
    for (const kind of ['marble', 'paper', 'cellular']) {
      const field = materialField(64, 40, kind, seed, 6, .65), expected = reference(64, 40, kind, seed, 6, .65);
      assert.ok(field.every((v, i) => Math.abs(v - expected[i]) < 1e-6));
    }
  }
});
