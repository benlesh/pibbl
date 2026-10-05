import type {
  CRCPhysicsAabb2D,
  CRCPhysicsMassProperties2D,
  CRCPhysicsPose2D,
  CRCPhysicsShape2D,
  CRCPhysicsTransform2D,
  CRCPhysicsVector2,
} from '../../2d-geometry.js';
import {
  copyFiniteVector2,
  requireFiniteNumber,
  requireNonnegativeNumber,
  requirePositiveNumber,
} from '../shared/validation.js';
import {
  CURVE_FLATTENING_MAX_DEPTH,
  CURVE_FLATTENING_TOLERANCE,
  IDENTITY_POSE_2D,
  canonicalizeContour2D,
  cleanZero,
  composePose2D,
  copyPose2D,
  freezeBounds2D,
  polygonMassData2D,
  transformPointInto,
  triangulateContour2D,
  type InternalPose2D,
} from './math.js';
import { DEGREES_TO_RADIANS, GEOMETRY_EPSILON } from './numeric-policy.js';
import {
  createShape2D,
  requireShapeRecord2D,
  type CapsuleLeaf2D,
  type ConvexLeaf2D,
  type PolygonLeaf2D,
} from './shape-records.js';

const FULL_TURN_RADIANS = Math.PI * 2;

/**
 * Creates an immutable circle collision shape without initializing a physics world.
 *
 * @param input - Circle radius and optional center. See {@link CRCPhysicsVector2}.
 * @returns An immutable circle collision shape. See {@link CRCPhysicsShape2D}.
 *
 * @see {@link CRCPhysicsVector2}
 * @see {@link CRCPhysicsShape2D}
 */
export function circleShape2D(
  input: Readonly<{ radius: number; center?: CRCPhysicsVector2 }>,
): CRCPhysicsShape2D {
  const radius = requirePositiveNumber(input.radius, 'circle.radius');
  const center = ownedVector(input.center ?? [0, 0], 'circle.center');
  const area = Math.PI * radius * radius;
  return createShapeFromLeaves(
    [Object.freeze({ kind: 'circle', center, radius, canonicalLeafIndex: 0 })],
    area,
    center[0]!,
    center[1]!,
    area * radius * radius / 2,
  );
}

/**
 * Creates an immutable ellipse collision shape without initializing a physics world.
 *
 * @param input - Ellipse radii, optional center, and rotation in degrees. See
 * {@link CRCPhysicsVector2} .
 * @returns An immutable ellipse collision shape. See {@link CRCPhysicsShape2D}.
 *
 * @see {@link CRCPhysicsVector2}
 * @see {@link CRCPhysicsShape2D}
 */
export function ellipseShape2D(
  input: Readonly<{
    radiusX: number;
    radiusY: number;
    center?: CRCPhysicsVector2;
    rotationDegrees?: number;
  }>,
): CRCPhysicsShape2D {
  const radiusX = requirePositiveNumber(input.radiusX, 'ellipse.radiusX');
  const radiusY = requirePositiveNumber(input.radiusY, 'ellipse.radiusY');
  const center = ownedVector(input.center ?? [0, 0], 'ellipse.center');
  const rotationRadians =
    requireFiniteNumber(input.rotationDegrees ?? 0, 'ellipse.rotationDegrees') *
    DEGREES_TO_RADIANS;
  const area = Math.PI * radiusX * radiusY;
  return createShapeFromLeaves(
    [Object.freeze({ kind: 'ellipse', center, radiusX, radiusY, rotationRadians, canonicalLeafIndex: 0 })],
    area,
    center[0]!,
    center[1]!,
    area * (radiusX * radiusX + radiusY * radiusY) / 4,
  );
}

/**
 * Creates an immutable box collision shape without initializing a physics world.
 *
 * @param input - Box width, height, and optional center. See {@link CRCPhysicsVector2}.
 * @returns An immutable box collision shape. See {@link CRCPhysicsShape2D}.
 *
 * @see {@link CRCPhysicsVector2}
 * @see {@link CRCPhysicsShape2D}
 */
export function boxShape2D(
  input: Readonly<{
    width: number;
    height: number;
    center?: CRCPhysicsVector2;
  }>,
): CRCPhysicsShape2D {
  const width = requirePositiveNumber(input.width, 'box.width');
  const height = requirePositiveNumber(input.height, 'box.height');
  const center = ownedVector(input.center ?? [0, 0], 'box.center');
  const area = width * height;
  return createShapeFromLeaves(
    [Object.freeze({ kind: 'box', center, halfWidth: width / 2, halfHeight: height / 2, canonicalLeafIndex: 0 })],
    area,
    center[0]!,
    center[1]!,
    area * (width * width + height * height) / 12,
  );
}

/**
 * Creates an immutable rounded box collision shape without initializing a physics world.
 *
 * @param input - Box dimensions, center, and uniform or per-corner radii. See
 * {@link CRCPhysicsVector2} .
 * @returns An immutable rounded-box collision shape. See {@link CRCPhysicsShape2D}.
 *
 * @see {@link CRCPhysicsVector2}
 * @see {@link CRCPhysicsShape2D}
 */
export function roundedBoxShape2D(
  input: Readonly<{
    width: number;
    height: number;
    radius:
      | number
      | readonly [
          topLeft: number,
          topRight: number,
          bottomRight: number,
          bottomLeft: number,
        ];
    center?: CRCPhysicsVector2;
  }>,
): CRCPhysicsShape2D {
  const width = requirePositiveNumber(input.width, 'roundedBox.width');
  const height = requirePositiveNumber(input.height, 'roundedBox.height');
  const center = ownedVector(input.center ?? [0, 0], 'roundedBox.center');
  const sourceRadii = typeof input.radius === 'number'
    ? [input.radius, input.radius, input.radius, input.radius] as const
    : input.radius;
  const radii = new Float64Array(4);
  const maximum = Math.min(width, height) / 2;
  for (let index = 0; index < radii.length; index += 1) {
    const radius = requireNonnegativeNumber(
      sourceRadii[index]!,
      `roundedBox.radius[${index}]`,
    );
    if (radius > maximum) {
      throw new RangeError(
        `roundedBox.radius[${index}] must not exceed ${String(maximum)}; received ${String(radius)}.`,
      );
    }
    radii[index] = radius;
  }
  const contour = roundedBoxContour(width / 2, height / 2, radii, center);
  const mass = polygonMassData2D(contour);
  return createShapeFromLeaves(
    [Object.freeze({
      kind: 'rounded-box',
      center,
      halfWidth: width / 2,
      halfHeight: height / 2,
      radii,
      canonicalLeafIndex: 0,
    })],
    mass.area,
    mass.centroidX,
    mass.centroidY,
    mass.unitInertia,
  );
}

/**
 * Creates an immutable capsule collision shape without initializing a physics world.
 *
 * @param input - Capsule centerline endpoints and radius. See {@link CRCPhysicsVector2}.
 * @returns An immutable capsule collision shape. See {@link CRCPhysicsShape2D}.
 *
 * @see {@link CRCPhysicsVector2}
 * @see {@link CRCPhysicsShape2D}
 */
export function capsuleShape2D(
  input: Readonly<{
    start: CRCPhysicsVector2;
    end: CRCPhysicsVector2;
    radius: number;
  }>,
): CRCPhysicsShape2D {
  const start = ownedVector(input.start, 'capsule.start');
  const end = ownedVector(input.end, 'capsule.end');
  const radius = requirePositiveNumber(input.radius, 'capsule.radius');
  const leaf: CapsuleLeaf2D = Object.freeze({
    kind: 'capsule', start, end, radius, canonicalLeafIndex: 0,
  });
  const mass = capsuleMassData(start, end, radius);
  return createShapeFromLeaves(
    [leaf],
    mass.area,
    mass.centroidX,
    mass.centroidY,
    mass.unitInertia,
  );
}

/**
 * Creates an immutable arc collision shape without initializing a physics world.
 *
 * @param input - Arc center, radius, angular endpoints in radians, sweep direction, and thickness.
 * See {@link CRCPhysicsVector2} .
 * @returns An immutable thick-arc collision shape. See {@link CRCPhysicsShape2D}.
 *
 * @see {@link CRCPhysicsVector2}
 * @see {@link CRCPhysicsShape2D}
 */
export function arcShape2D(
  input: Readonly<{
    center?: CRCPhysicsVector2;
    radius: number;
    startAngleRadians: number;
    endAngleRadians: number;
    counterclockwise?: boolean;
    thickness: number;
  }>,
): CRCPhysicsShape2D {
  const center = ownedVector(input.center ?? [0, 0], 'arc.center');
  const radius = requirePositiveNumber(input.radius, 'arc.radius');
  const startAngle = requireFiniteNumber(input.startAngleRadians, 'arc.startAngleRadians');
  const endAngle = requireFiniteNumber(input.endAngleRadians, 'arc.endAngleRadians');
  const thickness = requirePositiveNumber(input.thickness, 'arc.thickness');
  const points = flattenCircularSweep(
    center[0]!, center[1]!, radius, startAngle, endAngle, input.counterclockwise === true,
  );
  return chainFromOwnedPoints(points, false, thickness / 2);
}

/**
 * Creates an immutable wedge collision shape without initializing a physics world.
 *
 * @param input - Wedge center, radius, angular endpoints in radians, and sweep direction. See
 * {@link CRCPhysicsVector2} .
 * @returns An immutable wedge collision shape. See {@link CRCPhysicsShape2D}.
 *
 * @see {@link CRCPhysicsVector2}
 * @see {@link CRCPhysicsShape2D}
 */
export function wedgeShape2D(
  input: Readonly<{
    center?: CRCPhysicsVector2;
    radius: number;
    startAngleRadians: number;
    endAngleRadians: number;
    counterclockwise?: boolean;
  }>,
): CRCPhysicsShape2D {
  const center = ownedVector(input.center ?? [0, 0], 'wedge.center');
  const radius = requirePositiveNumber(input.radius, 'wedge.radius');
  const startAngle = requireFiniteNumber(input.startAngleRadians, 'wedge.startAngleRadians');
  const endAngle = requireFiniteNumber(input.endAngleRadians, 'wedge.endAngleRadians');
  const points = flattenCircularSweep(
    center[0]!, center[1]!, radius, startAngle, endAngle, input.counterclockwise === true,
  );
  const sweep = directedSweep(startAngle, endAngle, input.counterclockwise === true);
  if (Math.abs(sweep) <= GEOMETRY_EPSILON) {
    throw new RangeError('wedge angles must describe a nonzero sweep.');
  }
  const contourSource: CRCPhysicsVector2[] = Math.abs(sweep) >= FULL_TURN_RADIANS
    ? points.slice(0, -1).map(asReadonlyVector)
    : [asReadonlyVector(center), ...points.map(asReadonlyVector)];
  const contour = canonicalizeContour2D(contourSource, {
    strictlyConvex: false,
    path: 'wedge.contour',
  });
  const triangles = triangulateContour2D(contour);
  const leaves = triangles.map<PolygonLeaf2D>((vertices, canonicalLeafIndex) =>
    Object.freeze({ kind: 'polygon', vertices, canonicalLeafIndex }),
  );
  const mass = aggregateLeafMass(leaves);
  return createShapeFromLeaves(
    leaves,
    mass.area,
    mass.centroidX,
    mass.centroidY,
    mass.unitInertia,
  );
}

/**
 * Creates an immutable segment collision shape without initializing a physics world.
 *
 * @param input - Segment endpoints. See {@link CRCPhysicsVector2}.
 * @returns An immutable line-segment collision shape. See {@link CRCPhysicsShape2D}.
 *
 * @see {@link CRCPhysicsVector2}
 * @see {@link CRCPhysicsShape2D}
 */
export function segmentShape2D(
  input: Readonly<{ start: CRCPhysicsVector2; end: CRCPhysicsVector2 }>,
): CRCPhysicsShape2D {
  const start = ownedVector(input.start, 'segment.start');
  const end = ownedVector(input.end, 'segment.end');
  return createShapeFromLeaves(
    [Object.freeze({ kind: 'segment', start, end, canonicalLeafIndex: 0 })],
    0,
    (start[0]! + end[0]!) / 2,
    (start[1]! + end[1]!) / 2,
    0,
  );
}

/**
 * Creates an immutable chain collision shape without initializing a physics world.
 *
 * @param input - Ordered chain points, closure policy, and optional radius. See
 * {@link CRCPhysicsVector2} .
 * @returns An immutable chain collision shape. See {@link CRCPhysicsShape2D}.
 *
 * @see {@link CRCPhysicsVector2}
 * @see {@link CRCPhysicsShape2D}
 */
export function chainShape2D(
  input: Readonly<{
    points: readonly CRCPhysicsVector2[];
    closed?: boolean;
    radius?: number;
  }>,
): CRCPhysicsShape2D {
  if (input.points.length < 2) {
    throw new RangeError('chain.points must contain at least two points.');
  }
  const points = input.points.map((point, index) =>
    ownedVector(point, `chain.points[${index}]`),
  );
  const radius = requireNonnegativeNumber(input.radius ?? 0, 'chain.radius');
  return chainFromOwnedPoints(points, input.closed === true, radius);
}

/**
 * Creates an immutable polygon collision shape without initializing a physics world.
 *
 * @param input - Ordered polygon vertices. See {@link CRCPhysicsVector2}.
 * @returns An immutable polygon collision shape. See {@link CRCPhysicsShape2D}.
 *
 * @see {@link CRCPhysicsVector2}
 * @see {@link CRCPhysicsShape2D}
 */
export function polygonShape2D(
  input: Readonly<{ points: readonly CRCPhysicsVector2[] }>,
): CRCPhysicsShape2D {
  const vertices = canonicalizeContour2D(input.points, {
    strictlyConvex: true,
    path: 'polygon.points',
  });
  const mass = polygonMassData2D(vertices);
  return createShapeFromLeaves(
    [Object.freeze({ kind: 'polygon', vertices, canonicalLeafIndex: 0 })],
    mass.area,
    mass.centroidX,
    mass.centroidY,
    mass.unitInertia,
  );
}

/**
 * Computes axis-aligned bounds for an immutable shape at an optional pose.
 *
 * @param shape - Shape whose bounds are needed. See {@link CRCPhysicsShape2D}.
 * @param pose - Optional pose at which to evaluate the shape. See {@link CRCPhysicsPose2D}.
 * @returns Axis-aligned bounds of the posed shape. See {@link CRCPhysicsAabb2D}.
 *
 * @see {@link CRCPhysicsShape2D}
 * @see {@link CRCPhysicsPose2D}
 * @see {@link CRCPhysicsAabb2D}
 */
export function boundsOfShape2D(
  shape: CRCPhysicsShape2D,
  pose?: CRCPhysicsPose2D,
): CRCPhysicsAabb2D {
  const record = requireShapeRecord2D(shape);
  const outerPose = copyPose2D(pose, 'pose');
  return boundsForLeaves(record.leaves, composePose2D(outerPose, record.localPose));
}

/**
 * Computes shape area, centroid, mass, and rotational inertia at the requested density.
 *
 * @param shape - Shape whose mass properties are needed. See {@link CRCPhysicsShape2D}.
 * @param options - Optional material density.
 * @returns Mass, center of mass, and inertia for the shape. See {@link CRCPhysicsMassProperties2D}
 * .
 *
 * @see {@link CRCPhysicsShape2D}
 * @see {@link CRCPhysicsMassProperties2D}
 */
export function massProperties2D(
  shape: CRCPhysicsShape2D,
  options?: Readonly<{ density?: number }>,
): CRCPhysicsMassProperties2D {
  const record = requireShapeRecord2D(shape);
  const density = requirePositiveNumber(options?.density ?? 1, 'options.density');
  const transformedCentroid = new Float64Array(2);
  transformPointInto(
    transformedCentroid,
    0,
    record.centroidX,
    record.centroidY,
    record.localPose,
  );
  return Object.freeze({
    area: cleanZero(record.area),
    centroid: Object.freeze([
      cleanZero(transformedCentroid[0]!),
      cleanZero(transformedCentroid[1]!),
    ] as const),
    mass: cleanZero(record.area * density),
    rotationalInertia: cleanZero(record.unitInertia * density),
  });
}

/**
 * Returns independent shape geometry transformed by a rigid 2D pose.
 *
 * @param shape - Source shape; it is not modified. See {@link CRCPhysicsShape2D}.
 * @param transform - Transform to apply to the shape. See {@link CRCPhysicsTransform2D}.
 * @returns A shape containing the transformed geometry. See {@link CRCPhysicsShape2D}.
 *
 * @see {@link CRCPhysicsShape2D}
 * @see {@link CRCPhysicsTransform2D}
 */
export function transformShape2D(
  shape: CRCPhysicsShape2D,
  transform: CRCPhysicsTransform2D,
): CRCPhysicsShape2D {
  const source = requireShapeRecord2D(shape);
  const localPose = composePose2D(copyPose2D(transform, 'transform'), source.localPose);
  const localBounds = mutableBoundsForLeaves(source.leaves, localPose);
  return createShape2D({
    leaves: source.leaves,
    localPose,
    localBounds,
    area: source.area,
    centroidX: source.centroidX,
    centroidY: source.centroidY,
    unitInertia: source.unitInertia,
  });
}

function createShapeFromLeaves(
  leaves: readonly ConvexLeaf2D[],
  area: number,
  centroidX: number,
  centroidY: number,
  unitInertia: number,
): CRCPhysicsShape2D {
  return createShape2D({
    leaves,
    localBounds: mutableBoundsForLeaves(leaves, IDENTITY_POSE_2D),
    area,
    centroidX,
    centroidY,
    unitInertia: Math.max(0, unitInertia),
  });
}

function chainFromOwnedPoints(
  points: readonly Float64Array[],
  closed: boolean,
  radius: number,
): CRCPhysicsShape2D {
  const segmentCount = points.length === 1 ? 0 : points.length - 1 + (closed ? 1 : 0);
  const leaves: ConvexLeaf2D[] = [];
  for (let index = 0; index < segmentCount; index += 1) {
    const start = points[index]!;
    const end = points[(index + 1) % points.length]!;
    leaves.push(Object.freeze(radius === 0
      ? { kind: 'segment', start, end, canonicalLeafIndex: index }
      : { kind: 'capsule', start, end, radius, canonicalLeafIndex: index }));
  }
  if (leaves.length === 0) {
    const point = points[0]!;
    const area = Math.PI * radius * radius;
    leaves.push(Object.freeze({
      kind: 'circle', center: point, radius, canonicalLeafIndex: 0,
    }));
    return createShapeFromLeaves(
      leaves,
      area,
      point[0]!,
      point[1]!,
      area * radius * radius / 2,
    );
  }
  if (radius > 0) {
    const mass = aggregateLeafMass(leaves);
    return createShapeFromLeaves(
      leaves,
      mass.area,
      mass.centroidX,
      mass.centroidY,
      mass.unitInertia,
    );
  }
  const centroid = lineCentroid(points, closed);
  return createShapeFromLeaves(leaves, 0, centroid[0], centroid[1], 0);
}

function boundsForLeaves(
  leaves: readonly ConvexLeaf2D[],
  pose: InternalPose2D,
): CRCPhysicsAabb2D {
  const bounds = mutableBoundsForLeaves(leaves, pose);
  return freezeBounds2D(bounds[0]!, bounds[1]!, bounds[2]!, bounds[3]!);
}

function mutableBoundsForLeaves(
  leaves: readonly ConvexLeaf2D[],
  pose: InternalPose2D,
): Float64Array {
  const result = new Float64Array([
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ]);
  const point = new Float64Array(2);
  const include = (x: number, y: number, radius = 0): void => {
    transformPointInto(point, 0, x, y, pose);
    result[0] = Math.min(result[0]!, point[0]! - radius);
    result[1] = Math.min(result[1]!, point[1]! - radius);
    result[2] = Math.max(result[2]!, point[0]! + radius);
    result[3] = Math.max(result[3]!, point[1]! + radius);
  };
  for (const leaf of leaves) {
    switch (leaf.kind) {
      case 'circle':
        include(leaf.center[0]!, leaf.center[1]!, leaf.radius);
        break;
      case 'ellipse': {
        transformPointInto(point, 0, leaf.center[0]!, leaf.center[1]!, pose);
        const angle = pose.rotationRadians + leaf.rotationRadians;
        const cosine = Math.cos(angle);
        const sine = Math.sin(angle);
        const extentX = Math.hypot(leaf.radiusX * cosine, leaf.radiusY * sine);
        const extentY = Math.hypot(leaf.radiusX * sine, leaf.radiusY * cosine);
        result[0] = Math.min(result[0]!, point[0]! - extentX);
        result[1] = Math.min(result[1]!, point[1]! - extentY);
        result[2] = Math.max(result[2]!, point[0]! + extentX);
        result[3] = Math.max(result[3]!, point[1]! + extentY);
        break;
      }
      case 'box':
        includeBoxCorners(leaf.center, leaf.halfWidth, leaf.halfHeight, pose, result, point);
        break;
      case 'rounded-box':
        includeRoundedBoxBounds(leaf, pose, result, point);
        break;
      case 'capsule':
        include(leaf.start[0]!, leaf.start[1]!, leaf.radius);
        include(leaf.end[0]!, leaf.end[1]!, leaf.radius);
        break;
      case 'segment':
        include(leaf.start[0]!, leaf.start[1]!);
        include(leaf.end[0]!, leaf.end[1]!);
        break;
      case 'polygon':
        for (let offset = 0; offset < leaf.vertices.length; offset += 2) {
          include(leaf.vertices[offset]!, leaf.vertices[offset + 1]!);
        }
        break;
    }
  }
  return result;
}

function includeBoxCorners(
  center: Float64Array,
  halfWidth: number,
  halfHeight: number,
  pose: InternalPose2D,
  bounds: Float64Array,
  point: Float64Array,
): void {
  for (const xSign of [-1, 1]) {
    for (const ySign of [-1, 1]) {
      transformPointInto(
        point,
        0,
        center[0]! + xSign * halfWidth,
        center[1]! + ySign * halfHeight,
        pose,
      );
      bounds[0] = Math.min(bounds[0]!, point[0]!);
      bounds[1] = Math.min(bounds[1]!, point[1]!);
      bounds[2] = Math.max(bounds[2]!, point[0]!);
      bounds[3] = Math.max(bounds[3]!, point[1]!);
    }
  }
}

function includeRoundedBoxBounds(
  leaf: Extract<ConvexLeaf2D, { kind: 'rounded-box' }>,
  pose: InternalPose2D,
  bounds: Float64Array,
  point: Float64Array,
): void {
  const xSigns = [-1, 1, 1, -1] as const;
  const ySigns = [-1, -1, 1, 1] as const;
  for (let index = 0; index < 4; index += 1) {
    const radius = leaf.radii[index]!;
    transformPointInto(
      point,
      0,
      leaf.center[0]! + xSigns[index]! * (leaf.halfWidth - radius),
      leaf.center[1]! + ySigns[index]! * (leaf.halfHeight - radius),
      pose,
    );
    bounds[0] = Math.min(bounds[0]!, point[0]! - radius);
    bounds[1] = Math.min(bounds[1]!, point[1]! - radius);
    bounds[2] = Math.max(bounds[2]!, point[0]! + radius);
    bounds[3] = Math.max(bounds[3]!, point[1]! + radius);
  }
}

function aggregateLeafMass(leaves: readonly ConvexLeaf2D[]): Readonly<{
  area: number;
  centroidX: number;
  centroidY: number;
  unitInertia: number;
}> {
  const entries = leaves.map(leafMassData);
  const area = entries.reduce((sum, entry) => sum + entry.area, 0);
  if (area === 0) {
    return Object.freeze({ area: 0, centroidX: 0, centroidY: 0, unitInertia: 0 });
  }
  const centroidX = entries.reduce((sum, entry) => sum + entry.area * entry.centroidX, 0) / area;
  const centroidY = entries.reduce((sum, entry) => sum + entry.area * entry.centroidY, 0) / area;
  const unitInertia = entries.reduce((sum, entry) => {
    const dx = entry.centroidX - centroidX;
    const dy = entry.centroidY - centroidY;
    return sum + entry.unitInertia + entry.area * (dx * dx + dy * dy);
  }, 0);
  return Object.freeze({ area, centroidX, centroidY, unitInertia });
}

function leafMassData(leaf: ConvexLeaf2D): Readonly<{
  area: number;
  centroidX: number;
  centroidY: number;
  unitInertia: number;
}> {
  switch (leaf.kind) {
    case 'circle': {
      const area = Math.PI * leaf.radius * leaf.radius;
      return { area, centroidX: leaf.center[0]!, centroidY: leaf.center[1]!, unitInertia: area * leaf.radius * leaf.radius / 2 };
    }
    case 'ellipse': {
      const area = Math.PI * leaf.radiusX * leaf.radiusY;
      return { area, centroidX: leaf.center[0]!, centroidY: leaf.center[1]!, unitInertia: area * (leaf.radiusX * leaf.radiusX + leaf.radiusY * leaf.radiusY) / 4 };
    }
    case 'box': {
      const width = leaf.halfWidth * 2;
      const height = leaf.halfHeight * 2;
      const area = width * height;
      return { area, centroidX: leaf.center[0]!, centroidY: leaf.center[1]!, unitInertia: area * (width * width + height * height) / 12 };
    }
    case 'capsule':
      return capsuleMassData(leaf.start, leaf.end, leaf.radius);
    case 'polygon':
      return polygonMassData2D(leaf.vertices);
    case 'segment':
      return { area: 0, centroidX: (leaf.start[0]! + leaf.end[0]!) / 2, centroidY: (leaf.start[1]! + leaf.end[1]!) / 2, unitInertia: 0 };
    case 'rounded-box': {
      const contour = roundedBoxContour(leaf.halfWidth, leaf.halfHeight, leaf.radii, leaf.center);
      return polygonMassData2D(contour);
    }
  }
}

function capsuleMassData(
  start: Float64Array,
  end: Float64Array,
  radius: number,
): Readonly<{ area: number; centroidX: number; centroidY: number; unitInertia: number }> {
  const dx = end[0]! - start[0]!;
  const dy = end[1]! - start[1]!;
  const length = Math.hypot(dx, dy);
  const rectangleArea = 2 * radius * length;
  const circleArea = Math.PI * radius * radius;
  const area = rectangleArea + circleArea;
  const rectangleInertia = rectangleArea * (length * length + 4 * radius * radius) / 12;
  const capsInertia =
    Math.PI * radius ** 4 / 2 +
    circleArea * length * length / 4 +
    4 * length * radius ** 3 / 3;
  return Object.freeze({
    area,
    centroidX: (start[0]! + end[0]!) / 2,
    centroidY: (start[1]! + end[1]!) / 2,
    unitInertia: rectangleInertia + capsInertia,
  });
}

function lineCentroid(
  points: readonly Float64Array[],
  closed: boolean,
): readonly [number, number] {
  const segmentCount = points.length - 1 + (closed ? 1 : 0);
  let totalLength = 0;
  let weightedX = 0;
  let weightedY = 0;
  for (let index = 0; index < segmentCount; index += 1) {
    const start = points[index]!;
    const end = points[(index + 1) % points.length]!;
    const length = Math.hypot(end[0]! - start[0]!, end[1]! - start[1]!);
    totalLength += length;
    weightedX += length * (start[0]! + end[0]!) / 2;
    weightedY += length * (start[1]! + end[1]!) / 2;
  }
  if (totalLength > 0) {
    return [weightedX / totalLength, weightedY / totalLength];
  }
  return [points.reduce((sum, point) => sum + point[0]!, 0) / points.length, points.reduce((sum, point) => sum + point[1]!, 0) / points.length];
}

function roundedBoxContour(
  halfWidth: number,
  halfHeight: number,
  radii: Float64Array,
  center: Float64Array,
): Float64Array {
  const points: Float64Array[] = [];
  const cornerData = [
    [halfWidth - radii[1]!, -halfHeight + radii[1]!, -Math.PI / 2, 0, radii[1]!],
    [halfWidth - radii[2]!, halfHeight - radii[2]!, 0, Math.PI / 2, radii[2]!],
    [-halfWidth + radii[3]!, halfHeight - radii[3]!, Math.PI / 2, Math.PI, radii[3]!],
    [-halfWidth + radii[0]!, -halfHeight + radii[0]!, Math.PI, 3 * Math.PI / 2, radii[0]!],
  ] as const;
  for (const [x, y, start, end, radius] of cornerData) {
    const cornerPoints = radius === 0
      ? [new Float64Array([center[0]! + x, center[1]! + y])]
      : flattenCircularSweep(center[0]! + x, center[1]! + y, radius, start, end, false);
    points.push(...cornerPoints);
  }
  return canonicalizeContour2D(points.map(asReadonlyVector), {
    strictlyConvex: false,
    path: 'roundedBox.contour',
  });
}

function flattenCircularSweep(
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  counterclockwise: boolean,
): Float64Array[] {
  const sweep = directedSweep(startAngle, endAngle, counterclockwise);
  const points = [pointOnCircle(centerX, centerY, radius, startAngle)];
  appendFlattenedArc(points, centerX, centerY, radius, startAngle, startAngle + sweep, 0);
  if (Math.abs(sweep) >= FULL_TURN_RADIANS) {
    points[points.length - 1] = new Float64Array(points[0]!);
  }
  return points;
}

function appendFlattenedArc(
  output: Float64Array[],
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  depth: number,
): void {
  const middleAngle = (startAngle + endAngle) / 2;
  const halfSweep = Math.abs(endAngle - startAngle) / 2;
  const chordError = radius * (1 - Math.cos(halfSweep));
  if (
    chordError <= CURVE_FLATTENING_TOLERANCE ||
    depth >= CURVE_FLATTENING_MAX_DEPTH
  ) {
    output.push(pointOnCircle(centerX, centerY, radius, endAngle));
    return;
  }
  appendFlattenedArc(output, centerX, centerY, radius, startAngle, middleAngle, depth + 1);
  appendFlattenedArc(output, centerX, centerY, radius, middleAngle, endAngle, depth + 1);
}

function directedSweep(
  startAngle: number,
  endAngle: number,
  counterclockwise: boolean,
): number {
  const raw = endAngle - startAngle;
  if (Math.abs(raw) >= FULL_TURN_RADIANS) {
    return counterclockwise ? -FULL_TURN_RADIANS : FULL_TURN_RADIANS;
  }
  if (counterclockwise) {
    const magnitude = ((-raw % FULL_TURN_RADIANS) + FULL_TURN_RADIANS) % FULL_TURN_RADIANS;
    return -magnitude;
  }
  return ((raw % FULL_TURN_RADIANS) + FULL_TURN_RADIANS) % FULL_TURN_RADIANS;
}

function pointOnCircle(
  centerX: number,
  centerY: number,
  radius: number,
  angle: number,
): Float64Array {
  return new Float64Array([
    centerX + radius * Math.cos(angle),
    centerY + radius * Math.sin(angle),
  ]);
}

function ownedVector(value: CRCPhysicsVector2, path: string): Float64Array {
  const copied = copyFiniteVector2(value, path);
  return new Float64Array(copied);
}

function asReadonlyVector(value: Float64Array): CRCPhysicsVector2 {
  return [value[0]!, value[1]!] as const;
}
