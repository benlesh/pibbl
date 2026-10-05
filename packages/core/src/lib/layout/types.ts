import type { measureElement } from './measure.js';
import type { resolveBox } from './box.js';
import type { LayoutDiagnosticContext } from '../style/diagnostics.js';
import type { normalizeEdges } from '../style/normalize.js';
import type { BoxStyle, ResolvedBoxStyle } from '../style/types.js';
import type { CRCRenderLayerTarget } from '../render-layer/types.js';
import type { useLayoutBox } from '../hooks/use-layout-box.js';
import type { MeasureResult } from '../types.js';
/**
 * Width and height in logical Canvas units.
 *
 * @see {@link LayoutBox}
 * @see {@link MeasureResult}
 */
export interface Size {
  /** Horizontal extent in the units of the containing geometry or surface. See {@link Size}. */
  width: number;
  /** Vertical extent in the units of the containing geometry or surface. See {@link Size}. */
  height: number;
}

/**
 * Available and limiting dimensions supplied to layout and measurement.
 *
 * @see {@link measureElement}
 * @see {@link resolveBox}
 * @see {@link LayoutDiagnosticContext}
 */
export interface Constraints {
  /** Minimum permitted width. See {@link Constraints}. */
  minWidth: number;
  /** Maximum permitted width. See {@link Constraints}. */
  maxWidth: number;
  /** Minimum permitted height. See {@link Constraints}. */
  minHeight: number;
  /** Maximum permitted height. See {@link Constraints}. */
  maxHeight: number;
}

/**
 * An axis-aligned rectangle in the layout coordinate system.
 *
 * @see {@link Size}
 * @see {@link CRCRenderLayerTarget}
 * @see {@link ResolvedBoxStyle}
 * @see {@link useLayoutBox}
 */
export interface LayoutBox extends Size {
  /**
   * Horizontal coordinate or displacement in the containing coordinate system. See
   * {@link LayoutBox}.
   */
  x: number;
  /**
   * Vertical coordinate or displacement in the containing coordinate system. See {@link LayoutBox}
   * .
   */
  y: number;
}

/** @internal Temporary render-time allocation and containing-block basis. */
export interface LayoutContext {
  allocation: Readonly<LayoutBox>;
  percentageBasis: Readonly<LayoutBox>;
}

/**
 * Resolved numeric insets for the four sides of a box.
 *
 * @see {@link normalizeEdges}
 * @see {@link BoxStyle}
 */
export interface Edges {
  /** Top edge value or top envelope guide. See {@link Edges}. */
  top: number;
  /** Right edge coordinate or inset. See {@link Edges}. */
  right: number;
  /** Bottom edge value or bottom envelope guide. See {@link Edges}. */
  bottom: number;
  /** Left edge coordinate or inset. See {@link Edges}. */
  left: number;
}
