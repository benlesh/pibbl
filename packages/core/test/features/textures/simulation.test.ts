import { expect, it } from "vitest";
import { InkSimulation } from "../../../src/features/textures/lib/simulation.js";
import { materialField } from "../../../src/features/textures/lib/material-field.js";

it("replays fixed step counts independently of batch boundaries and remains finite", () => {
  const a = new InkSimulation({ width: 64, height: 40, seed: 42, preset: "stripes" }),
    b = new InkSimulation({ width: 64, height: 40, seed: 42, preset: "stripes" });
  a.paint(20, 10, 6, 0.8);
  b.paint(20, 10, 6, 0.8);
  a.advance(480);
  for (let i = 0; i < 60; i++) b.advance(8);
  expect(a.a).toEqual(b.a);
  expect(a.b).toEqual(b.b);
  expect(a.steps).toBe(480);
  expect(a.a.every((n) => Number.isFinite(n) && n >= 0 && n <= 1)).toBe(true);
  expect(a.b.every((n) => Number.isFinite(n) && n >= 0 && n <= 1)).toBe(true);
  a.dispose();
  b.dispose();
  expect(a.a.length + a.b.length).toBe(0);
});
it("produces distinct spots and stripes without changing the seed", () => {
  const spots = new InkSimulation({ width: 64, height: 40, seed: 42, preset: "spots" }),
    stripes = new InkSimulation({ width: 64, height: 40, seed: 42, preset: "stripes" });
  spots.advance(1000);
  stripes.advance(1000);
  expect(spots.b).not.toEqual(stripes.b);
  expect(spots.b.some((n) => n > 0.1)).toBe(true);
  expect(stripes.b.some((n) => n > 0.1)).toBe(true);
});
it("matches material edge values before colorization, including corners", () => {
  for (const kind of ["marble", "paper", "cellular"] as const) {
    const field = materialField(129, 81, kind, 91, 7.5, 0.7);
    for (let y = 0; y < 81; y++)
      expect(field[y * 129]).toBeCloseTo(field[y * 129 + 128], 6);
    for (let x = 0; x < 129; x++)
      expect(field[x]).toBeCloseTo(field[80 * 129 + x], 6);
  }
});

for (const radius of [3, 6, 12])
  it(`reshapes a radius-${radius} mature spot without collapsing it`, () => {
    const ink = new InkSimulation({ width: 80, height: 80, seed: 42, preset: "spots" });
    // Isolate a user-created colony from the constructor's seeded pattern.
    ink.a.fill(1);
    ink.b.fill(0);
    ink.paint(40, 40, radius, 0.8);
    ink.advance(960);
    const mass = () => ink.b.reduce((sum, value) => sum + value, 0);
    expect(mass()).toBeGreaterThan(25);
    const settled = mass();
    const before = new Float32Array(ink.b);
    ink.paint(40, 40, radius, 0.8);
    expect(ink.b).not.toEqual(before);
    ink.advance(960);
    expect(mass()).toBeGreaterThan(settled * 0.6);
    ink.dispose();
  });

it("keeps paper grain in a pale, narrow tonal range rather than broad dark bands", () => {
  for (const detail of [0, 0.65, 1]) {
    const paper = materialField(128, 128, "paper", 42, 6, detail);
    expect(Math.max(...paper)).toBeLessThan(0.23);
    expect(Math.min(...paper)).toBeGreaterThan(0.02);
    expect(Math.max(...paper) - Math.min(...paper)).toBeGreaterThan(0.005);
  }
});

it("stirs existing ink locally without creating a new brush colony or changing memory", () => {
  const ink = new InkSimulation({ width: 64, height: 40, seed: 42, preset: "spots" });
  const before = ink.b.slice(),
    memory = ink.b.buffer;
  ink.stir(30, 20, 0, 0, 10);
  expect(ink.b).toEqual(before);
  ink.stir(30, 20, 4, 2, 10);
  expect(ink.b.buffer).toBe(memory);
  expect(ink.b).not.toEqual(before);
  for (let y = 0; y < 40; y++)
    for (let x = 0; x < 64; x++) {
      if (Math.hypot(x - 30, y - 20) >= 10)
        expect(ink.b[y * 64 + x]).toBe(before[y * 64 + x]);
    }
  expect(ink.b.every((v) => Number.isFinite(v) && v >= 0 && v <= 1)).toBe(true);
  ink.dispose();
});

it("backtraces both fields correctly after buffer swaps and preserves uniform edge fields", () => {
  const ink = new InkSimulation({ width: 16, height: 8, seed: 42, preset: "stripes" });
  try {
    ink.advance(1); // Exercise the alternate A/B field pair.
    for (let i = 0; i < ink.b.length; i++) {
      ink.b[i] = (i % 16) / 16;
      ink.a[i] = 1 - ink.b[i];
    }
    ink.stir(8, 4, 2, 0, 4);
    expect(ink.b[4 * 16 + 8]).toBe(6 / 16);
    expect(ink.a[4 * 16 + 8]).toBe(10 / 16);
    ink.a.fill(0.75);
    ink.b.fill(0.25);
    for (const [x, y] of [
      [0, 0],
      [16, 0],
      [0, 8],
      [16, 8],
    ]) {
      ink.stir(x, y, 16, -8, 128);
      expect(ink.a.every((value) => value === 0.75)).toBe(true);
      expect(ink.b.every((value) => value === 0.25)).toBe(true);
    }
  } finally {
    ink.dispose();
  }
});
