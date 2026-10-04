import { describe, expect, it } from "vitest";
import { compileParticleEffect2D } from "../src/features/particles/lib/compiler.js";
import { createCanvasBirthLedger } from "../src/features/particles/lib/canvas/birth-ledger.js";
import { defineParticleEffect2D } from "../src/features/particles/lib/definition.js";

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
});
