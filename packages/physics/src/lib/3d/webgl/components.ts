import { createElement, useMemo } from "@crc/core";
import {
  Mesh,
  createWebGLGeometry,
  type CRCWebGLGeometry,
  type MeshProps,
  type MeshStyle,
} from "@crc/webgl";
import type {
  CRCPhysicsQuaternion,
  CRCPhysicsShape3D,
  CRCPhysicsVector3,
} from "../../../3d-geometry.js";
import {
  boxShape3D,
  capsuleShape3D,
  coneShape3D,
  convexHullShape3D,
  cylinderShape3D,
  ellipsoidShape3D,
  heightfieldShape3D,
} from "../../../3d-geometry.js";
import { composePose3D, transformPointInto } from "../math.js";
import { requireShapeRecord3D, type ShapeRecord3D } from "../shape-records.js";
import { bindPhysicsAttachmentShape3D } from "../runtime/descriptors.js";

export interface PhysicsShape3DProps extends Omit<MeshProps, "geometry"> {
  readonly shape: CRCPhysicsShape3D;
  readonly style?: MeshStyle;
}

export interface Box3DProps extends Omit<PhysicsShape3DProps, "shape"> {
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly center?: CRCPhysicsVector3;
  readonly orientation?: CRCPhysicsQuaternion;
}

export interface Ellipsoid3DProps extends Omit<PhysicsShape3DProps, "shape"> {
  readonly radii: CRCPhysicsVector3;
  readonly center?: CRCPhysicsVector3;
  readonly orientation?: CRCPhysicsQuaternion;
}

export interface Capsule3DProps extends Omit<PhysicsShape3DProps, "shape"> {
  readonly start: CRCPhysicsVector3;
  readonly end: CRCPhysicsVector3;
  readonly radius: number;
}

export interface Cylinder3DProps extends Omit<PhysicsShape3DProps, "shape"> {
  readonly radius: number;
  readonly halfHeight: number;
  readonly center?: CRCPhysicsVector3;
  readonly orientation?: CRCPhysicsQuaternion;
}

export interface Cone3DProps extends Cylinder3DProps {}

export interface ConvexHull3DProps extends Omit<PhysicsShape3DProps, "shape"> {
  readonly points: readonly CRCPhysicsVector3[];
}

export interface Heightfield3DProps extends Omit<PhysicsShape3DProps, "shape"> {
  readonly rows: number;
  readonly columns: number;
  readonly heights: ArrayLike<number>;
  readonly cellSizeX?: number;
  readonly cellSizeZ?: number;
  readonly heightScale?: number;
  readonly origin?: CRCPhysicsVector3;
}

const geometries = new WeakMap<object, CRCWebGLGeometry>();

export function PhysicsShape3D(props: Readonly<PhysicsShape3DProps>) {
  const geometry = physicsGeometryForShape3DForTest(props.shape);
  const { shape: _shape, ...meshProps } = props;
  return createElement(Mesh, {
    ...meshProps,
    geometry,
    ...(meshProps.physics === undefined
      ? {}
      : {
          physics: bindPhysicsAttachmentShape3D(meshProps.physics, props.shape),
        }),
  });
}

/** Package-private deterministic geometry/cache evidence. */
export function physicsGeometryForShape3DForTest(
  shape: CRCPhysicsShape3D,
): CRCWebGLGeometry {
  let geometry = geometries.get(shape as object);
  if (geometry === undefined) {
    geometry = geometryForShape(shape);
    geometries.set(shape as object, geometry);
  }
  return geometry;
}

export function Box3D(props: Readonly<Box3DProps>) {
  const { width, height, depth, center, orientation, ...rest } = props;
  const shape = useMemo(
    () => boxShape3D({ width, height, depth, center, orientation }),
    [width, height, depth, ...vector(center), ...quaternion(orientation)],
  );
  return createElement(PhysicsShape3D, { ...rest, shape });
}

export function Ellipsoid3D(props: Readonly<Ellipsoid3DProps>) {
  const { radii, center, orientation, ...rest } = props;
  const shape = useMemo(
    () => ellipsoidShape3D({ radii, center, orientation }),
    [...radii, ...vector(center), ...quaternion(orientation)],
  );
  return createElement(PhysicsShape3D, { ...rest, shape });
}

export function Capsule3D(props: Readonly<Capsule3DProps>) {
  const { start, end, radius, ...rest } = props;
  const shape = useMemo(
    () => capsuleShape3D({ start, end, radius }),
    [...start, ...end, radius],
  );
  return createElement(PhysicsShape3D, { ...rest, shape });
}

export function Cylinder3D(props: Readonly<Cylinder3DProps>) {
  const { radius, halfHeight, center, orientation, ...rest } = props;
  const shape = useMemo(
    () => cylinderShape3D({ radius, halfHeight, center, orientation }),
    [radius, halfHeight, ...vector(center), ...quaternion(orientation)],
  );
  return createElement(PhysicsShape3D, { ...rest, shape });
}

export function Cone3D(props: Readonly<Cone3DProps>) {
  const { radius, halfHeight, center, orientation, ...rest } = props;
  const shape = useMemo(
    () => coneShape3D({ radius, halfHeight, center, orientation }),
    [radius, halfHeight, ...vector(center), ...quaternion(orientation)],
  );
  return createElement(PhysicsShape3D, { ...rest, shape });
}

export function ConvexHull3D(props: Readonly<ConvexHull3DProps>) {
  const { points, ...rest } = props;
  const deps = points.flatMap((point) => [...point]);
  const shape = useMemo(() => convexHullShape3D({ points }), deps);
  return createElement(PhysicsShape3D, { ...rest, shape });
}

export function Heightfield3D(props: Readonly<Heightfield3DProps>) {
  const {
    rows,
    columns,
    heights,
    cellSizeX,
    cellSizeZ,
    heightScale,
    origin,
    ...rest
  } = props;
  const deps = [
    rows,
    columns,
    cellSizeX,
    cellSizeZ,
    heightScale,
    ...vector(origin),
    ...Array.from(heights),
  ];
  const shape = useMemo(
    () =>
      heightfieldShape3D({
        rows,
        columns,
        heights,
        cellSizeX,
        cellSizeZ,
        heightScale,
        origin,
      }),
    deps,
  );
  return createElement(PhysicsShape3D, { ...rest, shape });
}

function geometryForShape(shape: CRCPhysicsShape3D): CRCWebGLGeometry {
  const record = requireShapeRecord3D(shape);
  const triangles: number[] = [];
  if (record.kind === "box")
    appendBox(triangles, record.center, record.halfExtents, record.orientation);
  else if (record.kind === "sphere")
    appendEllipsoid(
      triangles,
      record.center,
      [record.radius, record.radius, record.radius],
      [0, 0, 0, 1],
    );
  else if (record.kind === "ellipsoid")
    appendEllipsoid(triangles, record.center, record.radii, record.orientation);
  else if (record.kind === "capsule")
    appendCapsule(triangles, record.start, record.end, record.radius);
  else if (record.kind === "cylinder")
    appendCylinder(
      triangles,
      record.center,
      record.radius,
      record.halfHeight,
      record.orientation,
      false,
    );
  else if (record.kind === "cone")
    appendCylinder(
      triangles,
      record.center,
      record.radius,
      record.halfHeight,
      record.orientation,
      true,
    );
  else if (record.kind === "convexHull")
    appendIndexed(triangles, record.vertices, record.faces);
  else if (record.kind === "triangleMesh" || record.kind === "heightfield")
    triangles.push(...record.triangles);
  applyLocalPose(triangles, record);
  const normals = triangleNormals(triangles);
  return createWebGLGeometry({ positions: triangles, normals });
}

function appendBox(
  output: number[],
  center: ArrayLike<number>,
  half: ArrayLike<number>,
  orientation: ArrayLike<number>,
): void {
  const corners = Array.from({ length: 8 }, (_, feature) =>
    orientedPoint(center, orientation, [
      (feature & 1) === 0 ? -half[0]! : half[0]!,
      (feature & 2) === 0 ? -half[1]! : half[1]!,
      (feature & 4) === 0 ? -half[2]! : half[2]!,
    ]),
  );
  for (const [a, b, c, d] of [
    [0, 2, 3, 1],
    [4, 5, 7, 6],
    [0, 1, 5, 4],
    [2, 6, 7, 3],
    [0, 4, 6, 2],
    [1, 3, 7, 5],
  ] as const) {
    triangle(output, corners[a]!, corners[b]!, corners[c]!);
    triangle(output, corners[a]!, corners[c]!, corners[d]!);
  }
}

function appendEllipsoid(
  output: number[],
  center: ArrayLike<number>,
  radii: ArrayLike<number>,
  orientation: ArrayLike<number>,
): void {
  const point = (latitude: number, longitude: number) => {
    const phi = -Math.PI / 2 + (latitude / 10) * Math.PI;
    const theta = (longitude / 20) * Math.PI * 2;
    return orientedPoint(center, orientation, [
      Math.cos(phi) * Math.cos(theta) * radii[0]!,
      Math.sin(phi) * radii[1]!,
      Math.cos(phi) * Math.sin(theta) * radii[2]!,
    ]);
  };
  for (let latitude = 0; latitude < 10; latitude += 1) {
    for (let longitude = 0; longitude < 20; longitude += 1) {
      const next = (longitude + 1) % 20;
      const a = point(latitude, longitude);
      const b = point(latitude + 1, longitude);
      const c = point(latitude + 1, next);
      const d = point(latitude, next);
      triangle(output, a, b, c);
      triangle(output, a, c, d);
    }
  }
}

function appendCapsule(
  output: number[],
  start: ArrayLike<number>,
  end: ArrayLike<number>,
  radius: number,
): void {
  const axis = unit([
    end[0]! - start[0]!,
    end[1]! - start[1]!,
    end[2]! - start[2]!,
  ]);
  const rotation = quaternionFromY(axis);
  const center = [
    (start[0]! + end[0]!) / 2,
    (start[1]! + end[1]!) / 2,
    (start[2]! + end[2]!) / 2,
  ];
  const half =
    Math.hypot(end[0]! - start[0]!, end[1]! - start[1]!, end[2]! - start[2]!) /
    2;
  const point = (latitude: number, longitude: number) => {
    const lower = latitude <= 6;
    const phi = lower
      ? -Math.PI / 2 + (latitude / 6) * (Math.PI / 2)
      : ((latitude - 7) / 6) * (Math.PI / 2);
    const theta = (longitude / 20) * Math.PI * 2;
    const y = Math.sin(phi) * radius + (lower ? -half : half);
    return orientedPoint(center, rotation, [
      Math.cos(phi) * Math.cos(theta) * radius,
      y,
      Math.cos(phi) * Math.sin(theta) * radius,
    ]);
  };
  for (let latitude = 0; latitude < 13; latitude += 1)
    for (let longitude = 0; longitude < 20; longitude += 1) {
      const next = (longitude + 1) % 20;
      const a = point(latitude, longitude);
      const b = point(latitude + 1, longitude);
      const c = point(latitude + 1, next);
      const d = point(latitude, next);
      triangle(output, a, b, c);
      triangle(output, a, c, d);
    }
}

function appendCylinder(
  output: number[],
  center: ArrayLike<number>,
  radius: number,
  halfHeight: number,
  orientation: ArrayLike<number>,
  cone: boolean,
): void {
  const bottomCenter = orientedPoint(center, orientation, [0, -halfHeight, 0]);
  const topCenter = orientedPoint(center, orientation, [0, halfHeight, 0]);
  for (let segment = 0; segment < 24; segment += 1) {
    const next = (segment + 1) % 24;
    const angle = (segment / 24) * Math.PI * 2;
    const nextAngle = (next / 24) * Math.PI * 2;
    const bottomA = orientedPoint(center, orientation, [
      Math.cos(angle) * radius,
      -halfHeight,
      Math.sin(angle) * radius,
    ]);
    const bottomB = orientedPoint(center, orientation, [
      Math.cos(nextAngle) * radius,
      -halfHeight,
      Math.sin(nextAngle) * radius,
    ]);
    const topA = cone
      ? topCenter
      : orientedPoint(center, orientation, [
          Math.cos(angle) * radius,
          halfHeight,
          Math.sin(angle) * radius,
        ]);
    const topB = cone
      ? topCenter
      : orientedPoint(center, orientation, [
          Math.cos(nextAngle) * radius,
          halfHeight,
          Math.sin(nextAngle) * radius,
        ]);
    triangle(output, bottomCenter, bottomB, bottomA);
    triangle(output, bottomA, bottomB, topB);
    if (!cone) {
      triangle(output, bottomA, topB, topA);
      triangle(output, topCenter, topA, topB);
    }
  }
}

function appendIndexed(
  output: number[],
  positions: Float64Array,
  indices: Uint32Array,
): void {
  for (let index = 0; index < indices.length; index += 3) {
    triangle(
      output,
      vertex(positions, indices[index]!),
      vertex(positions, indices[index + 1]!),
      vertex(positions, indices[index + 2]!),
    );
  }
}

function applyLocalPose(positions: number[], record: ShapeRecord3D): void {
  const pose = composePose3D(
    {
      position: new Float64Array(3),
      orientation: new Float64Array([0, 0, 0, 1]),
    },
    record.localPose,
  );
  const source = new Float64Array(3);
  const target = new Float64Array(3);
  for (let index = 0; index < positions.length; index += 3) {
    source.set([
      positions[index]!,
      positions[index + 1]!,
      positions[index + 2]!,
    ]);
    transformPointInto(target, source, pose);
    positions[index] = target[0]!;
    positions[index + 1] = target[1]!;
    positions[index + 2] = target[2]!;
  }
}

function triangleNormals(positions: number[]): number[] {
  const normals: number[] = [];
  for (let index = 0; index < positions.length; index += 9) {
    const a = positions.slice(index, index + 3);
    const b = positions.slice(index + 3, index + 6);
    const c = positions.slice(index + 6, index + 9);
    const normal = unit(cross(subtract(b, a), subtract(c, a)));
    normals.push(...normal, ...normal, ...normal);
  }
  return normals;
}

function triangle(
  output: number[],
  a: ArrayLike<number>,
  b: ArrayLike<number>,
  c: ArrayLike<number>,
): void {
  output.push(a[0]!, a[1]!, a[2]!, b[0]!, b[1]!, b[2]!, c[0]!, c[1]!, c[2]!);
}

function orientedPoint(
  center: ArrayLike<number>,
  quaternion: ArrayLike<number>,
  point: ArrayLike<number>,
): number[] {
  const [x, y, z, w] = [
    quaternion[0]!,
    quaternion[1]!,
    quaternion[2]!,
    quaternion[3]!,
  ];
  const tx = 2 * (y * point[2]! - z * point[1]!);
  const ty = 2 * (z * point[0]! - x * point[2]!);
  const tz = 2 * (x * point[1]! - y * point[0]!);
  return [
    center[0]! + point[0]! + w * tx + y * tz - z * ty,
    center[1]! + point[1]! + w * ty + z * tx - x * tz,
    center[2]! + point[2]! + w * tz + x * ty - y * tx,
  ];
}

function quaternionFromY(
  axis: readonly number[],
): readonly [number, number, number, number] {
  const dotY = axis[1]!;
  if (dotY < -0.999999) return [1, 0, 0, 0];
  const cross = [axis[2]!, 0, -axis[0]!];
  const w = 1 + dotY;
  return unitQuaternion([cross[0], cross[1], cross[2], w]);
}

function unitQuaternion(
  value: readonly number[],
): readonly [number, number, number, number] {
  const length = Math.hypot(...value);
  return [
    value[0]! / length,
    value[1]! / length,
    value[2]! / length,
    value[3]! / length,
  ];
}

function vertex(values: Float64Array, index: number): number[] {
  return [values[index * 3]!, values[index * 3 + 1]!, values[index * 3 + 2]!];
}

function subtract(left: ArrayLike<number>, right: ArrayLike<number>): number[] {
  return [left[0]! - right[0]!, left[1]! - right[1]!, left[2]! - right[2]!];
}

function cross(left: ArrayLike<number>, right: ArrayLike<number>): number[] {
  return [
    left[1]! * right[2]! - left[2]! * right[1]!,
    left[2]! * right[0]! - left[0]! * right[2]!,
    left[0]! * right[1]! - left[1]! * right[0]!,
  ];
}

function unit(value: readonly number[]): number[] {
  const length = Math.hypot(...value);
  return length === 0
    ? [0, 1, 0]
    : value.map((component) => component / length);
}

function vector(value: CRCPhysicsVector3 | undefined): readonly number[] {
  return value ?? [0, 0, 0];
}

function quaternion(
  value: CRCPhysicsQuaternion | undefined,
): readonly number[] {
  return value ?? [0, 0, 0, 1];
}
