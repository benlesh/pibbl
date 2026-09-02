import { defineComp } from '../define-comp.js';
import { definePrimitive } from '../define-primitive.js';
import type {
  CRCEventFocusOptions,
  CRCEventHandlers,
} from '../events/types.js';
import {
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
import { renderPath } from './path.js';

export interface LineProps extends CRCEventHandlers, CRCEventFocusOptions {}

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

export function renderLine(
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
  const interactionWidth = lineInteractionWidth ?? strokeWidth ?? 0;

  return renderPath(
    {
      ...props,
      keyboardNavigationBounds: props.keyboardNavigationBounds ??
        lineBounds(coords, interactionWidth),
    },
    {
      d: linePath,
      stroke,
      strokeWidth,
      opacity,
      cursor,
      lineInteractionWidth: interactionWidth,
    },
    ctx,
  );
}

/**
 * Describes a polyline primitive for JSX or createElement authoring.
 */
export const Line = definePrimitive<
  LineProps,
  LineStyle,
  LineStyle,
  ResolvedLineStyle
>(renderLine, {
  resolveStyle: style =>
    stripLayoutParticipation(style) as ResolvedLineStyle,
});
registerOpaqueStyleProperties(Line, ['stroke', 'cursor']);

const renderLegacyLine = function Line(
  props: LineProps,
  style: Readonly<ResolvedLineStyle>,
  ctx: RenderingContext2D,
) {
  return renderLine(props, style, ctx);
};

/** @internal Temporary lowercase authoring adapter retained until Task 12. */
export const line = defineComp<
  LineProps,
  LineStyle,
  LineStyle,
  ResolvedLineStyle
>(renderLegacyLine, {
  resolveStyle: style =>
    stripLayoutParticipation(style) as ResolvedLineStyle,
});
registerOpaqueStyleProperties(renderLegacyLine, ['stroke', 'cursor']);

function lineBounds(
  coords: readonly [number, number][],
  interactionWidth: number,
) {
  if (coords.length === 0) return undefined;
  const halfWidth = interactionWidth / 2;
  const xs = coords.map(([x]) => x);
  const ys = coords.map(([, y]) => y);
  const left = Math.min(...xs) - halfWidth;
  const right = Math.max(...xs) + halfWidth;
  const top = Math.min(...ys) - halfWidth;
  const bottom = Math.max(...ys) + halfWidth;
  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}
