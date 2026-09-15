import type { CRCComponent } from "@crc/core";
import {
  crcInternalCurrentSimulationOwner,
  setCurrentComponentAfterRender,
  useInternalHookSlot,
} from "@crc/core/internal";
import type {
  CRCPhysicsWorld2DProps,
  CRCPhysicsWorldHandle2D,
} from "../types.js";
import { pushPhysicsWorld2D, requireCurrentPhysicsWorld2D } from "./context.js";
import { PhysicsWorld2DController } from "./controller.js";

const renderPhysicsWorld2D: CRCComponent<CRCPhysicsWorld2DProps> = (props) => {
  const owner = crcInternalCurrentSimulationOwner();
  const slot = useInternalHookSlot("physicsWorld2DController", (teardowns) => {
    const controller = new PhysicsWorld2DController(owner, props);
    teardowns.add(() => controller.dispose());
    return controller;
  });
  const controller = slot.value;
  controller.beginRender(props);
  const popWorld = pushPhysicsWorld2D(controller);
  try {
    setCurrentComponentAfterRender(popWorld);
  } catch (error) {
    popWorld();
    throw error;
  }
  return props.children;
};

/** Owns one transparent, component-scoped 2D physics world. */
export const PhysicsWorld2D = renderPhysicsWorld2D;

/** Returns the nearest 2D physics world while a descendant is evaluating. */
export function crcPhysicsWorld2D(): CRCPhysicsWorldHandle2D {
  return requireCurrentPhysicsWorld2D().handle;
}
