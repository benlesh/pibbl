import type { CRCPhysicsShape3D } from "../../3d-geometry.js";
import type { InternalPose3D } from "./math.js";

interface ShapeRecordBase3D {
  readonly identity: number;
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

type ShapeRecordInput3D =
  | Omit<SphereShapeRecord3D, "identity">
  | Omit<BoxShapeRecord3D, "identity">;

const shapeRecords3D = new WeakMap<object, ShapeRecord3D>();
const shapeShells3D = new WeakMap<ShapeRecord3D, CRCPhysicsShape3D>();
let nextShapeIdentity3D = 0;

export function createShape3D(record: ShapeRecordInput3D): CRCPhysicsShape3D {
  const shell = Object.freeze({}) as CRCPhysicsShape3D;
  const identity = nextShapeIdentity3D;
  nextShapeIdentity3D += 1;
  const stored = Object.freeze({ ...record, identity }) as ShapeRecord3D;
  shapeRecords3D.set(shell, stored);
  shapeShells3D.set(stored, shell);
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

/** Package-private world/query seam. */
export function shapeForRecord3D(record: ShapeRecord3D): CRCPhysicsShape3D {
  const shape = shapeShells3D.get(record);
  if (shape === undefined) {
    throw new TypeError("shape record does not belong to this CRC physics realm.");
  }
  return shape;
}
