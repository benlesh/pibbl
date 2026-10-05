import type { PibblManipulationFrameProps } from './controller-types.js';
import { createElement } from "../element/create-element.js";
import { Group } from "../components/g.js";
import { definePrimitive } from "../define-primitive.js";
import { GLOBAL_STATE } from "../global-state.js";
import { useHookSlot, requireHookContext } from "../hooks/hook-slot.js";
import { pushLayoutBox } from "../layout/context.js";
import { getCurrentWorldTransform } from "../render-target.js";
import { currentRootCoordinateMapping } from "./coordinates.js";
import type { PibblNode } from "../element/types.js";
import type { PibblComponentRefs } from "../types.js";
import type { SystemStyle } from "../types.js";
import type { PibblManipulationBox } from "./types.js";
import type { PibblManipulationController } from "./controller-types.js";
import {
  manipulationState,
  detachManipulationFrame,
  type ManipulationState,
} from "./controller.js";

const frames: ManipulationState[] = [];
export function requireManipulationFrame(
  controller: PibblManipulationController,
): ManipulationState {
  const state = manipulationState(controller);
  if (frames.at(-1) !== state)
    throw new Error(
      "Pibbl manipulation handles must be descendants of their controller frame.",
    );
  return state;
}
interface FrameProps {
  readonly controller: PibblManipulationController;
  readonly children?: PibblNode;
}
interface FrameStyle extends SystemStyle, PibblManipulationBox {}
interface FrameAttachment {
  state: ManipulationState;
}

function attachManipulationFrame(
  state: ManipulationState,
  componentRefs: PibblComponentRefs<any>,
): void {
  if (state.frame && state.frame !== componentRefs) {
    if (GLOBAL_STATE.seenIds?.has(state.frame.id))
      throw new Error(
        "A manipulation controller can attach to only one frame.",
      );
    detachManipulationFrame(state);
  }
  state.frame = componentRefs;
}

function releaseManipulationFrame(
  state: ManipulationState,
  componentRefs: PibblComponentRefs<any>,
): void {
  if (state.frame !== componentRefs) return;
  state.frame = undefined;
  detachManipulationFrame(state);
}

/**
 * Provides a manipulation controller and its presentation frame to descendant handles.
 *
 * @param props - Authored component inputs, supplied through JSX or createElement. See the linked
 * props and style types.
 * @throws When called directly; Pibbl mounts this component through JSX or createElement.
 *
 * @see {@link PibblManipulationFrameProps}
 */
export const ManipulationFrame = definePrimitive<FrameProps, FrameStyle>(
  function ManipulationFrame(props, style) {
    const state = manipulationState(props.controller);
    const { componentRefs, pibblInstance } = requireHookContext();
    if (state.root.eventRoot !== pibblInstance.eventRoot)
      throw new Error(
        "A manipulation controller cannot attach across Pibbl roots.",
      );
    const slot = useHookSlot<FrameAttachment>("manipulationFrame", (teardowns) => {
      const attachment: FrameAttachment = { state };
      attachManipulationFrame(state, componentRefs);
      teardowns.add(() => releaseManipulationFrame(attachment.state, componentRefs));
      return attachment;
    });
    const attachment = slot.value;
    if (attachment.state !== state) {
      releaseManipulationFrame(attachment.state, componentRefs);
      attachManipulationFrame(state, componentRefs);
      attachment.state = state;
    } else {
      attachManipulationFrame(state, componentRefs);
    }
    const box = state.options.box.get();
    if (
      ![box.left, box.top, style.width, style.height].every(Number.isFinite) ||
      style.width <= 0 ||
      style.height <= 0
    )
      throw new Error(
        "ManipulationFrame requires finite position and positive dimensions.",
      );
    const parent = getCurrentWorldTransform().translate(-box.left, -box.top);
    const transaction = pibblInstance.eventRoot.renderTransaction;
    if (!transaction)
      throw new Error(
        "ManipulationFrame requires an active render transaction.",
      );
    transaction.onFinish((success) => {
      if (success && state.alive && state.frame === componentRefs) {
        state.parent = parent;
        state.coordinateMapping = currentRootCoordinateMapping(state.root);
      }
    });
    const releaseLayout = pushLayoutBox(
      Object.freeze({ x: 0, y: 0, width: style.width, height: style.height }),
    );
    frames.push(state);
    GLOBAL_STATE.componentRefs!.onAfterRender = () => {
      frames.pop();
      releaseLayout();
    };
    const rotation = state.options.rotation?.get() ?? 0;
    if (!Number.isFinite(rotation))
      throw new Error("ManipulationFrame rotation must be finite radians.");
    return createElement(Group, {
      style: {
        rotationDegrees: (rotation * 180) / Math.PI,
        rotationOrigin: [style.width / 2, style.height / 2],
      },
      children: props.children,
    });
  },
  { childInput: "structural" },
);
