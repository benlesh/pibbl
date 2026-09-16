import { describe, expect, it } from "vitest";
import { particleCurve, particleGradient } from "../particle.js";
import { compileParticleEffect3D } from "../compiler.js";
import { defineParticleEffect3D } from "../webgl-definition.js";
import { particleSystemOwnershipSnapshot } from "../system/ownership.js";
import {
  acquireParticleRecipes3D,
  createParticleRecipes3D,
} from "./recipe.js";

describe("WebGL particle recipes", () => {
  it("creates one fixed-capacity point recipe with 257-sample appearance tables", () => {
    const compiled = compileParticleEffect3D(
      defineParticleEffect3D({
        emitters: [
          {
            name: "fireflies",
            capacity: 20_000,
            emission: [{ type: "rate", particlesPerSecond: 200 }],
            shape: { type: "sphere", radius: 4, sample: "volume" },
            initial: {
              lifetimeMilliseconds: 4_000,
              size: 5,
              color: "#dfff7a",
            },
            appearance: {
              opacity: particleCurve([
                [0, 0],
                [0.2, 1],
                [1, 0],
              ]),
              color: particleGradient([
                [0, "#fff6a8"],
                [1, "#8cff5a"],
              ]),
            },
            renderer: {
              type: "point",
              material: "emissive",
              blend: "additive",
            },
          },
        ],
      }),
    );

    const [created] = createParticleRecipes3D(
      compiled,
      compiled.parameterLayout.defaults,
    );

    expect(created!.recipe.capacity).toBe(20_000);
    expect(created!.recipe.topology).toBe("points");
    expect(created!.recipe.verticesPerInstance).toBe(1);
    expect(created!.recipe.lookupTables).toHaveLength(2);
    expect(created!.recipe.lookupTables.map((table) => table.width)).toEqual([
      257, 257,
    ]);
    expect(created!.recipe.lookupTables.map((table) => table.channels)).toEqual([
      4, 1,
    ]);
  });

  it("uses an immutable six-vertex quad for billboard recipes", () => {
    const source = document.createElement("canvas");
    const compiled = compileParticleEffect3D(
      defineParticleEffect3D({
        emitters: [
          {
            name: "smoke",
            capacity: 32,
            emission: [{ type: "rate", particlesPerSecond: 4 }],
            shape: { type: "point" },
            initial: { lifetimeMilliseconds: 1_000, size: 0.4 },
            renderer: {
              type: "billboard",
              source,
              material: "unlit",
              blend: "alpha",
            },
          },
        ],
      }),
    );

    const [created] = createParticleRecipes3D(
      compiled,
      compiled.parameterLayout.defaults,
    );

    expect(created!.recipe.topology).toBe("triangles");
    expect(created!.recipe.verticesPerInstance).toBe(6);
    expect(created!.recipe.staticVertexData).toHaveLength(12);
    expect(created!.recipe.sprite?.source).toBe(source);
  });

  it("leases stable recipes with exact idempotent ownership", () => {
    const compiled = compileParticleEffect3D(
      defineParticleEffect3D({
        emitters: [
          {
            name: "embers",
            capacity: 128,
            emission: [{ type: "rate", particlesPerSecond: 20 }],
            shape: { type: "point" },
            initial: { lifetimeMilliseconds: 1_000, size: 4 },
            renderer: {
              type: "point",
              material: "emissive",
              blend: "additive",
            },
          },
        ],
      }),
    );
    const baseline = particleSystemOwnershipSnapshot();
    const first = acquireParticleRecipes3D(
      compiled,
      compiled.parameterLayout.defaults,
    );
    const second = acquireParticleRecipes3D(
      compiled,
      compiled.parameterLayout.defaults,
    );

    expect(first.recipes[0]!.recipe).toBe(second.recipes[0]!.recipe);
    expect(particleSystemOwnershipSnapshot().webglRecipes).toBe(
      baseline.webglRecipes + 2,
    );

    first.release();
    first.release();
    second.release();
    expect(particleSystemOwnershipSnapshot().webglRecipes).toBe(
      baseline.webglRecipes,
    );
  });
});
