import { createElement } from "../element/create-element.js";
import { Group } from "../components/g.js";
import { definePrimitive } from "../define-primitive.js";
import { GLOBAL_STATE } from "../global-state.js";
import { useHookSlot, requireHookContext } from "../hooks/hook-slot.js";
import { pushLayoutBox } from "../layout/context.js";
import { getCurrentWorldTransform } from "../render-target.js";
import type { CRCNode } from "../element/types.js";
import type { SystemStyle } from "../types.js";
import type { CRCManipulationBox } from "./types.js";
import type { CRCManipulationController } from "./controller-types.js";
import {
  manipulationState,
  detachManipulationFrame,
  type ManipulationState,
} from "./controller.js";

const frames: ManipulationState[] = [];
export function requireManipulationFrame(
  controller: CRCManipulationController,
): ManipulationState {
  const state = manipulationState(controller);
  if (frames.at(-1) !== state)
    throw new Error(
      "CRC manipulation handles must be descendants of their controller frame.",
    );
  return state;
}
interface FrameProps {
  readonly controller: CRCManipulationController;
  readonly children?: CRCNode;
}
interface FrameStyle extends SystemStyle, CRCManipulationBox {}

export const ManipulationFrame = definePrimitive<FrameProps, FrameStyle>(
  function ManipulationFrame(props, style) {
    const state = manipulationState(props.controller);
    const { componentRefs, crcInstance } = requireHookContext();
    if (state.root.eventRoot !== crcInstance.eventRoot)
      throw new Error(
        "A manipulation controller cannot attach across CRC roots.",
      );
    if (state.frame && state.frame !== componentRefs)
      throw new Error(
        "A manipulation controller can attach to only one frame.",
      );
    useHookSlot("manipulationFrame", (teardowns) => {
      state.frame = componentRefs;
      teardowns.add(() => {
        if (state.frame === componentRefs) {
          state.frame = undefined;
          detachManipulationFrame(state);
        }
      });
      return state;
    });
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
    const transaction = crcInstance.eventRoot.renderTransaction;
    if (!transaction)
      throw new Error(
        "ManipulationFrame requires an active render transaction.",
      );
    transaction.onFinish((success) => {
      if (success && state.alive && state.frame === componentRefs) {
        state.parent = parent;
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
