import { definePrimitive } from '../define-primitive.js';
import type {
  CRCEventFocusOptions,
  CRCEventHandlers,
} from '../events/types.js';
import type { RenderingContext2D, SystemStyle } from '../types.js';
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

export interface EllipseProps extends CRCEventHandlers, CRCEventFocusOptions {}

export interface EllipseStyle
  extends SystemStyle, PaintStyle, CursorStyle, BoxStyle, LayoutItemStyle {
  radiusX: Exclude<Length, 'auto'>;
  radiusY: Exclude<Length, 'auto'>;
  cx?: Exclude<Length, 'auto'>;
  cy?: Exclude<Length, 'auto'>;
  rotation?: number;
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
  const path = new Path2D();
  if (radiusX > 0 && radiusY > 0) {
    path.ellipse(cx, cy, radiusX, radiusY, rotation, 0, Math.PI * 2);
  }
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

/** Describes an ellipse primitive for JSX or createElement authoring. */
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
