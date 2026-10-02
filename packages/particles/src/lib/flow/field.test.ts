import { describe, expect, it } from "vitest";
import { FlowFieldKernel2D } from "./field.js";

describe("obstacle-aware flow", () => {
  it("redirects an upward plume around a solid square without creating flow through its faces", () => {
    const field = new FlowFieldKernel2D(48, 48, 480, 480);
    // cx, cy, half width/height, radians, vx, vy, omega, COM x/y
    field.setBoxes(new Float64Array([240, 240, 40, 40, 0, 0, 0, 0, 240, 240]));
    for (let step = 0; step < 120; step++) {
      field.advance(1 / 60, [
        { x: 240, y: 350, radius: 45, acceleration: [0, -300] },
      ]);
    }
    const positions = new Float32Array([195, 285, 285, 285, 240, 300]);
    const velocities = new Float32Array(6);
    field.sampleBatch(positions, velocities, 3);
    expect(velocities[0]).toBeLessThan(-1);
    expect(velocities[2]).toBeGreaterThan(1);
    expect(velocities[5]).toBeLessThan(-1);
    expect(field.maximumSolidFluxError()).toBe(0);
    expect(field.maximumDivergence()).toBeLessThan(0.2);
  });

  it("uses solid motion, including rotation about the center of mass", () => {
    const field = new FlowFieldKernel2D(24, 24, 240, 240);
    field.setBoxes(
      new Float64Array([120, 120, 30, 30, 0, 25, -10, 0.5, 110, 120]),
    );
    field.advance(1 / 60);
    expect(field.maximumSolidFluxError()).toBe(0);
    const velocities = new Float32Array(4);
    field.sampleBatch(new Float32Array([85, 120, 155, 120]), velocities, 2);
    expect(velocities[0]).toBeGreaterThan(0);
    expect(velocities[2]).toBeGreaterThan(0);
  });

  it("reuses numerical storage and rejects malformed batches before changing the field", () => {
    const field = new FlowFieldKernel2D(16, 16, 160, 160);
    const bytes = field.byteLength;
    field.setBoxes(new Float64Array([80, 80, 20, 20, 0, 0, 0, 0, 80, 80]));
    expect(() => field.setBoxes(new Float64Array([1, 2]))).toThrow(/obstacle/);
    for (let i = 0; i < 10; i++) field.advance(1 / 60);
    expect(field.byteLength).toBe(bytes);
    expect(field.isSolid(80, 80)).toBe(true);
    expect(() =>
      field.sampleBatch(new Float32Array(4), new Float32Array(2), 2),
    ).toThrow(/batch/);
  });

  it("stops the pressure solve when the residual converges", () => {
    const field = new FlowFieldKernel2D(32, 24, 320, 240);
    field.advance(1 / 60);
    expect(field.projectionIterations).toBeLessThan(80);
    expect(field.projectionResidual).toBe(0);
    for (let i = 0; i < 60; i++)
      field.advance(1 / 60, [
        { x: 160, y: 180, radius: 40, acceleration: [0, -200] },
      ]);
    expect(field.maximumDivergence()).toBeLessThan(0.01);
    expect(field.maximumDivergence()).toBeCloseTo(field.projectionResidual, 4);
  });

  it("sweeps particle segments so a fast particle cannot tunnel through a square", () => {
    const field = new FlowFieldKernel2D(24, 24, 240, 240);
    field.setBoxes(new Float64Array([120, 120, 20, 20, 0, 0, 0, 0, 120, 120]));
    const positions = new Float32Array([120, 200, 60, 200]);
    const velocities = new Float32Array([0, -1000, 0, -1000]);
    field.moveBatch(positions, velocities, 2, 0.1);
    expect(positions[1]).toBeGreaterThanOrEqual(140);
    expect(positions[1]).toBeLessThan(141);
    expect(positions[3]).toBe(100);
    expect(field.isSolid(positions[0]!, positions[1]!)).toBe(false);
  });
});

it("carries buoyancy with the plume so smoke rises past the obstacle", () => {
  const field = new FlowFieldKernel2D(96, 64, 720, 480);
  field.setBoxes(new Float64Array([340, 250, 55, 30, 0, 0, 0, 0, 340, 250]));
  const positions = new Float32Array(128);
  const velocities = new Float32Array(128);
  for (let i = 0; i < 64; i++) {
    positions[i * 2] = 332 + i * 0.9;
    positions[i * 2 + 1] = 385;
  }
  const sources = [
    { x: 360, y: 395, radius: 45, acceleration: [0, -300] as const, heat: 3 },
  ];
  for (let step = 0; step < 600; step++) {
    field.advance(1 / 60, sources);
    field.sampleBatch(positions, velocities, 64);
    field.moveBatch(positions, velocities, 64, 1 / 60);
  }
  for (let i = 0; i < 64; i++) {
    expect(positions[i * 2 + 1]).toBeLessThan(220);
    expect(field.isSolid(positions[i * 2]!, positions[i * 2 + 1]!)).toBe(false);
  }
});

it("rasterizes ellipse and triangle outlines rather than their bounding boxes", () => {
  const field = new FlowFieldKernel2D(48, 48, 480, 480);
  field.setObstacles({
    ellipses: new Float64Array([120, 120, 60, 30, 0, 20, 0, 0, 120, 120]),
    polygons: new Float64Array([
      3, 0, -10, 0, 300, 130, 240, 180, 300, 60, 360, 180,
    ]),
  });
  expect(field.isSolid(120, 120)).toBe(true);
  expect(field.isSolid(170, 140)).toBe(false);
  expect(field.isSolid(300, 120)).toBe(true);
  expect(field.isSolid(250, 80)).toBe(false);
  field.advance(1 / 60);
  expect(field.maximumSolidFluxError()).toBe(0);
  expect(() =>
    field.setObstacles({ polygons: new Float64Array([3, 0, 0, 0, 0, 0, 1]) }),
  ).toThrow();
  expect(field.isSolid(300, 120)).toBe(true);
});
