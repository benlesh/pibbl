import type { ShapeRecord2D, ConvexLeaf2D } from "../shape-records.js";
import type { PhysicsWorld2DKernel } from "../world/world.js";
import { COLLIDER_SENSOR_2D } from "../world/contact-cache.js";

/** Engine-owned snapshot. Publish only after adoption; never borrow kernel arrays. */
export class CommittedBoxObstacles2D {
  private batch = { revision: 0, boxes: new Float64Array(0) };
  private error: Error | undefined;
  private readonly rectangle = new Float64Array(5);
  read(): Readonly<{ revision: number; boxes: Float64Array }> {
    if (this.error) throw this.error;
    return this.batch;
  }
  countBoxes(shape: ShapeRecord2D): number {
    for (const leaf of shape.leaves) {
      this.describeRectangle(leaf);
    }
    return shape.leaves.length;
  }
  private describeRectangle(leaf: ConvexLeaf2D): void {
    const out = this.rectangle;
    if (leaf.kind === "box") {
      out[0] = leaf.center[0]!; out[1] = leaf.center[1]!;
      out[2] = leaf.halfWidth; out[3] = leaf.halfHeight; out[4] = 0;
      return;
    }
    if (leaf.kind === "polygon" && leaf.vertices.length === 8) {
      const v = leaf.vertices;
      const ax = v[2]! - v[0]!, ay = v[3]! - v[1]!;
      const bx = v[6]! - v[0]!, by = v[7]! - v[1]!;
      const a = Math.hypot(ax, ay), b = Math.hypot(bx, by);
      const tolerance = Math.max(a, b) * 1e-10;
      if (a > 0 && b > 0 && Math.abs(ax * bx + ay * by) <= a * b * 1e-10 &&
          Math.abs(v[4]! - v[0]! - ax - bx) <= tolerance &&
          Math.abs(v[5]! - v[1]! - ay - by) <= tolerance) {
        out[0] = (v[0]! + v[4]!) / 2; out[1] = (v[1]! + v[5]!) / 2;
        out[2] = a / 2; out[3] = b / 2; out[4] = Math.atan2(ay, ax);
        return;
      }
    }
    throw new TypeError("Physics box obstacles require box colliders; unsupported solid: " + leaf.kind);
  }
  publish(world: PhysicsWorld2DKernel, entries: readonly Readonly<{ id: number; bodyId: number }>[], revision: number): void {
    // Validation precedes writes. Unsupported topology must not partially replace
    // the previous committed snapshot or throw out of physics commit adoption.
    let count = 0;
    try {
      for (const entry of entries) {
        const collider = world.colliderIdentity(entry.id);
        if (!collider || !world.isBodyEnabled(entry.bodyId) || (world.colliders.flags[collider.index]! & COLLIDER_SENSOR_2D)) continue;
        count += this.countBoxes(world.colliders.shapes[collider.index]!);
      }
    } catch (error) {
      this.error = error instanceof Error ? error : new Error(String(error));
      return;
    }
    this.error = undefined;
    if (this.batch.boxes.length !== count * 10) this.batch = { revision, boxes: new Float64Array(count * 10) };
    const output = this.batch.boxes, bodies = world.bodies;
    let offset = 0;
    for (const entry of entries) {
      const collider = world.colliderIdentity(entry.id);
      if (!collider || !world.isBodyEnabled(entry.bodyId) || (world.colliders.flags[collider.index]! & COLLIDER_SENSOR_2D)) continue;
      const body = world.bodyIdentity(entry.bodyId)!.index;
      const shape = world.colliders.shapes[collider.index]!;
      const rotation = bodies.rotationRadians[body]!;
      const cosine = Math.cos(rotation), sine = Math.sin(rotation);
      const originX = bodies.positionX[body]! - cosine * bodies.localCenterX[body]! + sine * bodies.localCenterY[body]!;
      const originY = bodies.positionY[body]! - sine * bodies.localCenterX[body]! - cosine * bodies.localCenterY[body]!;
      const local = shape.localPose;
      const x = originX + cosine * local.x - sine * local.y;
      const y = originY + sine * local.x + cosine * local.y;
      const angle = rotation + local.rotationRadians;
      const c = Math.cos(angle), s = Math.sin(angle);
      for (const leaf of shape.leaves) {
        this.describeRectangle(leaf);
        const rect = this.rectangle;
        output[offset++] = x + c * rect[0]! - s * rect[1]!;
        output[offset++] = y + s * rect[0]! + c * rect[1]!;
        output[offset++] = rect[2]!;
        output[offset++] = rect[3]!;
        output[offset++] = angle + rect[4]!;
        output[offset++] = bodies.linearVelocityX[body]!;
        output[offset++] = bodies.linearVelocityY[body]!;
        output[offset++] = bodies.angularVelocity[body]!;
        output[offset++] = bodies.positionX[body]!;
        output[offset++] = bodies.positionY[body]!;
      }
    }
    this.batch.revision = revision;
  }
}
