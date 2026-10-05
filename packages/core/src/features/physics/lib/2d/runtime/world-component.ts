import type { PibblComponent } from "@pibbl/core";
import {
  pibblInternalCurrentSimulationOwner,
  pibblInternalCurrentWorldTransform,
  setCurrentComponentAfterRender,
  useInternalHookSlot,
} from "@pibbl/core/internal";
import type {
  PibblPhysicsWorld2DProps,
  PibblPhysicsWorldHandle2D,
} from "../types.js";
import { resolveSignalFields } from "../../shared/signal-inputs.js";
import type { PibblResolvedPhysicsWorld2DProps } from "./world-props.js";
import { pushPhysicsWorld2D, requireCurrentPhysicsWorld2D } from "./context.js";
import { PhysicsWorld2DController } from "./controller.js";

const renderPhysicsWorld2D: PibblComponent<PibblPhysicsWorld2DProps> = (props) => {
  const resolvedProps = resolveSignalFields<PibblResolvedPhysicsWorld2DProps>(
    props,
    WORLD_STRUCTURAL_FIELDS,
  );
  const owner = pibblInternalCurrentSimulationOwner();
  const slot = useInternalHookSlot("physicsWorld2DController", (teardowns) => {
    const controller = new PhysicsWorld2DController(owner, resolvedProps);
    teardowns.add(() => controller.dispose());
    return controller;
  });
  const controller = slot.value;
  controller.beginRender(resolvedProps, pibblInternalCurrentWorldTransform());
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

/**
 * Owns one transparent, component-scoped 2D physics world.
 *
 * @see {@link PibblComponent}
 * @see {@link PibblPhysicsWorld2DProps}
 */
export const PhysicsWorld2D = renderPhysicsWorld2D;

/**
 * Returns the nearest 2D physics world while a descendant is evaluating.
 *
 * @returns A stable world handle that can be attached to a physics world. See
 * {@link PibblPhysicsWorldHandle2D} .
 *
 * @see {@link PibblPhysicsWorldHandle2D}
 */
export function pibblPhysicsWorld2D(): PibblPhysicsWorldHandle2D {
  return requireCurrentPhysicsWorld2D().handle;
}
