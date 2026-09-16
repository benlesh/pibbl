import { describe, expect, it } from "vitest";
import { compileParticleEffect2D, compileParticleEffect3D } from "../../particles/src/lib/compiler.js";
import { createCanvasBirthLedger } from "../../particles/src/lib/canvas/birth-ledger.js";
import { defineParticleEffect2D } from "../../particles/src/lib/definition.js";
import { defineParticleEffect3D } from "../../particles/src/lib/webgl-definition.js";
import { acquireParticleRecipes3D } from "../../particles/src/lib/webgl/recipe.js";

describe("particle structural performance", () => {
  it("commits fixed Canvas storage proportional to declared capacity", () => {
    const compiled = compileParticleEffect2D(
      defineParticleEffect2D({
        emitters: [{
          name: "marks",
          capacity: 10_000,
          emission: [{ type: "manual", count: 1 }],
          shape: { type: "point" },
          initial: { lifetimeMilliseconds: 1_000 },
          renderer: { type: "circle" },
        }],
      }),
    );
    const ledger = createCanvasBirthLedger(compiled);
    const emitter = ledger.committed.emitters[0]!;

    expect(emitter.birthTimes).toHaveLength(10_000);
    expect(emitter.deathTimes).toHaveLength(10_000);
    expect(emitter.origins).toHaveLength(20_000);
    expect(emitter.occupied).toHaveLength(10_000);
    expect(emitter.ageOrder).toHaveLength(10_000);
    ledger.dispose();
  });

  it("represents twenty thousand WebGL particles with one analytic instanced recipe", () => {
    const compiled = compileParticleEffect3D(
      defineParticleEffect3D({
        emitters: [{
          name: "embers",
          capacity: 20_000,
          emission: [{ type: "rate", particlesPerSecond: 300 }],
          shape: { type: "sphere", radius: 2, sample: "volume" },
          initial: { lifetimeMilliseconds: 2_000, size: 4 },
          renderer: {
            type: "point",
            material: "emissive",
            blend: "additive",
          },
        }],
      }),
    );
    const lease = acquireParticleRecipes3D(
      compiled,
      compiled.parameterLayout.defaults,
    );

    expect(lease.recipes).toHaveLength(1);
    expect(lease.recipes[0]!.recipe).toMatchObject({
      capacity: 20_000,
      topology: "points",
      verticesPerInstance: 1,
      staticVertexData: undefined,
    });
    expect(lease.recipes[0]!.recipe.vertexSource).toContain("gl_InstanceID");
    lease.release();
  });
});
