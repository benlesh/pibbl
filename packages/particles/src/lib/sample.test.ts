import { describe, expect, it } from "vitest";
import {
  compileParticleEffect2D,
  compileParticleEffect3D,
} from "./compiler.js";
import { defineParticleEffect2D } from "./definition.js";
import { particle } from "./particle.js";
import {
  Particle2DRegister,
  Particle3DRegister,
  particleSamplerPerformanceSnapshot,
  sampleCircleRadius,
  sampleParticle2D,
  sampleParticle3D,
  sampleShape2D,
  sampleShape3D,
  sampleSphereRadius,
} from "./sample.js";
import { defineParticleEffect3D } from "./webgl-definition.js";

describe("particle analytic sampling", () => {
  it("uses uniform measure for circle, sphere, rectangle-edge, and box-surface shapes", () => {
    expect(sampleCircleRadius(0.25, 10)).toBe(5);
    expect(sampleSphereRadius(0.125, 8)).toBe(4);

    const output2D = new Float64Array(2);
    sampleShape2D(
      { type: "circle", radius: 10, sample: "interior" },
      0.25,
      0,
      0,
      output2D,
      0,
    );
    expect([...output2D]).toEqual([5, 0]);
    sampleShape2D(
      { type: "rectangle", width: 4, height: 2, sample: "edge" },
      7 / 12,
      0,
      0,
      output2D,
      0,
    );
    expect([...output2D]).toEqual([1, 1]);

    const output3D = new Float64Array(3);
    sampleShape3D(
      { type: "sphere", radius: 8, sample: "volume" },
      0.125,
      0.5,
      0.5,
      output3D,
      0,
    );
    expect(output3D[0]).toBeCloseTo(-4, 15);
    expect(output3D[1]).toBeCloseTo(0, 15);
    expect(output3D[2]).toBeCloseTo(0, 15);
    sampleShape3D(
      { type: "box", size: [2, 4, 6], sample: "surface" },
      0,
      0.25,
      0.75,
      output3D,
      0,
    );
    expect([...output3D]).toEqual([-1, -2, -1.5]);

    sampleShape3D(
      {
        type: "cone",
        direction: [0, 0, 1],
        spreadDegrees: 60,
        length: 2,
        sample: "volume",
      },
      1,
      1,
      0,
      output3D,
      0,
    );
    expect(Math.hypot(...output3D)).toBeCloseTo(2, 15);
    expect(output3D[2]).toBeCloseTo(1, 15);
  });

  it("evaluates acceleration and angular velocity at logical particle age", () => {
    const effect = defineParticleEffect2D({
      emitters: [
        {
          name: "analytic",
          capacity: 1,
          emission: [{ type: "burst", atMilliseconds: 0, count: 1 }],
          shape: { type: "point", position: [1, 2] },
          initial: {
            lifetimeMilliseconds: 1_000,
            velocity: [2, 3],
            size: [4, 6],
            rotationDegrees: 10,
            angularVelocityDegreesPerSecond: 20,
            color: "#ff8000",
            opacity: 0.5,
          },
          motion: [{ type: "acceleration", value: [4, -2] }],
          appearance: {
            opacity: particle.curve([
              [0, 1],
              [1, 0],
            ]),
          },
          renderer: { type: "circle" },
        },
      ],
    });
    const emitter = compileParticleEffect2D(effect).emitters[0]!;
    const output = new Float64Array(Particle2DRegister.AtlasFrame + 1);

    expect(
      sampleParticle2D(
        emitter,
        { seed: 42, ordinal: 0, birthTimeMilliseconds: 0 },
        500,
        new Float64Array(0),
        output,
      ),
    ).toBe(true);
    expect(output[Particle2DRegister.X]).toBe(2.5);
    expect(output[Particle2DRegister.Y]).toBe(3.25);
    expect(output[Particle2DRegister.VelocityX]).toBe(4);
    expect(output[Particle2DRegister.VelocityY]).toBe(2);
    expect(output[Particle2DRegister.SizeX]).toBe(4);
    expect(output[Particle2DRegister.SizeY]).toBe(6);
    expect(output[Particle2DRegister.Rotation]).toBe(20);
    expect(output[Particle2DRegister.Red]).toBe(1);
    expect(output[Particle2DRegister.Green]).toBe(128 / 255);
    expect(output[Particle2DRegister.Blue]).toBe(0);
    expect(output[Particle2DRegister.Alpha]).toBe(0.5);
    expect(output[Particle2DRegister.AtlasFrame]).toBe(0);
    expect(
      sampleParticle2D(
        emitter,
        { seed: 42, ordinal: 0, birthTimeMilliseconds: 0 },
        1_000,
        new Float64Array(0),
        output,
      ),
    ).toBe(false);
    expect(output[Particle2DRegister.Live]).toBe(0);
  });

  it("samples whole-vector and initial-color parameter registers in 2D", () => {
    const effect = defineParticleEffect2D({
      parameters: {
        launch: { type: "vector2", default: [2, 3], timing: "spawn" },
        wind: { type: "vector2", default: [4, 5], timing: "simulation" },
        tint: { type: "color", default: "#33669980", timing: "render" },
      },
      emitters: [
        {
          name: "parameterized",
          capacity: 1,
          emission: [{ type: "burst", atMilliseconds: 0, count: 1 }],
          shape: { type: "point" },
          initial: {
            lifetimeMilliseconds: 1_000,
            velocity: particle.parameter("launch"),
            color: particle.parameter("tint"),
          },
          motion: [
            {
              type: "acceleration",
              value: particle.parameter("wind"),
            },
          ],
          renderer: { type: "circle" },
          bounds: { min: [-20, -20], max: [20, 20] },
        },
      ],
    });
    const plan = compileParticleEffect2D(effect);
    const output = new Float64Array(Particle2DRegister.AtlasFrame + 1);

    sampleParticle2D(
      plan.emitters[0]!,
      { seed: 1, ordinal: 0, birthTimeMilliseconds: 0 },
      500,
      plan.parameterLayout.defaults,
      output,
    );
    expect(output[Particle2DRegister.X]).toBe(1.5);
    expect(output[Particle2DRegister.Y]).toBe(2.125);
    expect(output[Particle2DRegister.VelocityX]).toBe(4);
    expect(output[Particle2DRegister.VelocityY]).toBe(5.5);
    expect(output[Particle2DRegister.Red]).toBe(0.2);
    expect(output[Particle2DRegister.Green]).toBe(0.4);
    expect(output[Particle2DRegister.Blue]).toBe(0.6);
    expect(output[Particle2DRegister.Alpha]).toBe(128 / 255);
  });

  it("uses the closed-form drag displacement and zero-drag limit", () => {
    const dragEffect = defineParticleEffect2D({
      emitters: [
        {
          name: "drag",
          capacity: 1,
          emission: [{ type: "burst", atMilliseconds: 0, count: 1 }],
          shape: { type: "point" },
          initial: { lifetimeMilliseconds: 1_000, velocity: [10, 0] },
          motion: [{ type: "drag", amount: 2 }],
          renderer: { type: "circle" },
        },
      ],
    });
    const zeroEffect = defineParticleEffect2D({
      emitters: [
        {
          name: "zero",
          capacity: 1,
          emission: [{ type: "burst", atMilliseconds: 0, count: 1 }],
          shape: { type: "point" },
          initial: { lifetimeMilliseconds: 1_000, velocity: [10, 0] },
          motion: [{ type: "drag", amount: 0 }],
          renderer: { type: "circle" },
        },
      ],
    });
    const output = new Float64Array(Particle2DRegister.AtlasFrame + 1);

    sampleParticle2D(
      compileParticleEffect2D(dragEffect).emitters[0]!,
      { seed: 1, ordinal: 0, birthTimeMilliseconds: 0 },
      500,
      new Float64Array(0),
      output,
    );
    expect(output[Particle2DRegister.X]).toBeCloseTo(3.1606027941427883, 14);
    expect(output[Particle2DRegister.VelocityX]).toBeCloseTo(
      3.6787944117144233,
      14,
    );

    sampleParticle2D(
      compileParticleEffect2D(zeroEffect).emitters[0]!,
      { seed: 1, ordinal: 0, birthTimeMilliseconds: 0 },
      500,
      new Float64Array(0),
      output,
    );
    expect(output[Particle2DRegister.X]).toBe(5);
    expect(output[Particle2DRegister.VelocityX]).toBe(10);
  });

  it("samples one seeded sway frequency range as horizontal 2D displacement", () => {
    const effect = defineParticleEffect2D({
      emitters: [
        {
          name: "sway",
          capacity: 1,
          emission: [{ type: "burst", atMilliseconds: 0, count: 1 }],
          shape: { type: "point" },
          initial: { lifetimeMilliseconds: 2_000 },
          motion: [{ type: "sway", amplitude: 2, frequency: [0.25, 0.25] }],
          renderer: { type: "circle" },
        },
      ],
    });
    const output = new Float64Array(Particle2DRegister.AtlasFrame + 1);

    sampleParticle2D(
      compileParticleEffect2D(effect).emitters[0]!,
      { seed: 42, ordinal: 0, birthTimeMilliseconds: 0 },
      0,
      new Float64Array(0),
      output,
    );
    expect(output[Particle2DRegister.X]).toBe(0);
    expect(output[Particle2DRegister.Y]).toBe(0);
    expect(output[Particle2DRegister.VelocityX]).toBe(Math.PI);
    expect(output[Particle2DRegister.VelocityY]).toBe(0);

    sampleParticle2D(
      compileParticleEffect2D(effect).emitters[0]!,
      { seed: 42, ordinal: 0, birthTimeMilliseconds: 0 },
      1_000,
      new Float64Array(0),
      output,
    );
    expect(output[Particle2DRegister.X]).toBe(2);
    expect(output[Particle2DRegister.Y]).toBe(0);
  });

  it("returns the instantaneous tangential velocity of a 2D orbit", () => {
    const effect = defineParticleEffect2D({
      emitters: [
        {
          name: "orbit",
          capacity: 1,
          emission: [{ type: "burst", atMilliseconds: 0, count: 1 }],
          shape: { type: "point", position: [1, 0] },
          initial: { lifetimeMilliseconds: 2_000 },
          motion: [
            {
              type: "orbit",
              center: [0, 0],
              degreesPerSecond: 90,
            },
          ],
          renderer: { type: "circle" },
        },
      ],
    });
    const output = new Float64Array(Particle2DRegister.AtlasFrame + 1);

    sampleParticle2D(
      compileParticleEffect2D(effect).emitters[0]!,
      { seed: 1, ordinal: 0, birthTimeMilliseconds: 0 },
      1_000,
      new Float64Array(0),
      output,
    );
    expect(output[Particle2DRegister.X]).toBeCloseTo(0, 15);
    expect(output[Particle2DRegister.Y]).toBeCloseTo(1, 15);
    expect(output[Particle2DRegister.VelocityX]).toBeCloseTo(-Math.PI / 2, 15);
    expect(output[Particle2DRegister.VelocityY]).toBeCloseTo(0, 15);
  });

  it("rotates 3D positions around the declared normalized orbit axis", () => {
    const effect = defineParticleEffect3D({
      emitters: [
        {
          name: "orbit",
          capacity: 1,
          emission: [{ type: "burst", atMilliseconds: 0, count: 1 }],
          shape: { type: "point", position: [1, 0, 0] },
          initial: { lifetimeMilliseconds: 2_000 },
          motion: [
            {
              type: "orbit",
              center: [0, 0, 0],
              axis: [0, 0, 1],
              degreesPerSecond: 90,
            },
          ],
          renderer: { type: "point", material: "unlit", blend: "alpha" },
        },
      ],
    });
    const output = new Float64Array(Particle3DRegister.AtlasFrame + 1);

    expect(
      sampleParticle3D(
        compileParticleEffect3D(effect).emitters[0]!,
        { seed: 1, ordinal: 0, birthTimeMilliseconds: 0 },
        1_000,
        new Float64Array(0),
        output,
      ),
    ).toBe(true);
    expect(output[Particle3DRegister.X]).toBeCloseTo(0, 15);
    expect(output[Particle3DRegister.Y]).toBeCloseTo(1, 15);
    expect(output[Particle3DRegister.Z]).toBeCloseTo(0, 15);
    expect(output[Particle3DRegister.VelocityX]).toBeCloseTo(-Math.PI / 2, 15);
    expect(output[Particle3DRegister.VelocityY]).toBeCloseTo(0, 15);
    expect(output[Particle3DRegister.VelocityZ]).toBeCloseTo(0, 15);
  });

  it("returns the instantaneous velocity of 3D sway", () => {
    const effect = defineParticleEffect3D({
      emitters: [
        {
          name: "sway",
          capacity: 1,
          emission: [{ type: "burst", atMilliseconds: 0, count: 1 }],
          shape: { type: "point" },
          initial: { lifetimeMilliseconds: 1_000 },
          motion: [
            {
              type: "sway",
              direction: [0, 2, 0],
              amplitude: 3,
              frequency: 0.5,
            },
          ],
          renderer: { type: "point", material: "unlit", blend: "alpha" },
        },
      ],
    });
    const output = new Float64Array(Particle3DRegister.AtlasFrame + 1);

    sampleParticle3D(
      compileParticleEffect3D(effect).emitters[0]!,
      { seed: 1, ordinal: 0, birthTimeMilliseconds: 0 },
      0,
      new Float64Array(0),
      output,
    );
    expect(output[Particle3DRegister.X]).toBe(0);
    expect(output[Particle3DRegister.Y]).toBe(0);
    expect(output[Particle3DRegister.Z]).toBe(0);
    expect(output[Particle3DRegister.VelocityX]).toBe(0);
    expect(output[Particle3DRegister.VelocityY]).toBe(6 * Math.PI);
    expect(output[Particle3DRegister.VelocityZ]).toBe(0);
  });

  it("samples whole-vector and color parameters and retains every 3D angular axis", () => {
    const effect = defineParticleEffect3D({
      parameters: {
        launch: { type: "vector3", default: [1, 2, 3], timing: "spawn" },
        spin: {
          type: "vector3",
          default: [10, 20, 30],
          timing: "simulation",
        },
        tint: { type: "color", default: "#33669980", timing: "render" },
      },
      emitters: [
        {
          name: "parameterized",
          capacity: 1,
          emission: [{ type: "burst", atMilliseconds: 0, count: 1 }],
          shape: { type: "point" },
          initial: {
            lifetimeMilliseconds: 1_000,
            velocity: particle.parameter("launch"),
            rotationDegrees: 5,
            angularVelocityDegreesPerSecond: 7,
            color: particle.parameter("tint"),
          },
          motion: [
            {
              type: "angularVelocity",
              degreesPerSecond: particle.parameter("spin"),
            },
          ],
          renderer: { type: "point", material: "unlit", blend: "alpha" },
          bounds: { min: [-10, -10, -10], max: [10, 10, 10] },
        },
      ],
    });
    const plan = compileParticleEffect3D(effect);
    const output = new Float64Array(Particle3DRegister.AtlasFrame + 1);

    sampleParticle3D(
      plan.emitters[0]!,
      { seed: 1, ordinal: 0, birthTimeMilliseconds: 0 },
      500,
      plan.parameterLayout.defaults,
      output,
    );
    expect(output[Particle3DRegister.X]).toBe(0.5);
    expect(output[Particle3DRegister.Y]).toBe(1);
    expect(output[Particle3DRegister.Z]).toBe(1.5);
    expect(output[Particle3DRegister.VelocityX]).toBe(1);
    expect(output[Particle3DRegister.VelocityY]).toBe(2);
    expect(output[Particle3DRegister.VelocityZ]).toBe(3);
    expect(output[Particle3DRegister.RotationX]).toBe(5);
    expect(output[Particle3DRegister.RotationY]).toBe(10);
    expect(output[Particle3DRegister.RotationZ]).toBe(23.5);
    expect(output[Particle3DRegister.Red]).toBe(0.2);
    expect(output[Particle3DRegister.Green]).toBe(0.4);
    expect(output[Particle3DRegister.Blue]).toBe(0.6);
    expect(output[Particle3DRegister.Alpha]).toBe(128 / 255);
  });

  it("uses independent cone polar and azimuth streams", () => {
    const effect = defineParticleEffect3D({
      emitters: [
        {
          name: "cone",
          capacity: 1,
          emission: [{ type: "burst", atMilliseconds: 0, count: 1 }],
          shape: { type: "point" },
          initial: {
            lifetimeMilliseconds: 1_000,
            velocity: {
              type: "cone",
              direction: [0, 0, 1],
              speed: particle.between(1, 2),
              spreadDegrees: particle.between(20, 40),
            },
          },
          renderer: { type: "point", material: "unlit", blend: "alpha" },
        },
      ],
    });
    const output = new Float64Array(Particle3DRegister.AtlasFrame + 1);

    sampleParticle3D(
      compileParticleEffect3D(effect).emitters[0]!,
      { seed: 17, ordinal: 3, birthTimeMilliseconds: 0 },
      0,
      new Float64Array(0),
      output,
    );
    expect(output[Particle3DRegister.VelocityX]).toBeCloseTo(
      -0.20899031429834883,
      15,
    );
    expect(output[Particle3DRegister.VelocityY]).toBeCloseTo(
      -0.07522677808035927,
      15,
    );
    expect(output[Particle3DRegister.VelocityZ]).toBeCloseTo(
      1.2437579160192094,
      15,
    );
  });

  it("samples 100,000 particles without sample-time arrays or objects and repeats after restart", () => {
    const effect = defineParticleEffect2D({
      emitters: [
        {
          name: "repeatable",
          capacity: 100_000,
          emission: [{ type: "rate", particlesPerSecond: 100_000 }],
          shape: { type: "circle", radius: 10, sample: "interior" },
          initial: {
            lifetimeMilliseconds: particle.between(1_000, 2_000),
            velocity: [particle.between(-2, 2), particle.between(-2, 2)],
            size: particle.between(1, 3),
          },
          renderer: { type: "circle" },
          bounds: { min: [-20, -20], max: [20, 20] },
        },
      ],
    });
    const emitter = compileParticleEffect2D(effect).emitters[0]!;
    const output = new Float64Array(Particle2DRegister.AtlasFrame + 1);
    const parameters = new Float64Array(0);
    const birth = { seed: 42, ordinal: 0, birthTimeMilliseconds: 0 };
    const before = particleSamplerPerformanceSnapshot();
    let firstChecksum = 0;
    let restartChecksum = 0;

    for (let ordinal = 0; ordinal < 100_000; ordinal += 1) {
      birth.ordinal = ordinal;
      sampleParticle2D(emitter, birth, 500, parameters, output);
      firstChecksum +=
        output[Particle2DRegister.X]! * 3 +
        output[Particle2DRegister.Y]! * 5 +
        output[Particle2DRegister.SizeX]!;
    }
    for (let ordinal = 0; ordinal < 100_000; ordinal += 1) {
      birth.ordinal = ordinal;
      sampleParticle2D(emitter, birth, 500, parameters, output);
      restartChecksum +=
        output[Particle2DRegister.X]! * 3 +
        output[Particle2DRegister.Y]! * 5 +
        output[Particle2DRegister.SizeX]!;
    }
    const after = particleSamplerPerformanceSnapshot();

    expect(restartChecksum).toBe(firstChecksum);
    expect(after.samples - before.samples).toBe(200_000);
    expect(after.sampleArrayAllocations - before.sampleArrayAllocations).toBe(
      0,
    );
    expect(after.sampleObjectAllocations - before.sampleObjectAllocations).toBe(
      0,
    );
    expect(Particle3DRegister.AtlasFrame).toBeGreaterThan(Particle3DRegister.Z);
  });
});
