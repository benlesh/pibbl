import type { CRCNode } from "../element/types.js";
import type { Signal, SignalValue, WritableSignal } from "../signals/types.js";
import type {
  CRCManipulationBox,
  CRCManipulationMoveOptions,
  CRCManipulationResizeOptions,
  CRCManipulationRotateOptions,
  CRCResizePosition,
} from "./types.js";

export interface CRCManipulationGeometry {
  readonly box: CRCManipulationBox;
  readonly rotation: number;
}
export type CRCManipulationOperation = "move" | "resize" | "rotate";
export type CRCManipulationCancelReason =
  | "explicit"
  | "escape"
  | "pointer-cancel"
  | "capture-lost"
  | "disabled"
  | "external-change"
  | "coordinate-space-changed"
  | "constraints-unsatisfiable";
export interface CRCManipulationActive {
  readonly operation: CRCManipulationOperation;
  readonly handle: CRCResizePosition | null;
  readonly pointerId: number;
}
export interface CRCManipulationSnapshot {
  readonly operation: CRCManipulationOperation;
  readonly handle: CRCResizePosition | null;
  readonly initial: CRCManipulationGeometry;
  readonly proposed: CRCManipulationGeometry;
  readonly applied: CRCManipulationGeometry;
  readonly snapActive: boolean;
  readonly snapSatisfied: boolean;
}
export interface CRCManipulationEvent extends CRCManipulationSnapshot {
  readonly before: CRCManipulationGeometry;
  readonly after: CRCManipulationGeometry;
}
export interface CRCManipulationCommitEvent extends CRCManipulationEvent {
  readonly changed: boolean;
}
export interface CRCManipulationCancelEvent extends CRCManipulationEvent {
  readonly reason: CRCManipulationCancelReason;
}
export type CRCManipulationMoveInput = Omit<
  CRCManipulationMoveOptions,
  "snap"
> & {
  readonly enabled?: SignalValue<boolean>;
  readonly snap?: Omit<
    NonNullable<CRCManipulationMoveOptions["snap"]>,
    "enabled"
  > & { readonly enabled?: SignalValue<boolean> };
};
type SignalEnabled<T> = T extends unknown
  ? Omit<T, "enabled"> & { readonly enabled?: SignalValue<boolean> }
  : never;
export type CRCManipulationResizeInput = Omit<
  CRCManipulationResizeOptions,
  "snap"
> & {
  readonly enabled?: SignalValue<boolean>;
  readonly snap?: SignalEnabled<
    NonNullable<CRCManipulationResizeOptions["snap"]>
  >;
};
export type CRCManipulationRotateInput = Omit<
  CRCManipulationRotateOptions,
  "snap"
> & {
  readonly enabled?: SignalValue<boolean>;
  readonly snap?: SignalEnabled<
    NonNullable<CRCManipulationRotateOptions["snap"]>
  >;
};
export interface CRCManipulationOptions {
  readonly box: WritableSignal<CRCManipulationBox>;
  readonly rotation?: WritableSignal<number>;
  readonly move?: CRCManipulationMoveInput;
  readonly resize?: CRCManipulationResizeInput;
  readonly rotate?: CRCManipulationRotateInput;
  readonly onStart?: (event: CRCManipulationEvent) => void;
  readonly onChange?: (event: CRCManipulationEvent) => void;
  readonly onCommit?: (event: CRCManipulationCommitEvent) => void;
  readonly onCancel?: (event: CRCManipulationCancelEvent) => void;
}
export interface CRCManipulationFrameProps {
  readonly controller: CRCManipulationController;
  readonly style: WritableSignal<CRCManipulationBox>;
  readonly children?: CRCNode;
}
export interface CRCManipulationController {
  readonly active: Signal<CRCManipulationActive | null>;
  readonly snapshot: Signal<CRCManipulationSnapshot | null>;
  readonly frameProps: CRCManipulationFrameProps;
  cancel(): void;
}
