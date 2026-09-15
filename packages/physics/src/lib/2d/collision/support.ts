import { transformPointInto, type InternalPose2D } from '../math.js';
import { GEOMETRY_EPSILON } from '../numeric-policy.js';
import type { ConvexLeaf2D } from '../shape-records.js';

export interface SupportPoint2D {
  readonly x: number;
  readonly y: number;
  readonly feature: number;
}

export interface MinkowskiVertex2D {
  readonly x: number;
  readonly y: number;
  readonly firstX: number;
  readonly firstY: number;
  readonly secondX: number;
  readonly secondY: number;
  readonly firstFeature: number;
  readonly secondFeature: number;
}

export function supportMinkowski2D(
  first: ConvexLeaf2D,
  firstPose: InternalPose2D,
  second: ConvexLeaf2D,
  secondPose: InternalPose2D,
  directionX: number,
  directionY: number,
): MinkowskiVertex2D {
  const points = new Float64Array(4);
  const firstFeature = supportLeaf2D(points, 0, first, firstPose, directionX, directionY);
  const secondFeature = supportLeaf2D(points, 2, second, secondPose, -directionX, -directionY);
  return {
    x: points[0]! - points[2]!,
    y: points[1]! - points[3]!,
    firstX: points[0]!,
    firstY: points[1]!,
    secondX: points[2]!,
    secondY: points[3]!,
    firstFeature,
    secondFeature,
  };
}

export function supportLeaf2D(
  output: Float64Array,
  outputOffset: number,
  leaf: ConvexLeaf2D,
  pose: InternalPose2D,
  directionX: number,
  directionY: number,
): number {
  const cosine = Math.cos(pose.rotationRadians);
  const sine = Math.sin(pose.rotationRadians);
  const localDirectionX = cosine * directionX + sine * directionY;
  const localDirectionY = -sine * directionX + cosine * directionY;
  const local = localSupport(leaf, localDirectionX, localDirectionY);
  transformPointInto(output, outputOffset, local.x, local.y, pose);
  return local.feature;
}

export function centerOfLeaf2D(
  output: Float64Array,
  outputOffset: number,
  leaf: ConvexLeaf2D,
  pose: InternalPose2D,
): void {
  let x: number;
  let y: number;
  switch (leaf.kind) {
    case 'circle':
    case 'ellipse':
    case 'box':
    case 'rounded-box':
      x = leaf.center[0]!;
      y = leaf.center[1]!;
      break;
    case 'capsule':
    case 'segment':
      x = (leaf.start[0]! + leaf.end[0]!) / 2;
      y = (leaf.start[1]! + leaf.end[1]!) / 2;
      break;
    case 'polygon': {
      x = 0;
      y = 0;
      const count = leaf.vertices.length / 2;
      for (let index = 0; index < count; index += 1) {
        x += leaf.vertices[index * 2]!;
        y += leaf.vertices[index * 2 + 1]!;
      }
      x /= count;
      y /= count;
      break;
    }
  }
  transformPointInto(output, outputOffset, x, y, pose);
}

function localSupport(
  leaf: ConvexLeaf2D,
  directionX: number,
  directionY: number,
): SupportPoint2D {
  const length = Math.hypot(directionX, directionY);
  const unitX = length > GEOMETRY_EPSILON ? directionX / length : 1;
  const unitY = length > GEOMETRY_EPSILON ? directionY / length : 0;
  switch (leaf.kind) {
    case 'circle':
      return { x: leaf.center[0]! + unitX * leaf.radius, y: leaf.center[1]! + unitY * leaf.radius, feature: 0 };
    case 'ellipse': {
      const cosine = Math.cos(leaf.rotationRadians);
      const sine = Math.sin(leaf.rotationRadians);
      const dx = cosine * directionX + sine * directionY;
      const dy = -sine * directionX + cosine * directionY;
      const denominator = Math.hypot(leaf.radiusX * dx, leaf.radiusY * dy);
      const ellipseX = denominator > GEOMETRY_EPSILON
        ? leaf.radiusX * leaf.radiusX * dx / denominator
        : leaf.radiusX;
      const ellipseY = denominator > GEOMETRY_EPSILON
        ? leaf.radiusY * leaf.radiusY * dy / denominator
        : 0;
      return {
        x: leaf.center[0]! + cosine * ellipseX - sine * ellipseY,
        y: leaf.center[1]! + sine * ellipseX + cosine * ellipseY,
        feature: 0,
      };
    }
    case 'box': {
      const vertices = [
        [-leaf.halfWidth, -leaf.halfHeight],
        [leaf.halfWidth, -leaf.halfHeight],
        [leaf.halfWidth, leaf.halfHeight],
        [-leaf.halfWidth, leaf.halfHeight],
      ] as const;
      let best = 0;
      let bestProjection = Number.NEGATIVE_INFINITY;
      for (let index = 0; index < vertices.length; index += 1) {
        const vertex = vertices[index]!;
        const projection = vertex[0] * directionX + vertex[1] * directionY;
        if (projection > bestProjection) {
          best = index;
          bestProjection = projection;
        }
      }
      const vertex = vertices[best]!;
      return { x: leaf.center[0]! + vertex[0], y: leaf.center[1]! + vertex[1], feature: best };
    }
    case 'rounded-box': {
      let bestX = 0;
      let bestY = 0;
      let bestProjection = Number.NEGATIVE_INFINITY;
      let bestFeature = 0;
      for (let feature = 0; feature < 4; feature += 1) {
        const radius = leaf.radii[feature]!;
        const right = feature === 1 || feature === 2;
        const bottom = feature >= 2;
        const x = leaf.center[0]! + (right ? leaf.halfWidth - radius : -leaf.halfWidth + radius) + unitX * radius;
        const y = leaf.center[1]! + (bottom ? leaf.halfHeight - radius : -leaf.halfHeight + radius) + unitY * radius;
        const projection = x * directionX + y * directionY;
        if (projection > bestProjection + GEOMETRY_EPSILON) {
          bestX = x;
          bestY = y;
          bestProjection = projection;
          bestFeature = feature;
        }
      }
      return { x: bestX, y: bestY, feature: bestFeature };
    }
    case 'capsule': {
      const startProjection = leaf.start[0]! * directionX + leaf.start[1]! * directionY;
      const endProjection = leaf.end[0]! * directionX + leaf.end[1]! * directionY;
      const feature = endProjection > startProjection ? 1 : 0;
      const endpoint = feature === 0 ? leaf.start : leaf.end;
      return { x: endpoint[0]! + unitX * leaf.radius, y: endpoint[1]! + unitY * leaf.radius, feature };
    }
    case 'segment': {
      const startProjection = leaf.start[0]! * directionX + leaf.start[1]! * directionY;
      const endProjection = leaf.end[0]! * directionX + leaf.end[1]! * directionY;
      const feature = endProjection > startProjection ? 1 : 0;
      const endpoint = feature === 0 ? leaf.start : leaf.end;
      return { x: endpoint[0]!, y: endpoint[1]!, feature };
    }
    case 'polygon': {
      let best = 0;
      let bestProjection = Number.NEGATIVE_INFINITY;
      for (let index = 0; index < leaf.vertices.length / 2; index += 1) {
        const x = leaf.vertices[index * 2]!;
        const y = leaf.vertices[index * 2 + 1]!;
        const projection = x * directionX + y * directionY;
        if (projection > bestProjection) {
          best = index;
          bestProjection = projection;
        }
      }
      return { x: leaf.vertices[best * 2]!, y: leaf.vertices[best * 2 + 1]!, feature: best };
    }
  }
}
