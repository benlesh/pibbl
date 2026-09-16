import type { PreparedBox3D, PreparedSphere3D } from "./support.js";
import {
  affineSignAtExactTime,
  compareExactTimes,
  compareRationals,
  compareScaledExactTimeToDyadic,
  dyadicAdd,
  dyadicDot3,
  dyadicFromBigInt,
  dyadicFromNumber,
  dyadicMultiply,
  dyadicNegate,
  dyadicSign,
  dyadicSquare,
  dyadicSubtract,
  exactQuadratic,
  exactSlabTime,
  exactSquaredDistanceRelation,
  exactVector3Difference,
  exactVector3FromNumbers,
  insertExactSlabBreakpoint,
  projectAffineAtExactTime,
  projectAffineRatioAtExactTime,
  projectDyadicNormalizedComponent,
  projectExactTime,
  projectScaledExactTime,
  quadraticDiscriminantSign,
  quadraticRoot,
  quadraticSignAtRational,
  rationalFromBigInts,
  rationalMidpoint,
  rationalTime,
  type ExactDyadic,
  type ExactQuadratic,
  type ExactRational,
  type ExactTime,
  type ExactVector3,
} from "./exact-binary64.js";

export interface AnalyticCastCandidate3D {
  readonly pointX: number;
  readonly pointY: number;
  readonly pointZ: number;
  readonly normalX: number;
  readonly normalY: number;
  readonly normalZ: number;
  readonly distance: number;
  readonly timeOfImpact: number;
}

export interface ExactSphereSweepEvent3D {
  readonly kind: "initial" | "tangent" | "crossing";
  readonly time: ExactTime;
}

interface ExactAffineCoordinate {
  readonly offset: ExactDyadic;
  readonly slope: ExactDyadic;
}

interface ExactSphereBoxGeometry {
  readonly origin: ExactVector3;
  readonly motion: ExactVector3;
  readonly halfExtents: ExactVector3;
  readonly radius: ExactDyadic;
  readonly translationSquared: ExactDyadic;
}

type BoxCell = readonly [-1 | 0 | 1, -1 | 0 | 1, -1 | 0 | 1];

const ZERO_DYADIC = dyadicFromBigInt(0n);
const TWO_DYADIC = dyadicFromBigInt(2n);
const ZERO_RATIONAL = rationalFromBigInts(0n, 1n);
const ONE_RATIONAL = rationalFromBigInts(1n, 1n);
const ZERO_TIME = rationalTime(ZERO_RATIONAL);

export function proveSphereSweepEvent3D(
  offset: ExactVector3,
  motion: ExactVector3,
  radius: ExactDyadic,
  minimum: ExactRational,
  maximum: ExactRational,
): ExactSphereSweepEvent3D | null {
  if (compareRationals(minimum, maximum) > 0) return null;
  return proveQuadraticEvent(
    sphereSweepQuadratic(offset, motion, radius),
    minimum,
    maximum,
  );
}

export function materializeAffineVector3(
  offset: ExactVector3,
  motion: ExactVector3,
  time: ExactTime,
): readonly [number, number, number] | null {
  const x = projectAffineAtExactTime(offset[0], motion[0], time);
  const y = projectAffineAtExactTime(offset[1], motion[1], time);
  const z = projectAffineAtExactTime(offset[2], motion[2], time);
  return x === null || y === null || z === null
    ? null
    : [cleanZero(x), cleanZero(y), cleanZero(z)];
}

export function raycastSphereAnalytically(
  sphere: PreparedSphere3D,
  origin: ArrayLike<number>,
  rawDirection: ArrayLike<number>,
  maxDistance: number,
  includeInitialOverlap: boolean,
): AnalyticCastCandidate3D | null {
  if (
    !isFiniteVector(origin) ||
    !isFiniteVector(rawDirection) ||
    !Number.isFinite(sphere.radius) ||
    !Number.isFinite(maxDistance)
  ) return null;
  const offset = exactVector3Difference(origin, sphere.center);
  const motion = exactVector3FromNumbers(rawDirection);
  const motionSquared = dyadicDot3(motion, motion);
  if (dyadicSign(motionSquared) === 0) return null;
  const radius = dyadicFromNumber(sphere.radius);
  const initialRelation = exactSquaredDistanceRelation(offset, radius);
  if (initialRelation <= 0) {
    if (!includeInitialOverlap) return null;
    const direction = normalizeScaleSafe(
      -rawDirection[0]!,
      -rawDirection[1]!,
      -rawDirection[2]!,
    );
    if (direction === null) return null;
    return finiteCandidate({
      pointX: origin[0]!,
      pointY: origin[1]!,
      pointZ: origin[2]!,
      normalX: direction[0],
      normalY: direction[1],
      normalZ: direction[2],
      distance: 0,
      timeOfImpact: 0,
    });
  }
  if (maxDistance === 0) return null;

  const event = proveSphereSweepFromZero(offset, motion, radius);
  if (event === null || event.kind === "initial") return null;
  if (
    compareScaledExactTimeToDyadic(
      event.time,
      motionSquared,
      dyadicFromNumber(maxDistance),
    ) > 0
  ) return null;
  const distance = projectScaledExactTime(event.time, motionSquared);
  const point = materializeAffineVector3(
    exactVector3FromNumbers(origin),
    motion,
    event.time,
  );
  const normal = materializeUnitAffineVector3(
    offset,
    motion,
    event.time,
    radius,
  );
  if (distance === null || point === null || normal === null) return null;
  return finiteCandidate({
    pointX: point[0],
    pointY: point[1],
    pointZ: point[2],
    normalX: normal[0],
    normalY: normal[1],
    normalZ: normal[2],
    distance,
    timeOfImpact: Math.min(1, distance / maxDistance),
  });
}

export function castSphereAgainstSphereAnalytically(
  moving: PreparedSphere3D,
  translation: ArrayLike<number>,
  target: PreparedSphere3D,
  includeInitialOverlap: boolean,
): AnalyticCastCandidate3D | null {
  if (
    !isFiniteVector(moving.center) ||
    !isFiniteVector(target.center) ||
    !isFiniteVector(translation) ||
    !Number.isFinite(moving.radius) ||
    !Number.isFinite(target.radius)
  ) return null;
  const offset = exactVector3Difference(moving.center, target.center);
  const motion = exactVector3FromNumbers(translation);
  const translationSquared = dyadicDot3(motion, motion);
  const radius = dyadicAdd(
    dyadicFromNumber(moving.radius),
    dyadicFromNumber(target.radius),
  );
  const initialRelation = exactSquaredDistanceRelation(offset, radius);
  if (initialRelation <= 0) {
    if (!includeInitialOverlap) return null;
    const normal = normalizeExactVectorAgainstMotion(offset, translation);
    if (normal === null) return null;
    return sphereSphereCandidate(target, normal, 0, 0);
  }
  if (translationSquared.significand === 0n) return null;
  const event = proveSphereSweepEvent3D(
    offset,
    motion,
    radius,
    ZERO_RATIONAL,
    ONE_RATIONAL,
  );
  if (event === null || event.kind === "initial") return null;
  const time = projectExactTime(event.time);
  const distance = projectScaledExactTime(event.time, translationSquared);
  const normal = materializeUnitAffineVector3(
    offset,
    motion,
    event.time,
    radius,
  );
  if (time === null || distance === null || normal === null) return null;
  return sphereSphereCandidate(target, normal, distance, time);
}

export function castSphereAgainstBoxAnalytically(
  moving: PreparedSphere3D,
  translation: ArrayLike<number>,
  target: PreparedBox3D,
  includeInitialOverlap: boolean,
): AnalyticCastCandidate3D | null {
  if (
    !isFiniteVector(moving.center) ||
    !isFiniteVector(translation) ||
    !isFiniteVector(target.center) ||
    !Array.from(target.axes).every(Number.isFinite) ||
    !isFiniteVector(target.halfExtents) ||
    !Number.isFinite(moving.radius)
  ) return null;
  const geometry = exactSphereBoxGeometry(moving, translation, target);
  const initialCell = classifyBoxCell(geometry, ZERO_TIME);
  const initialQuadratic = boxCellQuadratic(geometry, initialCell);
  const initialRelation = quadraticSignAtRational(
    initialQuadratic,
    ZERO_RATIONAL,
  );
  if (initialRelation <= 0) {
    if (!includeInitialOverlap) return null;
    return materializeSphereBoxCandidate(
      geometry,
      target,
      translation,
      ZERO_TIME,
      0,
      0,
      initialRelation === 0,
    );
  }
  if (geometry.translationSquared.significand === 0n) return null;

  const breakpoints = sphereBoxBreakpoints(geometry);
  for (let index = 0; index + 1 < breakpoints.length; index += 1) {
    const left = breakpoints[index]!;
    const right = breakpoints[index + 1]!;
    const midpoint = rationalMidpoint(left, right);
    const cell = classifyBoxCell(geometry, rationalTime(midpoint));
    const quadratic = boxCellQuadratic(geometry, cell);
    const leftRelation = quadraticSignAtRational(quadratic, left);
    if (leftRelation <= 0 && compareRationals(left, ZERO_RATIONAL) > 0) {
      const time = rationalTime(left);
      return materializeSphereBoxEvent(
        geometry,
        target,
        translation,
        time,
      );
    }
    const event = proveQuadraticEvent(quadratic, left, right);
    if (event !== null && event.kind !== "initial") {
      return materializeSphereBoxEvent(
        geometry,
        target,
        translation,
        event.time,
      );
    }
  }
  return null;
}

function proveSphereSweepFromZero(
  offset: ExactVector3,
  motion: ExactVector3,
  radius: ExactDyadic,
): ExactSphereSweepEvent3D | null {
  const quadratic = sphereSweepQuadratic(offset, motion, radius);
  if (dyadicSign(quadratic.c) <= 0) {
    return { kind: "initial", time: ZERO_TIME };
  }
  if (dyadicSign(quadratic.a) <= 0) return null;
  const discriminantSign = quadraticDiscriminantSign(quadratic);
  if (discriminantSign < 0) return null;
  const time = quadraticRoot(quadratic, "lower");
  if (
    time === null ||
    compareExactTimes(time, ZERO_TIME) < 0
  ) return null;
  return {
    kind: discriminantSign === 0 ? "tangent" : "crossing",
    time,
  };
}

function proveQuadraticEvent(
  quadratic: ExactQuadratic,
  minimum: ExactRational,
  maximum: ExactRational,
): ExactSphereSweepEvent3D | null {
  if (quadraticSignAtRational(quadratic, minimum) <= 0) {
    return { kind: "initial", time: rationalTime(minimum) };
  }
  if (dyadicSign(quadratic.a) <= 0) return null;
  const discriminantSign = quadraticDiscriminantSign(quadratic);
  if (discriminantSign < 0) return null;
  const time = quadraticRoot(quadratic, "lower");
  if (
    time === null ||
    compareExactTimes(time, rationalTime(minimum)) < 0 ||
    compareExactTimes(time, rationalTime(maximum)) > 0
  ) return null;
  return {
    kind: discriminantSign === 0 ? "tangent" : "crossing",
    time,
  };
}

function sphereSweepQuadratic(
  offset: ExactVector3,
  motion: ExactVector3,
  radius: ExactDyadic,
): ExactQuadratic {
  return exactQuadratic(
    dyadicDot3(motion, motion),
    dyadicMultiply(TWO_DYADIC, dyadicDot3(offset, motion)),
    dyadicSubtract(dyadicDot3(offset, offset), dyadicSquare(radius)),
  );
}

function exactSphereBoxGeometry(
  moving: PreparedSphere3D,
  translation: ArrayLike<number>,
  target: PreparedBox3D,
): ExactSphereBoxGeometry {
  const worldOffset = exactVector3Difference(moving.center, target.center);
  const worldMotion = exactVector3FromNumbers(translation);
  const localOrigin = [0, 1, 2].map((axis) =>
    dyadicDot3(worldOffset, exactVector3FromNumbers(
      target.axes.subarray(axis * 3, axis * 3 + 3),
    ))
  ) as unknown as ExactVector3;
  const localMotion = [0, 1, 2].map((axis) =>
    dyadicDot3(worldMotion, exactVector3FromNumbers(
      target.axes.subarray(axis * 3, axis * 3 + 3),
    ))
  ) as unknown as ExactVector3;
  return {
    origin: localOrigin,
    motion: localMotion,
    halfExtents: exactVector3FromNumbers(target.halfExtents),
    radius: dyadicFromNumber(moving.radius),
    translationSquared: dyadicDot3(worldMotion, worldMotion),
  };
}

function sphereBoxBreakpoints(
  geometry: ExactSphereBoxGeometry,
): ExactRational[] {
  const breakpoints = [ZERO_RATIONAL, ONE_RATIONAL];
  for (let axis = 0; axis < 3; axis += 1) {
    for (const sign of [-1, 1] as const) {
      const bound = sign < 0
        ? dyadicNegate(geometry.halfExtents[axis])
        : geometry.halfExtents[axis];
      const time = exactSlabTime(
        geometry.origin[axis],
        geometry.motion[axis],
        bound,
      );
      if (
        time !== null &&
        compareRationals(time, ZERO_RATIONAL) > 0 &&
        compareRationals(time, ONE_RATIONAL) < 0
      ) insertExactSlabBreakpoint(breakpoints, time);
    }
  }
  return breakpoints;
}

function classifyBoxCell(
  geometry: ExactSphereBoxGeometry,
  time: ExactTime,
): BoxCell {
  const classifyAxis = (axis: number): -1 | 0 | 1 => {
    const aboveUpper = affineSignAtExactTime(
      dyadicSubtract(geometry.origin[axis], geometry.halfExtents[axis]),
      geometry.motion[axis],
      time,
    );
    if (aboveUpper > 0) return 1;
    const belowLower = affineSignAtExactTime(
      dyadicAdd(geometry.origin[axis], geometry.halfExtents[axis]),
      geometry.motion[axis],
      time,
    );
    return belowLower < 0 ? -1 : 0;
  };
  return [classifyAxis(0), classifyAxis(1), classifyAxis(2)];
}

function boxCellQuadratic(
  geometry: ExactSphereBoxGeometry,
  cell: BoxCell,
): ExactQuadratic {
  let a = ZERO_DYADIC;
  let b = ZERO_DYADIC;
  let c = dyadicNegate(dyadicSquare(geometry.radius));
  for (let axis = 0; axis < 3; axis += 1) {
    const sign = cell[axis];
    if (sign === 0) continue;
    const bound = sign < 0
      ? dyadicNegate(geometry.halfExtents[axis])
      : geometry.halfExtents[axis];
    const offset = dyadicSubtract(geometry.origin[axis], bound);
    const slope = geometry.motion[axis];
    a = dyadicAdd(a, dyadicSquare(slope));
    b = dyadicAdd(
      b,
      dyadicMultiply(TWO_DYADIC, dyadicMultiply(offset, slope)),
    );
    c = dyadicAdd(c, dyadicSquare(offset));
  }
  return exactQuadratic(a, b, c);
}

function materializeSphereBoxEvent(
  geometry: ExactSphereBoxGeometry,
  target: PreparedBox3D,
  translation: ArrayLike<number>,
  time: ExactTime,
): AnalyticCastCandidate3D | null {
  const projectedTime = projectExactTime(time);
  const distance = projectScaledExactTime(time, geometry.translationSquared);
  return projectedTime === null || distance === null
    ? null
    : materializeSphereBoxCandidate(
        geometry,
        target,
        translation,
        time,
        distance,
        projectedTime,
        true,
      );
}

function materializeSphereBoxCandidate(
  geometry: ExactSphereBoxGeometry,
  target: PreparedBox3D,
  translation: ArrayLike<number>,
  time: ExactTime,
  distance: number,
  projectedTime: number,
  exactContact: boolean,
): AnalyticCastCandidate3D | null {
  let cell = classifyBoxCell(geometry, time);
  const inside = cell[0] === 0 && cell[1] === 0 && cell[2] === 0;
  if (inside) {
    cell = nearestInsideFaceCell(geometry, time);
  }
  const localPoint = [0, 1, 2].map((axis): ExactAffineCoordinate => {
    const sign = cell[axis];
    if (sign === 0) {
      return {
        offset: geometry.origin[axis],
        slope: geometry.motion[axis],
      };
    }
    return {
      offset: sign < 0
        ? dyadicNegate(geometry.halfExtents[axis])
        : geometry.halfExtents[axis],
      slope: ZERO_DYADIC,
    };
  }) as [ExactAffineCoordinate, ExactAffineCoordinate, ExactAffineCoordinate];
  const localRadialOffset = [0, 1, 2].map((axis) =>
    cell[axis] === 0
      ? ZERO_DYADIC
      : dyadicSubtract(geometry.origin[axis], localPoint[axis]!.offset)
  ) as unknown as ExactVector3;
  const localRadialSlope = [0, 1, 2].map((axis) =>
    cell[axis] === 0 ? ZERO_DYADIC : geometry.motion[axis]
  ) as unknown as ExactVector3;
  const localNormal = inside
    ? [cell[0], cell[1], cell[2]] as const
    : exactContact
      ? materializeUnitAffineVector3(
          localRadialOffset,
          localRadialSlope,
          time,
          geometry.radius,
        )
      : materializeNormalizedExactVector3(localRadialOffset);
  if (localNormal === null) return null;
  let worldNormal = normalizeProjectedNormal(
    target.axes[0]! * localNormal[0] +
      target.axes[3]! * localNormal[1] +
      target.axes[6]! * localNormal[2],
    target.axes[1]! * localNormal[0] +
      target.axes[4]! * localNormal[1] +
      target.axes[7]! * localNormal[2],
    target.axes[2]! * localNormal[0] +
      target.axes[5]! * localNormal[1] +
      target.axes[8]! * localNormal[2],
  );
  if (worldNormal === null) return null;
  if (projectedTime === 0) {
    worldNormal = orientAgainstMotion(worldNormal, translation);
  }
  const point = materializeBoxPointWorld(target, localPoint, time);
  if (point === null) return null;
  return finiteCandidate({
    pointX: point[0],
    pointY: point[1],
    pointZ: point[2],
    normalX: worldNormal[0],
    normalY: worldNormal[1],
    normalZ: worldNormal[2],
    distance,
    timeOfImpact: projectedTime,
  });
}

function materializeUnitAffineVector3(
  offset: ExactVector3,
  motion: ExactVector3,
  time: ExactTime,
  length: ExactDyadic,
): readonly [number, number, number] | null {
  const x = projectAffineRatioAtExactTime(offset[0], motion[0], time, length);
  const y = projectAffineRatioAtExactTime(offset[1], motion[1], time, length);
  const z = projectAffineRatioAtExactTime(offset[2], motion[2], time, length);
  return x === null || y === null || z === null
    ? null
    : [cleanZero(x), cleanZero(y), cleanZero(z)];
}

function nearestInsideFaceCell(
  geometry: ExactSphereBoxGeometry,
  time: ExactTime,
): BoxCell {
  let selectedFeature = 0;
  let selectedDepth: ExactAffineCoordinate = {
    offset: dyadicAdd(geometry.origin[0], geometry.halfExtents[0]),
    slope: geometry.motion[0],
  };
  for (let feature = 1; feature < 6; feature += 1) {
    const axis = Math.floor(feature / 2);
    const positive = (feature & 1) === 1;
    const depth: ExactAffineCoordinate = positive
      ? {
          offset: dyadicSubtract(
            geometry.halfExtents[axis],
            geometry.origin[axis],
          ),
          slope: dyadicNegate(geometry.motion[axis]),
        }
      : {
          offset: dyadicAdd(
            geometry.origin[axis],
            geometry.halfExtents[axis],
          ),
          slope: geometry.motion[axis],
        };
    if (compareAffinesAtTime(depth, selectedDepth, time) < 0) {
      selectedDepth = depth;
      selectedFeature = feature;
    }
  }
  const cell: [-1 | 0 | 1, -1 | 0 | 1, -1 | 0 | 1] = [0, 0, 0];
  cell[Math.floor(selectedFeature / 2)] = (selectedFeature & 1) === 0 ? -1 : 1;
  return cell;
}

function compareAffinesAtTime(
  first: ExactAffineCoordinate,
  second: ExactAffineCoordinate,
  time: ExactTime,
): -1 | 0 | 1 {
  return affineSignAtExactTime(
    dyadicSubtract(first.offset, second.offset),
    dyadicSubtract(first.slope, second.slope),
    time,
  );
}

function materializeBoxPointWorld(
  target: PreparedBox3D,
  localPoint: readonly [
    ExactAffineCoordinate,
    ExactAffineCoordinate,
    ExactAffineCoordinate,
  ],
  time: ExactTime,
): readonly [number, number, number] | null {
  const result: number[] = [];
  for (let worldAxis = 0; worldAxis < 3; worldAxis += 1) {
    let offset = dyadicFromNumber(target.center[worldAxis]!);
    let slope = ZERO_DYADIC;
    for (let localAxis = 0; localAxis < 3; localAxis += 1) {
      const axisValue = dyadicFromNumber(
        target.axes[localAxis * 3 + worldAxis]!,
      );
      offset = dyadicAdd(
        offset,
        dyadicMultiply(axisValue, localPoint[localAxis].offset),
      );
      slope = dyadicAdd(
        slope,
        dyadicMultiply(axisValue, localPoint[localAxis].slope),
      );
    }
    const projected = projectAffineAtExactTime(offset, slope, time);
    if (projected === null) return null;
    result.push(cleanZero(projected));
  }
  return [result[0]!, result[1]!, result[2]!];
}

function sphereSphereCandidate(
  target: PreparedSphere3D,
  normal: readonly [number, number, number],
  distance: number,
  timeOfImpact: number,
): AnalyticCastCandidate3D | null {
  return finiteCandidate({
    pointX: target.center[0]! + normal[0] * target.radius,
    pointY: target.center[1]! + normal[1] * target.radius,
    pointZ: target.center[2]! + normal[2] * target.radius,
    normalX: normal[0],
    normalY: normal[1],
    normalZ: normal[2],
    distance,
    timeOfImpact,
  });
}

function normalizeExactVectorAgainstMotion(
  vector: ExactVector3,
  motion: ArrayLike<number>,
): readonly [number, number, number] | null {
  const normalized = materializeNormalizedExactVector3(vector);
  if (normalized !== null) return orientAgainstMotion(normalized, motion);
  const fallback = normalizeScaleSafe(
    -motion[0]!,
    -motion[1]!,
    -motion[2]!,
  );
  return fallback ?? [1, 0, 0];
}

function materializeNormalizedExactVector3(
  vector: ExactVector3,
): readonly [number, number, number] | null {
  const squaredLength = dyadicDot3(vector, vector);
  if (dyadicSign(squaredLength) === 0) return null;
  const x = projectDyadicNormalizedComponent(vector[0], squaredLength);
  const y = projectDyadicNormalizedComponent(vector[1], squaredLength);
  const z = projectDyadicNormalizedComponent(vector[2], squaredLength);
  return x === null || y === null || z === null
    ? null
    : [cleanZero(x), cleanZero(y), cleanZero(z)];
}

function orientAgainstMotion(
  normal: readonly [number, number, number],
  motion: ArrayLike<number>,
): readonly [number, number, number] {
  const projection =
    normal[0] * motion[0]! +
    normal[1] * motion[1]! +
    normal[2] * motion[2]!;
  return projection > 0
    ? [-normal[0], -normal[1], -normal[2]]
    : normal;
}

function normalizeProjectedNormal(
  x: number,
  y: number,
  z: number,
): readonly [number, number, number] | null {
  const length = Math.hypot(x, y, z);
  if (!Number.isFinite(length) || length === 0) return null;
  return [
    cleanZero(x / length),
    cleanZero(y / length),
    cleanZero(z / length),
  ];
}

function normalizeScaleSafe(
  x: number,
  y: number,
  z: number,
): readonly [number, number, number] | null {
  const scale = Math.max(Math.abs(x), Math.abs(y), Math.abs(z));
  if (!Number.isFinite(scale) || scale === 0) return null;
  const scaledX = x / scale;
  const scaledY = y / scale;
  const scaledZ = z / scale;
  const length = Math.hypot(scaledX, scaledY, scaledZ);
  if (!Number.isFinite(length) || length === 0) return null;
  return [
    cleanZero(scaledX / length),
    cleanZero(scaledY / length),
    cleanZero(scaledZ / length),
  ];
}

function finiteCandidate(
  candidate: AnalyticCastCandidate3D,
): AnalyticCastCandidate3D | null {
  return [
    candidate.pointX,
    candidate.pointY,
    candidate.pointZ,
    candidate.normalX,
    candidate.normalY,
    candidate.normalZ,
    candidate.distance,
    candidate.timeOfImpact,
  ].every(Number.isFinite)
    ? candidate
    : null;
}

function isFiniteVector(value: ArrayLike<number>): boolean {
  return Number.isFinite(value[0]!) &&
    Number.isFinite(value[1]!) &&
    Number.isFinite(value[2]!);
}

function cleanZero(value: number): number {
  return value === 0 ? 0 : value;
}
