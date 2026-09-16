import type {
  CRCPhysicsAabb3D,
  CRCPhysicsMassProperties3D,
  CRCPhysicsPose3D,
  CRCPhysicsQuaternion,
  CRCPhysicsShape3D,
  CRCPhysicsTransform3D,
  CRCPhysicsVector3,
} from "../../3d-geometry.js";
import { requirePositiveNumber } from "../shared/validation.js";
import {
  IDENTITY_POSE_3D,
  cleanZero,
  composePose3D,
  copyCanonicalQuaternion,
  copyFiniteVector3,
  copyPose3D,
  freezeVector3,
  rotateDiagonalTensor,
  rotationMatrixInto,
  transformPointInto,
  type InternalPose3D,
} from "./math.js";
import { createShape3D, requireShapeRecord3D } from "./shape-records.js";
import { buildCanonicalHull3D } from "./hull.js";

const identityQuaternion: CRCPhysicsQuaternion = [0, 0, 0, 1];
const zeroVector: CRCPhysicsVector3 = [0, 0, 0];

export function sphereShape3D(
  input: Readonly<{
    radius: number;
    center?: CRCPhysicsVector3;
  }>,
): CRCPhysicsShape3D {
  return createShape3D({
    kind: "sphere",
    center: copyFiniteVector3(input.center ?? zeroVector, "sphere.center"),
    radius: requirePositiveNumber(input.radius, "sphere.radius"),
    localPose: IDENTITY_POSE_3D,
  });
}

export function boxShape3D(
  input: Readonly<{
    width: number;
    height: number;
    depth: number;
    center?: CRCPhysicsVector3;
    orientation?: CRCPhysicsQuaternion;
  }>,
): CRCPhysicsShape3D {
  const width = requirePositiveNumber(input.width, "box.width");
  const height = requirePositiveNumber(input.height, "box.height");
  const depth = requirePositiveNumber(input.depth, "box.depth");
  return createShape3D({
    kind: "box",
    center: copyFiniteVector3(input.center ?? zeroVector, "box.center"),
    orientation: copyCanonicalQuaternion(
      input.orientation ?? identityQuaternion,
      "box.orientation",
    ),
    halfExtents: new Float64Array([width / 2, height / 2, depth / 2]),
    localPose: IDENTITY_POSE_3D,
  });
}

export function ellipsoidShape3D(
  input: Readonly<{
    radii: CRCPhysicsVector3;
    center?: CRCPhysicsVector3;
    orientation?: CRCPhysicsQuaternion;
  }>,
): CRCPhysicsShape3D {
  const radii = copyFiniteVector3(input.radii, "ellipsoid.radii");
  for (let axis = 0; axis < 3; axis += 1) {
    requirePositiveNumber(radii[axis]!, `ellipsoid.radii[${axis}]`);
  }
  return createShape3D({
    kind: "ellipsoid",
    radii,
    center: copyFiniteVector3(input.center ?? zeroVector, "ellipsoid.center"),
    orientation: copyCanonicalQuaternion(
      input.orientation ?? identityQuaternion,
      "ellipsoid.orientation",
    ),
    localPose: IDENTITY_POSE_3D,
  });
}

export function capsuleShape3D(
  input: Readonly<{
    start: CRCPhysicsVector3;
    end: CRCPhysicsVector3;
    radius: number;
  }>,
): CRCPhysicsShape3D {
  const start = copyFiniteVector3(input.start, "capsule.start");
  const end = copyFiniteVector3(input.end, "capsule.end");
  if (
    Math.hypot(
      end[0]! - start[0]!,
      end[1]! - start[1]!,
      end[2]! - start[2]!,
    ) === 0
  ) {
    throw new RangeError("capsule start and end must be distinct.");
  }
  return createShape3D({
    kind: "capsule",
    start,
    end,
    center: new Float64Array([
      (start[0]! + end[0]!) / 2,
      (start[1]! + end[1]!) / 2,
      (start[2]! + end[2]!) / 2,
    ]),
    radius: requirePositiveNumber(input.radius, "capsule.radius"),
    localPose: IDENTITY_POSE_3D,
  });
}

export function cylinderShape3D(
  input: Readonly<{
    radius: number;
    halfHeight: number;
    center?: CRCPhysicsVector3;
    orientation?: CRCPhysicsQuaternion;
  }>,
): CRCPhysicsShape3D {
  return createShape3D({
    kind: "cylinder",
    center: copyFiniteVector3(input.center ?? zeroVector, "cylinder.center"),
    orientation: copyCanonicalQuaternion(
      input.orientation ?? identityQuaternion,
      "cylinder.orientation",
    ),
    radius: requirePositiveNumber(input.radius, "cylinder.radius"),
    halfHeight: requirePositiveNumber(input.halfHeight, "cylinder.halfHeight"),
    localPose: IDENTITY_POSE_3D,
  });
}

export function coneShape3D(
  input: Readonly<{
    radius: number;
    halfHeight: number;
    center?: CRCPhysicsVector3;
    orientation?: CRCPhysicsQuaternion;
  }>,
): CRCPhysicsShape3D {
  return createShape3D({
    kind: "cone",
    center: copyFiniteVector3(input.center ?? zeroVector, "cone.center"),
    orientation: copyCanonicalQuaternion(
      input.orientation ?? identityQuaternion,
      "cone.orientation",
    ),
    radius: requirePositiveNumber(input.radius, "cone.radius"),
    halfHeight: requirePositiveNumber(input.halfHeight, "cone.halfHeight"),
    localPose: IDENTITY_POSE_3D,
  });
}

export function convexHullShape3D(
  input: Readonly<{ points: readonly CRCPhysicsVector3[] }>,
): CRCPhysicsShape3D {
  const { vertices, faces } = buildCanonicalHull3D(input.points);
  return createShape3D({
    kind: "convexHull",
    center: averageVertices(vertices),
    vertices,
    faces,
    localPose: IDENTITY_POSE_3D,
  });
}

export function triangleMeshShape3D(
  input: Readonly<{
    positions: ArrayLike<number>;
    indices?: ArrayLike<number>;
  }>,
): CRCPhysicsShape3D {
  const positions = copyFiniteArray(input.positions, "triangleMesh.positions");
  if (positions.length === 0 || positions.length % 3 !== 0) {
    throw new RangeError(
      "triangle mesh positions must contain complete nonempty xyz triples.",
    );
  }
  const vertexCount = positions.length / 3;
  const indices =
    input.indices === undefined
      ? Uint32Array.from({ length: vertexCount }, (_, index) => index)
      : copyIndices(input.indices, vertexCount);
  if (indices.length === 0 || indices.length % 3 !== 0) {
    throw new RangeError(
      "triangle mesh indices must contain complete nonempty triangles.",
    );
  }
  const { minimum, maximum } = vertexBounds(positions);
  return createShape3D({
    kind: "triangleMesh",
    center: midpoint(minimum, maximum),
    positions,
    indices,
    minimum,
    maximum,
    localPose: IDENTITY_POSE_3D,
  });
}

export function heightfieldShape3D(
  input: Readonly<{
    rows: number;
    columns: number;
    heights: ArrayLike<number>;
    cellSizeX?: number;
    cellSizeZ?: number;
    heightScale?: number;
    origin?: CRCPhysicsVector3;
  }>,
): CRCPhysicsShape3D {
  if (
    !Number.isSafeInteger(input.rows) ||
    input.rows < 2 ||
    !Number.isSafeInteger(input.columns) ||
    input.columns < 2
  ) {
    throw new RangeError(
      "heightfield rows and columns must be integers of at least two.",
    );
  }
  const heights = copyFiniteArray(input.heights, "heightfield.heights");
  if (heights.length !== input.rows * input.columns) {
    throw new RangeError(
      "heightfield heights length must equal rows * columns.",
    );
  }
  const cellSizeX = requirePositiveNumber(
    input.cellSizeX ?? 1,
    "heightfield.cellSizeX",
  );
  const cellSizeZ = requirePositiveNumber(
    input.cellSizeZ ?? 1,
    "heightfield.cellSizeZ",
  );
  const heightScale = requirePositiveNumber(
    input.heightScale ?? 1,
    "heightfield.heightScale",
  );
  const origin = copyFiniteVector3(
    input.origin ?? zeroVector,
    "heightfield.origin",
  );
  let minimumHeight = Number.POSITIVE_INFINITY;
  let maximumHeight = Number.NEGATIVE_INFINITY;
  for (const height of heights) {
    minimumHeight = Math.min(minimumHeight, height * heightScale);
    maximumHeight = Math.max(maximumHeight, height * heightScale);
  }
  const minimum = new Float64Array([
    origin[0]!,
    origin[1]! + minimumHeight,
    origin[2]!,
  ]);
  const maximum = new Float64Array([
    origin[0]! + (input.columns - 1) * cellSizeX,
    origin[1]! + maximumHeight,
    origin[2]! + (input.rows - 1) * cellSizeZ,
  ]);
  return createShape3D({
    kind: "heightfield",
    center: midpoint(minimum, maximum),
    rows: input.rows,
    columns: input.columns,
    heights,
    cellSizeX,
    cellSizeZ,
    heightScale,
    origin,
    minimum,
    maximum,
    localPose: IDENTITY_POSE_3D,
  });
}

export function boundsOfShape3D(
  shape: CRCPhysicsShape3D,
  pose?: CRCPhysicsPose3D,
): CRCPhysicsAabb3D {
  const record = requireShapeRecord3D(shape);
  const worldPose = composePose3D(copyPose3D(pose, "pose"), record.localPose);
  const center = new Float64Array(3);
  transformPointInto(center, record.center, worldPose);

  if (record.kind === "sphere") {
    return freezeBounds3D(
      center[0]! - record.radius,
      center[1]! - record.radius,
      center[2]! - record.radius,
      center[0]! + record.radius,
      center[1]! + record.radius,
      center[2]! + record.radius,
    );
  }

  if (record.kind === "capsule") {
    const start = new Float64Array(3);
    const end = new Float64Array(3);
    transformPointInto(start, record.start, worldPose);
    transformPointInto(end, record.end, worldPose);
    return freezeBounds3D(
      Math.min(start[0]!, end[0]!) - record.radius,
      Math.min(start[1]!, end[1]!) - record.radius,
      Math.min(start[2]!, end[2]!) - record.radius,
      Math.max(start[0]!, end[0]!) + record.radius,
      Math.max(start[1]!, end[1]!) + record.radius,
      Math.max(start[2]!, end[2]!) + record.radius,
    );
  }
  if (record.kind === "convexHull") {
    return transformedVertexBounds(record.vertices, worldPose);
  }
  if (record.kind === "triangleMesh" || record.kind === "heightfield") {
    return transformedBoxBounds(record.minimum, record.maximum, worldPose);
  }

  const orientationPose = poseFor(record.center, record.orientation);
  const worldBoxPose = composePose3D(worldPose, orientationPose);
  transformPointInto(center, zeroVector, worldBoxPose);
  const rotation = new Float64Array(9);
  rotationMatrixInto(rotation, worldBoxPose.orientation);
  if (record.kind === "ellipsoid") {
    const extents = new Float64Array(3);
    for (let axis = 0; axis < 3; axis += 1) {
      extents[axis] = Math.hypot(
        rotation[axis * 3]! * record.radii[0]!,
        rotation[axis * 3 + 1]! * record.radii[1]!,
        rotation[axis * 3 + 2]! * record.radii[2]!,
      );
    }
    return freezeBounds3D(
      center[0]! - extents[0]!,
      center[1]! - extents[1]!,
      center[2]! - extents[2]!,
      center[0]! + extents[0]!,
      center[1]! + extents[1]!,
      center[2]! + extents[2]!,
    );
  }
  if (record.kind === "cylinder" || record.kind === "cone") {
    const minimum = new Float64Array(3);
    const maximum = new Float64Array(3);
    for (let axis = 0; axis < 3; axis += 1) {
      const dx = rotation[axis * 3]!;
      const dy = rotation[axis * 3 + 1]!;
      const dz = rotation[axis * 3 + 2]!;
      if (record.kind === "cylinder") {
        const extent =
          record.radius * Math.hypot(dx, dz) + record.halfHeight * Math.abs(dy);
        minimum[axis] = center[axis]! - extent;
        maximum[axis] = center[axis]! + extent;
      } else {
        const positive = Math.max(
          record.halfHeight * dy,
          record.radius * Math.hypot(dx, dz) - record.halfHeight * dy,
        );
        const negative = Math.max(
          -record.halfHeight * dy,
          record.radius * Math.hypot(dx, dz) + record.halfHeight * dy,
        );
        minimum[axis] = center[axis]! - negative;
        maximum[axis] = center[axis]! + positive;
      }
    }
    return freezeBounds3D(
      minimum[0]!,
      minimum[1]!,
      minimum[2]!,
      maximum[0]!,
      maximum[1]!,
      maximum[2]!,
    );
  }
  const halfExtents = record.halfExtents;
  const extentX =
    Math.abs(rotation[0]!) * halfExtents[0]! +
    Math.abs(rotation[1]!) * halfExtents[1]! +
    Math.abs(rotation[2]!) * halfExtents[2]!;
  const extentY =
    Math.abs(rotation[3]!) * halfExtents[0]! +
    Math.abs(rotation[4]!) * halfExtents[1]! +
    Math.abs(rotation[5]!) * halfExtents[2]!;
  const extentZ =
    Math.abs(rotation[6]!) * halfExtents[0]! +
    Math.abs(rotation[7]!) * halfExtents[1]! +
    Math.abs(rotation[8]!) * halfExtents[2]!;
  return freezeBounds3D(
    center[0]! - extentX,
    center[1]! - extentY,
    center[2]! - extentZ,
    center[0]! + extentX,
    center[1]! + extentY,
    center[2]! + extentZ,
  );
}

export function massProperties3D(
  shape: CRCPhysicsShape3D,
  options?: Readonly<{ density?: number }>,
): CRCPhysicsMassProperties3D {
  const record = requireShapeRecord3D(shape);
  const density = requirePositiveNumber(
    options?.density ?? 1,
    "options.density",
  );
  const center = new Float64Array(3);
  transformPointInto(center, record.center, record.localPose);

  if (record.kind === "sphere") {
    const volume = (4 * Math.PI * record.radius ** 3) / 3;
    const mass = volume * density;
    const inertia = (2 * mass * record.radius ** 2) / 5;
    return freezeMassProperties(
      volume,
      center,
      mass,
      rotateDiagonalTensor(
        inertia,
        inertia,
        inertia,
        record.localPose.orientation,
      ),
    );
  }

  if (record.kind === "triangleMesh" || record.kind === "heightfield") {
    return freezeMassProperties(0, center, 0, [0, 0, 0, 0, 0, 0, 0, 0, 0]);
  }
  if (record.kind === "convexHull") {
    const hull = hullMassProperties(record.vertices, record.faces, density);
    const hullCenter = new Float64Array(3);
    transformPointInto(hullCenter, hull.center, record.localPose);
    return freezeMassProperties(
      hull.volume,
      hullCenter,
      hull.mass,
      rotateTensor(hull.tensor, record.localPose.orientation),
    );
  }
  if (record.kind === "capsule") {
    const length = segmentLength(record);
    const cylinderMass = Math.PI * record.radius ** 2 * length * density;
    const sphereMass = (4 * Math.PI * record.radius ** 3 * density) / 3;
    const mass = cylinderMass + sphereMass;
    const axial =
      (cylinderMass * record.radius ** 2) / 2 +
      (2 * sphereMass * record.radius ** 2) / 5;
    const capDistance = length / 2 + (3 * record.radius) / 8;
    const transverse =
      (cylinderMass * (3 * record.radius ** 2 + length ** 2)) / 12 +
      sphereMass * ((83 * record.radius ** 2) / 320 + capDistance ** 2);
    const axis = new Float64Array([
      (record.end[0]! - record.start[0]!) / length,
      (record.end[1]! - record.start[1]!) / length,
      (record.end[2]! - record.start[2]!) / length,
    ]);
    const tensor = axialTensor(transverse, axial, axis);
    return freezeMassProperties(
      cylinderMass / density + sphereMass / density,
      center,
      mass,
      rotateTensor(tensor, record.localPose.orientation),
    );
  }
  const dimensions = massDimensions(record);
  const width = dimensions[0] * 2;
  const height = dimensions[1] * 2;
  const depth = dimensions[2] * 2;
  const volume =
    record.kind === "ellipsoid"
      ? (4 * Math.PI * dimensions[0] * dimensions[1] * dimensions[2]) / 3
      : record.kind === "cylinder"
        ? Math.PI * record.radius ** 2 * record.halfHeight * 2
        : record.kind === "cone"
          ? (Math.PI * record.radius ** 2 * record.halfHeight * 2) / 3
          : width * height * depth;
  const mass = volume * density;
  const orientation = composePose3D(
    record.localPose,
    poseFor(zeroVector, record.orientation),
  ).orientation;
  let diagonalX = (mass * (height ** 2 + depth ** 2)) / 12;
  let diagonalY = (mass * (width ** 2 + depth ** 2)) / 12;
  let diagonalZ = (mass * (width ** 2 + height ** 2)) / 12;
  if (record.kind === "ellipsoid") {
    diagonalX = (mass * (record.radii[1]! ** 2 + record.radii[2]! ** 2)) / 5;
    diagonalY = (mass * (record.radii[0]! ** 2 + record.radii[2]! ** 2)) / 5;
    diagonalZ = (mass * (record.radii[0]! ** 2 + record.radii[1]! ** 2)) / 5;
  } else if (record.kind === "cylinder") {
    diagonalX = diagonalZ =
      (mass * (3 * record.radius ** 2 + 4 * record.halfHeight ** 2)) / 12;
    diagonalY = (mass * record.radius ** 2) / 2;
  } else if (record.kind === "cone") {
    diagonalX = diagonalZ =
      (3 * mass * (record.radius ** 2 + record.halfHeight ** 2)) / 20;
    diagonalY = (3 * mass * record.radius ** 2) / 10;
    const localCenter = new Float64Array([0, -record.halfHeight / 2, 0]);
    const shapePose = composePose3D(
      record.localPose,
      poseFor(record.center, record.orientation),
    );
    transformPointInto(center, localCenter, shapePose);
  }
  return freezeMassProperties(
    volume,
    center,
    mass,
    rotateDiagonalTensor(diagonalX, diagonalY, diagonalZ, orientation),
  );
}

function axialTensor(
  transverse: number,
  axial: number,
  axis: Float64Array,
): number[] {
  const delta = axial - transverse;
  return [
    transverse + delta * axis[0]! ** 2,
    delta * axis[0]! * axis[1]!,
    delta * axis[0]! * axis[2]!,
    delta * axis[1]! * axis[0]!,
    transverse + delta * axis[1]! ** 2,
    delta * axis[1]! * axis[2]!,
    delta * axis[2]! * axis[0]!,
    delta * axis[2]! * axis[1]!,
    transverse + delta * axis[2]! ** 2,
  ];
}

function rotateTensor(
  tensor: ArrayLike<number>,
  orientation: ArrayLike<number>,
): CRCPhysicsMassProperties3D["inertiaTensor"] {
  const rotation = new Float64Array(9);
  rotationMatrixInto(rotation, orientation);
  const intermediate = new Float64Array(9);
  const result = new Array<number>(9);
  for (let row = 0; row < 3; row += 1)
    for (let column = 0; column < 3; column += 1)
      intermediate[row * 3 + column] =
        rotation[row * 3]! * tensor[column]! +
        rotation[row * 3 + 1]! * tensor[3 + column]! +
        rotation[row * 3 + 2]! * tensor[6 + column]!;
  for (let row = 0; row < 3; row += 1)
    for (let column = 0; column < 3; column += 1)
      result[row * 3 + column] = cleanZero(
        intermediate[row * 3]! * rotation[column * 3]! +
          intermediate[row * 3 + 1]! * rotation[column * 3 + 1]! +
          intermediate[row * 3 + 2]! * rotation[column * 3 + 2]!,
      );
  return Object.freeze(result) as CRCPhysicsMassProperties3D["inertiaTensor"];
}

function hullMassProperties(
  vertices: Float64Array,
  faces: Uint32Array,
  density: number,
) {
  let volume = 0;
  const firstMoment = new Float64Array(3);
  let x2 = 0,
    y2 = 0,
    z2 = 0,
    xy = 0,
    xz = 0,
    yz = 0;
  for (let index = 0; index < faces.length; index += 3) {
    const a = vertices.subarray(faces[index]! * 3, faces[index]! * 3 + 3);
    const b = vertices.subarray(
      faces[index + 1]! * 3,
      faces[index + 1]! * 3 + 3,
    );
    const c = vertices.subarray(
      faces[index + 2]! * 3,
      faces[index + 2]! * 3 + 3,
    );
    const signed =
      (a[0]! * (b[1]! * c[2]! - b[2]! * c[1]!) -
        a[1]! * (b[0]! * c[2]! - b[2]! * c[0]!) +
        a[2]! * (b[0]! * c[1]! - b[1]! * c[0]!)) /
      6;
    volume += signed;
    for (let axis = 0; axis < 3; axis += 1)
      firstMoment[axis] += (signed * (a[axis]! + b[axis]! + c[axis]!)) / 4;
    const second = (axis: number) =>
      (signed / 10) *
      (a[axis]! ** 2 +
        b[axis]! ** 2 +
        c[axis]! ** 2 +
        a[axis]! * b[axis]! +
        a[axis]! * c[axis]! +
        b[axis]! * c[axis]!);
    const product = (u: number, v: number) =>
      (signed / 20) *
      (2 * (a[u]! * a[v]! + b[u]! * b[v]! + c[u]! * c[v]!) +
        a[u]! * b[v]! +
        a[v]! * b[u]! +
        a[u]! * c[v]! +
        a[v]! * c[u]! +
        b[u]! * c[v]! +
        b[v]! * c[u]!);
    x2 += second(0);
    y2 += second(1);
    z2 += second(2);
    xy += product(0, 1);
    xz += product(0, 2);
    yz += product(1, 2);
  }
  const sign = volume < 0 ? -1 : 1;
  volume *= sign;
  for (let axis = 0; axis < 3; axis += 1) firstMoment[axis] *= sign;
  x2 *= sign;
  y2 *= sign;
  z2 *= sign;
  xy *= sign;
  xz *= sign;
  yz *= sign;
  const center = new Float64Array([
    firstMoment[0]! / volume,
    firstMoment[1]! / volume,
    firstMoment[2]! / volume,
  ]);
  const mass = volume * density;
  const tensor = [
    density * (y2 + z2) - mass * (center[1]! ** 2 + center[2]! ** 2),
    -density * xy + mass * center[0]! * center[1]!,
    -density * xz + mass * center[0]! * center[2]!,
    -density * xy + mass * center[0]! * center[1]!,
    density * (x2 + z2) - mass * (center[0]! ** 2 + center[2]! ** 2),
    -density * yz + mass * center[1]! * center[2]!,
    -density * xz + mass * center[0]! * center[2]!,
    -density * yz + mass * center[1]! * center[2]!,
    density * (x2 + y2) - mass * (center[0]! ** 2 + center[1]! ** 2),
  ];
  return { volume, center, mass, tensor };
}

export function transformShape3D(
  shape: CRCPhysicsShape3D,
  transform: CRCPhysicsTransform3D,
): CRCPhysicsShape3D {
  const source = requireShapeRecord3D(shape);
  rejectScale(transform);
  const localPose = composePose3D(
    copyPose3D(transform, "transform"),
    source.localPose,
  );
  return createShape3D({ ...source, localPose });
}

function poseFor(
  position: ArrayLike<number>,
  orientation: Float64Array,
): InternalPose3D {
  return Object.freeze({
    position:
      position instanceof Float64Array
        ? position
        : new Float64Array([position[0]!, position[1]!, position[2]!]),
    orientation,
  });
}

function freezeBounds3D(
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number,
): CRCPhysicsAabb3D {
  return Object.freeze({
    min: freezeVector3(minX, minY, minZ),
    max: freezeVector3(maxX, maxY, maxZ),
  });
}

function freezeMassProperties(
  volume: number,
  center: Float64Array,
  mass: number,
  inertiaTensor: CRCPhysicsMassProperties3D["inertiaTensor"],
): CRCPhysicsMassProperties3D {
  return Object.freeze({
    volume: cleanZero(volume),
    centerOfMass: freezeVector3(center[0]!, center[1]!, center[2]!),
    mass: cleanZero(mass),
    inertiaTensor,
  });
}

function rejectScale(transform: CRCPhysicsTransform3D): void {
  const candidate = transform as unknown as Record<string, unknown>;
  if (
    "scale" in candidate ||
    "scaleX" in candidate ||
    "scaleY" in candidate ||
    "scaleZ" in candidate
  ) {
    throw new TypeError("transform must not contain scale.");
  }
}

function averageVertices(vertices: Float64Array): Float64Array {
  const result = new Float64Array(3);
  for (let index = 0; index < vertices.length; index += 3) {
    result[0] += vertices[index]!;
    result[1] += vertices[index + 1]!;
    result[2] += vertices[index + 2]!;
  }
  const count = vertices.length / 3;
  result[0] /= count;
  result[1] /= count;
  result[2] /= count;
  return result;
}

function copyFiniteArray(
  values: ArrayLike<number>,
  label: string,
): Float64Array {
  if (!Number.isSafeInteger(values.length) || values.length < 0) {
    throw new TypeError(`${label}.length must be a nonnegative safe integer.`);
  }
  const copy = new Float64Array(values.length);
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!Number.isFinite(value))
      throw new TypeError(`${label}[${index}] must be finite.`);
    copy[index] = value!;
  }
  return copy;
}

function copyIndices(
  values: ArrayLike<number>,
  vertexCount: number,
): Uint32Array {
  if (!Number.isSafeInteger(values.length) || values.length < 0) {
    throw new TypeError(
      "triangleMesh.indices.length must be a nonnegative safe integer.",
    );
  }
  const copy = new Uint32Array(values.length);
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!Number.isSafeInteger(value) || value! < 0 || value! >= vertexCount) {
      throw new RangeError(
        `triangleMesh.indices[${index}] must identify a vertex.`,
      );
    }
    copy[index] = value!;
  }
  return copy;
}

function vertexBounds(vertices: Float64Array): Readonly<{
  minimum: Float64Array;
  maximum: Float64Array;
}> {
  const minimum = new Float64Array([Infinity, Infinity, Infinity]);
  const maximum = new Float64Array([-Infinity, -Infinity, -Infinity]);
  for (let index = 0; index < vertices.length; index += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      minimum[axis] = Math.min(minimum[axis]!, vertices[index + axis]!);
      maximum[axis] = Math.max(maximum[axis]!, vertices[index + axis]!);
    }
  }
  return { minimum, maximum };
}

function midpoint(
  minimum: ArrayLike<number>,
  maximum: ArrayLike<number>,
): Float64Array {
  return new Float64Array([
    (minimum[0]! + maximum[0]!) / 2,
    (minimum[1]! + maximum[1]!) / 2,
    (minimum[2]! + maximum[2]!) / 2,
  ]);
}

function transformedVertexBounds(
  vertices: Float64Array,
  pose: InternalPose3D,
): CRCPhysicsAabb3D {
  const transformed = new Float64Array(vertices.length);
  for (let index = 0; index < vertices.length; index += 3) {
    transformPointInto(
      transformed.subarray(index, index + 3),
      vertices.subarray(index, index + 3),
      pose,
    );
  }
  const { minimum, maximum } = vertexBounds(transformed);
  return freezeBounds3D(
    minimum[0]!,
    minimum[1]!,
    minimum[2]!,
    maximum[0]!,
    maximum[1]!,
    maximum[2]!,
  );
}

function transformedBoxBounds(
  minimum: Float64Array,
  maximum: Float64Array,
  pose: InternalPose3D,
): CRCPhysicsAabb3D {
  const vertices = new Float64Array(24);
  for (let feature = 0; feature < 8; feature += 1) {
    vertices[feature * 3] = (feature & 1) === 0 ? minimum[0]! : maximum[0]!;
    vertices[feature * 3 + 1] = (feature & 2) === 0 ? minimum[1]! : maximum[1]!;
    vertices[feature * 3 + 2] = (feature & 4) === 0 ? minimum[2]! : maximum[2]!;
  }
  return transformedVertexBounds(vertices, pose);
}

function segmentLength(record: {
  readonly start: Float64Array;
  readonly end: Float64Array;
}): number {
  return Math.hypot(
    record.end[0]! - record.start[0]!,
    record.end[1]! - record.start[1]!,
    record.end[2]! - record.start[2]!,
  );
}

function massDimensions(
  record: Exclude<
    ReturnType<typeof requireShapeRecord3D>,
    { kind: "sphere" | "triangleMesh" | "heightfield" }
  >,
): Float64Array {
  if (record.kind === "box") return record.halfExtents;
  if (record.kind === "ellipsoid") return record.radii;
  if (record.kind === "cylinder" || record.kind === "cone") {
    return new Float64Array([record.radius, record.halfHeight, record.radius]);
  }
  if (record.kind === "capsule") {
    const length = segmentLength(record);
    return new Float64Array([
      record.radius,
      length / 2 + record.radius,
      record.radius,
    ]);
  }
  const { minimum, maximum } = vertexBounds(record.vertices);
  return new Float64Array([
    (maximum[0]! - minimum[0]!) / 2,
    (maximum[1]! - minimum[1]!) / 2,
    (maximum[2]! - minimum[2]!) / 2,
  ]);
}
