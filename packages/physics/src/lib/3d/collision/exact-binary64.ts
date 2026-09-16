export interface ExactDyadic {
  readonly significand: bigint;
  readonly exponent: number;
}

export type ExactVector3 = readonly [ExactDyadic, ExactDyadic, ExactDyadic];

export interface ExactRational {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

export interface ExactQuadratic {
  readonly a: ExactDyadic;
  readonly b: ExactDyadic;
  readonly c: ExactDyadic;
}

export type ExactTime =
  | Readonly<{ kind: "rational"; value: ExactRational }>
  | Readonly<{
      kind: "quadratic-root";
      quadratic: ExactQuadratic;
      branch: "lower" | "upper";
    }>;

const ZERO_DYADIC: ExactDyadic = Object.freeze({
  significand: 0n,
  exponent: 0,
});
const ONE_DYADIC: ExactDyadic = Object.freeze({
  significand: 1n,
  exponent: 0,
});
const TWO_DYADIC: ExactDyadic = Object.freeze({
  significand: 1n,
  exponent: 1,
});
const ZERO_RATIONAL: ExactRational = Object.freeze({
  numerator: 0n,
  denominator: 1n,
});
const SIGN_BIT = 1n << 63n;
const MAX_FINITE_BITS = 0x7fef_ffff_ffff_ffffn;
const MIN_FINITE_ORDER = orderedBits(SIGN_BIT | MAX_FINITE_BITS);
const MAX_FINITE_ORDER = orderedBits(MAX_FINITE_BITS);
const bitsBuffer = new ArrayBuffer(8);
const bitsFloat = new Float64Array(bitsBuffer);
const bitsInteger = new BigUint64Array(bitsBuffer);

export function dyadicFromNumber(value: number): ExactDyadic {
  if (!Number.isFinite(value)) {
    throw new RangeError("exact dyadic input must be finite.");
  }
  if (value === 0) return ZERO_DYADIC;
  bitsFloat[0] = value;
  const encoded = bitsInteger[0]!;
  const negative = (encoded & SIGN_BIT) !== 0n;
  const exponentBits = Number((encoded >> 52n) & 0x7ffn);
  const fraction = encoded & 0x000f_ffff_ffff_ffffn;
  const significand = exponentBits === 0
    ? fraction
    : (1n << 52n) | fraction;
  const exponent = exponentBits === 0
    ? -1074
    : exponentBits - 1023 - 52;
  return canonicalDyadic(negative ? -significand : significand, exponent);
}

export function dyadicFromBigInt(
  value: bigint,
  exponent = 0,
): ExactDyadic {
  if (!Number.isSafeInteger(exponent)) {
    throw new RangeError("exact dyadic exponent must be a safe integer.");
  }
  return canonicalDyadic(value, exponent);
}

export function dyadicNegate(value: ExactDyadic): ExactDyadic {
  return value.significand === 0n
    ? ZERO_DYADIC
    : Object.freeze({
        significand: -value.significand,
        exponent: value.exponent,
      });
}

export function dyadicAdd(
  first: ExactDyadic,
  second: ExactDyadic,
): ExactDyadic {
  if (first.significand === 0n) return second;
  if (second.significand === 0n) return first;
  const exponent = Math.min(first.exponent, second.exponent);
  return canonicalDyadic(
    (first.significand << BigInt(first.exponent - exponent)) +
      (second.significand << BigInt(second.exponent - exponent)),
    exponent,
  );
}

export function dyadicSubtract(
  first: ExactDyadic,
  second: ExactDyadic,
): ExactDyadic {
  return dyadicAdd(first, dyadicNegate(second));
}

export function dyadicMultiply(
  first: ExactDyadic,
  second: ExactDyadic,
): ExactDyadic {
  if (first.significand === 0n || second.significand === 0n) {
    return ZERO_DYADIC;
  }
  return canonicalDyadic(
    first.significand * second.significand,
    first.exponent + second.exponent,
  );
}

export function dyadicSquare(value: ExactDyadic): ExactDyadic {
  return dyadicMultiply(value, value);
}

export function dyadicDot3(
  first: ExactVector3,
  second: ExactVector3,
): ExactDyadic {
  return dyadicAdd(
    dyadicAdd(
      dyadicMultiply(first[0], second[0]),
      dyadicMultiply(first[1], second[1]),
    ),
    dyadicMultiply(first[2], second[2]),
  );
}

export function dyadicCompare(
  first: ExactDyadic,
  second: ExactDyadic,
): -1 | 0 | 1 {
  return signBigInt(dyadicSubtract(first, second).significand);
}

export function dyadicSign(value: ExactDyadic): -1 | 0 | 1 {
  return signBigInt(value.significand);
}

export function exactVector3FromNumbers(value: ArrayLike<number>): ExactVector3 {
  return [
    dyadicFromNumber(value[0]!),
    dyadicFromNumber(value[1]!),
    dyadicFromNumber(value[2]!),
  ];
}

export function exactVector3Difference(
  first: ArrayLike<number>,
  second: ArrayLike<number>,
): ExactVector3 {
  return [
    dyadicSubtract(dyadicFromNumber(first[0]!), dyadicFromNumber(second[0]!)),
    dyadicSubtract(dyadicFromNumber(first[1]!), dyadicFromNumber(second[1]!)),
    dyadicSubtract(dyadicFromNumber(first[2]!), dyadicFromNumber(second[2]!)),
  ];
}

export function rationalFromBigInts(
  numerator: bigint,
  denominator: bigint,
): ExactRational {
  if (denominator === 0n) {
    throw new RangeError("exact rational denominator must be non-zero.");
  }
  if (numerator === 0n) return ZERO_RATIONAL;
  const normalizedNumerator = denominator < 0n ? -numerator : numerator;
  const normalizedDenominator = denominator < 0n ? -denominator : denominator;
  const divisor = greatestCommonDivisor(
    absoluteBigInt(normalizedNumerator),
    normalizedDenominator,
  );
  return Object.freeze({
    numerator: normalizedNumerator / divisor,
    denominator: normalizedDenominator / divisor,
  });
}

export function rationalFromDyadics(
  numerator: ExactDyadic,
  denominator: ExactDyadic,
): ExactRational {
  if (denominator.significand === 0n) {
    throw new RangeError("exact rational denominator must be non-zero.");
  }
  if (numerator.significand === 0n) return ZERO_RATIONAL;
  const exponentDifference = numerator.exponent - denominator.exponent;
  return exponentDifference >= 0
    ? rationalFromBigInts(
        numerator.significand << BigInt(exponentDifference),
        denominator.significand,
      )
    : rationalFromBigInts(
        numerator.significand,
        denominator.significand << BigInt(-exponentDifference),
      );
}

export function rationalFromNumber(value: number): ExactRational {
  return rationalFromDyadics(dyadicFromNumber(value), ONE_DYADIC);
}

export function rationalNegate(value: ExactRational): ExactRational {
  return value.numerator === 0n
    ? ZERO_RATIONAL
    : Object.freeze({
        numerator: -value.numerator,
        denominator: value.denominator,
      });
}

export function rationalAdd(
  first: ExactRational,
  second: ExactRational,
): ExactRational {
  return rationalFromBigInts(
    first.numerator * second.denominator +
      second.numerator * first.denominator,
    first.denominator * second.denominator,
  );
}

export function rationalSubtract(
  first: ExactRational,
  second: ExactRational,
): ExactRational {
  return rationalAdd(first, rationalNegate(second));
}

export function rationalMultiply(
  first: ExactRational,
  second: ExactRational,
): ExactRational {
  return rationalFromBigInts(
    first.numerator * second.numerator,
    first.denominator * second.denominator,
  );
}

export function rationalSquare(value: ExactRational): ExactRational {
  return rationalMultiply(value, value);
}

export function rationalMidpoint(
  first: ExactRational,
  second: ExactRational,
): ExactRational {
  const sum = rationalAdd(first, second);
  return rationalFromBigInts(sum.numerator, sum.denominator * 2n);
}

export function compareRationals(
  first: ExactRational,
  second: ExactRational,
): -1 | 0 | 1 {
  return signBigInt(
    first.numerator * second.denominator -
      second.numerator * first.denominator,
  );
}

export function rationalSign(value: ExactRational): -1 | 0 | 1 {
  return signBigInt(value.numerator);
}

export function exactSlabTime(
  origin: ExactDyadic,
  velocity: ExactDyadic,
  bound: ExactDyadic,
): ExactRational | null {
  return velocity.significand === 0n
    ? null
    : rationalFromDyadics(dyadicSubtract(bound, origin), velocity);
}

export function insertExactSlabBreakpoint(
  breakpoints: ExactRational[],
  value: ExactRational,
): void {
  if (breakpoints.length > 8) {
    throw new RangeError("exact slab breakpoint count exceeded its 3D bound.");
  }
  for (let index = 0; index < breakpoints.length; index += 1) {
    const relation = compareRationals(value, breakpoints[index]!);
    if (relation === 0) return;
    if (relation < 0) {
      if (breakpoints.length === 8) {
        throw new RangeError("exact slab breakpoint count exceeded its 3D bound.");
      }
      breakpoints.splice(index, 0, value);
      return;
    }
  }
  if (breakpoints.length === 8) {
    throw new RangeError("exact slab breakpoint count exceeded its 3D bound.");
  }
  breakpoints.push(value);
}

export function exactSquaredDistanceRelation(
  point: ExactVector3,
  radius: ExactDyadic,
): -1 | 0 | 1 {
  return dyadicCompare(dyadicDot3(point, point), dyadicSquare(radius));
}

export function exactSquaredDistanceToRadiusSumRelation(
  point: readonly [number, number, number],
  firstRadius: number,
  secondRadius: number,
): -1 | 0 | 1 {
  const radius = dyadicAdd(
    dyadicFromNumber(firstRadius),
    dyadicFromNumber(secondRadius),
  );
  return exactSquaredDistanceRelation(exactVector3FromNumbers(point), radius);
}

export function exactQuadratic(
  a: ExactDyadic,
  b: ExactDyadic,
  c: ExactDyadic,
): ExactQuadratic {
  return Object.freeze({ a, b, c });
}

export function quadraticDiscriminant(
  quadratic: ExactQuadratic,
): ExactDyadic {
  return dyadicSubtract(
    dyadicSquare(quadratic.b),
    dyadicMultiply(
      dyadicMultiply(dyadicFromBigInt(4n), quadratic.a),
      quadratic.c,
    ),
  );
}

export function quadraticDiscriminantSign(
  quadratic: ExactQuadratic,
): -1 | 0 | 1 {
  return dyadicSign(quadraticDiscriminant(quadratic));
}

export function quadraticSignAtRational(
  quadratic: ExactQuadratic,
  time: ExactRational,
): -1 | 0 | 1 {
  const rationalA = rationalFromDyadic(quadratic.a);
  const rationalB = rationalFromDyadic(quadratic.b);
  const rationalC = rationalFromDyadic(quadratic.c);
  return rationalSign(rationalAdd(
    rationalAdd(
      rationalMultiply(rationalA, rationalSquare(time)),
      rationalMultiply(rationalB, time),
    ),
    rationalC,
  ));
}

export function quadraticRoot(
  quadratic: ExactQuadratic,
  branch: "lower" | "upper",
): ExactTime | null {
  if (dyadicSign(quadratic.a) <= 0 || quadraticDiscriminantSign(quadratic) < 0) {
    return null;
  }
  return Object.freeze({
    kind: "quadratic-root",
    quadratic,
    branch,
  });
}

export function rationalTime(value: ExactRational): ExactTime {
  return Object.freeze({ kind: "rational", value });
}

export function compareExactTimes(
  first: ExactTime,
  second: ExactTime,
): -1 | 0 | 1 {
  if (first.kind === "rational") {
    return second.kind === "rational"
      ? compareRationals(first.value, second.value)
      : negateSign(compareQuadraticRootToRational(second, first.value));
  }
  if (second.kind === "rational") {
    return compareQuadraticRootToRational(first, second.value);
  }
  return compareQuadraticRoots(first, second);
}

export function compareExactTimeToRational(
  time: ExactTime,
  value: ExactRational,
): -1 | 0 | 1 {
  return time.kind === "rational"
    ? compareRationals(time.value, value)
    : compareQuadraticRootToRational(time, value);
}

export function affineSignAtExactTime(
  offset: ExactDyadic,
  slope: ExactDyadic,
  time: ExactTime,
): -1 | 0 | 1 {
  return compareAffineAtExactTimeToRational(
    offset,
    slope,
    time,
    ZERO_RATIONAL,
  );
}

export function compareAffineAtExactTimeToRational(
  offset: ExactDyadic,
  slope: ExactDyadic,
  time: ExactTime,
  value: ExactRational,
): -1 | 0 | 1 {
  if (time.kind === "rational") {
    return rationalSign(rationalSubtract(
      rationalAdd(
        rationalFromDyadic(offset),
        rationalMultiply(rationalFromDyadic(slope), time.value),
      ),
      value,
    ));
  }
  const { quadratic, branch } = time;
  const twiceA = dyadicMultiply(TWO_DYADIC, quadratic.a);
  const offsetMinusValue = rationalSubtract(
    rationalFromDyadic(offset),
    value,
  );
  const constant = rationalSubtract(
    rationalMultiply(rationalFromDyadic(twiceA), offsetMinusValue),
    rationalFromDyadic(dyadicMultiply(slope, quadratic.b)),
  );
  const radicalCoefficient = rationalFromDyadic(
    branch === "lower" ? dyadicNegate(slope) : slope,
  );
  return signOneRadical(
    constant,
    radicalCoefficient,
    rationalFromDyadic(quadraticDiscriminant(quadratic)),
  );
}

export function projectExactTime(time: ExactTime): number | null {
  return projectExactValue((value) => compareExactTimeToRational(time, value));
}

export function projectAffineAtExactTime(
  offset: ExactDyadic,
  slope: ExactDyadic,
  time: ExactTime,
): number | null {
  return projectExactValue((value) =>
    compareAffineAtExactTimeToRational(offset, slope, time, value)
  );
}

export function projectAffineRatioAtExactTime(
  offset: ExactDyadic,
  slope: ExactDyadic,
  time: ExactTime,
  denominator: ExactDyadic,
): number | null {
  if (dyadicSign(denominator) <= 0) {
    throw new RangeError("exact affine projection denominator must be positive.");
  }
  const rationalDenominator = rationalFromDyadic(denominator);
  return projectExactValue((value) =>
    compareAffineAtExactTimeToRational(
      offset,
      slope,
      time,
      rationalMultiply(value, rationalDenominator),
    )
  );
}

export function compareScaledExactTimeToDyadic(
  time: ExactTime,
  scaleSquared: ExactDyadic,
  value: ExactDyadic,
): -1 | 0 | 1 {
  if (dyadicSign(scaleSquared) < 0) {
    throw new RangeError("exact squared scale must be nonnegative.");
  }
  if (dyadicSign(value) < 0) return 1;
  if (scaleSquared.significand === 0n) {
    return dyadicCompare(ZERO_DYADIC, value);
  }
  const limit = quadraticRoot(exactQuadratic(
    scaleSquared,
    ZERO_DYADIC,
    dyadicNegate(dyadicSquare(value)),
  ), "upper");
  if (limit === null) {
    throw new RangeError("exact nonnegative distance limit must have a root.");
  }
  return compareExactTimes(time, limit);
}

export function projectScaledExactTime(
  time: ExactTime,
  scaleSquared: ExactDyadic,
): number | null {
  if (dyadicSign(scaleSquared) < 0) {
    throw new RangeError("exact squared scale must be nonnegative.");
  }
  if (scaleSquared.significand === 0n) return 0;
  return projectExactValue((value) => {
    if (rationalSign(value) < 0) return 1;
    const squaredValue = rationalSquare(value);
    const limit = quadraticRoot(exactQuadratic(
      scaleSquared,
      ZERO_DYADIC,
      dyadicNegate(dyadicFromRationalSquare(squaredValue)),
    ), "upper");
    if (limit !== null) return compareExactTimes(time, limit);
    return compareScaledTimeToRationalWithoutDyadicRoot(
      time,
      scaleSquared,
      value,
    );
  });
}

export function projectDyadicSquareRoot(value: ExactDyadic): number | null {
  if (dyadicSign(value) < 0) {
    throw new RangeError("exact square-root input must be nonnegative.");
  }
  return projectScaledExactTime(
    rationalTime(rationalFromBigInts(1n, 1n)),
    value,
  );
}

export function projectDyadicNormalizedComponent(
  value: ExactDyadic,
  squaredLength: ExactDyadic,
): number | null {
  if (dyadicSign(squaredLength) <= 0) {
    throw new RangeError("exact squared length must be positive.");
  }
  const valueSign = dyadicSign(value);
  const squaredValue = rationalFromDyadic(dyadicSquare(value));
  const rationalSquaredLength = rationalFromDyadic(squaredLength);
  return projectExactValue((candidate) => {
    const candidateSign = rationalSign(candidate);
    if (valueSign === 0) return negateSign(candidateSign);
    if (candidateSign === 0) return valueSign;
    if (valueSign !== candidateSign) return valueSign;
    const magnitudeRelation = compareRationals(
      squaredValue,
      rationalMultiply(rationalSquare(candidate), rationalSquaredLength),
    );
    return valueSign > 0 ? magnitudeRelation : negateSign(magnitudeRelation);
  });
}

function canonicalDyadic(
  significand: bigint,
  exponent: number,
): ExactDyadic {
  if (significand === 0n) return ZERO_DYADIC;
  const magnitude = absoluteBigInt(significand);
  const lowestBit = magnitude & -magnitude;
  const trailingZeroCount = lowestBit.toString(2).length - 1;
  return Object.freeze({
    significand: significand >> BigInt(trailingZeroCount),
    exponent: exponent + trailingZeroCount,
  });
}

function greatestCommonDivisor(first: bigint, second: bigint): bigint {
  let a = first;
  let b = second;
  for (let iteration = 0; iteration < 32_768; iteration += 1) {
    if (b === 0n) return a;
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  throw new RangeError("exact rational reduction exceeded its binary64 bound.");
}

function rationalFromDyadic(value: ExactDyadic): ExactRational {
  return rationalFromDyadics(value, ONE_DYADIC);
}

function dyadicFromRationalSquare(value: ExactRational): ExactDyadic {
  const denominator = value.denominator;
  if ((denominator & (denominator - 1n)) !== 0n) {
    return ZERO_DYADIC;
  }
  const denominatorExponent = denominator.toString(2).length - 1;
  return dyadicFromBigInt(value.numerator, -denominatorExponent);
}

function compareScaledTimeToRationalWithoutDyadicRoot(
  time: ExactTime,
  scaleSquared: ExactDyadic,
  value: ExactRational,
): -1 | 0 | 1 {
  if (rationalSign(value) < 0) return 1;
  if (time.kind === "rational") {
    return compareRationals(
      rationalMultiply(
        rationalFromDyadic(scaleSquared),
        rationalSquare(time.value),
      ),
      rationalSquare(value),
    );
  }
  const { quadratic } = time;
  const scaleOverA = rationalFromDyadics(scaleSquared, quadratic.a);
  const offset = rationalMultiply(
    scaleOverA,
    rationalFromDyadic(dyadicNegate(quadratic.c)),
  );
  const slope = rationalMultiply(
    scaleOverA,
    rationalFromDyadic(dyadicNegate(quadratic.b)),
  );
  return signRationalAffineAtQuadraticRoot(
    rationalSubtract(offset, rationalSquare(value)),
    slope,
    time,
  );
}

function signRationalAffineAtQuadraticRoot(
  offset: ExactRational,
  slope: ExactRational,
  time: Extract<ExactTime, { kind: "quadratic-root" }>,
): -1 | 0 | 1 {
  const { quadratic, branch } = time;
  const twiceA = rationalFromDyadic(
    dyadicMultiply(TWO_DYADIC, quadratic.a),
  );
  const constant = rationalSubtract(
    rationalMultiply(twiceA, offset),
    rationalMultiply(slope, rationalFromDyadic(quadratic.b)),
  );
  const radicalCoefficient = branch === "lower"
    ? rationalNegate(slope)
    : slope;
  return signOneRadical(
    constant,
    radicalCoefficient,
    rationalFromDyadic(quadraticDiscriminant(quadratic)),
  );
}

function compareQuadraticRootToRational(
  root: Extract<ExactTime, { kind: "quadratic-root" }>,
  value: ExactRational,
): -1 | 0 | 1 {
  const { quadratic, branch } = root;
  const twiceA = dyadicMultiply(TWO_DYADIC, quadratic.a);
  const constant = rationalSubtract(
    rationalFromDyadic(dyadicNegate(quadratic.b)),
    rationalMultiply(rationalFromDyadic(twiceA), value),
  );
  const radicalCoefficient = rationalFromBigInts(
    branch === "lower" ? -1n : 1n,
    1n,
  );
  return signOneRadical(
    constant,
    radicalCoefficient,
    rationalFromDyadic(quadraticDiscriminant(quadratic)),
  );
}

function compareQuadraticRoots(
  first: Extract<ExactTime, { kind: "quadratic-root" }>,
  second: Extract<ExactTime, { kind: "quadratic-root" }>,
): -1 | 0 | 1 {
  const firstTwiceA = dyadicMultiply(TWO_DYADIC, first.quadratic.a);
  const secondTwiceA = dyadicMultiply(TWO_DYADIC, second.quadratic.a);
  const constant = rationalFromDyadic(dyadicAdd(
    dyadicMultiply(dyadicNegate(first.quadratic.b), secondTwiceA),
    dyadicMultiply(second.quadratic.b, firstTwiceA),
  ));
  const firstRadicalCoefficient = rationalFromDyadic(
    dyadicMultiply(
      first.branch === "lower" ? dyadicNegate(ONE_DYADIC) : ONE_DYADIC,
      secondTwiceA,
    ),
  );
  const secondRadicalCoefficient = rationalFromDyadic(
    dyadicMultiply(
      second.branch === "lower" ? ONE_DYADIC : dyadicNegate(ONE_DYADIC),
      firstTwiceA,
    ),
  );
  return signTwoRadicals(
    constant,
    firstRadicalCoefficient,
    rationalFromDyadic(quadraticDiscriminant(first.quadratic)),
    secondRadicalCoefficient,
    rationalFromDyadic(quadraticDiscriminant(second.quadratic)),
  );
}

function signOneRadical(
  constant: ExactRational,
  radicalCoefficient: ExactRational,
  radicand: ExactRational,
): -1 | 0 | 1 {
  const radicandSign = rationalSign(radicand);
  if (radicandSign < 0) {
    throw new RangeError("exact radical radicand must be nonnegative.");
  }
  const constantSign = rationalSign(constant);
  if (radicandSign === 0 || rationalSign(radicalCoefficient) === 0) {
    return constantSign;
  }
  const radicalSign = rationalSign(radicalCoefficient);
  if (constantSign === 0) return radicalSign;
  if (constantSign === radicalSign) return constantSign;
  const magnitudeRelation = compareRationals(
    rationalSquare(constant),
    rationalMultiply(rationalSquare(radicalCoefficient), radicand),
  );
  return magnitudeRelation === 0
    ? 0
    : magnitudeRelation > 0
      ? constantSign
      : radicalSign;
}

function signTwoRadicals(
  constant: ExactRational,
  firstCoefficient: ExactRational,
  firstRadicand: ExactRational,
  secondCoefficient: ExactRational,
  secondRadicand: ExactRational,
): -1 | 0 | 1 {
  const firstPartSign = signOneRadical(
    constant,
    firstCoefficient,
    firstRadicand,
  );
  const secondRadicalSign = rationalSign(secondRadicand) === 0
    ? 0
    : rationalSign(secondCoefficient);
  if (secondRadicalSign === 0) return firstPartSign;
  if (firstPartSign === 0) return secondRadicalSign;
  if (firstPartSign === secondRadicalSign) return firstPartSign;

  const squaredConstant = rationalSubtract(
    rationalAdd(
      rationalSquare(constant),
      rationalMultiply(rationalSquare(firstCoefficient), firstRadicand),
    ),
    rationalMultiply(rationalSquare(secondCoefficient), secondRadicand),
  );
  const squaredRadicalCoefficient = rationalMultiply(
    rationalFromBigInts(2n, 1n),
    rationalMultiply(constant, firstCoefficient),
  );
  const magnitudeRelation = signOneRadical(
    squaredConstant,
    squaredRadicalCoefficient,
    firstRadicand,
  );
  return magnitudeRelation === 0
    ? 0
    : magnitudeRelation > 0
      ? firstPartSign
      : secondRadicalSign;
}

function projectExactValue(
  compareToRational: (value: ExactRational) => -1 | 0 | 1,
): number | null {
  if (compareToRational(rationalFromNumber(-Number.MAX_VALUE)) < 0) return null;
  if (compareToRational(rationalFromNumber(Number.MAX_VALUE)) > 0) return null;
  if (compareToRational(ZERO_RATIONAL) === 0) return 0;

  let minimum = MIN_FINITE_ORDER;
  let maximum = MAX_FINITE_ORDER;
  for (let iteration = 0; iteration < 64; iteration += 1) {
    if (minimum >= maximum) break;
    const middle = (minimum + maximum + 1n) >> 1n;
    const candidate = numberFromOrderedBits(middle);
    if (compareToRational(rationalFromNumber(candidate)) >= 0) {
      minimum = middle;
    } else {
      maximum = middle - 1n;
    }
  }

  const lower = numberFromOrderedBits(minimum);
  if (minimum === MAX_FINITE_ORDER) return lower;
  const upper = numberFromOrderedBits(minimum + 1n);
  if (Object.is(lower, -0) && Object.is(upper, 0)) return 0;
  const midpoint = rationalMidpoint(
    rationalFromNumber(lower),
    rationalFromNumber(upper),
  );
  const midpointRelation = compareToRational(midpoint);
  if (midpointRelation < 0) return cleanProjectedZero(lower);
  if (midpointRelation > 0) return cleanProjectedZero(upper);
  bitsFloat[0] = lower;
  const lowerBits = bitsInteger[0]!;
  return cleanProjectedZero((lowerBits & 1n) === 0n ? lower : upper);
}

function orderedBits(bits: bigint): bigint {
  return (bits & SIGN_BIT) === 0n
    ? bits | SIGN_BIT
    : (~bits) & 0xffff_ffff_ffff_ffffn;
}

function numberFromOrderedBits(value: bigint): number {
  bitsInteger[0] = (value & SIGN_BIT) !== 0n
    ? value & ~SIGN_BIT
    : (~value) & 0xffff_ffff_ffff_ffffn;
  return bitsFloat[0]!;
}

function cleanProjectedZero(value: number): number {
  return value === 0 ? 0 : value;
}

function absoluteBigInt(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function signBigInt(value: bigint): -1 | 0 | 1 {
  return value < 0n ? -1 : value > 0n ? 1 : 0;
}

function negateSign(value: -1 | 0 | 1): -1 | 0 | 1 {
  return value === 0 ? 0 : value === 1 ? -1 : 1;
}
