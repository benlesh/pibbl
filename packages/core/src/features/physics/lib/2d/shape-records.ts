import type { PibblPhysicsShape2D } from '../../2d-geometry.js';
import { IDENTITY_POSE_2D, type InternalPose2D } from './math.js';

interface LeafBase2D {
  readonly canonicalLeafIndex: number;
}

export interface CircleLeaf2D extends LeafBase2D {
  readonly kind: 'circle';
  readonly center: Float64Array;
  readonly radius: number;
}

export interface EllipseLeaf2D extends LeafBase2D {
  readonly kind: 'ellipse';
  readonly center: Float64Array;
  readonly radiusX: number;
  readonly radiusY: number;
  readonly rotationRadians: number;
}

export interface BoxLeaf2D extends LeafBase2D {
  readonly kind: 'box';
  readonly center: Float64Array;
  readonly halfWidth: number;
  readonly halfHeight: number;
}

export interface RoundedBoxLeaf2D extends LeafBase2D {
  readonly kind: 'rounded-box';
  readonly center: Float64Array;
  readonly halfWidth: number;
  readonly halfHeight: number;
  readonly radii: Float64Array;
}

export interface CapsuleLeaf2D extends LeafBase2D {
  readonly kind: 'capsule';
  readonly start: Float64Array;
  readonly end: Float64Array;
  readonly radius: number;
}

export interface SegmentLeaf2D extends LeafBase2D {
  readonly kind: 'segment';
  readonly start: Float64Array;
  readonly end: Float64Array;
}

export interface PolygonLeaf2D extends LeafBase2D {
  readonly kind: 'polygon';
  readonly vertices: Float64Array;
}

export type ConvexLeaf2D =
  | CircleLeaf2D
  | EllipseLeaf2D
  | BoxLeaf2D
  | RoundedBoxLeaf2D
  | CapsuleLeaf2D
  | SegmentLeaf2D
  | PolygonLeaf2D;

export interface ShapeRecord2D {
  readonly leaves: readonly ConvexLeaf2D[];
  readonly localPose: InternalPose2D;
  readonly localBounds: Float64Array;
  readonly area: number;
  readonly centroidX: number;
  readonly centroidY: number;
  readonly unitInertia: number;
}

const shapeRecords2D = new WeakMap<object, ShapeRecord2D>();

export function createShape2D(
  record: Omit<ShapeRecord2D, 'localPose'> &
    Readonly<{ localPose?: InternalPose2D }>,
): PibblPhysicsShape2D {
  const shell = Object.freeze({}) as PibblPhysicsShape2D;
  shapeRecords2D.set(
    shell,
    Object.freeze({
      ...record,
      leaves: Object.isFrozen(record.leaves)
        ? record.leaves
        : Object.freeze([...record.leaves]),
      localPose: record.localPose ?? IDENTITY_POSE_2D,
    }),
  );
  return shell;
}

export function requireShapeRecord2D(shape: PibblPhysicsShape2D): ShapeRecord2D {
  const record =
    typeof shape === 'object' && shape !== null
      ? shapeRecords2D.get(shape)
      : undefined;
  if (record === undefined) {
    throw new TypeError('shape must be a Pibbl physics 2D shape.');
  }
  return record;
}
