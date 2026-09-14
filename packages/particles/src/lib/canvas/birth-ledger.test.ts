import { describe, expect, it, vi } from "vitest";
import { compileParticleEffect2D } from "../compiler.js";
import { defineParticleEffect2D } from "../definition.js";
import { isPotentialBirthAccepted } from "../emission.js";
import type { CRCParticleEmission } from "../types.js";
import {
  CANVAS_LEDGER_NO_SLOT,
  createCanvasBirthLedger,
  type CanvasEmitterLedger,
} from "./birth-ledger.js";

function compiledEmitter(options: {
  readonly capacity?: number;
  readonly overflow?: "reject-newest" | "recycle-oldest";
  readonly emission?: readonly CRCParticleEmission[];
  readonly lifetimeMilliseconds?: number;
}) {
  const effect = defineParticleEffect2D({
    emitters: [
      {
        name: "marks",
        capacity: options.capacity ?? 4,
        overflow: options.overflow,
        emission: options.emission ?? [{ type: "manual", count: 1 }],
        shape: { type: "point" },
        initial: { lifetimeMilliseconds: options.lifetimeMilliseconds ?? 100 },
        renderer: { type: "circle" },
      },
    ],
  });
  const compiled = compileParticleEffect2D(effect);
  return { compiled, parameters: compiled.parameterLayout.defaults };
}

function frame(
  generation: number,
  previous: number,
  current: number,
  status: "running" | "draining" = "running",
) {
  return {
    generation,
    frameId: current + 1,
    logicalTime: current,
    effectTimeMilliseconds: current,
    previousEffectTimeMilliseconds: previous,
    seed: 17,
    status,
  } as const;
}

function orderedSlots(ledger: CanvasEmitterLedger): number[] {
  const result: number[] = [];
  let slot = ledger.oldestSlot;
  while (slot !== CANVAS_LEDGER_NO_SLOT) {
    result.push(slot);
    slot = ledger.ageOrder[slot]!;
  }
  return result;
}

function orderedRecords(ledger: CanvasEmitterLedger) {
  return orderedSlots(ledger).map((slot) => ({
    slot,
    birth: ledger.birthTimes[slot],
    death: ledger.deathTimes[slot],
    ordinal: ledger.ordinals[slot],
    source: ledger.sourceIds[slot],
    salt: ledger.seedSalts[slot],
    origin: [ledger.origins[slot * 2], ledger.origins[slot * 2 + 1]],
    epoch: ledger.spawnEpochs[slot],
  }));
}

describe("fixed-capacity Canvas birth ledger", () => {
  it("keeps fixed typed-array identities and never uses Array.splice across 10,000 births", () => {
    const { compiled, parameters } = compiledEmitter({
      capacity: 3,
      overflow: "recycle-oldest",
    });
    const ledger = createCanvasBirthLedger(compiled);
    const arrays = [
      ...ledger.committed.emitters.flatMap((emitter) => [
        emitter.birthTimes,
        emitter.deathTimes,
        emitter.ordinals,
        emitter.sourceIds,
        emitter.seedSalts,
        emitter.origins,
        emitter.spawnEpochs,
        emitter.occupied,
        emitter.freeSlots,
        emitter.ageOrder,
      ]),
      ...ledger.candidate.emitters.flatMap((emitter) => [
        emitter.birthTimes,
        emitter.deathTimes,
        emitter.ordinals,
        emitter.sourceIds,
        emitter.seedSalts,
        emitter.origins,
        emitter.spawnEpochs,
        emitter.occupied,
        emitter.freeSlots,
        emitter.ageOrder,
      ]),
    ];
    const splice = vi.spyOn(Array.prototype, "splice");

    ledger.adoptFrame(frame(1, 0, 0), 1, parameters);
    for (let index = 0; index < 10_000; index += 1) {
      ledger.emitManual({
        emitterIndex: 0,
        sourceIndex: 0,
        count: 1,
        birthTimeMilliseconds: index,
        seed: 17,
        seedSalt: 0,
        origin: [0, 0],
        spawnEpoch: 1,
        parameters,
      });
    }
    ledger.finishTransaction(true);

    expect(splice).not.toHaveBeenCalled();
    expect(ledger.committed.emitters[0]?.liveCount).toBe(3);
    expect(
      arrays.every(
        (array) =>
          ledger.committed.emitters.some((emitter) =>
            Object.values(emitter).includes(array),
          ) ||
          ledger.candidate.emitters.some((emitter) =>
            Object.values(emitter).includes(array),
          ),
      ),
    ).toBe(true);
    splice.mockRestore();
  });

  it("accepts equal-time rate and burst births in emission source order", () => {
    const { compiled, parameters } = compiledEmitter({
      capacity: 8,
      emission: [
        { type: "rate", particlesPerSecond: 10 },
        { type: "burst", atMilliseconds: 100, count: 2 },
        { type: "rate", particlesPerSecond: 10 },
      ],
      lifetimeMilliseconds: 1_000,
    });
    const ledger = createCanvasBirthLedger(compiled);

    const summary = ledger.adoptFrame(frame(1, 0, 100), 4, parameters);
    expect(summary).toMatchObject({
      accepted: 4,
      rejected: 0,
      liveCount: 4,
      nextAutomaticBirthMilliseconds: 200,
      latestDeathMilliseconds: 1_100,
    });
    ledger.finishTransaction(true);

    expect(orderedRecords(ledger.committed.emitters[0]!)).toEqual([
      expect.objectContaining({ birth: 100, ordinal: 0, source: 0, epoch: 4 }),
      expect.objectContaining({ birth: 100, ordinal: 1, source: 1, epoch: 4 }),
      expect.objectContaining({ birth: 100, ordinal: 2, source: 1, epoch: 4 }),
      expect.objectContaining({ birth: 100, ordinal: 3, source: 2, epoch: 4 }),
    ]);
  });

  it("consumes exactly one ordinal for each probability-rejected rate birth", () => {
    const { compiled, parameters } = compiledEmitter({
      capacity: 4,
      emission: [
        { type: "rate", particlesPerSecond: 10, probability: 0.2 },
        { type: "burst", atMilliseconds: 200, count: 1 },
      ],
      lifetimeMilliseconds: 1_000,
    });
    const rate = compiled.emitters[0]!.emission.rates[0]!;
    let seed = 0;
    while (
      [0, 1, 2].some((ordinal) =>
        isPotentialBirthAccepted(
          rate.probability,
          seed,
          compiled.emitters[0]!.emitterHash,
          ordinal,
          rate.probabilityChannel,
        ),
      )
    ) {
      seed += 1;
    }
    const ledger = createCanvasBirthLedger(compiled);

    ledger.adoptFrame({ ...frame(1, 0, 200), seed }, 4, parameters);
    ledger.finishTransaction(true);

    expect(orderedRecords(ledger.committed.emitters[0]!)).toEqual([
      expect.objectContaining({ birth: 200, ordinal: 2, source: 1 }),
    ]);
  });

  it("applies scheduled-burst probability independently to each potential ordinal", () => {
    const { compiled, parameters } = compiledEmitter({
      capacity: 4,
      emission: [
        {
          type: "burst",
          atMilliseconds: 100,
          count: 3,
          probability: 0.5,
        },
      ],
      lifetimeMilliseconds: 1_000,
    });
    const emitter = compiled.emitters[0]!;
    const burst = emitter.emission.bursts[0]!;
    let seed = 0;
    while (
      isPotentialBirthAccepted(
        burst.probability,
        seed,
        emitter.emitterHash,
        0,
        burst.probabilityChannel,
      ) ||
      !isPotentialBirthAccepted(
        burst.probability,
        seed,
        emitter.emitterHash,
        1,
        burst.probabilityChannel,
      )
    ) {
      seed += 1;
    }
    const ledger = createCanvasBirthLedger(compiled);

    ledger.adoptFrame({ ...frame(1, 0, 100), seed }, 4, parameters);
    ledger.finishTransaction(true);

    expect(
      orderedRecords(ledger.committed.emitters[0]!).map(
        (record) => record.ordinal,
      ),
    ).toEqual(
      [0, 1, 2].filter((ordinal) =>
        isPotentialBirthAccepted(
          burst.probability,
          seed,
          emitter.emitterHash,
          ordinal,
          burst.probabilityChannel,
        ),
      ),
    );
  });

  it("samples default manual sources in declaration order without renumbering their particles", () => {
    const { compiled, parameters } = compiledEmitter({
      capacity: 6,
      emission: [
        { type: "manual", count: 2 },
        { type: "manual", count: 1 },
      ],
      lifetimeMilliseconds: 1_000,
    });
    const ledger = createCanvasBirthLedger(compiled);
    ledger.adoptFrame(frame(1, 0, 0), 1, parameters);

    expect(
      ledger.emitManualSources({
        generation: 1,
        emitterIndex: 0,
        birthTimeMilliseconds: 0,
        seed: 17,
        seedSalt: 0,
        origin: [0, 0],
        spawnEpoch: 1,
        parameters,
      }),
    ).toEqual({ requested: 3, accepted: 3, rejected: 0 });
    ledger.finishTransaction(true);
    expect(orderedRecords(ledger.committed.emitters[0]!)).toEqual([
      expect.objectContaining({ ordinal: 0, source: 0 }),
      expect.objectContaining({ ordinal: 1, source: 0 }),
      expect.objectContaining({ ordinal: 2, source: 1 }),
    ]);
  });

  it("reports exact reject-newest counts after expiring reusable slots", () => {
    const { compiled, parameters } = compiledEmitter({ capacity: 2 });
    const ledger = createCanvasBirthLedger(compiled);
    ledger.adoptFrame(frame(1, 0, 0), 1, parameters);

    expect(
      ledger.emitManual({
        emitterIndex: 0,
        sourceIndex: 0,
        count: 3,
        birthTimeMilliseconds: 0,
        seed: 1,
        seedSalt: 0,
        origin: [2, 3],
        spawnEpoch: 1,
        parameters,
      }),
    ).toEqual({ requested: 3, accepted: 2, rejected: 1 });
    ledger.finishTransaction(true);

    ledger.adoptFrame(frame(1, 0, 100), 1, parameters);
    expect(ledger.candidate.emitters[0]?.liveCount).toBe(0);
    expect(
      ledger.emitManual({
        emitterIndex: 0,
        sourceIndex: 0,
        count: 1,
        birthTimeMilliseconds: 100,
        seed: 1,
        seedSalt: 9,
        origin: [4, 5],
        spawnEpoch: 1,
        parameters,
      }),
    ).toEqual({ requested: 1, accepted: 1, rejected: 0 });
    ledger.finishTransaction(true);
    expect(orderedRecords(ledger.committed.emitters[0]!)).toEqual([
      expect.objectContaining({
        birth: 100,
        death: 200,
        ordinal: 3,
        salt: 9,
        origin: [4, 5],
      }),
    ]);
  });

  it("recycles the oldest live ordinal deterministically, including capacity one and equal-time ties", () => {
    const { compiled, parameters } = compiledEmitter({
      capacity: 1,
      overflow: "recycle-oldest",
      lifetimeMilliseconds: 1_000,
    });
    const ledger = createCanvasBirthLedger(compiled);
    ledger.adoptFrame(frame(1, 0, 0), 1, parameters);
    ledger.emitManual({
      emitterIndex: 0,
      sourceIndex: 2,
      count: 3,
      birthTimeMilliseconds: 0,
      seed: 1,
      seedSalt: 0,
      origin: [0, 0],
      spawnEpoch: 1,
      parameters,
    });
    ledger.finishTransaction(true);

    expect(orderedRecords(ledger.committed.emitters[0]!)).toEqual([
      expect.objectContaining({ birth: 0, ordinal: 2, source: 2 }),
    ]);
  });

  it("includes time-zero births once, resets ordinals on restart, and closes automatic emission while draining", () => {
    const { compiled, parameters } = compiledEmitter({
      capacity: 4,
      emission: [
        { type: "burst", atMilliseconds: 0, count: 1 },
        { type: "rate", particlesPerSecond: 10 },
      ],
      lifetimeMilliseconds: 150,
    });
    const ledger = createCanvasBirthLedger(compiled);

    expect(ledger.adoptFrame(frame(1, 0, 0), 1, parameters).accepted).toBe(1);
    ledger.finishTransaction(true);
    expect(ledger.adoptFrame(frame(1, 0, 0), 1, parameters).accepted).toBe(0);
    ledger.finishTransaction(true);

    expect(ledger.adoptFrame(frame(2, 0, 0), 2, parameters).accepted).toBe(1);
    ledger.finishTransaction(true);
    expect(orderedRecords(ledger.committed.emitters[0]!)).toEqual([
      expect.objectContaining({ ordinal: 0, epoch: 2 }),
    ]);

    const draining = ledger.adoptFrame(
      frame(2, 0, 100, "draining"),
      2,
      parameters,
    );
    expect(draining.accepted).toBe(0);
    expect(draining.nextAutomaticBirthMilliseconds).toBeNull();
    ledger.finishTransaction(true);
    const empty = ledger.adoptFrame(
      frame(2, 100, 150, "draining"),
      2,
      parameters,
    );
    expect(empty.liveCount).toBe(0);
  });

  it("fast-forwards dead rate ordinals across hidden gaps and enumerates only the potentially-live window", () => {
    const { compiled, parameters } = compiledEmitter({
      capacity: 4,
      emission: [{ type: "rate", particlesPerSecond: 1_000 }],
      lifetimeMilliseconds: 2,
    });
    const ledger = createCanvasBirthLedger(compiled);

    const summary = ledger.adoptFrame(frame(1, 0, 100_000), 1, parameters);
    ledger.finishTransaction(true);

    expect(summary.enumeratedPotentialBirths).toBeLessThanOrEqual(3);
    expect(orderedRecords(ledger.committed.emitters[0]!)).toEqual([
      expect.objectContaining({ birth: 99_999, ordinal: 99_998 }),
      expect.objectContaining({ birth: 100_000, ordinal: 99_999 }),
    ]);
  });

  it("does not invent ordinals for disabled automatic sources while fast-forwarding", () => {
    const { compiled, parameters } = compiledEmitter({
      capacity: 2,
      emission: [
        {
          type: "rate",
          particlesPerSecond: 1_000,
          probability: 0,
        },
        { type: "burst", atMilliseconds: 100, count: 2, probability: 0 },
        { type: "burst", atMilliseconds: 100_000, count: 1 },
      ],
      lifetimeMilliseconds: 2,
    });
    const ledger = createCanvasBirthLedger(compiled);

    ledger.adoptFrame(frame(1, 0, 100_000), 1, parameters);
    ledger.finishTransaction(true);

    expect(orderedRecords(ledger.committed.emitters[0]!)).toEqual([
      expect.objectContaining({ birth: 100_000, ordinal: 0, source: 2 }),
    ]);
  });

  it("keeps the committed generation and epoch ownership unchanged when presentation fails", () => {
    const { compiled, parameters } = compiledEmitter({
      capacity: 1,
      overflow: "recycle-oldest",
      lifetimeMilliseconds: 1_000,
    });
    const retained: number[] = [];
    const released: number[] = [];
    const ledger = createCanvasBirthLedger(compiled, {
      retainSpawnEpoch: (epoch) => retained.push(epoch),
      releaseSpawnEpoch: (epoch) => released.push(epoch),
    });
    ledger.adoptFrame(frame(1, 0, 0), 1, parameters);
    ledger.emitManual({
      emitterIndex: 0,
      sourceIndex: 0,
      count: 1,
      birthTimeMilliseconds: 0,
      seed: 1,
      seedSalt: 0,
      origin: [0, 0],
      spawnEpoch: 1,
      parameters,
    });
    ledger.finishTransaction(true);
    expect(retained).toEqual([1]);

    ledger.emitManual({
      emitterIndex: 0,
      sourceIndex: 0,
      count: 1,
      birthTimeMilliseconds: 10,
      seed: 1,
      seedSalt: 0,
      origin: [0, 0],
      spawnEpoch: 2,
      parameters,
    });
    expect(orderedRecords(ledger.candidate.emitters[0]!)[0]).toMatchObject({
      ordinal: 1,
      epoch: 2,
    });
    ledger.finishTransaction(false);

    expect(orderedRecords(ledger.committed.emitters[0]!)[0]).toMatchObject({
      ordinal: 0,
      epoch: 1,
    });
    expect(orderedRecords(ledger.candidate.emitters[0]!)[0]).toMatchObject({
      ordinal: 0,
      epoch: 1,
    });
    expect(retained).toEqual([1]);
    expect(released).toEqual([]);
  });
});
