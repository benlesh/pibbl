import { describe, expect, it } from "vitest";
import { particle } from "./particle.js";
import {
  compileEmissionSchedule,
  countRateBirthsThrough,
  isPotentialBirthAccepted,
  rateBirthTimeAt,
} from "./emission.js";
import { hashEmitterName } from "./random.js";

describe("particle emission compilation", () => {
  it("represents fractional rates as exact intervals without frame accumulation", () => {
    const schedule = compileEmissionSchedule(
      [
        {
          type: "rate",
          particlesPerSecond: 2.5,
          startMilliseconds: 100,
          durationMilliseconds: 1_600,
        },
      ],
      1_000,
    );
    const rate = schedule.rates[0]!;

    expect(rate.intervalMilliseconds).toBe(400);
    expect(rateBirthTimeAt(rate, 0, 0)).toBe(500);
    expect(rateBirthTimeAt(rate, 3, 0)).toBe(1_700);
    expect(countRateBirthsThrough(rate, 499)).toBe(0);
    expect(countRateBirthsThrough(rate, 500)).toBe(1);
    expect(countRateBirthsThrough(rate, 1_700)).toBe(4);
    expect(countRateBirthsThrough(rate, 10_000)).toBe(4);
  });

  it("treats repeat count as total cycles and keeps equal-time bursts declaration-stable", () => {
    const schedule = compileEmissionSchedule(
      [
        {
          type: "burst",
          atMilliseconds: 100,
          count: 2,
          repeat: { everyMilliseconds: 100, count: 3 },
        },
        { type: "burst", atMilliseconds: 200, count: particle.integer(1, 3) },
      ],
      500,
    );

    expect(
      schedule.bursts.map((burst) => [
        burst.atMilliseconds,
        burst.sourceIndex,
        burst.cycleIndex,
        burst.minimumCount,
        burst.maximumCount,
      ]),
    ).toEqual([
      [100, 0, 0, 2, 2],
      [200, 0, 1, 2, 2],
      [200, 1, 0, 1, 3],
      [300, 0, 2, 2, 2],
    ]);
  });

  it("applies probability to a potential ordinal without renumbering later ordinals", () => {
    const emitterHash = hashEmitterName("snow");

    expect(isPotentialBirthAccepted(0.2, 7, emitterHash, 0, 99)).toBe(true);
    expect(isPotentialBirthAccepted(0.2, 7, emitterHash, 1, 99)).toBe(false);
    expect(isPotentialBirthAccepted(0.2, 7, emitterHash, 4, 99)).toBe(true);
    expect(isPotentialBirthAccepted(0.2, 7, emitterHash, 5, 99)).toBe(true);
  });

  it("resets finite rate intervals at exact repeat-cycle boundaries", () => {
    const rate = compileEmissionSchedule(
      [
        {
          type: "rate",
          particlesPerSecond: 10,
          durationMilliseconds: 200,
          repeat: { everyMilliseconds: 500, count: 2 },
        },
      ],
      1_000,
    ).rates[0]!;

    expect(rateBirthTimeAt(rate, 1, 0)).toBe(200);
    expect(rateBirthTimeAt(rate, 0, 1)).toBe(600);
    expect(countRateBirthsThrough(rate, 599)).toBe(2);
    expect(countRateBirthsThrough(rate, 600)).toBe(3);
    expect(countRateBirthsThrough(rate, 700)).toBe(4);
  });

  it("classifies finite, automatic-infinite, and manual-open schedules with live-window metadata", () => {
    const finite = compileEmissionSchedule(
      [
        { type: "burst", atMilliseconds: 100, count: 3 },
        {
          type: "rate",
          particlesPerSecond: 2,
          startMilliseconds: 0,
          durationMilliseconds: 1_000,
        },
      ],
      750,
    );
    const infinite = compileEmissionSchedule(
      [{ type: "rate", particlesPerSecond: 4 }],
      1_000,
    );
    const manual = compileEmissionSchedule(
      [
        { type: "burst", atMilliseconds: 100, count: 1 },
        { type: "manual", count: 2 },
      ],
      1_000,
    );
    const emptyFinite = compileEmissionSchedule(
      [{ type: "rate", particlesPerSecond: 0 }],
      1_000,
    );

    expect(finite.completion).toBe("finite");
    expect(finite.earliestAutomaticBirthMilliseconds).toBe(100);
    expect(finite.latestAutomaticBirthMilliseconds).toBe(1_000);
    expect(finite.completionMilliseconds).toBe(1_750);
    expect(finite.maximumPotentiallyLiveOrdinals).toBe(5);
    expect(infinite.completion).toBe("automatic-infinite");
    expect(infinite.latestAutomaticBirthMilliseconds).toBeNull();
    expect(infinite.maximumPotentiallyLiveOrdinals).toBe(5);
    expect(manual.completion).toBe("manual-open");
    expect(manual.earliestAutomaticBirthMilliseconds).toBe(100);
    expect(manual.latestAutomaticBirthMilliseconds).toBe(100);
    expect(manual.completionMilliseconds).toBeNull();
    expect(emptyFinite.completion).toBe("finite");
    expect(emptyFinite.completionMilliseconds).toBe(0);
  });
});
