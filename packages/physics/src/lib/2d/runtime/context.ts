import type { PhysicsWorld2DController } from "./controller.js";

export interface PhysicsBodyScope2D {
  readonly world: PhysicsWorld2DController;
  readonly bodyId: number;
}

const worldStack: PhysicsWorld2DController[] = [];
const bodyStack: PhysicsBodyScope2D[] = [];

export function pushPhysicsWorld2D(
  world: PhysicsWorld2DController,
): () => void {
  if (worldStack.length > 0) {
    throw new Error("PhysicsWorld2D components cannot be nested.");
  }
  worldStack.push(world);
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    if (worldStack.pop() !== world) {
      worldStack.length = 0;
      bodyStack.length = 0;
      throw new Error("PhysicsWorld2D scope exited out of traversal order.");
    }
  };
}

export function requireCurrentPhysicsWorld2D(): PhysicsWorld2DController {
  const world = worldStack.at(-1);
  if (world === undefined) {
    throw new Error("This operation requires the nearest PhysicsWorld2D.");
  }
  return world;
}

export function pushPhysicsBody2D(scope: PhysicsBodyScope2D): () => void {
  if (requireCurrentPhysicsWorld2D() !== scope.world) {
    throw new Error(
      "A physics 2D body cannot cross its nearest world boundary.",
    );
  }
  bodyStack.push(scope);
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    if (bodyStack.pop() !== scope) {
      bodyStack.length = 0;
      throw new Error("Physics body 2D scope exited out of traversal order.");
    }
  };
}

export function requireCurrentPhysicsBody2D(): PhysicsBodyScope2D {
  const body = bodyStack.at(-1);
  const world = requireCurrentPhysicsWorld2D();
  if (body === undefined || body.world !== world) {
    throw new Error("collider2D() requires the nearest physics 2D body.");
  }
  return body;
}
