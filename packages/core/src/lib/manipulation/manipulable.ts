import { createElement } from "../element/create-element.js";
import type { CRCNode } from "../element/types.js";
import type { WritableSignal } from "../signals/types.js";
import { useManipulation } from "./controller.js";
import type {
  CRCManipulationOptions,
  CRCManipulationMoveInput,
  CRCManipulationResizeInput,
  CRCManipulationRotateInput,
} from "./controller-types.js";
import { ManipulationFrame } from "./frame.js";
import { DragHandle, ResizeHandles, RotationHandle } from "./handles.js";
import type {
  CRCResizeHandlesProps,
  CRCRotationHandleProps,
  CRCRotationHandleStyle,
} from "./handles.js";
import type { CRCManipulationBox } from "./types.js";

export interface CRCManipulableProps extends Pick<
  CRCManipulationOptions,
  "rotation" | "onStart" | "onChange" | "onCommit" | "onCancel"
> {
  readonly style: WritableSignal<CRCManipulationBox>;
  readonly draggable?: boolean | CRCManipulationMoveInput;
  readonly resizable?: boolean | CRCManipulationResizeInput;
  readonly rotatable?: boolean | CRCManipulationRotateInput;
  readonly resizeHandles?:
    | CRCResizeHandlesProps["positions"]
    | Omit<CRCResizeHandlesProps, "controller">;
  readonly rotationHandle?: Omit<
    CRCRotationHandleProps,
    "controller" | "children"
  > & { readonly style?: CRCRotationHandleStyle };
  readonly children?: CRCNode;
}
function operation<T>(value: boolean | T | undefined): T | undefined {
  return value === undefined || value === false
    ? undefined
    : value === true
      ? ({} as T)
      : value;
}
/** Compose the same signal-owned frame and handles used by useManipulation. */
export function Manipulable(props: CRCManipulableProps): CRCNode {
  const controller = useManipulation({
    box: props.style,
    rotation: props.rotation,
    move: operation(props.draggable),
    resize: operation(props.resizable),
    rotate: operation(props.rotatable),
    onStart: props.onStart,
    onChange: props.onChange,
    onCommit: props.onCommit,
    onCancel: props.onCancel,
  });
  const resizeHandles =
    Array.isArray(props.resizeHandles) ||
    props.resizeHandles === "corners" ||
    props.resizeHandles === "edges-and-corners"
      ? { positions: props.resizeHandles }
      : props.resizeHandles;
  return createElement(ManipulationFrame, {
    ...controller.frameProps,
    children: [
      createElement(DragHandle, {
        key: "content",
        controller,
        style: { width: "100%", height: "100%" },
        children: props.children,
      }),
      props.resizable &&
        createElement(ResizeHandles, {
          key: "resize",
          controller,
          ...resizeHandles,
        }),
      props.rotatable &&
        createElement(RotationHandle, {
          key: "rotate",
          controller,
          ...props.rotationHandle,
        }),
    ],
  });
}
