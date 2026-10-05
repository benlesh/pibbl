import { definePrimitive } from '../define-primitive.js';
import type {
  CRCEventFocusOptions,
  CRCEventHandlers,
  CRCEventParticipationOptions,
} from '../events/types.js';
import type { RenderingContext2D, SystemStyle } from '../types.js';
import type { CRCPhysics2DPropExtension } from '../types.js';
import {
  resolveLocalOffset,
  stripLayoutParticipation,
} from '../style/resolve-built-in.js';
import { registerOpaqueStyleProperties } from '../style/resolve-dispatch.js';
import type {
  BoxStyle,
  CursorStyle,
  LayoutItemStyle,
  Length,
  PaintStyle,
  ResolvedDrawingStyle,
} from '../style/types.js';
import {
  resolveFiniteShapeNumber,
  resolveNonnegativeShapeLength,
} from './shape-style.js';
import { renderPath } from './path.js';
import { createEllipsePath } from '../geometry/ellipse.js';

/**
 * Authored inputs for Ellipse, including the declared data and presentation options.
 *
 * @see {@link CRCEventHandlers}
 * @see {@link CRCEventParticipationOptions}
 * @see {@link CRCPhysics2DPropExtension}
 * @see {@link Ellipse}
 */
export interface EllipseProps extends CRCEventHandlers, CRCEventFocusOptions, CRCEventParticipationOptions, CRCPhysics2DPropExtension {}

/**
 * Supported geometry and presentation properties for Ellipse.
 *
 * @see {@link SystemStyle}
 * @see {@link PaintStyle}
 * @see {@link CursorStyle}
 * @see {@link BoxStyle}
 * @see {@link LayoutItemStyle}
 * @see {@link Length}
 * @see {@link Ellipse}
 */
export interface EllipseStyle
  extends SystemStyle, PaintStyle, CursorStyle, BoxStyle, LayoutItemStyle {
  /** Horizontal ellipse radius. See {@link Length}. */
  radiusX: Exclude<Length, 'auto'>;
  /** Vertical ellipse radius. See {@link Length}. */
  radiusY: Exclude<Length, 'auto'>;
  /** Horizontal coordinate of the center. See {@link Length}. */
  cx?: Exclude<Length, 'auto'>;
  /** Vertical coordinate of the center. See {@link Length}. */
  cy?: Exclude<Length, 'auto'>;
  /** Rotation applied to the containing geometry. See {@link EllipseStyle}. */
  rotation?: number;
  /**
   * Width used for line hit testing independently of the visible stroke width. See
   * {@link EllipseStyle}.
   */
  lineInteractionWidth?: number;
}

type ResolvedEllipseStyle = ResolvedDrawingStyle<EllipseStyle> & {
  radiusX: number;
  radiusY: number;
  cx: number;
  cy: number;
  rotation: number;
};

function renderEllipse(
  props: EllipseProps,
  style: Readonly<ResolvedEllipseStyle>,
  ctx: RenderingContext2D,
) {
  const { cx, cy, radiusX, radiusY, rotation, ...pathStyle } = style;
  const path = createEllipsePath({ cx, cy, radiusX, radiusY, rotation });
  const halfWidth = Math.sqrt(
    (radiusX * Math.cos(rotation)) ** 2 +
      (radiusY * Math.sin(rotation)) ** 2,
  );
  const halfHeight = Math.sqrt(
    (radiusX * Math.sin(rotation)) ** 2 +
      (radiusY * Math.cos(rotation)) ** 2,
  );

  return renderPath({
    ...props,
    keyboardNavigationBounds: props.keyboardNavigationBounds ?? {
      x: cx - halfWidth,
      y: cy - halfHeight,
      width: halfWidth * 2,
      height: halfHeight * 2,
    },
  }, {
    ...pathStyle,
    d: path,
  }, ctx);
}

/**
 * Describes an ellipse primitive for JSX or createElement authoring.
 *
 * @param props - Authored component inputs, supplied through JSX or createElement. See the linked
 * props and style types.
 * @throws When called directly; CRC mounts this component through JSX or createElement.
 *
 * @see {@link EllipseProps}
 * @see {@link EllipseStyle}
 */
export const Ellipse = definePrimitive<
  EllipseProps,
  EllipseStyle,
  EllipseStyle,
  ResolvedEllipseStyle
>(renderEllipse, {
  resolveStyle: (style, context) => ({
    ...stripLayoutParticipation(style),
    cx: resolveLocalOffset(style.cx, context.percentageBasis.width, 'cx', context),
    cy: resolveLocalOffset(style.cy, context.percentageBasis.height, 'cy', context),
    radiusX: resolveNonnegativeShapeLength(
      style.radiusX,
      context.percentageBasis.width,
      'radiusX',
      context,
    ),
    radiusY: resolveNonnegativeShapeLength(
      style.radiusY,
      context.percentageBasis.height,
      'radiusY',
      context,
    ),
    rotation: resolveFiniteShapeNumber(style.rotation ?? 0, 'rotation', context),
  }) as ResolvedEllipseStyle,
});
registerOpaqueStyleProperties(Ellipse, ['fill', 'stroke', 'cursor']);
