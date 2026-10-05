import type { PibblManipulationActive, PibblManipulationFrameProps, PibblManipulationGeometry, PibblManipulationOptions, PibblManipulationSnapshot } from './controller-types.js';
import type { PibblDragHandleProps } from './handles.js';
/**
 * Position and dimensions of a manipulation target in logical coordinates.
 *
 * @see {@link PibblManipulationOptions}
 * @see {@link PibblManipulationGeometry}
 * @see {@link PibblManipulationFrameProps}
 */
export interface PibblManipulationBox {
  /** Left edge coordinate or inset. See {@link PibblManipulationBox}. */
  readonly left: number;
  /** Top edge value or top envelope guide. See {@link PibblManipulationBox}. */
  readonly top: number;
  /**
   * Horizontal extent in the units of the containing geometry or surface. See
   * {@link PibblManipulationBox}.
   */
  readonly width: number;
  /**
   * Vertical extent in the units of the containing geometry or surface. See
   * {@link PibblManipulationBox}.
   */
  readonly height: number;
}

/**
 * A manipulation input point in logical coordinates.
 *
 * @see {@link PibblManipulationGeometry}
 */
export interface PibblManipulationPoint {
  /**
   * Horizontal coordinate or displacement in the containing coordinate system. See
   * {@link PibblManipulationPoint}.
   */
  readonly x: number;
  /**
   * Vertical coordinate or displacement in the containing coordinate system. See
   * {@link PibblManipulationPoint}.
   */
  readonly y: number;
}

export interface PibblManipulationModifiers {
  readonly shift?: boolean;
  readonly alt?: boolean;
  readonly ctrl?: boolean;
  readonly meta?: boolean;
}

/**
 * Modifier-key condition used to activate manipulation snapping or affordances.
 *
 * @see {@link PibblDragHandleProps}
 */
export type PibblManipulationWhen = 'always' | 'shift' | 'alt' | 'ctrl' | 'meta';

/**
 * An edge or corner at which a resize handle is placed.
 *
 * @see {@link PibblManipulationSnapshot}
 * @see {@link PibblManipulationActive}
 */
export type PibblResizePosition =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'right'
  | 'bottom-right'
  | 'bottom'
  | 'bottom-left'
  | 'left';

export interface PibblManipulationMoveSnap {
  readonly enabled?: boolean;
  readonly when?: PibblManipulationWhen;
  readonly step: number | Readonly<{ x: number; y: number }>;
  readonly origin?: Readonly<{ x?: number; y?: number }>;
}

/**
 * Axis, bounding box, and snapping constraints for translation.
 *
 * @see {@link PibblManipulationBox}
 * @see {@link PibblManipulationMoveSnap}
 */
export interface PibblManipulationMoveOptions {
  /** Selects `"both"`, `"x"`, `"y"` for axis. See {@link PibblManipulationMoveOptions}. */
  readonly axis?: 'both' | 'x' | 'y';
  /** Logical region constraining the content or query. See {@link PibblManipulationBox}. */
  readonly bounds?: PibblManipulationBox;
  /** Snapping configuration for the manipulation operation. See {@link PibblManipulationMoveSnap}. */
  readonly snap?: PibblManipulationMoveSnap;
}

export interface PibblManipulationResizeSizeSnap {
  readonly target?: 'size';
  readonly enabled?: boolean;
  readonly when?: PibblManipulationWhen;
  readonly step: number | Readonly<{ width: number; height: number }>;
}

export interface PibblManipulationResizeGridSnap {
  readonly target: 'grid';
  readonly enabled?: boolean;
  readonly when?: PibblManipulationWhen;
  readonly step: number | Readonly<{ x: number; y: number }>;
  readonly origin?: Readonly<{ x?: number; y?: number }>;
}

export interface PibblManipulationAspectRatio {
  readonly value: 'initial' | number;
  readonly when?: PibblManipulationWhen;
}

/**
 * Size limits, bounds, aspect ratio, and snapping constraints for resizing.
 *
 * @see {@link PibblManipulationBox}
 * @see {@link PibblManipulationResizeSizeSnap}
 */
export interface PibblManipulationResizeOptions {
  /** Minimum permitted width. See {@link PibblManipulationResizeOptions}. */
  readonly minWidth?: number;
  /** Minimum permitted height. See {@link PibblManipulationResizeOptions}. */
  readonly minHeight?: number;
  /** Maximum permitted width. See {@link PibblManipulationResizeOptions}. */
  readonly maxWidth?: number;
  /** Maximum permitted height. See {@link PibblManipulationResizeOptions}. */
  readonly maxHeight?: number;
  /** Logical region constraining the content or query. See {@link PibblManipulationBox}. */
  readonly bounds?: PibblManipulationBox;
  /**
   * Constraint on the manipulated width-to-height ratio. See {@link PibblManipulationAspectRatio}.
   */
  readonly aspectRatio?: PibblManipulationAspectRatio;
  /**
   * Snapping configuration for the manipulation operation. See
   * {@link PibblManipulationResizeSizeSnap}, {@link PibblManipulationResizeGridSnap}.
   */
  readonly snap?: PibblManipulationResizeSizeSnap | PibblManipulationResizeGridSnap;
}

export interface PibblManipulationRotateSnap {
  readonly enabled?: boolean;
  readonly when?: PibblManipulationWhen;
  readonly step: number;
  readonly origin?: number;
}

/**
 * Angular snapping configuration for rotation.
 *
 * @see {@link PibblManipulationRotateSnap}
 */
export interface PibblManipulationRotateOptions {
  /**
   * Snapping configuration for the manipulation operation. See {@link PibblManipulationRotateSnap}.
   */
  readonly snap?: PibblManipulationRotateSnap;
}

export interface ManipulationSolveInput {
  readonly operation: 'move' | 'resize' | 'rotate';
  readonly handle?: PibblResizePosition;
  readonly initial: PibblManipulationBox;
  readonly initialRotation?: number;
  readonly rotationDelta?: number;
  readonly initialPoint: PibblManipulationPoint;
  readonly currentPoint: PibblManipulationPoint;
  readonly modifiers: PibblManipulationModifiers;
  readonly move?: PibblManipulationMoveOptions;
  readonly resize?: PibblManipulationResizeOptions;
  readonly rotate?: PibblManipulationRotateOptions;
}

export interface ManipulationSolveResult {
  readonly proposed: PibblManipulationBox;
  readonly applied: PibblManipulationBox;
  readonly snapActive: boolean;
  readonly snapSatisfied: boolean;
  readonly proposedRotation: number;
  readonly appliedRotation: number;
}
