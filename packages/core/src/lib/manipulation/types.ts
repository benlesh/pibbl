import type { CRCManipulationActive, CRCManipulationFrameProps, CRCManipulationGeometry, CRCManipulationOptions, CRCManipulationSnapshot } from './controller-types.js';
import type { CRCDragHandleProps } from './handles.js';
/**
 * Position and dimensions of a manipulation target in logical coordinates.
 *
 * @see {@link CRCManipulationOptions}
 * @see {@link CRCManipulationGeometry}
 * @see {@link CRCManipulationFrameProps}
 */
export interface CRCManipulationBox {
  /** Left edge coordinate or inset. See {@link CRCManipulationBox}. */
  readonly left: number;
  /** Top edge value or top envelope guide. See {@link CRCManipulationBox}. */
  readonly top: number;
  /**
   * Horizontal extent in the units of the containing geometry or surface. See
   * {@link CRCManipulationBox}.
   */
  readonly width: number;
  /**
   * Vertical extent in the units of the containing geometry or surface. See
   * {@link CRCManipulationBox}.
   */
  readonly height: number;
}

/**
 * A manipulation input point in logical coordinates.
 *
 * @see {@link CRCManipulationGeometry}
 */
export interface CRCManipulationPoint {
  /**
   * Horizontal coordinate or displacement in the containing coordinate system. See
   * {@link CRCManipulationPoint}.
   */
  readonly x: number;
  /**
   * Vertical coordinate or displacement in the containing coordinate system. See
   * {@link CRCManipulationPoint}.
   */
  readonly y: number;
}

export interface CRCManipulationModifiers {
  readonly shift?: boolean;
  readonly alt?: boolean;
  readonly ctrl?: boolean;
  readonly meta?: boolean;
}

/**
 * Modifier-key condition used to activate manipulation snapping or affordances.
 *
 * @see {@link CRCDragHandleProps}
 */
export type CRCManipulationWhen = 'always' | 'shift' | 'alt' | 'ctrl' | 'meta';

/**
 * An edge or corner at which a resize handle is placed.
 *
 * @see {@link CRCManipulationSnapshot}
 * @see {@link CRCManipulationActive}
 */
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

/**
 * Axis, bounding box, and snapping constraints for translation.
 *
 * @see {@link CRCManipulationBox}
 * @see {@link CRCManipulationMoveSnap}
 */
export interface CRCManipulationMoveOptions {
  /** Selects `"both"`, `"x"`, `"y"` for axis. See {@link CRCManipulationMoveOptions}. */
  readonly axis?: 'both' | 'x' | 'y';
  /** Logical region constraining the content or query. See {@link CRCManipulationBox}. */
  readonly bounds?: CRCManipulationBox;
  /** Snapping configuration for the manipulation operation. See {@link CRCManipulationMoveSnap}. */
  readonly snap?: CRCManipulationMoveSnap;
}

export interface CRCManipulationResizeSizeSnap {
  readonly target?: 'size';
  readonly enabled?: boolean;
  readonly when?: CRCManipulationWhen;
  readonly step: number | Readonly<{ width: number; height: number }>;
}

export interface CRCManipulationResizeGridSnap {
  readonly target: 'grid';
  readonly enabled?: boolean;
  readonly when?: CRCManipulationWhen;
  readonly step: number | Readonly<{ x: number; y: number }>;
  readonly origin?: Readonly<{ x?: number; y?: number }>;
}

export interface CRCManipulationAspectRatio {
  readonly value: 'initial' | number;
  readonly when?: CRCManipulationWhen;
}

/**
 * Size limits, bounds, aspect ratio, and snapping constraints for resizing.
 *
 * @see {@link CRCManipulationBox}
 * @see {@link CRCManipulationResizeSizeSnap}
 */
export interface CRCManipulationResizeOptions {
  /** Minimum permitted width. See {@link CRCManipulationResizeOptions}. */
  readonly minWidth?: number;
  /** Minimum permitted height. See {@link CRCManipulationResizeOptions}. */
  readonly minHeight?: number;
  /** Maximum permitted width. See {@link CRCManipulationResizeOptions}. */
  readonly maxWidth?: number;
  /** Maximum permitted height. See {@link CRCManipulationResizeOptions}. */
  readonly maxHeight?: number;
  /** Logical region constraining the content or query. See {@link CRCManipulationBox}. */
  readonly bounds?: CRCManipulationBox;
  /**
   * Constraint on the manipulated width-to-height ratio. See {@link CRCManipulationAspectRatio}.
   */
  readonly aspectRatio?: CRCManipulationAspectRatio;
  /**
   * Snapping configuration for the manipulation operation. See
   * {@link CRCManipulationResizeSizeSnap}, {@link CRCManipulationResizeGridSnap}.
   */
  readonly snap?: CRCManipulationResizeSizeSnap | CRCManipulationResizeGridSnap;
}

export interface CRCManipulationRotateSnap {
  readonly enabled?: boolean;
  readonly when?: CRCManipulationWhen;
  readonly step: number;
  readonly origin?: number;
}

/**
 * Angular snapping configuration for rotation.
 *
 * @see {@link CRCManipulationRotateSnap}
 */
export interface CRCManipulationRotateOptions {
  /**
   * Snapping configuration for the manipulation operation. See {@link CRCManipulationRotateSnap}.
   */
  readonly snap?: CRCManipulationRotateSnap;
}

export interface ManipulationSolveInput {
  readonly operation: 'move' | 'resize' | 'rotate';
  readonly handle?: CRCResizePosition;
  readonly initial: CRCManipulationBox;
  readonly initialRotation?: number;
  readonly rotationDelta?: number;
  readonly initialPoint: CRCManipulationPoint;
  readonly currentPoint: CRCManipulationPoint;
  readonly modifiers: CRCManipulationModifiers;
  readonly move?: CRCManipulationMoveOptions;
  readonly resize?: CRCManipulationResizeOptions;
  readonly rotate?: CRCManipulationRotateOptions;
}

export interface ManipulationSolveResult {
  readonly proposed: CRCManipulationBox;
  readonly applied: CRCManipulationBox;
  readonly snapActive: boolean;
  readonly snapSatisfied: boolean;
  readonly proposedRotation: number;
  readonly appliedRotation: number;
}
