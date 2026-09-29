import { describe, expect, it } from "vitest";
import { defineParticleEffect2D } from "./definition.js";
import { particle } from "./particle.js";
import {
  ParameterTimingMask,
  compileParticleEffect2D,
  compileParameterReference,
} from "./compiler.js";

describe("particle compiler", () => {
  it("packs parameters into fixed offsets with separate spawn, simulation, and render masks", () => {
    const effect = defineParticleEffect2D({
      parameters: {
        launch: { type: "number", default: 4, timing: "spawn" },
        wind: { type: "vector2", default: [1, -2], timing: "simulation" },
        tint: { type: "color", default: "#33669980", timing: "render" },
      },
      emitters: [
        {
          name: "sparks",
          capacity: 20,
          emission: [{ type: "burst", atMilliseconds: 0, count: 1 }],
          shape: { type: "point" },
          initial: { lifetimeMilliseconds: 1_000 },
          renderer: { type: "circle" },
        },
      ],
    });
    const plan = compileParticleEffect2D(effect);

    expect(plan.parameterLayout.entries).toEqual([
      { name: "launch", type: "number", timing: "spawn", offset: 0, length: 1 },
      {
        name: "wind",
        type: "vector2",
        timing: "simulation",
        offset: 1,
        length: 2,
      },
      { name: "tint", type: "color", timing: "render", offset: 3, length: 4 },
    ]);
    expect([...plan.parameterLayout.defaults]).toEqual([
      4,
      1,
      -2,
      0.2,
      0.4,
      0.6,
      128 / 255,
    ]);
    expect([...plan.parameterLayout.spawnMask]).toEqual([1, 0, 0, 0, 0, 0, 0]);
    expect([...plan.parameterLayout.simulationMask]).toEqual([
      0, 1, 1, 0, 0, 0, 0,
    ]);
    expect([...plan.parameterLayout.renderMask]).toEqual([0, 0, 0, 1, 1, 1, 1]);
  });

  it("compiles whole-vector and initial-color references into dimension-aware offsets", () => {
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
    const emitter = compileParticleEffect2D(effect).emitters[0]!;

    expect(emitter.initial.velocity).toMatchObject({
      kind: "parameter",
      offset: 0,
      length: 2,
      timingMask: ParameterTimingMask.Spawn,
    });
    expect(emitter.motion[0]).toMatchObject({
      type: "acceleration",
      value: {
        kind: "parameter",
        offset: 2,
        length: 2,
        timingMask: ParameterTimingMask.Simulation,
      },
    });
    expect(emitter.initial.color).toMatchObject({
      kind: "parameter",
      offset: 4,
      length: 4,
      timingMask: ParameterTimingMask.Render,
    });
  });

  it("derives stable distinct channels from normalized property paths rather than descriptor identity", () => {
    const shared = particle.between(1, 2);
    const effect = defineParticleEffect2D({
      emitters: [
        {
          name: "sparks",
          capacity: 20,
          emission: [{ type: "burst", atMilliseconds: 0, count: 1 }],
          shape: { type: "point" },
          initial: {
            lifetimeMilliseconds: 1_000,
            velocity: [shared, shared],
            size: shared,
          },
          renderer: { type: "circle" },
        },
      ],
    });
    const first = compileParticleEffect2D(effect).emitters[0]!;
    const second = compileParticleEffect2D(effect).emitters[0]!;
    if (
      !Array.isArray(first.initial.velocity) ||
      !Array.isArray(first.initial.size) ||
      !Array.isArray(second.initial.velocity) ||
      !Array.isArray(second.initial.size)
    ) {
      throw new TypeError(
        "Expected literal vectors to compile component-wise.",
      );
    }

    expect(first.initial.velocity[0].channel).not.toBe(
      first.initial.velocity[1].channel,
    );
    expect(first.initial.velocity[0].channel).not.toBe(
      first.initial.size[0].channel,
    );
    expect(first.initial.velocity[0].channel).toBe(
      second.initial.velocity[0].channel,
    );
    expect(first.initial.velocity[1].channel).toBe(
      second.initial.velocity[1].channel,
    );
    expect(first.initial.size[0].channel).toBe(second.initial.size[0].channel);
  });

  it("rejects unknown and dimension-mismatched references before publishing a plan", () => {
    const effect = defineParticleEffect2D({
      parameters: {
        scalar: { type: "number", default: 1, timing: "spawn" },
        vector: { type: "vector2", default: [1, 2], timing: "simulation" },
      },
      emitters: [
        {
          name: "sparks",
          capacity: 1,
          emission: [{ type: "burst", atMilliseconds: 0, count: 1 }],
          shape: { type: "point" },
          initial: { lifetimeMilliseconds: 1 },
          renderer: { type: "circle" },
        },
      ],
    });
    const layout = compileParticleEffect2D(effect).parameterLayout;

    expect(() =>
      compileParameterReference(
        particle.parameter("missing"),
        layout,
        1,
        "initial.velocity[0]",
      ),
    ).toThrowError(/unknown parameter.*missing/i);
    expect(() =>
      compileParameterReference(
        particle.parameter("vector"),
        layout,
        1,
        "initial.velocity[0]",
      ),
    ).toThrowError(/vector.*dimension.*1/i);
    expect(
      compileParameterReference(
        particle.parameter("scalar"),
        layout,
        1,
        "initial.velocity[0]",
      ),
    ).toMatchObject({
      offset: 0,
      length: 1,
      timingMask: ParameterTimingMask.Spawn,
    });
  });

  it("retains completion metadata and explicit reasons for unavailable execution tiers", () => {
    const effect = defineParticleEffect2D({
      emitters: [
        {
          name: "manual",
          capacity: 3,
          emission: [{ type: "manual" }],
          shape: { type: "point" },
          initial: { lifetimeMilliseconds: particle.between(100, 400) },
          renderer: { type: "circle" },
        },
      ],
    });
    const plan = compileParticleEffect2D(effect);

    expect(plan.emitters[0]!.maximumLifetime).toEqual({
      kind: "fixed",
      milliseconds: 400,
    });
    expect(plan.emitters[0]!.emission.completion).toBe("manual-open");
    expect(plan.execution["stateless-canvas"]).toEqual({
      supported: true,
      reasons: [],
    });
    expect(plan.execution["stateless-webgl"].supported).toBe(false);
    expect(plan.execution["stateless-webgl"].reasons.length).toBeGreaterThan(0);
    expect(plan.execution["stateful-canvas"].supported).toBe(false);
    expect(plan.execution["stateful-canvas"].reasons).toEqual([
      "stateful Canvas execution is unavailable in Project 1",
    ]);
    expect(plan.execution["stateful-cpu-webgl"].supported).toBe(false);
    expect(plan.execution["stateful-cpu-webgl"].reasons.length).toBeGreaterThan(
      0,
    );
    expect(plan.execution["stateful-gpu-webgl"].supported).toBe(false);
    expect(plan.execution["stateful-gpu-webgl"].reasons.length).toBeGreaterThan(
      0,
    );
  });

  it("marks parameterized lifetime metadata as binding-dependent instead of using its default as a maximum", () => {
    const effect = defineParticleEffect2D({
      parameters: {
        lifetime: { type: "number", default: 1_000, timing: "spawn" },
      },
      emitters: [
        {
          name: "long-lived",
          capacity: 100,
          emission: [{ type: "rate", particlesPerSecond: 10 }],
          shape: { type: "point" },
          initial: {
            lifetimeMilliseconds: particle.parameter("lifetime"),
          },
          renderer: { type: "circle" },
          bounds: { min: [-1, -1], max: [1, 1] },
        },
      ],
    });
    const emitter = compileParticleEffect2D(effect).emitters[0]!;

    expect(emitter.maximumLifetime).toEqual({ kind: "parameter", offset: 0 });
    expect(emitter.emission.maximumLifetime).toEqual({
      kind: "parameter",
      offset: 0,
    });
    expect(emitter.emission.maximumPotentiallyLiveOrdinals).toBeNull();
    expect(emitter.emission.completionMilliseconds).toBeNull();
  });

  it("compiles a sway frequency tuple as one seeded range", () => {
    const effect = defineParticleEffect2D({
      emitters: [
        {
          name: "snow",
          capacity: 10,
          emission: [{ type: "rate", particlesPerSecond: 2 }],
          shape: { type: "point" },
          initial: { lifetimeMilliseconds: 1_000 },
          motion: [{ type: "sway", amplitude: 2, frequency: [0.1, 0.25] }],
          renderer: { type: "circle" },
        },
      ],
    });
    const motion = compileParticleEffect2D(effect).emitters[0]!.motion[0]!;

    expect(motion).toMatchObject({
      type: "sway",
      frequency: { kind: "between", min: 0.1, max: 0.25 },
    });
  });

});
