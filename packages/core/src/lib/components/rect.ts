import { definePrimitive } from '../define-primitive.js';
import type {
  CRCEventFocusOptions,
  CRCEventHandlers,
  CRCEventParticipationOptions,
} from '../events/types.js';
import { RenderingContext2D } from '../types.js';
import type { CRCPhysics2DPropExtension } from '../types.js';
import {
  resolveRequiredLength,
  stripLayoutParticipation,
} from '../style/resolve-built-in.js';
import type { RectStyle, ResolvedRectStyle } from '../style/types.js';
import { registerOpaqueStyleProperties } from '../style/resolve-dispatch.js';
import { adjustRectangleToPixelGrid } from '../util/pixel-grid-adjustments.js';
import { renderPath } from './path.js';
import { createRectanglePath } from '../geometry/rectangle.js';
import { resolveRoundedCornerStyle } from './rounded-corner-style.js';

/**
 * Authored inputs for Rectangle, including the declared data and presentation options.
 *
 * @see {@link CRCEventHandlers}
 * @see {@link CRCEventParticipationOptions}
 * @see {@link CRCPhysics2DPropExtension}
 * @see {@link Rectangle}
 */
export interface RectangleProps extends CRCEventHandlers, CRCEventFocusOptions, CRCEventParticipationOptions, CRCPhysics2DPropExtension {}

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
    cornerRadius,
    cornerRadii,
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

  const rectPath = createRectanglePath({
    x,
    y,
    width,
    height,
    cornerRadius,
    cornerRadii,
  });

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
    { x, y, width, height },
    cornerRadius === undefined && cornerRadii === undefined,
  );
}

/**
 * Describes a rectangle primitive for JSX or createElement authoring.
 *
 * @param props - Authored component inputs, supplied through JSX or createElement. See the linked
 * props and style types.
 * @throws When called directly; CRC mounts this component through JSX or createElement.
 *
 * @see {@link RectangleProps}
 * @see {@link RectStyle}
 */
export const Rectangle = definePrimitive<
  RectangleProps,
  RectStyle,
  RectStyle,
  ResolvedRectStyle
>(renderRectangle, {
  resolveStyle: (style, context) => ({
    ...stripLayoutParticipation(style),
    x: 0,
    y: 0,
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
    ...resolveRoundedCornerStyle(4, style, context),
  }) as ResolvedRectStyle,
});
registerOpaqueStyleProperties(Rectangle, ['fill', 'stroke', 'cursor']);
