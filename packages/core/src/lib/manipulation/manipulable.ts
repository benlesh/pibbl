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
  CRCDragHandleProps,
  CRCDragHandleStyle,
  CRCRotationHandleProps,
  CRCRotationHandleStyle,
} from "./handles.js";
import type { CRCManipulationBox } from "./types.js";

/**
 * Authored inputs for Manipulable, including the declared data and presentation options.
 *
 * @see {@link CRCManipulationOptions}
 * @see {@link WritableSignal}
 * @see {@link CRCManipulationBox}
 * @see {@link CRCManipulationMoveInput}
 * @see {@link CRCManipulationResizeInput}
 * @see {@link CRCManipulationRotateInput}
 * @see {@link CRCResizeHandlesProps}
 * @see {@link CRCRotationHandleProps}
 * @see {@link CRCRotationHandleStyle}
 * @see {@link CRCDragHandleProps}
 * @see {@link CRCDragHandleStyle}
 * @see {@link CRCNode}
 * @see {@link Manipulable}
 */
export interface CRCManipulableProps extends Pick<
  CRCManipulationOptions,
  "rotation" | "onStart" | "onChange" | "onCommit" | "onCancel"
> {
  /**
   * Declared presentation and layout properties. See {@link WritableSignal},
   * {@link CRCManipulationBox}.
   */
  readonly style: WritableSignal<CRCManipulationBox>;
  /** Enables or configures translation of the target. See {@link CRCManipulationMoveInput}. */
  readonly draggable?: boolean | CRCManipulationMoveInput;
  /** Enables or configures resizing of the target. See {@link CRCManipulationResizeInput}. */
  readonly resizable?: boolean | CRCManipulationResizeInput;
  /** Enables or configures rotation of the target. See {@link CRCManipulationRotateInput}. */
  readonly rotatable?: boolean | CRCManipulationRotateInput;
  /** Configuration of the target's resize handles. See {@link CRCResizeHandlesProps}. */
  readonly resizeHandles?:
    CRCResizeHandlesProps["positions"] | Omit<CRCResizeHandlesProps, "controller">;
  /**
   * Configuration of the target's rotation handle. See {@link CRCRotationHandleProps},
   * {@link CRCRotationHandleStyle}.
   */
  readonly rotationHandle?: Omit<CRCRotationHandleProps, "controller" | "children"> & {
    /** Declared presentation and layout properties. See {@link CRCRotationHandleStyle}. */
    readonly style?: CRCRotationHandleStyle;
  };
  /**
   * Configuration of the target's drag handle. See {@link CRCDragHandleProps},
   * {@link CRCDragHandleStyle}.
   */
  readonly dragHandle?: Omit<CRCDragHandleProps, "controller" | "children"> & {
    /** Declared presentation and layout properties. See {@link CRCDragHandleStyle}. */
    readonly style?: CRCDragHandleStyle;
  };
  /** Descendant content or the callback that supplies it. See {@link CRCNode}. */
  readonly children?: CRCNode;
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
 * @param props - Manipulation controller and child content. See {@link CRCManipulableProps}.
 * @returns Child content with manipulation interaction applied. See {@link CRCNode}.
 *
 * @see {@link CRCManipulableProps}
 * @see {@link CRCNode}
 */
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
