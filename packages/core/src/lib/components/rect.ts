import { definePrimitive } from '../define-primitive.js';
import type {
  CRCEventFocusOptions,
  CRCEventHandlers,
} from '../events/types.js';
import { RenderingContext2D } from '../types.js';
import {
  resolveLocalOffset,
  resolveRequiredLength,
  stripLayoutParticipation,
} from '../style/resolve-built-in.js';
import type { RectStyle, ResolvedRectStyle } from '../style/types.js';
import { registerOpaqueStyleProperties } from '../style/resolve-dispatch.js';
import { adjustRectangleToPixelGrid } from '../util/pixel-grid-adjustments.js';
import { renderPath } from './path.js';

export interface RectangleProps extends CRCEventHandlers, CRCEventFocusOptions {}

function renderRectangle(
  props: RectangleProps,
  style: Readonly<ResolvedRectStyle>,
  ctx: RenderingContext2D,
) {
  let {
    x = 0,
    y = 0,
    width,
    height,
    alignToPixelGrid,
    ...pathStyle
  } = style;

  if (alignToPixelGrid) {
    ({ x, y, width, height } = adjustRectangleToPixelGrid(
      style.strokeWidth ?? 0,
      x,
      y,
      width,
      height,
      alignToPixelGrid,
    ));
  }

  const rectPath = new Path2D();
  rectPath.rect(x, y, width, height);

  renderPath(
    {
      ...props,
      keyboardNavigationBounds: props.keyboardNavigationBounds ?? {
        x,
        y,
        width,
        height,
      },
    },
    {
      ...pathStyle,
      d: rectPath,
    },
    ctx,
  );
}

/**
 * Describes a rectangle primitive for JSX or createElement authoring.
 */
export const Rectangle = definePrimitive<
  RectangleProps,
  RectStyle,
  RectStyle,
  ResolvedRectStyle
>(renderRectangle, {
  resolveStyle: (style, context) => ({
    ...stripLayoutParticipation(style),
    x: resolveLocalOffset(style.x, context.percentageBasis.width, 'x', context),
    y: resolveLocalOffset(style.y, context.percentageBasis.height, 'y', context),
    width: resolveRequiredLength(
      style.width,
      context.percentageBasis.width,
      'width',
      context,
    ),
    height: resolveRequiredLength(
      style.height,
      context.percentageBasis.height,
      'height',
      context,
    ),
  }) as ResolvedRectStyle,
});
registerOpaqueStyleProperties(Rectangle, ['fill', 'stroke', 'cursor']);
