import { expect, it } from "vitest";
import { FlowFieldKernel2D } from "./field.js";
import { FlowParticlePopulation2D } from "./population.js";

it("advects a reusable particle batch and preserves the committed population until adoption", () => {
  const field = new FlowFieldKernel2D(24, 24, 240, 240);
  const sources = [{ x: 120, y: 180, radius: 40, heat: 3, acceleration: [0, -200] as const }];
  for (let i = 0; i < 120; i++) field.advance(1 / 60, sources);
  const committed = new FlowParticlePopulation2D(2);
  committed.birth(0, 1, 0, 120, 160);
  committed.birth(1, 2, 0, 130, 160);
  const candidate = new FlowParticlePopulation2D(2);
  candidate.copyFrom(committed);
  const order = new Uint32Array([1, 0xffffffff]);
  candidate.advance(field, 0, order, 2, 1000 / 60);
  expect(candidate.positions[1]).toBeLessThan(160);
  expect(candidate.positions[3]).toBeLessThan(160);
  expect(committed.positions[1]).toBe(160);
  committed.copyFrom(candidate);
  expect(committed.positions).toEqual(candidate.positions);
  candidate.birth(0, 3, 20, 70, 80);
  expect(candidate.positions[0]).toBe(70);
  expect(candidate.positions[1]).toBe(80);
});

it("retires particles covered by moving solids until their slots are reborn", () => {
  const field = new FlowFieldKernel2D(24, 24, 240, 240);
  const population = new FlowParticlePopulation2D(2);
  const order = new Uint32Array([1, 0xffffffff]);
  population.birth(0, 1, 0, 120, 120);
  population.birth(1, 2, 0, 180, 120);
  field.setBoxes(new Float64Array([120, 120, 20, 20, 0, 60, 0, 0, 120, 120]));
  population.advance(field, 0, order, 2, 1000 / 60);
  expect(population.isRetired(0)).toBe(true);
  expect(population.isRetired(1)).toBe(false);
  const candidate = new FlowParticlePopulation2D(2);
  candidate.copyFrom(population);
  field.setBoxes(new Float64Array());
  candidate.advance(field, 0, order, 2, 2000 / 60);
  expect(candidate.isRetired(0)).toBe(true);
  candidate.birth(0, 3, 40, 60, 60);
  expect(candidate.isRetired(0)).toBe(false);
  expect(population.isRetired(0)).toBe(true);
});
