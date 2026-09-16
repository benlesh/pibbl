import { describe, expect, it } from "vitest";
import { compileParticleEffect3D } from "../compiler.js";
import { defineParticleEffect3D } from "../webgl-definition.js";
import { buildParticleShader } from "./shader.js";

describe("WebGL particle shader compiler", () => {
  it("emits a closed analytic instanced shader with deterministic birth and death clipping", () => {
    const compiled = compileParticleEffect3D(
      defineParticleEffect3D({
        emitters: [
          {
            name: "embers",
            capacity: 512,
            emission: [{ type: "rate", particlesPerSecond: 80 }],
            shape: { type: "box", size: [2, 0.2, 1], sample: "volume" },
            initial: {
              lifetimeMilliseconds: 2_000,
              velocity: [0, 1.5, 0],
              size: 7,
              color: "#ff8a33",
            },
            motion: [
              { type: "acceleration", value: [0, 0.2, 0] },
              { type: "drag", amount: 0.15 },
            ],
            renderer: {
              type: "point",
              material: "emissive",
              blend: "additive",
            },
          },
        ],
      }),
    );

    const shader = buildParticleShader({
      emitter: compiled.emitters[0]!,
      parameterLayout: compiled.parameterLayout,
      fixedParameters: compiled.parameterLayout.defaults,
      lookupTableIndices: {},
    });

    expect(shader.vertexSource).toContain("gl_InstanceID");
    expect(shader.vertexSource).toContain("particle_sample_hash");
    expect(shader.vertexSource).toContain("particle_birth");
    expect(shader.vertexSource).toContain("particle_alive");
    expect(shader.vertexSource).toContain("u_projection_view");
    expect(shader.vertexSource).toContain("u_effective_opacity");
    expect(shader.vertexSource).toContain("gl_PointSize");
    expect(shader.vertexSource).not.toContain("eval(");
    expect(shader.fragmentSource).toContain("out_color");
  });
});
