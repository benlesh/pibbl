import { definePrimitive } from "@crc/core";
import { crcInternalCurrentWorldTransform } from "@crc/core/internal";
import type { CRCPhysicsWorldHandle2D } from "../types.js";
import { requirePhysicsWorld2DController } from "../runtime/controller.js";

export interface CRCPhysicsDebug2DProps {
  readonly world: CRCPhysicsWorldHandle2D;
  readonly color?: string;
}

/** Read-only authoritative bounds, mass centers and contact normals; no hit targets. */
export const PhysicsDebug2D = definePrimitive<CRCPhysicsDebug2DProps>(
  (props, _style, context) => {
    props.world.revision.get();
    const controller = requirePhysicsWorld2DController(props.world);
    const snapshot = controller.inspect();
    const transform = crcInternalCurrentWorldTransform()
      .inverse()
      .multiply(controller.rootTransform(new DOMMatrix()));
    context.save();
    try {
      context.transform(
        transform.a,
        transform.b,
        transform.c,
        transform.d,
        transform.e,
        transform.f,
      );
      context.strokeStyle = props.color ?? "#16a34a";
      context.fillStyle = props.color ?? "#16a34a";
      context.lineWidth = 1;
      for (const collider of snapshot.colliders) {
        const { min, max } = collider.bounds;
        context.strokeRect(min[0], min[1], max[0] - min[0], max[1] - min[1]);
      }
      context.beginPath();
      for (const body of snapshot.bodies) {
        const [x, y] = body.centerOfMass;
        context.moveTo(x - 3, y);
        context.lineTo(x + 3, y);
        context.moveTo(x, y - 3);
        context.lineTo(x, y + 3);
      }
      for (const contact of snapshot.contacts)
        for (const point of contact.points) {
          const [x, y] = point.pointOnFirst;
          context.moveTo(x, y);
          context.lineTo(
            x + 12 * contact.normal[0],
            y + 12 * contact.normal[1],
          );
        }
      context.stroke();
    } finally {
      context.restore();
    }
  },
);
