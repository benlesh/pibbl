import {
  composePose3D,
  rotationMatrixInto,
  transformPointInto,
  type InternalPose3D,
} from "../math.js";
import type {
  BoxShapeRecord3D,
  ConvexShapeRecord3D,
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
  readonly kind: "hull";
  readonly vertices: Float64Array;
  readonly faces: Uint32Array;
}

export interface PreparedEllipsoid3D extends PreparedShapeBase3D {
  readonly kind: "ellipsoid";
  readonly axes: Float64Array;
  readonly radii: Float64Array;
}

export interface PreparedCapsule3D extends PreparedShapeBase3D {
  readonly kind: "capsule";
  readonly start: Float64Array;
  readonly end: Float64Array;
  readonly radius: number;
}

export interface PreparedCylinder3D extends PreparedShapeBase3D {
  readonly kind: "cylinder";
  readonly axes: Float64Array;
  readonly radius: number;
  readonly halfHeight: number;
}

export interface PreparedCone3D extends PreparedShapeBase3D {
  readonly kind: "cone";
  readonly axes: Float64Array;
  readonly radius: number;
  readonly halfHeight: number;
}

export type PreparedConvexShape3D =
  | PreparedSphere3D
  | PreparedBox3D
  | PreparedVertexCloud3D
  | PreparedEllipsoid3D
  | PreparedCapsule3D
  | PreparedCylinder3D
  | PreparedCone3D;

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
  record: ConvexShapeRecord3D,
  outerPose: InternalPose3D,
): PreparedConvexShape3D {
  if (record.kind === "sphere") return prepareSphere(record, outerPose);
  if (record.kind === "box") return prepareBox(record, outerPose);
  if (record.kind === "capsule") {
    const pose = composePose3D(outerPose, record.localPose);
    const start = new Float64Array(3);
    const end = new Float64Array(3);
    const center = new Float64Array(3);
    transformPointInto(start, record.start, pose);
    transformPointInto(end, record.end, pose);
    transformPointInto(center, record.center, pose);
    return { kind: "capsule", center, start, end, radius: record.radius };
  }
  if (record.kind === "convexHull") return prepareHull(record, outerPose);
  const shapePose = composePose3D(composePose3D(outerPose, record.localPose), {
    position: record.center,
    orientation: record.orientation,
  });
  const axes = axesForPose(shapePose);
  if (record.kind === "ellipsoid") {
    if (
      record.radii[0] === record.radii[1] &&
      record.radii[1] === record.radii[2]
    ) {
      return {
        kind: "sphere",
        center: new Float64Array(shapePose.position),
        radius: record.radii[0]!,
      };
    }
    return {
      kind: "ellipsoid",
      center: new Float64Array(shapePose.position),
      axes,
      radii: record.radii,
    };
  }
  return {
    kind: record.kind,
    center: new Float64Array(shapePose.position),
    axes,
    radius: record.radius,
    halfHeight: record.halfHeight,
  };
}

export function supportShape3D(
  output: Float64Array,
  shape: PreparedConvexShape3D,
  directionX: number,
  directionY: number,
  directionZ: number,
): number {
  if (shape.kind === "sphere") {
    const unit = unitDirection(directionX, directionY, directionZ);
    output[0] = shape.center[0]! + shape.radius * unit[0];
    output[1] = shape.center[1]! + shape.radius * unit[1];
    output[2] = shape.center[2]! + shape.radius * unit[2];
    return 0;
  }

  if (shape.kind === "hull") {
    let selectedFeature = 0;
    for (let feature = 1; feature < shape.vertices.length / 3; feature += 1) {
      const offset = feature * 3;
      const selectedOffset = selectedFeature * 3;
      if (
        pointProjectsFarther(
          shape.vertices[offset]!,
          shape.vertices[offset + 1]!,
          shape.vertices[offset + 2]!,
          shape.vertices[selectedOffset]!,
          shape.vertices[selectedOffset + 1]!,
          shape.vertices[selectedOffset + 2]!,
          directionX,
          directionY,
          directionZ,
        )
      ) {
        selectedFeature = feature;
      }
    }
    output[0] = shape.vertices[selectedFeature * 3]!;
    output[1] = shape.vertices[selectedFeature * 3 + 1]!;
    output[2] = shape.vertices[selectedFeature * 3 + 2]!;
    return selectedFeature;
  }

  if (shape.kind === "ellipsoid") {
    const localX = dotAxis(shape.axes, 0, directionX, directionY, directionZ);
    const localY = dotAxis(shape.axes, 1, directionX, directionY, directionZ);
    const localZ = dotAxis(shape.axes, 2, directionX, directionY, directionZ);
    const localUnit = unitDirection(localX, localY, localZ);
    const denominator = Math.hypot(
      shape.radii[0]! * localUnit[0],
      shape.radii[1]! * localUnit[1],
      shape.radii[2]! * localUnit[2],
    );
    const x =
      denominator > 0
        ? (shape.radii[0]! ** 2 * localUnit[0]) / denominator
        : shape.radii[0]!;
    const y =
      denominator > 0 ? (shape.radii[1]! ** 2 * localUnit[1]) / denominator : 0;
    const z =
      denominator > 0 ? (shape.radii[2]! ** 2 * localUnit[2]) / denominator : 0;
    writeOriented(output, shape.center, shape.axes, x, y, z);
    return 0;
  }

  if (shape.kind === "capsule") {
    const endpoint = pointProjectsFarther(
      shape.end[0]!,
      shape.end[1]!,
      shape.end[2]!,
      shape.start[0]!,
      shape.start[1]!,
      shape.start[2]!,
      directionX,
      directionY,
      directionZ,
    )
      ? shape.end
      : shape.start;
    const unit = unitDirection(directionX, directionY, directionZ);
    output[0] = endpoint[0]! + shape.radius * unit[0];
    output[1] = endpoint[1]! + shape.radius * unit[1];
    output[2] = endpoint[2]! + shape.radius * unit[2];
    return endpoint === shape.start ? 0 : 1;
  }

  if (shape.kind === "cylinder" || shape.kind === "cone") {
    const localX = dotAxis(shape.axes, 0, directionX, directionY, directionZ);
    const localY = dotAxis(shape.axes, 1, directionX, directionY, directionZ);
    const localZ = dotAxis(shape.axes, 2, directionX, directionY, directionZ);
    const radialUnit = unitDirection(localX, 0, localZ);
    const radial = Math.hypot(localX, localZ);
    const x = radial > 0 ? shape.radius * radialUnit[0] : shape.radius;
    const z = radial > 0 ? shape.radius * radialUnit[2] : 0;
    if (shape.kind === "cone") {
      if (
        pointProjectsFarther(
          0,
          shape.halfHeight,
          0,
          x,
          -shape.halfHeight,
          z,
          localX,
          localY,
          localZ,
        )
      ) {
        writeOriented(output, shape.center, shape.axes, 0, shape.halfHeight, 0);
        return 1;
      }
      writeOriented(output, shape.center, shape.axes, x, -shape.halfHeight, z);
      return 0;
    }
    writeOriented(
      output,
      shape.center,
      shape.axes,
      x,
      positiveDirection(localY, localX, localY, localZ)
        ? shape.halfHeight
        : -shape.halfHeight,
      z,
    );
    return positiveDirection(localY, localX, localY, localZ) ? 1 : 0;
  }

  const localDirectionX = dotAxis(
    shape.axes,
    0,
    directionX,
    directionY,
    directionZ,
  );
  const localDirectionY = dotAxis(
    shape.axes,
    1,
    directionX,
    directionY,
    directionZ,
  );
  const localDirectionZ = dotAxis(
    shape.axes,
    2,
    directionX,
    directionY,
    directionZ,
  );
  const selectedFeature =
    (positiveDirection(
      localDirectionX,
      localDirectionX,
      localDirectionY,
      localDirectionZ,
    )
      ? 1
      : 0) |
    (positiveDirection(
      localDirectionY,
      localDirectionX,
      localDirectionY,
      localDirectionZ,
    )
      ? 2
      : 0) |
    (positiveDirection(
      localDirectionZ,
      localDirectionX,
      localDirectionY,
      localDirectionZ,
    )
      ? 4
      : 0);
  writeOriented(
    output,
    shape.center,
    shape.axes,
    (selectedFeature & 1) === 0
      ? -shape.halfExtents[0]!
      : shape.halfExtents[0]!,
    (selectedFeature & 2) === 0
      ? -shape.halfExtents[1]!
      : shape.halfExtents[1]!,
    (selectedFeature & 4) === 0
      ? -shape.halfExtents[2]!
      : shape.halfExtents[2]!,
  );
  return selectedFeature;
}

function unitDirection(
  x: number,
  y: number,
  z: number,
): readonly [number, number, number] {
  const scale = Math.max(Math.abs(x), Math.abs(y), Math.abs(z));
  if (scale === 0) return [1, 0, 0];
  const sx = x / scale;
  const sy = y / scale;
  const sz = z / scale;
  const inverse = 1 / Math.hypot(sx, sy, sz);
  return [sx * inverse, sy * inverse, sz * inverse];
}

function pointProjectsFarther(
  candidateX: number,
  candidateY: number,
  candidateZ: number,
  selectedX: number,
  selectedY: number,
  selectedZ: number,
  directionX: number,
  directionY: number,
  directionZ: number,
): boolean {
  const dx = candidateX - selectedX;
  const dy = candidateY - selectedY;
  const dz = candidateZ - selectedZ;
  const difference = dx * directionX + dy * directionY + dz * directionZ;
  const roundoff =
    Number.EPSILON *
    16 *
    (Math.abs(dx * directionX) +
      Math.abs(dy * directionY) +
      Math.abs(dz * directionZ));
  return difference > roundoff;
}

function positiveDirection(
  candidate: number,
  directionX: number,
  directionY: number,
  directionZ: number,
): boolean {
  return (
    candidate >
    Number.EPSILON *
      16 *
      Math.max(Math.abs(directionX), Math.abs(directionY), Math.abs(directionZ))
  );
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

function prepareHull(
  record: Extract<ConvexShapeRecord3D, { kind: "convexHull" }>,
  outerPose: InternalPose3D,
): PreparedVertexCloud3D {
  const local = record.vertices;
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
  return { kind: "hull", center, vertices, faces: record.faces };
}

function axesForPose(pose: InternalPose3D): Float64Array {
  const rotation = new Float64Array(9);
  rotationMatrixInto(rotation, pose.orientation);
  const axes = new Float64Array([
    rotation[0]!,
    rotation[3]!,
    rotation[6]!,
    rotation[1]!,
    rotation[4]!,
    rotation[7]!,
    rotation[2]!,
    rotation[5]!,
    rotation[8]!,
  ]);
  for (let axis = 0; axis < 3; axis += 1) {
    const offset = axis * 3;
    const length = Math.hypot(
      axes[offset]!,
      axes[offset + 1]!,
      axes[offset + 2]!,
    );
    axes[offset] /= length;
    axes[offset + 1] /= length;
    axes[offset + 2] /= length;
  }
  return axes;
}

function dotAxis(
  axes: Float64Array,
  axis: number,
  x: number,
  y: number,
  z: number,
): number {
  return (
    axes[axis * 3]! * x + axes[axis * 3 + 1]! * y + axes[axis * 3 + 2]! * z
  );
}

function writeOriented(
  output: Float64Array,
  center: Float64Array,
  axes: Float64Array,
  x: number,
  y: number,
  z: number,
): void {
  output[0] = center[0]! + axes[0]! * x + axes[3]! * y + axes[6]! * z;
  output[1] = center[1]! + axes[1]! * x + axes[4]! * y + axes[7]! * z;
  output[2] = center[2]! + axes[2]! * x + axes[5]! * y + axes[8]! * z;
}
