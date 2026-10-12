import { createElement } from "../element/create-element.js";
import type { PibblNode } from "../element/types.js";
import type { WritableSignal } from "../signals/types.js";
import { useManipulation } from "./controller.js";
import type {
  PibblManipulationOptions,
  PibblManipulationMoveInput,
  PibblManipulationResizeInput,
  PibblManipulationRotateInput,
} from "./controller-types.js";
import { ManipulationFrame } from "./frame.js";
import { DragHandle, ResizeHandles, RotationHandle } from "./handles.js";
import type {
  PibblResizeHandlesProps,
  PibblDragHandleProps,
  PibblDragHandleStyle,
  PibblRotationHandleProps,
  PibblRotationHandleStyle,
} from "./handles.js";
import type { PibblManipulationBox } from "./types.js";

/**
 * Authored inputs for Manipulable, including the declared data and presentation options.
 *
 * @see {@link PibblManipulationOptions}
 * @see {@link WritableSignal}
 * @see {@link PibblManipulationBox}
 * @see {@link PibblManipulationMoveInput}
 * @see {@link PibblManipulationResizeInput}
 * @see {@link PibblManipulationRotateInput}
 * @see {@link PibblResizeHandlesProps}
 * @see {@link PibblRotationHandleProps}
 * @see {@link PibblRotationHandleStyle}
 * @see {@link PibblDragHandleProps}
 * @see {@link PibblDragHandleStyle}
 * @see {@link PibblNode}
 * @see {@link Manipulable}
 */
export interface PibblManipulableProps extends Pick<
  PibblManipulationOptions,
  "rotation" | "onStart" | "onChange" | "onCommit" | "onCancel"
> {
  /**
   * Declared presentation and layout properties. See {@link WritableSignal},
   * {@link PibblManipulationBox}.
   */
  readonly style: WritableSignal<PibblManipulationBox>;
  /** Enables or configures translation of the target. See {@link PibblManipulationMoveInput}. */
  readonly draggable?: boolean | PibblManipulationMoveInput;
  /** Enables or configures resizing of the target. See {@link PibblManipulationResizeInput}. */
  readonly resizable?: boolean | PibblManipulationResizeInput;
  /** Enables or configures rotation of the target. See {@link PibblManipulationRotateInput}. */
  readonly rotatable?: boolean | PibblManipulationRotateInput;
  /** Configuration of the target's resize handles. See {@link PibblResizeHandlesProps}. */
  readonly resizeHandles?:
    PibblResizeHandlesProps["positions"] | Omit<PibblResizeHandlesProps, "controller">;
  /**
   * Configuration of the target's rotation handle. See {@link PibblRotationHandleProps},
   * {@link PibblRotationHandleStyle}.
   */
  readonly rotationHandle?: Omit<PibblRotationHandleProps, "controller" | "children"> & {
    /** Declared presentation and layout properties. See {@link PibblRotationHandleStyle}. */
    readonly style?: PibblRotationHandleStyle;
  };
  /**
   * Configuration of the target's drag handle. See {@link PibblDragHandleProps},
   * {@link PibblDragHandleStyle}.
   */
  readonly dragHandle?: Omit<PibblDragHandleProps, "controller" | "children"> & {
    /** Declared presentation and layout properties. See {@link PibblDragHandleStyle}. */
    readonly style?: PibblDragHandleStyle;
  };
  /** Descendant content or the callback that supplies it. See {@link PibblNode}. */
  readonly children?: PibblNode;
}
function operation<T>(value: boolean | T | undefined): T | undefined {
  return value === undefined || value === false
    ? undefined
    : value === true
      ? ({} as T)
      : value;
}
/**
 * Compose the same signal-owned frame and handles used by useManipulation.
 *
 * @param props - Manipulation controller and child content. See {@link PibblManipulableProps}.
 * @returns Child content with manipulation interaction applied. See {@link PibblNode}.
 *
 * @see {@link PibblManipulableProps}
 * @see {@link PibblNode}
 */
export function Manipulable(props: PibblManipulableProps): PibblNode {
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
        ...props.dragHandle,
        style: { width: "100%", height: "100%", ...props.dragHandle?.style },
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
