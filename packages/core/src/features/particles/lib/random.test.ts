import { describe, expect, it } from "vitest";
import {
  compileWeightedChoice,
  hashEmitterName,
  mix32,
  sampleHash,
  sampleInteger,
  sampleUnit,
  sampleWeightedChoice,
} from "./random.js";

describe("particle deterministic random values", () => {
  it("keeps UTF-16 FNV-1a emitter hashes stable", () => {
    expect(hashEmitterName("")).toBe(2_166_136_261);
    expect(hashEmitterName("snow")).toBe(2_223_183_858);
    expect(hashEmitterName("embers")).toBe(1_348_732_565);
    expect(hashEmitterName("雪")).toBe(1_847_958_269);
  });

  it("keeps seed, ordinal, and normalized-property channel samples stable", () => {
    const emitterHash = hashEmitterName("snow");

    expect(mix32(0x1234_5678)).toBe(4_125_564_054);
    expect(sampleHash(42, emitterHash, 7, 3)).toBe(507_546_560);
    expect(sampleUnit(42, emitterHash, 7, 3)).toBeCloseTo(
      0.11817239224910736,
      15,
    );
    expect(sampleUnit(42, emitterHash, 7, 4)).toBeCloseTo(
      0.6830484785605222,
      15,
    );
  });

  it("samples both inclusive integer endpoints without overflowing the upper bound", () => {
    expect(sampleInteger(0, -2, 2)).toBe(-2);
    expect(sampleInteger(0.2, -2, 2)).toBe(-1);
    expect(sampleInteger(1 - Number.EPSILON, -2, 2)).toBe(2);
  });

  it("selects weighted choices in source order at exact cumulative boundaries", () => {
    const choice = compileWeightedChoice([
      { value: 10, weight: 1 },
      { value: 20, weight: 3 },
      { value: 30, weight: 2 },
    ]);

    expect(Object.isFrozen(choice)).toBe(true);
    expect(Object.isFrozen(choice.values)).toBe(true);
    expect(Object.isFrozen(choice.cumulativeWeights)).toBe(true);
    expect(sampleWeightedChoice(choice, 0)).toBe(10);
    expect(sampleWeightedChoice(choice, 1 / 6)).toBe(20);
    expect(sampleWeightedChoice(choice, 4 / 6)).toBe(30);
    expect(sampleWeightedChoice(choice, 1 - Number.EPSILON)).toBe(30);
  });
});
