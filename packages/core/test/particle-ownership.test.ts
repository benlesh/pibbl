import { describe, expect, it } from "vitest";
import {
  particleSystemOwnershipSnapshot,
  recordCanvasParticleLedgerCreated,
  recordCanvasParticleRasterEntryCreated,
  recordParticleSchedulerRegistration,
} from "../src/features/particles/lib/system/ownership.js";

describe("particle resource ownership", () => {
  it("accounts for every renderer resource with idempotent release", () => {
    const baseline = particleSystemOwnershipSnapshot();
    const releases = [
      recordParticleSchedulerRegistration(),
      recordCanvasParticleLedgerCreated(),
      recordCanvasParticleRasterEntryCreated(),
    ];

    expect(particleSystemOwnershipSnapshot()).toMatchObject({
      schedulerRegistrations: baseline.schedulerRegistrations + 1,
      canvasLedgers: baseline.canvasLedgers + 1,
      canvasRasterEntries: baseline.canvasRasterEntries + 1,
    });

    for (const release of releases) {
      release();
      release();
    }
    expect(particleSystemOwnershipSnapshot()).toMatchObject({
      schedulerRegistrations: baseline.schedulerRegistrations,
      canvasLedgers: baseline.canvasLedgers,
      canvasRasterEntries: baseline.canvasRasterEntries,
    });
  });
});
