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

export type PreparedConvexShape3D = PreparedSphere3D | PreparedBox3D;

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
  return record.kind === "sphere"
    ? prepareSphere(record, outerPose)
    : prepareBox(record, outerPose);
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
    output[0] = shape.center[0]! + shape.radius * (inverseLength === 0 ? 1 : directionX * inverseLength);
    output[1] = shape.center[1]! + shape.radius * directionY * inverseLength;
    output[2] = shape.center[2]! + shape.radius * directionZ * inverseLength;
    return 0;
  }

  let selectedFeature = 0;
  let selectedProjection = Number.NEGATIVE_INFINITY;
  let selectedX = 0;
  let selectedY = 0;
  let selectedZ = 0;
  for (let feature = 0; feature < 8; feature += 1) {
    const localX = (feature & 1) === 0 ? -shape.halfExtents[0]! : shape.halfExtents[0]!;
    const localY = (feature & 2) === 0 ? -shape.halfExtents[1]! : shape.halfExtents[1]!;
    const localZ = (feature & 4) === 0 ? -shape.halfExtents[2]! : shape.halfExtents[2]!;
    const x = shape.center[0]! + shape.axes[0]! * localX + shape.axes[3]! * localY + shape.axes[6]! * localZ;
    const y = shape.center[1]! + shape.axes[1]! * localX + shape.axes[4]! * localY + shape.axes[7]! * localZ;
    const z = shape.center[2]! + shape.axes[2]! * localX + shape.axes[5]! * localY + shape.axes[8]! * localZ;
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
  const firstFeature = supportShape3D(points, first, directionX, directionY, directionZ);
  const secondOutput = points.subarray(3);
  const secondFeature = supportShape3D(secondOutput, second, -directionX, -directionY, -directionZ);
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
  const shapePose = composePose3D(
    composePose3D(outerPose, record.localPose),
    { position: record.center, orientation: record.orientation },
  );
  const rotation = new Float64Array(9);
  rotationMatrixInto(rotation, shapePose.orientation);
  return {
    kind: "box",
    center: new Float64Array(shapePose.position),
    axes: new Float64Array([
      rotation[0]!, rotation[3]!, rotation[6]!,
      rotation[1]!, rotation[4]!, rotation[7]!,
      rotation[2]!, rotation[5]!, rotation[8]!,
    ]),
    halfExtents: record.halfExtents,
  };
}
