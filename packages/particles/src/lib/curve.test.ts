import { describe, expect, it } from "vitest";
import { particle } from "./particle.js";
import {
  compileEasingTable,
  compileParticleCurve,
  compileParticleGradient,
  sampleEasingTable,
  sampleParticleCurve,
  sampleParticleGradient,
} from "./curve.js";

describe("particle curve compilation", () => {
  it("calls an easing exactly 257 times during compilation and never during lookup", () => {
    let calls = 0;
    const table = compileEasingTable((progress) => {
      calls += 1;
      return progress * progress;
    });

    expect(table).toHaveLength(257);
    expect(Object.isFrozen(table)).toBe(true);
    expect(table[0]).toBe(0);
    expect(table[128]).toBe(0.25);
    expect(table[256]).toBe(1);
    expect(calls).toBe(257);
    expect(sampleEasingTable(table, 0.25)).toBe(0.0625);
    expect(sampleEasingTable(table, 0.501953125)).toBeCloseTo(
      0.25196075439453125,
      15,
    );
    expect(calls).toBe(257);
  });

  it("compiles scalar and vector curves into 257-point tables with linear runtime interpolation", () => {
    const scalar = compileParticleCurve(
      particle.curve(
        [
          [0, 0],
          [0.5, 10],
          [1, 20],
        ],
        { easing: (progress) => progress * progress },
      ),
    );
    const vector = compileParticleCurve(
      particle.curve([
        [0, [2, 4]],
        [1, [6, 12]],
      ]),
    );

    expect(scalar.pointCount).toBe(257);
    expect(scalar.dimension).toBe(1);
    expect(scalar.samples[64]).toBe(2.5);
    expect(sampleParticleCurve(scalar, 0.125, 0)).toBe(0.625);
    expect(sampleParticleCurve(scalar, -1, 0)).toBe(0);
    expect(sampleParticleCurve(scalar, 2, 0)).toBe(20);
    expect(vector.samples).toHaveLength(514);
    expect(sampleParticleCurve(vector, 0.25, 0)).toBe(3);
    expect(sampleParticleCurve(vector, 0.25, 1)).toBe(6);
  });

  it("compiles gradients in straight sRGB and uses nearest 257-point runtime lookup", () => {
    const gradient = compileParticleGradient(
      particle.gradient([
        [0, "#ff0000"],
        [1, "rgba(0, 0, 255, 0.5)"],
      ]),
    );
    const output = new Float64Array(4);

    expect(gradient.pointCount).toBe(257);
    expect(gradient.samples).toHaveLength(1_028);
    expect(gradient.cssSamples).toHaveLength(257);
    expect(gradient.cssSamples[128]).toBe("rgba(127.5 0 127.5 / 0.75)");
    sampleParticleGradient(gradient, 0.5, output, 0);
    expect([...output]).toEqual([0.5, 0, 0.5, 0.75]);
    sampleParticleGradient(gradient, 0.499, output, 0);
    expect([...output]).toEqual([0.5, 0, 0.5, 0.75]);
    sampleParticleGradient(gradient, 0, output, 0);
    expect([...output]).toEqual([1, 0, 0, 1]);
  });
});
