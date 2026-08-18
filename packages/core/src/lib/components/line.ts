import { defineComp } from '../define-comp.js';
import {
  CRCBasicMouseEvents,
  RenderingContext2D,
  SystemStyle,
} from '../types.js';
import { stripLayoutParticipation } from '../style/resolve-built-in.js';
import { registerOpaqueStyleProperties } from '../style/resolve-dispatch.js';
import type {
  BoxStyle,
  CursorStyle,
  LayoutItemStyle,
  PaintStyle,
  ResolvedDrawingStyle,
} from '../style/types.js';
import { createLinePath } from '../util/create-line-path.js';
import { Path } from './path.js';

export interface LineProps extends CRCBasicMouseEvents {}

export interface LineStyle
  extends SystemStyle,
  BoxStyle,
  LayoutItemStyle,
  Omit<PaintStyle, 'fill'>,
  CursorStyle {
  coords: [number, number][];
  lineInteractionWidth?: number;
}

type ResolvedLineStyle = ResolvedDrawingStyle<LineStyle>;

export function Line(
  props: LineProps,
  style: Readonly<ResolvedLineStyle>,
  ctx: RenderingContext2D,
) {
  const {
    coords,
    stroke,
    strokeWidth,
    opacity,
    cursor,
    lineInteractionWidth,
  } = style;
  const linePath = createLinePath(coords);

  return Path(
    props,
    {
      d: linePath,
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
 * Creates a renderable Line component element.
 */
export const line = defineComp<
  LineProps,
  LineStyle,
  LineStyle,
  ResolvedLineStyle
>(Line, {
  resolveStyle: style =>
    stripLayoutParticipation(style) as ResolvedLineStyle,
});
registerOpaqueStyleProperties(Line, ['stroke', 'cursor']);
