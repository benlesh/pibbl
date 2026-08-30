import { defineComp } from '../define-comp.js';
import type { CRCEventHandlers } from '../events/types.js';
import { RenderingContext2D } from '../types.js';
import {
  resolveLocalOffset,
  resolveRequiredLength,
  stripLayoutParticipation,
} from '../style/resolve-built-in.js';
import type { RectStyle, ResolvedRectStyle } from '../style/types.js';
import { registerOpaqueStyleProperties } from '../style/resolve-dispatch.js';
import { adjustRectangleToPixelGrid } from '../util/pixel-grid-adjustments.js';
import { Path } from './path.js';

export interface RectProps extends CRCEventHandlers {}

function Rect(
  props: RectProps,
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

  Path(
    props,
    {
      ...pathStyle,
      d: rectPath,
    },
    ctx,
  );
}

/**
 * Creates a renderable Rect component element.
 */
export const rect = defineComp<
  RectProps,
  RectStyle,
  RectStyle,
  ResolvedRectStyle
>(Rect, {
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
registerOpaqueStyleProperties(Rect, ['fill', 'stroke', 'cursor']);
