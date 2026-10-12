import type { useManipulation } from './controller.js';
import type { PibblDragHandleProps } from './handles.js';
import type { PibblManipulableProps } from './manipulable.js';
import type { ManipulationFrame } from './frame.js';
import type { PibblNode } from "../element/types.js";
import type { Signal, SignalValue, WritableSignal } from "../signals/types.js";
import type {
  PibblManipulationBox,
  PibblManipulationMoveOptions,
  PibblManipulationResizeOptions,
  PibblManipulationRotateOptions,
  PibblResizePosition,
} from "./types.js";

/**
 * The box and rotation that a manipulation controller reads and updates.
 *
 * @see {@link PibblManipulationBox}
 * @see {@link PibblManipulationSnapshot}
 * @see {@link PibblManipulationEvent}
 */
export interface PibblManipulationGeometry {
  /**
   * Logical rectangle read and updated by the manipulation controller. See
   * {@link PibblManipulationBox}.
   */
  readonly box: PibblManipulationBox;
  /** Rotation applied to the containing geometry. See {@link PibblManipulationGeometry}. */
  readonly rotation: number;
}
/**
 * The move, resize, or rotate operation performed by a manipulation session.
 *
 * @see {@link PibblManipulationSnapshot}
 * @see {@link PibblManipulationActive}
 */
export type PibblManipulationOperation = "move" | "resize" | "rotate";
/**
 * Why an active manipulation session was cancelled.
 *
 * @see {@link PibblManipulationCancelEvent}
 */
export type PibblManipulationCancelReason =
  | "explicit"
  | "escape"
  | "pointer-cancel"
  | "capture-lost"
  | "disabled"
  | "external-change"
  | "coordinate-space-changed"
  | "constraints-unsatisfiable";
/**
 * Details identifying an operation currently in progress.
 *
 * @see {@link PibblManipulationOperation}
 * @see {@link PibblResizePosition}
 * @see {@link PibblManipulationController}
 */
export interface PibblManipulationActive {
  /** Kind of manipulation currently being performed. See {@link PibblManipulationOperation}. */
  readonly operation: PibblManipulationOperation;
  /** Handle identity associated with the operation or body. See {@link PibblResizePosition}. */
  readonly handle: PibblResizePosition | null;
  /** Browser identifier of the active pointer. See {@link PibblManipulationActive}. */
  readonly pointerId: number;
}
/**
 * The controller's current geometry and active-operation state.
 *
 * @see {@link PibblManipulationOperation}
 * @see {@link PibblResizePosition}
 * @see {@link PibblManipulationGeometry}
 * @see {@link PibblManipulationController}
 * @see {@link PibblManipulationEvent}
 */
export interface PibblManipulationSnapshot {
  /** Kind of manipulation currently being performed. See {@link PibblManipulationOperation}. */
  readonly operation: PibblManipulationOperation;
  /** Handle identity associated with the operation or body. See {@link PibblResizePosition}. */
  readonly handle: PibblResizePosition | null;
  /** Geometry captured when this manipulation began. See {@link PibblManipulationGeometry}. */
  readonly initial: PibblManipulationGeometry;
  /**
   * Geometry proposed before constraints and snapping are applied. See
   * {@link PibblManipulationGeometry}.
   */
  readonly proposed: PibblManipulationGeometry;
  /** Geometry after constraints and snapping are applied. See {@link PibblManipulationGeometry}. */
  readonly applied: PibblManipulationGeometry;
  /**
   * Whether snapping is currently enabled for this operation. See {@link PibblManipulationSnapshot}
   * .
   */
  readonly snapActive: boolean;
  /**
   * Whether the applied geometry satisfies the active snap constraint. See
   * {@link PibblManipulationSnapshot}.
   */
  readonly snapSatisfied: boolean;
}
/**
 * Geometry and operation information emitted while manipulating a target.
 *
 * @see {@link PibblManipulationSnapshot}
 * @see {@link PibblManipulationGeometry}
 * @see {@link PibblManipulationOptions}
 * @see {@link PibblManipulationCommitEvent}
 */
export interface PibblManipulationEvent extends PibblManipulationSnapshot {
  /** Geometry before this manipulation update. See {@link PibblManipulationGeometry}. */
  readonly before: PibblManipulationGeometry;
  /** Geometry after this manipulation update. See {@link PibblManipulationGeometry}. */
  readonly after: PibblManipulationGeometry;
}
/**
 * The final geometry of a successfully committed manipulation.
 *
 * @see {@link PibblManipulationEvent}
 * @see {@link PibblManipulationOptions}
 */
export interface PibblManipulationCommitEvent extends PibblManipulationEvent {
  /**
   * Whether the committed geometry differs from the starting geometry. See
   * {@link PibblManipulationCommitEvent}.
   */
  readonly changed: boolean;
}
/**
 * Cancellation reason and geometry information for an abandoned manipulation.
 *
 * @see {@link PibblManipulationEvent}
 * @see {@link PibblManipulationCancelReason}
 * @see {@link PibblManipulationOptions}
 */
export interface PibblManipulationCancelEvent extends PibblManipulationEvent {
  /**
   * Reason the operation could not produce its ordinary result. See
   * {@link PibblManipulationCancelReason}.
   */
  readonly reason: PibblManipulationCancelReason;
}
/**
 * Translation constraints and signal-capable enablement and snapping configuration.
 *
 * @see {@link SignalValue}
 * @see {@link PibblManipulationOptions}
 * @see {@link PibblManipulableProps}
 */
export type PibblManipulationMoveInput = Omit<PibblManipulationMoveOptions, "snap"> & {
  /** Whether this operation or resource participates in updates. See {@link SignalValue}. */
  readonly enabled?: SignalValue<boolean>;
  /**
   * Snapping configuration for the manipulation operation. See {@link PibblManipulationMoveOptions}
   * , {@link SignalValue}.
   */
  readonly snap?: Omit<NonNullable<PibblManipulationMoveOptions["snap"]>, "enabled"> & {
    /** Whether this operation or resource participates in updates. See {@link SignalValue}. */
    readonly enabled?: SignalValue<boolean>;
  };
};
type SignalEnabled<T> = T extends unknown
  ? Omit<T, "enabled"> & { readonly enabled?: SignalValue<boolean> }
  : never;
/**
 * Resize constraints and signal-capable enablement and snapping configuration.
 *
 * @see {@link SignalValue}
 * @see {@link PibblManipulationOptions}
 * @see {@link PibblManipulableProps}
 */
export type PibblManipulationResizeInput = Omit<PibblManipulationResizeOptions, "snap"> & {
  /** Whether this operation or resource participates in updates. See {@link SignalValue}. */
  readonly enabled?: SignalValue<boolean>;
  /**
   * Snapping configuration for the manipulation operation. See {@link SignalEnabled},
   * {@link PibblManipulationResizeOptions}.
   */
  readonly snap?: SignalEnabled<NonNullable<PibblManipulationResizeOptions["snap"]>>;
};
/**
 * Rotation constraints and signal-capable enablement and snapping configuration.
 *
 * @see {@link SignalValue}
 * @see {@link PibblManipulationOptions}
 * @see {@link PibblManipulableProps}
 */
export type PibblManipulationRotateInput = Omit<PibblManipulationRotateOptions, "snap"> & {
  /** Whether this operation or resource participates in updates. See {@link SignalValue}. */
  readonly enabled?: SignalValue<boolean>;
  /**
   * Snapping configuration for the manipulation operation. See {@link SignalEnabled},
   * {@link PibblManipulationRotateOptions}.
   */
  readonly snap?: SignalEnabled<NonNullable<PibblManipulationRotateOptions["snap"]>>;
};
/**
 * Geometry, constraints, and lifecycle callbacks for a manipulation controller.
 *
 * @see {@link WritableSignal}
 * @see {@link PibblManipulationBox}
 * @see {@link PibblManipulationMoveInput}
 * @see {@link PibblManipulationResizeInput}
 * @see {@link PibblManipulationRotateInput}
 * @see {@link PibblManipulationEvent}
 * @see {@link PibblManipulationCommitEvent}
 * @see {@link PibblManipulationCancelEvent}
 * @see {@link useManipulation}
 * @see {@link PibblManipulableProps}
 */
export interface PibblManipulationOptions {
  /**
   * Logical rectangle read and updated by the manipulation controller. See {@link WritableSignal}
   * , {@link PibblManipulationBox}.
   */
  readonly box: WritableSignal<PibblManipulationBox>;
  /** Rotation applied to the containing geometry. See {@link WritableSignal}. */
  readonly rotation?: WritableSignal<number>;
  /**
   * Configuration for translation of the manipulation target. See {@link PibblManipulationMoveInput}
   * .
   */
  readonly move?: PibblManipulationMoveInput;
  /**
   * Configuration or operation for changing the target dimensions. See
   * {@link PibblManipulationResizeInput}.
   */
  readonly resize?: PibblManipulationResizeInput;
  /**
   * Configuration for rotation of the manipulation target. See {@link PibblManipulationRotateInput}
   * .
   */
  readonly rotate?: PibblManipulationRotateInput;
  /**
   * Receives the initial state when a manipulation begins. See {@link PibblManipulationEvent}.
   * @param event - Current manipulation session and proposed geometry. See
   * {@link PibblManipulationEvent} .
   */
  readonly onStart?: (event: PibblManipulationEvent) => void;
  /**
   * Receives geometry changes during an active manipulation. See {@link PibblManipulationEvent}.
   * @param event - Current manipulation session and proposed geometry. See
   * {@link PibblManipulationEvent} .
   */
  readonly onChange?: (event: PibblManipulationEvent) => void;
  /**
   * Receives the final state of a committed manipulation. See {@link PibblManipulationCommitEvent}.
   * @param event - Successfully committed manipulation state. See
   * {@link PibblManipulationCommitEvent} .
   */
  readonly onCommit?: (event: PibblManipulationCommitEvent) => void;
  /**
   * Receives the reason and state of a cancelled manipulation. See
   * {@link PibblManipulationCancelEvent}.
   * @param event - Canceled manipulation state and cancellation reason. See
   * {@link PibblManipulationCancelEvent} .
   */
  readonly onCancel?: (event: PibblManipulationCancelEvent) => void;
}
/**
 * Authored inputs for ManipulationFrame, including the declared data and presentation options.
 *
 * @see {@link PibblManipulationController}
 * @see {@link WritableSignal}
 * @see {@link PibblManipulationBox}
 * @see {@link PibblNode}
 * @see {@link ManipulationFrame}
 */
export interface PibblManipulationFrameProps {
  /**
   * Controller owning the current interaction or mounted scenario. See
   * {@link PibblManipulationController}.
   */
  readonly controller: PibblManipulationController;
  /**
   * Declared presentation and layout properties. See {@link WritableSignal},
   * {@link PibblManipulationBox}.
   */
  readonly style: WritableSignal<PibblManipulationBox>;
  /** Descendant content or the callback that supplies it. See {@link PibblNode}. */
  readonly children?: PibblNode;
}
/**
 * Stable controls and reactive geometry for one mounted manipulation session.
 *
 * @see {@link Signal}
 * @see {@link PibblManipulationActive}
 * @see {@link PibblManipulationSnapshot}
 * @see {@link PibblManipulationFrameProps}
 * @see {@link useManipulation}
 * @see {@link PibblDragHandleProps}
 */
export interface PibblManipulationController {
  /**
   * Current active operation or its presentation configuration. See {@link Signal},
   * {@link PibblManipulationActive}.
   */
  readonly active: Signal<PibblManipulationActive | null>;
  /**
   * Current immutable observation of the manipulation session. See {@link Signal},
   * {@link PibblManipulationSnapshot}.
   */
  readonly snapshot: Signal<PibblManipulationSnapshot | null>;
  /**
   * Props for presenting the controller's current manipulation frame. See
   * {@link PibblManipulationFrameProps}.
   */
  readonly frameProps: PibblManipulationFrameProps;
  /**
   * Cancels the active manipulation and applies its cancellation policy. See
   * {@link PibblManipulationController}.
   */
  cancel(): void;
}
