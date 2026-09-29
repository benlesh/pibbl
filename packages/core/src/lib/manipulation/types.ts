export interface CRCManipulationBox {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface CRCManipulationPoint {
  readonly x: number;
  readonly y: number;
}

export interface CRCManipulationModifiers {
  readonly shift?: boolean;
  readonly alt?: boolean;
  readonly ctrl?: boolean;
  readonly meta?: boolean;
}

export type CRCManipulationWhen = 'always' | 'shift' | 'alt' | 'ctrl' | 'meta';

export type CRCResizePosition =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'right'
  | 'bottom-right'
  | 'bottom'
  | 'bottom-left'
  | 'left';

export interface CRCManipulationMoveSnap {
  readonly enabled?: boolean;
  readonly when?: CRCManipulationWhen;
  readonly step: number | Readonly<{ x: number; y: number }>;
  readonly origin?: Readonly<{ x?: number; y?: number }>;
}

export interface CRCManipulationMoveOptions {
  readonly axis?: 'both' | 'x' | 'y';
  readonly snap?: CRCManipulationMoveSnap;
}

export interface CRCManipulationResizeSizeSnap {
  readonly target?: 'size';
  readonly enabled?: boolean;
  readonly when?: CRCManipulationWhen;
  readonly step: number | Readonly<{ width: number; height: number }>;
}

export interface CRCManipulationResizeOptions {
  readonly minWidth?: number;
  readonly minHeight?: number;
  readonly maxWidth?: number;
  readonly maxHeight?: number;
  readonly snap?: CRCManipulationResizeSizeSnap;
}

export interface ManipulationSolveInput {
  readonly operation: 'move' | 'resize' | 'rotate';
  readonly handle?: CRCResizePosition;
  readonly initial: CRCManipulationBox;
  readonly initialPoint: CRCManipulationPoint;
  readonly currentPoint: CRCManipulationPoint;
  readonly modifiers: CRCManipulationModifiers;
  readonly move?: CRCManipulationMoveOptions;
  readonly resize?: CRCManipulationResizeOptions;
}

export interface ManipulationSolveResult {
  readonly proposed: CRCManipulationBox;
  readonly applied: CRCManipulationBox;
  readonly snapActive: boolean;
  readonly snapSatisfied: boolean;
}
