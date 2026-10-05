import { definePrimitive } from '../define-primitive.js';
import type {
  CRCEventFocusOptions,
  CRCEventHandlers,
  CRCEventParticipationOptions,
} from '../events/types.js';
import {
  PixelGridAlignment,
  RenderingContext2D,
  SystemStyle,
} from '../types.js';
import type { CRCPhysics2DPropExtension } from '../types.js';
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
 * Authored inputs for HorizontalLine, including the declared data and presentation options.
 *
 * @see {@link CRCEventHandlers}
 * @see {@link CRCEventParticipationOptions}
 * @see {@link CRCPhysics2DPropExtension}
 * @see {@link HorizontalLine}
 */
export interface HorizontalLineProps
  extends CRCEventHandlers, CRCEventFocusOptions, CRCEventParticipationOptions, CRCPhysics2DPropExtension {}

/**
 * Supported geometry and presentation properties for HorizontalLine.
 *
 * @see {@link SystemStyle}
 * @see {@link BoxStyle}
 * @see {@link LayoutItemStyle}
 * @see {@link LineStyle}
 * @see {@link Length}
 * @see {@link PixelGridAlignment}
 * @see {@link HorizontalLine}
 */
export interface HorizontalLineStyle
  extends SystemStyle, BoxStyle, LayoutItemStyle, Omit<LineStyle, 'coords'> {
  /**
   * Vertical coordinate or displacement in the containing coordinate system. See {@link Length}.
   */
  y: Exclude<Length, 'auto'>;
  /** Horizontal coordinate of the first endpoint. See {@link Length}. */
  x1?: Exclude<Length, 'auto'>;
  /** Horizontal coordinate of the second endpoint. See {@link Length}. */
  x2?: Exclude<Length, 'auto'>;
  /**
   * Pixel-grid alignment policy applied to the resolved geometry. See {@link PixelGridAlignment}.
   */
  alignToPixelGrid?: PixelGridAlignment;
  /**
   * Width used for line hit testing independently of the visible stroke width. See
   * {@link HorizontalLineStyle}.
   */
  lineInteractionWidth?: number;
}

type ResolvedHorizontalLineStyle = ResolvedDrawingStyle<HorizontalLineStyle> & {
  y: number;
  x1: number;
  x2: number;
};

function renderHorizontalLine(
  props: HorizontalLineProps,
  style: Readonly<ResolvedHorizontalLineStyle>,
  ctx: RenderingContext2D,
) {
  const {
    y: initialY,
    x1 = 0,
    x2 = ctx.canvas.width,
    alignToPixelGrid = 'none',
    stroke,
    strokeWidth,
    opacity,
    cursor,
    lineInteractionWidth,
  } = style;
  const y = adjustForPixelGrid(
    initialY,
    strokeWidth,
    alignToPixelGrid,
  );
  const coords: [number, number][] = [
    [x1, y],
    [x2, y],
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
 * Describes a horizontal-line primitive for JSX or createElement authoring.
 *
 * @param props - Authored component inputs, supplied through JSX or createElement. See the linked
 * props and style types.
 * @throws When called directly; CRC mounts this component through JSX or createElement.
 *
 * @see {@link HorizontalLineProps}
 * @see {@link HorizontalLineStyle}
 */
export const HorizontalLine = definePrimitive<
  HorizontalLineProps,
  HorizontalLineStyle,
  HorizontalLineStyle,
  ResolvedHorizontalLineStyle
>(renderHorizontalLine, {
  resolveStyle: (style, context) => ({
    ...stripLayoutParticipation(style),
    y: resolveRequiredLength(
      style.y,
      context.percentageBasis.height,
      'y',
      context,
    ),
    x1: resolveLocalOffset(
      style.x1,
      context.percentageBasis.width,
      'x1',
      context,
    ),
    x2: resolveRequiredLength(
      style.x2 ?? context.allocation.width,
      context.percentageBasis.width,
      'x2',
      context,
    ),
  }) as ResolvedHorizontalLineStyle,
});
registerOpaqueStyleProperties(HorizontalLine, ['stroke', 'cursor']);
