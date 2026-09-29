import type { CRCComponent } from "@crc/core";
import {
  crcInternalCurrentSimulationOwner,
  crcInternalCurrentWorldTransform,
  setCurrentComponentAfterRender,
  useInternalHookSlot,
} from "@crc/core/internal";
import type {
  CRCPhysicsWorld2DProps,
  CRCPhysicsWorldHandle2D,
} from "../types.js";
import { resolveSignalFields } from "../../shared/signal-inputs.js";
import type { CRCResolvedPhysicsWorld2DProps } from "./world-props.js";
import { pushPhysicsWorld2D, requireCurrentPhysicsWorld2D } from "./context.js";
import { PhysicsWorld2DController } from "./controller.js";

const renderPhysicsWorld2D: CRCComponent<CRCPhysicsWorld2DProps> = (props) => {
  const resolvedProps = resolveSignalFields<CRCResolvedPhysicsWorld2DProps>(
    props,
    WORLD_STRUCTURAL_FIELDS,
  );
  const owner = crcInternalCurrentSimulationOwner();
  const slot = useInternalHookSlot("physicsWorld2DController", (teardowns) => {
    const controller = new PhysicsWorld2DController(owner, resolvedProps);
    teardowns.add(() => controller.dispose());
    return controller;
  });
  const controller = slot.value;
  controller.beginRender(resolvedProps, crcInternalCurrentWorldTransform());
  const popWorld = pushPhysicsWorld2D(controller);
  try {
    setCurrentComponentAfterRender(popWorld);
  } catch (error) {
    popWorld();
    throw error;
  }
  return props.children;
};

const WORLD_STRUCTURAL_FIELDS = new Set<PropertyKey>(["children"]);

/** Owns one transparent, component-scoped 2D physics world. */
export const PhysicsWorld2D = renderPhysicsWorld2D;

/** Returns the nearest 2D physics world while a descendant is evaluating. */
export function crcPhysicsWorld2D(): CRCPhysicsWorldHandle2D {
  return requireCurrentPhysicsWorld2D().handle;
}
