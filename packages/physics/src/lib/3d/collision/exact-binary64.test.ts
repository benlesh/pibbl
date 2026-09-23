import { describe, expect, it } from "vitest";
import {
  affineSignAtExactTime,
  compareExactTimes,
  compareRationals,
  dyadicAdd,
  dyadicCompare,
  dyadicDot3,
  dyadicFromBigInt,
  dyadicFromNumber,
  dyadicMultiply,
  dyadicSquare,
  dyadicSubtract,
  exactQuadratic,
  exactSlabTime,
  exactSquaredDistanceToRadiusSumRelation,
  insertExactSlabBreakpoint,
  projectAffineAtExactTime,
  projectDyadicNormalizedComponent,
  projectExactTime,
  projectNonnegativeScaledExactTime,
  projectNonnegativeScaledExactTimeRatio,
  quadraticDiscriminantSign,
  quadraticRoot,
  rationalFromBigInts,
  rationalFromNumber,
  rationalTime,
} from "./exact-binary64.js";

describe("exact binary64 arithmetic", () => {
  it("canonicalizes signed zero and every binary64 exponent extreme", () => {
    expect(dyadicFromNumber(0)).toEqual({ significand: 0n, exponent: 0 });
    expect(dyadicFromNumber(-0)).toEqual({ significand: 0n, exponent: 0 });
    expect(dyadicFromNumber(Number.MIN_VALUE)).toEqual({
      significand: 1n,
      exponent: -1074,
    });
    expect(dyadicFromNumber(2 ** -1022)).toEqual({
      significand: 1n,
      exponent: -1022,
    });
    expect(dyadicFromNumber(Number.MAX_VALUE)).toEqual({
      significand: (1n << 53n) - 1n,
      exponent: 971,
    });
    expect(dyadicFromNumber(-1.5)).toEqual({ significand: -3n, exponent: -1 });
    expect(() => dyadicFromNumber(Number.POSITIVE_INFINITY)).toThrow(/finite/);
  });

  it("preserves cancellation and low terms discarded by binary64 addition", () => {
    const maximum = dyadicFromNumber(Number.MAX_VALUE);
    expect(dyadicAdd(maximum, dyadicFromNumber(-Number.MAX_VALUE))).toEqual({
      significand: 0n,
      exponent: 0,
    });
    expect(dyadicAdd(dyadicFromNumber(1), dyadicFromNumber(2 ** -53))).toEqual({
      significand: (1n << 53n) + 1n,
      exponent: -53,
    });
    expect(dyadicSubtract(dyadicFromNumber(1), dyadicFromNumber(1))).toEqual({
      significand: 0n,
      exponent: 0,
    });
  });

  it("adds, multiplies, squares, and dots without scale loss", () => {
    const scale = dyadicFromNumber(Number.MIN_VALUE);
    expect(dyadicMultiply(dyadicFromBigInt(3n), scale)).toEqual({
      significand: 3n,
      exponent: -1074,
    });
    expect(dyadicSquare(scale)).toEqual({ significand: 1n, exponent: -2148 });
    expect(dyadicDot3(
      [dyadicFromBigInt(3n), dyadicFromBigInt(4n), dyadicFromBigInt(0n)],
      [dyadicFromBigInt(3n), dyadicFromBigInt(4n), dyadicFromBigInt(0n)],
    )).toEqual({ significand: 25n, exponent: 0 });
  });

  it("keeps a two-term radius sum exact for initial topology", () => {
    expect(exactSquaredDistanceToRadiusSumRelation(
      [1.0000000000000004, 0, 0],
      nextRepresentableUp(1),
      2 ** -53,
    )).toBe(1);
    expect(exactSquaredDistanceToRadiusSumRelation(
      [1.0000000000000002, 0, 0],
      nextRepresentableUp(1),
      2 ** -53,
    )).toBe(-1);
  });

  it("constructs, orders, and deduplicates exact rational slab times", () => {
    const first = exactSlabTime(
      dyadicFromNumber(0),
      dyadicFromNumber(10),
      dyadicFromNumber(4),
    );
    const duplicate = exactSlabTime(
      dyadicFromNumber(0),
      dyadicFromNumber(5),
      dyadicFromNumber(2),
    );
    expect(first).toEqual(rationalFromBigInts(2n, 5n));
    expect(compareRationals(first!, duplicate!)).toBe(0);
    expect(compareRationals(first!, rationalFromBigInts(1n, 2n))).toBe(-1);

    const breakpoints = [
      rationalFromBigInts(0n, 1n),
      rationalFromBigInts(1n, 1n),
    ];
    insertExactSlabBreakpoint(breakpoints, first!);
    insertExactSlabBreakpoint(breakpoints, duplicate!);
    insertExactSlabBreakpoint(breakpoints, rationalFromBigInts(1n, 5n));
    expect(breakpoints).toEqual([
      rationalFromBigInts(0n, 1n),
      rationalFromBigInts(1n, 5n),
      rationalFromBigInts(2n, 5n),
      rationalFromBigInts(1n, 1n),
    ]);
  });

  it("decides quadratic discriminants exactly at tangent and adjacent values", () => {
    const one = dyadicFromNumber(1);
    const minusTwo = dyadicFromNumber(-2);
    expect(quadraticDiscriminantSign(exactQuadratic(one, minusTwo, one))).toBe(0);
    expect(quadraticDiscriminantSign(exactQuadratic(
      one,
      minusTwo,
      dyadicFromNumber(nextRepresentableUp(1)),
    ))).toBe(-1);
    expect(quadraticDiscriminantSign(exactQuadratic(
      one,
      minusTwo,
      dyadicFromNumber(nextRepresentableDown(1)),
    ))).toBe(1);
  });

  it("orders lower roots against rationals and other algebraic roots", () => {
    const first = quadraticRoot(exactQuadratic(
      dyadicFromNumber(1),
      dyadicFromNumber(-3),
      dyadicFromNumber(1),
    ), "lower");
    const tangent = quadraticRoot(exactQuadratic(
      dyadicFromNumber(25),
      dyadicFromNumber(-20),
      dyadicFromNumber(4),
    ), "lower");
    const scaledFirst = quadraticRoot(exactQuadratic(
      dyadicFromNumber(2),
      dyadicFromNumber(-6),
      dyadicFromNumber(2),
    ), "lower");
    const earlier = quadraticRoot(exactQuadratic(
      dyadicFromNumber(1),
      dyadicFromNumber(-5),
      dyadicFromNumber(1),
    ), "lower");
    expect(first).not.toBeNull();
    expect(tangent).not.toBeNull();
    expect(scaledFirst).not.toBeNull();
    expect(earlier).not.toBeNull();
    expect(compareExactTimes(first!, rationalTime(rationalFromBigInts(2n, 5n)))).toBe(-1);
    expect(compareExactTimes(tangent!, rationalTime(rationalFromBigInts(2n, 5n)))).toBe(0);
    expect(compareExactTimes(first!, tangent!)).toBe(-1);
    expect(compareExactTimes(tangent!, first!)).toBe(1);
    expect(compareExactTimes(first!, scaledFirst!)).toBe(0);
    expect(compareExactTimes(earlier!, first!)).toBe(-1);
    expect(compareExactTimes(first!, earlier!)).toBe(1);
  });

  it("decides affine feature ownership directly at an algebraic time", () => {
    const root = quadraticRoot(exactQuadratic(
      dyadicFromNumber(1),
      dyadicFromNumber(-3),
      dyadicFromNumber(1),
    ), "lower")!;
    expect(affineSignAtExactTime(
      dyadicFromNumber(-0.4),
      dyadicFromNumber(1),
      root,
    )).toBe(-1);
    expect(affineSignAtExactTime(
      dyadicFromNumber(-0.3),
      dyadicFromNumber(1),
      root,
    )).toBe(1);
  });

  it("projects rational, algebraic, subnormal, and maximum-finite values with exact bracketing", () => {
    const twoFifths = rationalTime(rationalFromBigInts(2n, 5n));
    expect(projectExactTime(twoFifths)).toBe(0.4);

    const tangent = quadraticRoot(exactQuadratic(
      dyadicFromNumber(25),
      dyadicFromNumber(-20),
      dyadicFromNumber(4),
    ), "lower")!;
    expect(projectExactTime(tangent)).toBe(0.4);
    expect(projectAffineAtExactTime(
      dyadicFromNumber(0),
      dyadicFromNumber(1),
      tangent,
    )).toBe(0.4);

    expect(projectExactTime(rationalTime(rationalFromNumber(Number.MIN_VALUE)))).toBe(
      Number.MIN_VALUE,
    );
    expect(projectExactTime(rationalTime(rationalFromNumber(Number.MAX_VALUE)))).toBe(
      Number.MAX_VALUE,
    );
    expect(dyadicCompare(
      dyadicFromNumber(projectExactTime(twoFifths)!),
      dyadicFromNumber(0.4),
    )).toBe(0);
  });

  it("normalizes exact components that are too small to materialize first", () => {
    const x = dyadicFromBigInt(3n, -2200);
    const y = dyadicFromBigInt(4n, -2200);
    const squaredLength = dyadicAdd(dyadicSquare(x), dyadicSquare(y));

    expect(projectDyadicNormalizedComponent(x, squaredLength)).toBe(0.6);
    expect(projectDyadicNormalizedComponent(y, squaredLength)).toBe(0.8);
    expect(projectDyadicNormalizedComponent(
      dyadicFromBigInt(-3n, -2200),
      squaredLength,
    )).toBe(-0.6);
  });

  it("projects a nonnegative scaled algebraic-time ratio without materializing its numerator", () => {
    const eventTime = quadraticRoot(exactQuadratic(
      dyadicFromNumber(2),
      dyadicFromNumber(-4),
      dyadicFromNumber(1),
    ), "lower")!;

    expect(projectNonnegativeScaledExactTimeRatio(
      eventTime,
      dyadicFromNumber(2),
      dyadicFromNumber(1),
    )).toBe(0.41421356237309503);
  });

  it("rejects negative times in the explicitly nonnegative scaled projector", () => {
    const negativeTime = rationalTime(rationalFromBigInts(-1n, 1n));

    expect(() => projectNonnegativeScaledExactTime(
      negativeTime,
      dyadicFromNumber(2),
    )).toThrow(/time must be nonnegative/);
    expect(() => projectNonnegativeScaledExactTimeRatio(
      negativeTime,
      dyadicFromNumber(2),
      dyadicFromNumber(1),
    )).toThrow(/time must be nonnegative/);
  });
});

function nextRepresentableUp(value: number): number {
  const floats = new Float64Array(1);
  const bits = new BigUint64Array(floats.buffer);
  floats[0] = value;
  bits[0] = bits[0]! + 1n;
  return floats[0]!;
}

function nextRepresentableDown(value: number): number {
  const floats = new Float64Array(1);
  const bits = new BigUint64Array(floats.buffer);
  floats[0] = value;
  bits[0] = bits[0]! - 1n;
  return floats[0]!;
}
