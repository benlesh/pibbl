import type { PhysicsWorld3DController } from "./controller.js";

export interface PhysicsBodyScope3D {
  readonly world: PhysicsWorld3DController;
  readonly bodyId: number;
}

const worldStack: PhysicsWorld3DController[] = [];
const bodyStack: PhysicsBodyScope3D[] = [];

export function pushPhysicsWorld3D(
  world: PhysicsWorld3DController,
): () => void {
  assertPhysicsWorld3DCanEnter();
  worldStack.push(world);
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    if (worldStack.pop() !== world) {
      worldStack.length = 0;
      bodyStack.length = 0;
      throw new Error("PhysicsWorld3D scope exited out of traversal order.");
    }
  };
}

export function assertPhysicsWorld3DCanEnter(): void {
  if (worldStack.length > 0) {
    throw new Error("PhysicsWorld3D components cannot be nested.");
  }
}

export function requireCurrentPhysicsWorld3D(): PhysicsWorld3DController {
  const world = worldStack.at(-1);
  if (world === undefined) {
    throw new Error("This operation requires the nearest PhysicsWorld3D.");
  }
  return world;
}

export function pushPhysicsBody3D(scope: PhysicsBodyScope3D): () => void {
  if (requireCurrentPhysicsWorld3D() !== scope.world) {
    throw new Error(
      "A physics 3D body cannot cross its nearest world boundary.",
    );
  }
  bodyStack.push(scope);
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    if (bodyStack.pop() !== scope) {
      bodyStack.length = 0;
      throw new Error("Physics body 3D scope exited out of traversal order.");
    }
  };
}

export function requireCurrentPhysicsBody3D(): PhysicsBodyScope3D {
  const body = bodyStack.at(-1);
  const world = requireCurrentPhysicsWorld3D();
  if (body === undefined || body.world !== world) {
    throw new Error("collider3D() requires the nearest physics 3D body.");
  }
  return body;
}
