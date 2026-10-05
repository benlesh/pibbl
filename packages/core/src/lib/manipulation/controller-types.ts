import type { useManipulation } from './controller.js';
import type { CRCDragHandleProps } from './handles.js';
import type { CRCManipulableProps } from './manipulable.js';
import type { ManipulationFrame } from './frame.js';
import type { CRCNode } from "../element/types.js";
import type { Signal, SignalValue, WritableSignal } from "../signals/types.js";
import type {
  CRCManipulationBox,
  CRCManipulationMoveOptions,
  CRCManipulationResizeOptions,
  CRCManipulationRotateOptions,
  CRCResizePosition,
} from "./types.js";

/**
 * The box and rotation that a manipulation controller reads and updates.
 *
 * @see {@link CRCManipulationBox}
 * @see {@link CRCManipulationSnapshot}
 * @see {@link CRCManipulationEvent}
 */
export interface CRCManipulationGeometry {
  /**
   * Logical rectangle read and updated by the manipulation controller. See
   * {@link CRCManipulationBox}.
   */
  readonly box: CRCManipulationBox;
  /** Rotation applied to the containing geometry. See {@link CRCManipulationGeometry}. */
  readonly rotation: number;
}
/**
 * The move, resize, or rotate operation performed by a manipulation session.
 *
 * @see {@link CRCManipulationSnapshot}
 * @see {@link CRCManipulationActive}
 */
export type CRCManipulationOperation = "move" | "resize" | "rotate";
/**
 * Why an active manipulation session was cancelled.
 *
 * @see {@link CRCManipulationCancelEvent}
 */
export type CRCManipulationCancelReason =
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
 * @see {@link CRCManipulationOperation}
 * @see {@link CRCResizePosition}
 * @see {@link CRCManipulationController}
 */
export interface CRCManipulationActive {
  /** Kind of manipulation currently being performed. See {@link CRCManipulationOperation}. */
  readonly operation: CRCManipulationOperation;
  /** Handle identity associated with the operation or body. See {@link CRCResizePosition}. */
  readonly handle: CRCResizePosition | null;
  /** Browser identifier of the active pointer. See {@link CRCManipulationActive}. */
  readonly pointerId: number;
}
/**
 * The controller's current geometry and active-operation state.
 *
 * @see {@link CRCManipulationOperation}
 * @see {@link CRCResizePosition}
 * @see {@link CRCManipulationGeometry}
 * @see {@link CRCManipulationController}
 * @see {@link CRCManipulationEvent}
 */
export interface CRCManipulationSnapshot {
  /** Kind of manipulation currently being performed. See {@link CRCManipulationOperation}. */
  readonly operation: CRCManipulationOperation;
  /** Handle identity associated with the operation or body. See {@link CRCResizePosition}. */
  readonly handle: CRCResizePosition | null;
  /** Geometry captured when this manipulation began. See {@link CRCManipulationGeometry}. */
  readonly initial: CRCManipulationGeometry;
  /**
   * Geometry proposed before constraints and snapping are applied. See
   * {@link CRCManipulationGeometry}.
   */
  readonly proposed: CRCManipulationGeometry;
  /** Geometry after constraints and snapping are applied. See {@link CRCManipulationGeometry}. */
  readonly applied: CRCManipulationGeometry;
  /**
   * Whether snapping is currently enabled for this operation. See {@link CRCManipulationSnapshot}
   * .
   */
  readonly snapActive: boolean;
  /**
   * Whether the applied geometry satisfies the active snap constraint. See
   * {@link CRCManipulationSnapshot}.
   */
  readonly snapSatisfied: boolean;
}
/**
 * Geometry and operation information emitted while manipulating a target.
 *
 * @see {@link CRCManipulationSnapshot}
 * @see {@link CRCManipulationGeometry}
 * @see {@link CRCManipulationOptions}
 * @see {@link CRCManipulationCommitEvent}
 */
export interface CRCManipulationEvent extends CRCManipulationSnapshot {
  /** Geometry before this manipulation update. See {@link CRCManipulationGeometry}. */
  readonly before: CRCManipulationGeometry;
  /** Geometry after this manipulation update. See {@link CRCManipulationGeometry}. */
  readonly after: CRCManipulationGeometry;
}
/**
 * The final geometry of a successfully committed manipulation.
 *
 * @see {@link CRCManipulationEvent}
 * @see {@link CRCManipulationOptions}
 */
export interface CRCManipulationCommitEvent extends CRCManipulationEvent {
  /**
   * Whether the committed geometry differs from the starting geometry. See
   * {@link CRCManipulationCommitEvent}.
   */
  readonly changed: boolean;
}
/**
 * Cancellation reason and geometry information for an abandoned manipulation.
 *
 * @see {@link CRCManipulationEvent}
 * @see {@link CRCManipulationCancelReason}
 * @see {@link CRCManipulationOptions}
 */
export interface CRCManipulationCancelEvent extends CRCManipulationEvent {
  /**
   * Reason the operation could not produce its ordinary result. See
   * {@link CRCManipulationCancelReason}.
   */
  readonly reason: CRCManipulationCancelReason;
}
/**
 * Translation constraints and signal-capable enablement and snapping configuration.
 *
 * @see {@link SignalValue}
 * @see {@link CRCManipulationOptions}
 * @see {@link CRCManipulableProps}
 */
export type CRCManipulationMoveInput = Omit<CRCManipulationMoveOptions, "snap"> & {
  /** Whether this operation or resource participates in updates. See {@link SignalValue}. */
  readonly enabled?: SignalValue<boolean>;
  /**
   * Snapping configuration for the manipulation operation. See {@link CRCManipulationMoveOptions}
   * , {@link SignalValue}.
   */
  readonly snap?: Omit<NonNullable<CRCManipulationMoveOptions["snap"]>, "enabled"> & {
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
 * @see {@link CRCManipulationOptions}
 * @see {@link CRCManipulableProps}
 */
export type CRCManipulationResizeInput = Omit<CRCManipulationResizeOptions, "snap"> & {
  /** Whether this operation or resource participates in updates. See {@link SignalValue}. */
  readonly enabled?: SignalValue<boolean>;
  /**
   * Snapping configuration for the manipulation operation. See {@link SignalEnabled},
   * {@link CRCManipulationResizeOptions}.
   */
  readonly snap?: SignalEnabled<NonNullable<CRCManipulationResizeOptions["snap"]>>;
};
/**
 * Rotation constraints and signal-capable enablement and snapping configuration.
 *
 * @see {@link SignalValue}
 * @see {@link CRCManipulationOptions}
 * @see {@link CRCManipulableProps}
 */
export type CRCManipulationRotateInput = Omit<CRCManipulationRotateOptions, "snap"> & {
  /** Whether this operation or resource participates in updates. See {@link SignalValue}. */
  readonly enabled?: SignalValue<boolean>;
  /**
   * Snapping configuration for the manipulation operation. See {@link SignalEnabled},
   * {@link CRCManipulationRotateOptions}.
   */
  readonly snap?: SignalEnabled<NonNullable<CRCManipulationRotateOptions["snap"]>>;
};
/**
 * Geometry, constraints, and lifecycle callbacks for a manipulation controller.
 *
 * @see {@link WritableSignal}
 * @see {@link CRCManipulationBox}
 * @see {@link CRCManipulationMoveInput}
 * @see {@link CRCManipulationResizeInput}
 * @see {@link CRCManipulationRotateInput}
 * @see {@link CRCManipulationEvent}
 * @see {@link CRCManipulationCommitEvent}
 * @see {@link CRCManipulationCancelEvent}
 * @see {@link useManipulation}
 * @see {@link CRCManipulableProps}
 */
export interface CRCManipulationOptions {
  /**
   * Logical rectangle read and updated by the manipulation controller. See {@link WritableSignal}
   * , {@link CRCManipulationBox}.
   */
  readonly box: WritableSignal<CRCManipulationBox>;
  /** Rotation applied to the containing geometry. See {@link WritableSignal}. */
  readonly rotation?: WritableSignal<number>;
  /**
   * Configuration for translation of the manipulation target. See {@link CRCManipulationMoveInput}
   * .
   */
  readonly move?: CRCManipulationMoveInput;
  /**
   * Configuration or operation for changing the target dimensions. See
   * {@link CRCManipulationResizeInput}.
   */
  readonly resize?: CRCManipulationResizeInput;
  /**
   * Configuration for rotation of the manipulation target. See {@link CRCManipulationRotateInput}
   * .
   */
  readonly rotate?: CRCManipulationRotateInput;
  /**
   * Receives the initial state when a manipulation begins. See {@link CRCManipulationEvent}.
   * @param event - Current manipulation session and proposed geometry. See
   * {@link CRCManipulationEvent} .
   */
  readonly onStart?: (event: CRCManipulationEvent) => void;
  /**
   * Receives geometry changes during an active manipulation. See {@link CRCManipulationEvent}.
   * @param event - Current manipulation session and proposed geometry. See
   * {@link CRCManipulationEvent} .
   */
  readonly onChange?: (event: CRCManipulationEvent) => void;
  /**
   * Receives the final state of a committed manipulation. See {@link CRCManipulationCommitEvent}.
   * @param event - Successfully committed manipulation state. See
   * {@link CRCManipulationCommitEvent} .
   */
  readonly onCommit?: (event: CRCManipulationCommitEvent) => void;
  /**
   * Receives the reason and state of a cancelled manipulation. See
   * {@link CRCManipulationCancelEvent}.
   * @param event - Canceled manipulation state and cancellation reason. See
   * {@link CRCManipulationCancelEvent} .
   */
  readonly onCancel?: (event: CRCManipulationCancelEvent) => void;
}
/**
 * Authored inputs for ManipulationFrame, including the declared data and presentation options.
 *
 * @see {@link CRCManipulationController}
 * @see {@link WritableSignal}
 * @see {@link CRCManipulationBox}
 * @see {@link CRCNode}
 * @see {@link ManipulationFrame}
 */
export interface CRCManipulationFrameProps {
  /**
   * Controller owning the current interaction or mounted scenario. See
   * {@link CRCManipulationController}.
   */
  readonly controller: CRCManipulationController;
  /**
   * Declared presentation and layout properties. See {@link WritableSignal},
   * {@link CRCManipulationBox}.
   */
  readonly style: WritableSignal<CRCManipulationBox>;
  /** Descendant content or the callback that supplies it. See {@link CRCNode}. */
  readonly children?: CRCNode;
}
/**
 * Stable controls and reactive geometry for one mounted manipulation session.
 *
 * @see {@link Signal}
 * @see {@link CRCManipulationActive}
 * @see {@link CRCManipulationSnapshot}
 * @see {@link CRCManipulationFrameProps}
 * @see {@link useManipulation}
 * @see {@link CRCDragHandleProps}
 */
export interface CRCManipulationController {
  /**
   * Current active operation or its presentation configuration. See {@link Signal},
   * {@link CRCManipulationActive}.
   */
  readonly active: Signal<CRCManipulationActive | null>;
  /**
   * Current immutable observation of the manipulation session. See {@link Signal},
   * {@link CRCManipulationSnapshot}.
   */
  readonly snapshot: Signal<CRCManipulationSnapshot | null>;
  /**
   * Props for presenting the controller's current manipulation frame. See
   * {@link CRCManipulationFrameProps}.
   */
  readonly frameProps: CRCManipulationFrameProps;
  /**
   * Cancels the active manipulation and applies its cancellation policy. See
   * {@link CRCManipulationController}.
   */
  cancel(): void;
}
