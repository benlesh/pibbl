import type { CRCPhysicsShape3D } from "../../3d-geometry.js";
import type { InternalPose3D } from "./math.js";

interface ShapeRecordBase3D {
  readonly localPose: InternalPose3D;
}

export interface SphereShapeRecord3D extends ShapeRecordBase3D {
  readonly kind: "sphere";
  readonly center: Float64Array;
  readonly radius: number;
}

export interface BoxShapeRecord3D extends ShapeRecordBase3D {
  readonly kind: "box";
  readonly center: Float64Array;
  readonly orientation: Float64Array;
  readonly halfExtents: Float64Array;
}

export type ShapeRecord3D = SphereShapeRecord3D | BoxShapeRecord3D;

const shapeRecords3D = new WeakMap<object, ShapeRecord3D>();

export function createShape3D(record: ShapeRecord3D): CRCPhysicsShape3D {
  const shell = Object.freeze({}) as CRCPhysicsShape3D;
  shapeRecords3D.set(shell, Object.freeze(record));
  return shell;
}

export function requireShapeRecord3D(shape: CRCPhysicsShape3D): ShapeRecord3D {
  const record =
    typeof shape === "object" && shape !== null
      ? shapeRecords3D.get(shape)
      : undefined;
  if (record === undefined) {
    throw new TypeError("shape must be a CRC physics 3D shape.");
  }
  return record;
}
