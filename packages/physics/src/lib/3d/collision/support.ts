import {
  composePose3D,
  rotationMatrixInto,
  transformPointInto,
  type InternalPose3D,
} from "../math.js";
import { GEOMETRY_EPSILON_3D } from "../numeric-policy.js";
import type {
  BoxShapeRecord3D,
  ShapeRecord3D,
  SphereShapeRecord3D,
} from "../shape-records.js";

interface PreparedShapeBase3D {
  readonly center: Float64Array;
}

export interface PreparedSphere3D extends PreparedShapeBase3D {
  readonly kind: "sphere";
  readonly radius: number;
}

export interface PreparedBox3D extends PreparedShapeBase3D {
  readonly kind: "box";
  readonly axes: Float64Array;
  readonly halfExtents: Float64Array;
}

export interface PreparedVertexCloud3D extends PreparedShapeBase3D {
  readonly kind: "vertices";
  readonly vertices: Float64Array;
}

export type PreparedConvexShape3D =
  PreparedSphere3D | PreparedBox3D | PreparedVertexCloud3D;

export interface MinkowskiVertex3D {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly firstX: number;
  readonly firstY: number;
  readonly firstZ: number;
  readonly secondX: number;
  readonly secondY: number;
  readonly secondZ: number;
  readonly firstFeature: number;
  readonly secondFeature: number;
}

export function prepareConvexShape3D(
  record: ShapeRecord3D,
  outerPose: InternalPose3D,
): PreparedConvexShape3D {
  if (record.kind === "sphere") return prepareSphere(record, outerPose);
  if (record.kind === "box") return prepareBox(record, outerPose);
  return prepareVertexCloud(record, outerPose);
}

export function supportShape3D(
  output: Float64Array,
  shape: PreparedConvexShape3D,
  directionX: number,
  directionY: number,
  directionZ: number,
): number {
  if (shape.kind === "sphere") {
    const length = Math.hypot(directionX, directionY, directionZ);
    const inverseLength = length > GEOMETRY_EPSILON_3D ? 1 / length : 0;
    output[0] =
      shape.center[0]! +
      shape.radius * (inverseLength === 0 ? 1 : directionX * inverseLength);
    output[1] = shape.center[1]! + shape.radius * directionY * inverseLength;
    output[2] = shape.center[2]! + shape.radius * directionZ * inverseLength;
    return 0;
  }

  if (shape.kind === "vertices") {
    let selectedFeature = 0;
    let selectedProjection = Number.NEGATIVE_INFINITY;
    for (let feature = 0; feature < shape.vertices.length / 3; feature += 1) {
      const offset = feature * 3;
      const projection =
        shape.vertices[offset]! * directionX +
        shape.vertices[offset + 1]! * directionY +
        shape.vertices[offset + 2]! * directionZ;
      if (projection > selectedProjection + GEOMETRY_EPSILON_3D) {
        selectedFeature = feature;
        selectedProjection = projection;
      }
    }
    output[0] = shape.vertices[selectedFeature * 3]!;
    output[1] = shape.vertices[selectedFeature * 3 + 1]!;
    output[2] = shape.vertices[selectedFeature * 3 + 2]!;
    return selectedFeature;
  }

  let selectedFeature = 0;
  let selectedProjection = Number.NEGATIVE_INFINITY;
  let selectedX = 0;
  let selectedY = 0;
  let selectedZ = 0;
  for (let feature = 0; feature < 8; feature += 1) {
    const localX =
      (feature & 1) === 0 ? -shape.halfExtents[0]! : shape.halfExtents[0]!;
    const localY =
      (feature & 2) === 0 ? -shape.halfExtents[1]! : shape.halfExtents[1]!;
    const localZ =
      (feature & 4) === 0 ? -shape.halfExtents[2]! : shape.halfExtents[2]!;
    const x =
      shape.center[0]! +
      shape.axes[0]! * localX +
      shape.axes[3]! * localY +
      shape.axes[6]! * localZ;
    const y =
      shape.center[1]! +
      shape.axes[1]! * localX +
      shape.axes[4]! * localY +
      shape.axes[7]! * localZ;
    const z =
      shape.center[2]! +
      shape.axes[2]! * localX +
      shape.axes[5]! * localY +
      shape.axes[8]! * localZ;
    const projection = x * directionX + y * directionY + z * directionZ;
    if (projection > selectedProjection + GEOMETRY_EPSILON_3D) {
      selectedFeature = feature;
      selectedProjection = projection;
      selectedX = x;
      selectedY = y;
      selectedZ = z;
    }
  }
  output[0] = selectedX;
  output[1] = selectedY;
  output[2] = selectedZ;
  return selectedFeature;
}

export function supportMinkowski3D(
  first: PreparedConvexShape3D,
  second: PreparedConvexShape3D,
  directionX: number,
  directionY: number,
  directionZ: number,
): MinkowskiVertex3D {
  const points = new Float64Array(6);
  const firstFeature = supportShape3D(
    points,
    first,
    directionX,
    directionY,
    directionZ,
  );
  const secondOutput = points.subarray(3);
  const secondFeature = supportShape3D(
    secondOutput,
    second,
    -directionX,
    -directionY,
    -directionZ,
  );
  return {
    x: points[0]! - points[3]!,
    y: points[1]! - points[4]!,
    z: points[2]! - points[5]!,
    firstX: points[0]!,
    firstY: points[1]!,
    firstZ: points[2]!,
    secondX: points[3]!,
    secondY: points[4]!,
    secondZ: points[5]!,
    firstFeature,
    secondFeature,
  };
}

function prepareSphere(
  record: SphereShapeRecord3D,
  outerPose: InternalPose3D,
): PreparedSphere3D {
  const pose = composePose3D(outerPose, record.localPose);
  const center = new Float64Array(3);
  transformPointInto(center, record.center, pose);
  return { kind: "sphere", center, radius: record.radius };
}

function prepareBox(
  record: BoxShapeRecord3D,
  outerPose: InternalPose3D,
): PreparedBox3D {
  const shapePose = composePose3D(composePose3D(outerPose, record.localPose), {
    position: record.center,
    orientation: record.orientation,
  });
  const rotation = new Float64Array(9);
  rotationMatrixInto(rotation, shapePose.orientation);
  return {
    kind: "box",
    center: new Float64Array(shapePose.position),
    axes: new Float64Array([
      rotation[0]!,
      rotation[3]!,
      rotation[6]!,
      rotation[1]!,
      rotation[4]!,
      rotation[7]!,
      rotation[2]!,
      rotation[5]!,
      rotation[8]!,
    ]),
    halfExtents: record.halfExtents,
  };
}

function prepareVertexCloud(
  record: Exclude<ShapeRecord3D, SphereShapeRecord3D | BoxShapeRecord3D>,
  outerPose: InternalPose3D,
): PreparedVertexCloud3D {
  const local = localVertices(record);
  const pose = composePose3D(outerPose, record.localPose);
  const vertices = new Float64Array(local.length);
  for (let index = 0; index < local.length; index += 3) {
    transformPointInto(
      vertices.subarray(index, index + 3),
      local.subarray(index, index + 3),
      pose,
    );
  }
  const center = new Float64Array(3);
  transformPointInto(center, record.center, pose);
  return { kind: "vertices", center, vertices };
}

function localVertices(
  record: Exclude<ShapeRecord3D, SphereShapeRecord3D | BoxShapeRecord3D>,
): Float64Array {
  if (record.kind === "convexHull") return new Float64Array(record.vertices);
  if (record.kind === "triangleMesh" || record.kind === "heightfield") {
    return boxVertices(record.minimum, record.maximum, 0.025);
  }
  if (record.kind === "capsule") {
    const values: number[] = [];
    const axis = normalizedAxis(record.start, record.end);
    const basis = perpendicularBasis(axis);
    for (const endpoint of [record.start, record.end]) {
      for (let ring = 0; ring <= 4; ring += 1) {
        const angle = ((ring / 4) * Math.PI) / 2;
        const axial = Math.cos(angle) * record.radius;
        const radial = Math.sin(angle) * record.radius;
        const sign = endpoint === record.start ? -1 : 1;
        for (let segment = 0; segment < 12; segment += 1) {
          const around = (segment / 12) * Math.PI * 2;
          values.push(
            endpoint[0]! +
              axis[0] * axial * sign +
              radial *
                (basis[0][0] * Math.cos(around) +
                  basis[1][0] * Math.sin(around)),
            endpoint[1]! +
              axis[1] * axial * sign +
              radial *
                (basis[0][1] * Math.cos(around) +
                  basis[1][1] * Math.sin(around)),
            endpoint[2]! +
              axis[2] * axial * sign +
              radial *
                (basis[0][2] * Math.cos(around) +
                  basis[1][2] * Math.sin(around)),
          );
        }
      }
    }
    return new Float64Array(values);
  }
  const values: number[] = [];
  const radii =
    record.kind === "ellipsoid"
      ? record.radii
      : new Float64Array([record.radius, record.halfHeight, record.radius]);
  if (record.kind === "ellipsoid") {
    for (let latitude = 0; latitude <= 8; latitude += 1) {
      const phi = -Math.PI / 2 + (latitude / 8) * Math.PI;
      for (let longitude = 0; longitude < 16; longitude += 1) {
        const theta = (longitude / 16) * Math.PI * 2;
        values.push(
          Math.cos(phi) * Math.cos(theta) * radii[0]!,
          Math.sin(phi) * radii[1]!,
          Math.cos(phi) * Math.sin(theta) * radii[2]!,
        );
      }
    }
  } else {
    const topRadius = record.kind === "cone" ? 0 : record.radius;
    for (let segment = 0; segment < 20; segment += 1) {
      const angle = (segment / 20) * Math.PI * 2;
      values.push(
        record.radius * Math.cos(angle),
        -record.halfHeight,
        record.radius * Math.sin(angle),
        topRadius * Math.cos(angle),
        record.halfHeight,
        topRadius * Math.sin(angle),
      );
    }
  }
  const oriented = new Float64Array(values.length);
  const pose: InternalPose3D = {
    position: record.center,
    orientation: record.orientation,
  };
  const source = new Float64Array(values);
  for (let index = 0; index < source.length; index += 3) {
    transformPointInto(
      oriented.subarray(index, index + 3),
      source.subarray(index, index + 3),
      pose,
    );
  }
  return oriented;
}

function boxVertices(
  minimum: Float64Array,
  maximum: Float64Array,
  minimumHalfThickness: number,
): Float64Array {
  const center = [
    (minimum[0]! + maximum[0]!) / 2,
    (minimum[1]! + maximum[1]!) / 2,
    (minimum[2]! + maximum[2]!) / 2,
  ] as const;
  const half = [
    Math.max((maximum[0]! - minimum[0]!) / 2, minimumHalfThickness),
    Math.max((maximum[1]! - minimum[1]!) / 2, minimumHalfThickness),
    Math.max((maximum[2]! - minimum[2]!) / 2, minimumHalfThickness),
  ] as const;
  const values = new Float64Array(24);
  for (let feature = 0; feature < 8; feature += 1) {
    values[feature * 3] =
      center[0] + ((feature & 1) === 0 ? -half[0] : half[0]);
    values[feature * 3 + 1] =
      center[1] + ((feature & 2) === 0 ? -half[1] : half[1]);
    values[feature * 3 + 2] =
      center[2] + ((feature & 4) === 0 ? -half[2] : half[2]);
  }
  return values;
}

function normalizedAxis(
  start: Float64Array,
  end: Float64Array,
): readonly [number, number, number] {
  const x = end[0]! - start[0]!;
  const y = end[1]! - start[1]!;
  const z = end[2]! - start[2]!;
  const length = Math.hypot(x, y, z);
  return [x / length, y / length, z / length];
}

function perpendicularBasis(
  axis: readonly [number, number, number],
): readonly [
  readonly [number, number, number],
  readonly [number, number, number],
] {
  const seed =
    Math.abs(axis[1]) < 0.9 ? ([0, 1, 0] as const) : ([1, 0, 0] as const);
  const ux = axis[1] * seed[2] - axis[2] * seed[1];
  const uy = axis[2] * seed[0] - axis[0] * seed[2];
  const uz = axis[0] * seed[1] - axis[1] * seed[0];
  const length = Math.hypot(ux, uy, uz);
  const first = [ux / length, uy / length, uz / length] as const;
  const second = [
    axis[1] * first[2] - axis[2] * first[1],
    axis[2] * first[0] - axis[0] * first[2],
    axis[0] * first[1] - axis[1] * first[0],
  ] as const;
  return [first, second];
}
