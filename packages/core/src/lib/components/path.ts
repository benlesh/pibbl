import { definePrimitive } from '../define-primitive.js';
import type {
  CRCEventFocusOptions,
  CRCEventHandlers,
} from '../events/types.js';
import { RenderingContext2D } from '../types.js';
import { stripLayoutParticipation } from '../style/resolve-built-in.js';
import { registerOpaqueStyleProperties } from '../style/resolve-dispatch.js';
import type { PathStyle, ResolvedPathStyle } from '../style/types.js';
import type { StyleResolutionContext } from '../types.js';
import { isTransparent } from '../util/is-transparent.js';
import { wireCommonEvents } from '../util/wire-common-events.js';

export interface PathProps extends CRCEventHandlers, CRCEventFocusOptions {}

export function renderPath(
  props: PathProps,
  style: Readonly<ResolvedPathStyle>,
  ctx: RenderingContext2D,
) {
  const {
    d,
    fill,
    stroke,
    strokeWidth,
    opacity,
    cursor,
    lineInteractionWidth = strokeWidth ?? 0,
  } = style;

  if (opacity !== undefined) {
    ctx.globalAlpha = ctx.globalAlpha * opacity;
  }

  if (fill && !isTransparent(fill)) {
    ctx.fillStyle = fill;
    ctx.fill(d);
  }

  if (stroke && strokeWidth && strokeWidth > 0) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth;
    ctx.stroke(d);
  }

  wireCommonEvents(props, d, !!fill, lineInteractionWidth, cursor);
}

/**
 * Describes a Canvas path primitive for JSX or createElement authoring.
 */
export const Path = definePrimitive<
  PathProps,
  PathStyle,
  PathStyle,
  ResolvedPathStyle
>(renderPath, {
  resolveStyle: resolvePathStyle,
});
registerOpaqueStyleProperties(Path, ['fill', 'stroke', 'cursor']);

function resolvePathStyle(
  style: Readonly<PathStyle>,
  _context: Readonly<StyleResolutionContext>,
): Readonly<ResolvedPathStyle> {
  return stripLayoutParticipation(style) as ResolvedPathStyle;
}
