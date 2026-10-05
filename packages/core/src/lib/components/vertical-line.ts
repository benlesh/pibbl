import { definePrimitive } from '../define-primitive.js';
import type {
  PibblEventFocusOptions,
  PibblEventHandlers,
  PibblEventParticipationOptions,
} from '../events/types.js';
import {
  PixelGridAlignment,
  RenderingContext2D,
  SystemStyle,
} from '../types.js';
import type { PibblPhysics2DPropExtension } from '../types.js';
import { adjustForPixelGrid } from '../util/pixel-grid-adjustments.js';
import {
  resolveLocalOffset,
  resolveRequiredLength,
  stripLayoutParticipation,
} from '../style/resolve-built-in.js';
import { registerOpaqueStyleProperties } from '../style/resolve-dispatch.js';
import type {
  BoxStyle,
  LayoutItemStyle,
  Length,
  ResolvedDrawingStyle,
} from '../style/types.js';
import { renderLine, type LineStyle } from './line.js';

/**
 * Authored inputs for VerticalLine, including the declared data and presentation options.
 *
 * @see {@link PibblEventHandlers}
 * @see {@link PibblEventParticipationOptions}
 * @see {@link PibblPhysics2DPropExtension}
 * @see {@link VerticalLine}
 */
export interface VerticalLineProps
  extends PibblEventHandlers, PibblEventFocusOptions, PibblEventParticipationOptions, PibblPhysics2DPropExtension {}

/**
 * Supported geometry and presentation properties for VerticalLine.
 *
 * @see {@link SystemStyle}
 * @see {@link BoxStyle}
 * @see {@link LayoutItemStyle}
 * @see {@link LineStyle}
 * @see {@link Length}
 * @see {@link PixelGridAlignment}
 * @see {@link VerticalLine}
 */
export interface VerticalLineStyle
  extends SystemStyle, BoxStyle, LayoutItemStyle, Omit<LineStyle, 'coords'> {
  /**
   * Horizontal coordinate or displacement in the containing coordinate system. See {@link Length}
   * .
   */
  x: Exclude<Length, 'auto'>;
  /** Vertical coordinate of the first endpoint. See {@link Length}. */
  y1?: Exclude<Length, 'auto'>;
  /** Vertical coordinate of the second endpoint. See {@link Length}. */
  y2?: Exclude<Length, 'auto'>;
  /**
   * Pixel-grid alignment policy applied to the resolved geometry. See {@link PixelGridAlignment}.
   */
  alignToPixelGrid?: PixelGridAlignment;
  /**
   * Width used for line hit testing independently of the visible stroke width. See
   * {@link VerticalLineStyle}.
   */
  lineInteractionWidth?: number;
}

type ResolvedVerticalLineStyle = ResolvedDrawingStyle<VerticalLineStyle> & {
  x: number;
  y1: number;
  y2: number;
};

function renderVerticalLine(
  props: VerticalLineProps,
  style: Readonly<ResolvedVerticalLineStyle>,
  ctx: RenderingContext2D,
) {
  const {
    x: initialX,
    y1 = 0,
    y2 = ctx.canvas.height,
    alignToPixelGrid = 'none',
    stroke,
    strokeWidth,
    opacity,
    cursor,
    lineInteractionWidth,
  } = style;
  const x = adjustForPixelGrid(
    initialX,
    strokeWidth,
    alignToPixelGrid,
  );
  const coords: [number, number][] = [
    [x, y1],
    [x, y2],
  ];

  return renderLine(
    props,
    {
      coords,
      stroke,
      strokeWidth,
      opacity,
      cursor,
      lineInteractionWidth,
    },
    ctx,
  );
}

/**
 * Describes a vertical-line primitive for JSX or createElement authoring.
 *
 * @param props - Authored component inputs, supplied through JSX or createElement. See the linked
 * props and style types.
 * @throws When called directly; Pibbl mounts this component through JSX or createElement.
 *
 * @see {@link VerticalLineProps}
 * @see {@link VerticalLineStyle}
 */
export const VerticalLine = definePrimitive<
  VerticalLineProps,
  VerticalLineStyle,
  VerticalLineStyle,
  ResolvedVerticalLineStyle
>(renderVerticalLine, {
  resolveStyle: (style, context) => ({
    ...stripLayoutParticipation(style),
    x: resolveRequiredLength(
      style.x,
      context.percentageBasis.width,
      'x',
      context,
    ),
    y1: resolveLocalOffset(
      style.y1,
      context.percentageBasis.height,
      'y1',
      context,
    ),
    y2: resolveRequiredLength(
      style.y2 ?? context.allocation.height,
      context.percentageBasis.height,
      'y2',
      context,
    ),
  }) as ResolvedVerticalLineStyle,
});
registerOpaqueStyleProperties(VerticalLine, ['stroke', 'cursor']);
