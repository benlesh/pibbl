import type { ConvexLeaf2D } from "../shape-records.js";
import type { PhysicsWorld2DKernel } from "../world/world.js";
import { COLLIDER_SENSOR_2D } from "../world/contact-cache.js";
export interface PhysicsObstacleBatch2D {
  readonly revision: number;
  readonly boxes: Float64Array;
  readonly ellipses: Float64Array;
  readonly polygons: Float64Array;
}
/** Published copies: no borrowed physics-engine memory or candidate state. */
export class CommittedObstacles2D {
  private batch = {
    revision: 0,
    boxes: new Float64Array(0),
    ellipses: new Float64Array(0),
    polygons: new Float64Array(0),
  };
  private readonly expandedShapes = new WeakMap<
    readonly ConvexLeaf2D[],
    readonly ConvexLeaf2D[]
  >();
  private readonly expandedLeaves = new WeakMap<
    ConvexLeaf2D,
    readonly ConvexLeaf2D[]
  >();
  private leaves(leaves: readonly ConvexLeaf2D[]): readonly ConvexLeaf2D[] {
    // A rounded rectangle with equal corner radii is exactly the union of two
    // central boxes and four disks. Cache the immutable geometry, not world poses.
    const cached = this.expandedShapes.get(leaves);
    if (cached) return cached;
    const result: ConvexLeaf2D[] = [];
    for (const leaf of leaves) {
      if (leaf.kind !== "rounded-box") {
        result.push(leaf);
        continue;
      }
      let expanded = this.expandedLeaves.get(leaf);
      if (!expanded) {
        const radius = leaf.radii[0]!;
        if (!leaf.radii.every((r) => r === radius)) {
          result.push(leaf);
          continue;
        }
        const {
          halfWidth: hw,
          halfHeight: hh,
          center,
          canonicalLeafIndex,
        } = leaf;
        const parts: ConvexLeaf2D[] = [];
        if (hw > radius)
          parts.push({
            kind: "box",
            center,
            halfWidth: hw - radius,
            halfHeight: hh,
            canonicalLeafIndex,
          });
        if (hh > radius)
          parts.push({
            kind: "box",
            center,
            halfWidth: hw,
            halfHeight: hh - radius,
            canonicalLeafIndex,
          });
        if (radius > 0)
          for (const y of [-1, 1])
            for (const x of [-1, 1])
              parts.push({
                kind: "circle",
                center: new Float64Array([
                  center[0]! + x * (hw - radius),
                  center[1]! + y * (hh - radius),
                ]),
                radius,
                canonicalLeafIndex,
              });
        expanded = parts;
        this.expandedLeaves.set(leaf, expanded);
      }
      result.push(...expanded);
    }
    this.expandedShapes.set(leaves, result);
    return result;
  }
  private error: Error | undefined;
  private changed = false;
  private write(output: Float64Array, index: number, value: number): void {
    if (output[index] !== value) {
      output[index] = value;
      this.changed = true;
    }
  }
  read(): PhysicsObstacleBatch2D {
    if (this.error) throw this.error;
    return this.batch;
  }
  publish(
    world: PhysicsWorld2DKernel,
    entries: readonly Readonly<{ id: number; bodyId: number }>[],
    revision: number,
  ): void {
    let boxes = 0,
      ellipses = 0,
      polygons = 0;
    for (const entry of entries) {
      const collider = world.colliderIdentity(entry.id);
      if (
        !collider ||
        !world.isBodyEnabled(entry.bodyId) ||
        world.colliders.flags[collider.index]! & COLLIDER_SENSOR_2D
      )
        continue;
      for (const leaf of this.leaves(
        world.colliders.shapes[collider.index]!.leaves,
      )) {
        if (leaf.kind === "box") boxes += 10;
        else if (leaf.kind === "ellipse" || leaf.kind === "circle")
          ellipses += 10;
        else if (leaf.kind === "polygon") polygons += 6 + leaf.vertices.length;
        else {
          this.error = new TypeError(
            "Unsupported flow obstacle collider: " + leaf.kind,
          );
          return;
        }
      }
    }
    this.changed =
      this.error !== undefined ||
      this.batch.boxes.length !== boxes ||
      this.batch.ellipses.length !== ellipses ||
      this.batch.polygons.length !== polygons;
    this.error = undefined;
    if (this.batch.boxes.length !== boxes)
      this.batch.boxes = new Float64Array(boxes);
    if (this.batch.ellipses.length !== ellipses)
      this.batch.ellipses = new Float64Array(ellipses);
    if (this.batch.polygons.length !== polygons)
      this.batch.polygons = new Float64Array(polygons);
    let boxAt = 0,
      ellipseAt = 0,
      polygonAt = 0;
    const bodies = world.bodies;
    for (const entry of entries) {
      const collider = world.colliderIdentity(entry.id);
      if (
        !collider ||
        !world.isBodyEnabled(entry.bodyId) ||
        world.colliders.flags[collider.index]! & COLLIDER_SENSOR_2D
      )
        continue;
      const body = world.bodyIdentity(entry.bodyId)!.index;
      const shape = world.colliders.shapes[collider.index]!;
      const rotation = bodies.rotationRadians[body]!;
      const cosine = Math.cos(rotation),
        sine = Math.sin(rotation);
      const originX =
        bodies.positionX[body]! -
        cosine * bodies.localCenterX[body]! +
        sine * bodies.localCenterY[body]!;
      const originY =
        bodies.positionY[body]! -
        sine * bodies.localCenterX[body]! -
        cosine * bodies.localCenterY[body]!;
      const local = shape.localPose;
      const x = originX + cosine * local.x - sine * local.y;
      const y = originY + sine * local.x + cosine * local.y;
      const angle = rotation + local.rotationRadians,
        c = Math.cos(angle),
        s = Math.sin(angle);
      for (const leaf of this.leaves(shape.leaves)) {
        if (leaf.kind === "polygon") {
          const output = this.batch.polygons;
          this.write(output, polygonAt++, leaf.vertices.length / 2);
          this.write(output, polygonAt++, bodies.linearVelocityX[body]!);
          this.write(output, polygonAt++, bodies.linearVelocityY[body]!);
          this.write(output, polygonAt++, bodies.angularVelocity[body]!);
          this.write(output, polygonAt++, bodies.positionX[body]!);
          this.write(output, polygonAt++, bodies.positionY[body]!);
          for (let v = 0; v < leaf.vertices.length; v += 2) {
            this.write(
              output,
              polygonAt++,
              x + c * leaf.vertices[v]! - s * leaf.vertices[v + 1]!,
            );
            this.write(
              output,
              polygonAt++,
              y + s * leaf.vertices[v]! + c * leaf.vertices[v + 1]!,
            );
          }
        } else if (
          leaf.kind === "box" ||
          leaf.kind === "ellipse" ||
          leaf.kind === "circle"
        ) {
          const output =
            leaf.kind === "box" ? this.batch.boxes : this.batch.ellipses;
          let at = leaf.kind === "box" ? boxAt : ellipseAt;
          this.write(
            output,
            at++,
            x + c * leaf.center[0]! - s * leaf.center[1]!,
          );
          this.write(
            output,
            at++,
            y + s * leaf.center[0]! + c * leaf.center[1]!,
          );
          this.write(
            output,
            at++,
            leaf.kind === "box"
              ? leaf.halfWidth
              : leaf.kind === "circle"
                ? leaf.radius
                : leaf.radiusX,
          );
          this.write(
            output,
            at++,
            leaf.kind === "box"
              ? leaf.halfHeight
              : leaf.kind === "circle"
                ? leaf.radius
                : leaf.radiusY,
          );
          this.write(
            output,
            at++,
            angle + (leaf.kind === "ellipse" ? leaf.rotationRadians : 0),
          );
          this.write(output, at++, bodies.linearVelocityX[body]!);
          this.write(output, at++, bodies.linearVelocityY[body]!);
          this.write(output, at++, bodies.angularVelocity[body]!);
          this.write(output, at++, bodies.positionX[body]!);
          this.write(output, at++, bodies.positionY[body]!);
          if (leaf.kind === "box") boxAt = at;
          else ellipseAt = at;
        }
      }
    }
    if (this.changed) this.batch.revision = revision;
  }
}
