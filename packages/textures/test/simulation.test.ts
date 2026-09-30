import { expect, it } from "vitest";
import { InkSimulation } from "../src/lib/simulation.js";
import { materialField } from "../src/lib/material-field.js";

it("replays fixed step counts independently of batch boundaries and remains finite", () => {
  const a = new InkSimulation(64, 40, 42, "stripes"),
    b = new InkSimulation(64, 40, 42, "stripes");
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
  const spots = new InkSimulation(64, 40, 42, "spots"),
    stripes = new InkSimulation(64, 40, 42, "stripes");
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
  it(`keeps a radius-${radius} painted spot alive and does not erase it when painted again`, () => {
    const ink = new InkSimulation(80, 80, 42, "spots");
    // Isolate a user-created colony from the constructor's seeded pattern.
    ink.a.fill(1);
    ink.b.fill(0);
    ink.paint(40, 40, radius, 0.8);
    ink.advance(960);
    const mass = () => ink.b.reduce((sum, value) => sum + value, 0);
    expect(mass()).toBeGreaterThan(25);
    const settled = mass();
    for (let i = 0; i < 12; i++) ink.paint(40, 40, radius, 0.8);
    ink.advance(960);
    expect(mass()).toBeGreaterThan(settled * 0.8);
    ink.dispose();
  });
