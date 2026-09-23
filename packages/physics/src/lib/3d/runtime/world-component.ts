import type { CRCComponent } from "@crc/core";
import {
  crcInternalCurrentSimulationOwner,
  setCurrentComponentAfterRender,
  useInternalHookSlot,
} from "@crc/core/internal";
import { pushPhysicsPresentation } from "@crc/webgl/internal";
import type {
  CRCPhysicsWorld3DProps,
  CRCPhysicsWorldHandle3D,
} from "../types.js";
import {
  assertPhysicsWorld3DCanEnter,
  pushPhysicsWorld3D,
  requireCurrentPhysicsWorld3D,
} from "./context.js";
import { PhysicsWorld3DController } from "./controller.js";

const renderPhysicsWorld3D: CRCComponent<CRCPhysicsWorld3DProps> = (props) => {
  // The friend call validates the active backend without retaining any model
  // scope or exposing mutable WebGL state.
  pushPhysicsPresentation(IDENTITY_MATRIX_3D)();
  assertPhysicsWorld3DCanEnter();
  const owner = crcInternalCurrentSimulationOwner();
  const slot = useInternalHookSlot("physicsWorld3DController", (teardowns) => {
    const controller = new PhysicsWorld3DController(owner, props);
    teardowns.add(() => controller.dispose());
    return controller;
  });
  const controller = slot.value;
  controller.beginRender(props);
  const popWorld = pushPhysicsWorld3D(controller);
  try {
    setCurrentComponentAfterRender(popWorld);
  } catch (error) {
    popWorld();
    throw error;
  }
  return props.children;
};

/** Owns one transparent, component-scoped 3D physics world. */
export const PhysicsWorld3D = renderPhysicsWorld3D;

/** Returns the nearest 3D physics world while a descendant is evaluating. */
export function crcPhysicsWorld3D(): CRCPhysicsWorldHandle3D {
  return requireCurrentPhysicsWorld3D().handle;
}

const IDENTITY_MATRIX_3D = Object.freeze([
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
]);
