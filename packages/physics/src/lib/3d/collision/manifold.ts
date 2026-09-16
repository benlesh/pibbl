import type {
  CRCPhysicsShapeContact3D,
  CRCPhysicsVector3,
} from "../../../3d-geometry.js";
import { cleanZero } from "../math.js";
import { GEOMETRY_EPSILON_3D } from "../numeric-policy.js";
import type { PreparedBox3D, PreparedConvexShape3D } from "./support.js";

export interface PrivatePairDistance3D {
  readonly separation: number;
  readonly firstX: number;
  readonly firstY: number;
  readonly firstZ: number;
  readonly secondX: number;
  readonly secondY: number;
  readonly secondZ: number;
  readonly normalX: number;
  readonly normalY: number;
  readonly normalZ: number;
  readonly firstFeature: number;
  readonly secondFeature: number;
}

export interface PrivateManifoldPoint3D {
  readonly firstX: number;
  readonly firstY: number;
  readonly firstZ: number;
  readonly secondX: number;
  readonly secondY: number;
  readonly secondZ: number;
  readonly separation: number;
  readonly firstFeature: number;
  readonly secondFeature: number;
}

export interface PrivateManifold3D {
  readonly normalX: number;
  readonly normalY: number;
  readonly normalZ: number;
  readonly points: readonly PrivateManifoldPoint3D[];
}

interface BoxFace3D {
  readonly center: readonly [number, number, number];
  readonly normal: readonly [number, number, number];
  readonly tangentU: readonly [number, number, number];
  readonly tangentV: readonly [number, number, number];
  readonly halfU: number;
  readonly halfV: number;
  readonly feature: number;
  readonly vertices: readonly ClipVertex3D[];
}

interface ClipVertex3D {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly feature: number;
}

export function createPrivateManifold3D(
  distance: PrivatePairDistance3D,
  first: PreparedConvexShape3D,
  second: PreparedConvexShape3D,
): PrivateManifold3D {
  const points = first.kind === "box" && second.kind === "box"
    ? boxContactPoints(distance, first, second)
    : [fallbackPoint(distance)];
  return {
    normalX: distance.normalX,
    normalY: distance.normalY,
    normalZ: distance.normalZ,
    points,
  };
}

export function publicContactFromManifold3D(
  manifold: PrivateManifold3D,
): CRCPhysicsShapeContact3D {
  const points = manifold.points.map((point) => Object.freeze({
    pointOnFirst: freezeCollisionVector3(point.firstX, point.firstY, point.firstZ),
    pointOnSecond: freezeCollisionVector3(point.secondX, point.secondY, point.secondZ),
    separation: cleanZero(point.separation),
  }));
  return Object.freeze({
    normal: freezeCollisionVector3(manifold.normalX, manifold.normalY, manifold.normalZ),
    points: Object.freeze(points),
  });
}

export function freezeCollisionVector3(
  x: number,
  y: number,
  z: number,
): CRCPhysicsVector3 {
  return Object.freeze([
    collisionZero(x),
    collisionZero(y),
    collisionZero(z),
  ] as const);
}

function boxContactPoints(
  distance: PrivatePairDistance3D,
  first: PreparedBox3D,
  second: PreparedBox3D,
): readonly PrivateManifoldPoint3D[] {
  const normal = [distance.normalX, distance.normalY, distance.normalZ] as const;
  const firstFace = supportingFace(first, [-normal[0], -normal[1], -normal[2]]);
  const secondFace = supportingFace(second, normal);
  const firstAlignment = -dot(firstFace.normal, normal);
  const secondAlignment = dot(secondFace.normal, normal);
  const firstIsReference = firstAlignment >= secondAlignment - GEOMETRY_EPSILON_3D;
  const reference = firstIsReference ? firstFace : secondFace;
  const incident = firstIsReference ? secondFace : firstFace;
  let polygon = [...incident.vertices];
  polygon = clipPolygon(polygon, reference.tangentU, dot(reference.center, reference.tangentU) + reference.halfU, true, 0);
  polygon = clipPolygon(polygon, reference.tangentU, dot(reference.center, reference.tangentU) - reference.halfU, false, 1);
  polygon = clipPolygon(polygon, reference.tangentV, dot(reference.center, reference.tangentV) + reference.halfV, true, 2);
  polygon = clipPolygon(polygon, reference.tangentV, dot(reference.center, reference.tangentV) - reference.halfV, false, 3);
  const points: PrivateManifoldPoint3D[] = [];
  for (const vertex of polygon) {
    const relative = [
      vertex.x - reference.center[0],
      vertex.y - reference.center[1],
      vertex.z - reference.center[2],
    ] as const;
    const separation = dot(relative, reference.normal);
    if (separation > GEOMETRY_EPSILON_3D) continue;
    const projected = [
      vertex.x - separation * reference.normal[0],
      vertex.y - separation * reference.normal[1],
      vertex.z - separation * reference.normal[2],
    ] as const;
    points.push(firstIsReference
      ? {
          firstX: projected[0], firstY: projected[1], firstZ: projected[2],
          secondX: vertex.x, secondY: vertex.y, secondZ: vertex.z,
          separation,
          firstFeature: reference.feature,
          secondFeature: vertex.feature,
        }
      : {
          firstX: vertex.x, firstY: vertex.y, firstZ: vertex.z,
          secondX: projected[0], secondY: projected[1], secondZ: projected[2],
          separation,
          firstFeature: vertex.feature,
          secondFeature: reference.feature,
        });
  }
  if (points.length === 0) return [fallbackPoint(distance)];
  points.sort(compareManifoldPoints);
  return points.slice(0, 4);
}

function supportingFace(box: PreparedBox3D, direction: ArrayLike<number>): BoxFace3D {
  let selectedAxis = 0;
  let selectedSign = -1;
  let selectedAlignment = Number.NEGATIVE_INFINITY;
  for (let axis = 0; axis < 3; axis += 1) {
    for (const sign of [-1, 1] as const) {
      const alignment = sign * (
        box.axes[axis * 3]! * direction[0]! +
        box.axes[axis * 3 + 1]! * direction[1]! +
        box.axes[axis * 3 + 2]! * direction[2]!
      );
      const feature = axis * 2 + (sign > 0 ? 1 : 0);
      const selectedFeature = selectedAxis * 2 + (selectedSign > 0 ? 1 : 0);
      if (
        alignment > selectedAlignment + GEOMETRY_EPSILON_3D ||
        (Math.abs(alignment - selectedAlignment) <= GEOMETRY_EPSILON_3D && feature < selectedFeature)
      ) {
        selectedAxis = axis;
        selectedSign = sign;
        selectedAlignment = alignment;
      }
    }
  }
  const otherAxes = [0, 1, 2].filter((axis) => axis !== selectedAxis);
  const normal = axisVector(box, selectedAxis, selectedSign);
  const tangentU = axisVector(box, otherAxes[0]!, 1);
  const tangentV = axisVector(box, otherAxes[1]!, 1);
  const center = [
    box.center[0]! + normal[0] * box.halfExtents[selectedAxis]!,
    box.center[1]! + normal[1] * box.halfExtents[selectedAxis]!,
    box.center[2]! + normal[2] * box.halfExtents[selectedAxis]!,
  ] as const;
  const vertices: ClipVertex3D[] = [];
  for (const [uSign, vSign] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    const x = center[0] + uSign * tangentU[0] * box.halfExtents[otherAxes[0]!]! +
      vSign * tangentV[0] * box.halfExtents[otherAxes[1]!]!;
    const y = center[1] + uSign * tangentU[1] * box.halfExtents[otherAxes[0]!]! +
      vSign * tangentV[1] * box.halfExtents[otherAxes[1]!]!;
    const z = center[2] + uSign * tangentU[2] * box.halfExtents[otherAxes[0]!]! +
      vSign * tangentV[2] * box.halfExtents[otherAxes[1]!]!;
    let feature = selectedSign > 0 ? 1 << selectedAxis : 0;
    if (uSign > 0) feature |= 1 << otherAxes[0]!;
    if (vSign > 0) feature |= 1 << otherAxes[1]!;
    vertices.push({ x, y, z, feature });
  }
  return {
    center,
    normal,
    tangentU,
    tangentV,
    halfU: box.halfExtents[otherAxes[0]!]!,
    halfV: box.halfExtents[otherAxes[1]!]!,
    feature: selectedAxis * 2 + (selectedSign > 0 ? 1 : 0),
    vertices,
  };
}

function clipPolygon(
  input: readonly ClipVertex3D[],
  axis: ArrayLike<number>,
  offset: number,
  keepLess: boolean,
  planeFeature: number,
): ClipVertex3D[] {
  if (input.length === 0) return [];
  const output: ClipVertex3D[] = [];
  for (let index = 0; index < input.length; index += 1) {
    const current = input[index]!;
    const next = input[(index + 1) % input.length]!;
    const currentDistance = current.x * axis[0]! + current.y * axis[1]! + current.z * axis[2]! - offset;
    const nextDistance = next.x * axis[0]! + next.y * axis[1]! + next.z * axis[2]! - offset;
    const currentInside = keepLess ? currentDistance <= GEOMETRY_EPSILON_3D : currentDistance >= -GEOMETRY_EPSILON_3D;
    const nextInside = keepLess ? nextDistance <= GEOMETRY_EPSILON_3D : nextDistance >= -GEOMETRY_EPSILON_3D;
    if (currentInside) output.push(current);
    if (currentInside === nextInside) continue;
    const denominator = currentDistance - nextDistance;
    if (Math.abs(denominator) <= GEOMETRY_EPSILON_3D) continue;
    const amount = currentDistance / denominator;
    output.push({
      x: current.x + amount * (next.x - current.x),
      y: current.y + amount * (next.y - current.y),
      z: current.z + amount * (next.z - current.z),
      feature: 16 + planeFeature * 64 + Math.min(current.feature, next.feature),
    });
  }
  return output;
}

function compareManifoldPoints(first: PrivateManifoldPoint3D, second: PrivateManifoldPoint3D): number {
  if (Math.abs(first.separation - second.separation) > GEOMETRY_EPSILON_3D) {
    return first.separation - second.separation;
  }
  return first.firstFeature - second.firstFeature ||
    first.secondFeature - second.secondFeature ||
    first.firstX - second.firstX ||
    first.firstY - second.firstY ||
    first.firstZ - second.firstZ;
}

function fallbackPoint(distance: PrivatePairDistance3D): PrivateManifoldPoint3D {
  return {
    firstX: distance.firstX,
    firstY: distance.firstY,
    firstZ: distance.firstZ,
    secondX: distance.secondX,
    secondY: distance.secondY,
    secondZ: distance.secondZ,
    separation: distance.separation,
    firstFeature: distance.firstFeature,
    secondFeature: distance.secondFeature,
  };
}

function axisVector(box: PreparedBox3D, axis: number, sign: number): readonly [number, number, number] {
  return [
    sign * box.axes[axis * 3]!,
    sign * box.axes[axis * 3 + 1]!,
    sign * box.axes[axis * 3 + 2]!,
  ];
}

function dot(first: ArrayLike<number>, second: ArrayLike<number>): number {
  return first[0]! * second[0]! + first[1]! * second[1]! + first[2]! * second[2]!;
}

function collisionZero(value: number): number {
  return Math.abs(value) <= Number.EPSILON ? 0 : value;
}
