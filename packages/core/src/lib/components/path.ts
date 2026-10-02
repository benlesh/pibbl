<<<<<<< HEAD
import { resolveTexturePaint } from '../textures/texture.js';
import { getLayoutBox } from '../layout/context.js';
=======
>>>>>>> origin/main
import { resolvePath } from '../geometry/resolve-path.js';
import { definePrimitive } from '../define-primitive.js';
import type {
  CRCEventFocusOptions,
  CRCEventHandlers,
  CRCEventParticipationOptions,
} from '../events/types.js';
import { RenderingContext2D } from '../types.js';
import type { CRCPhysics2DPropExtension } from '../types.js';
import { stripLayoutParticipation } from '../style/resolve-built-in.js';
import { registerOpaqueStyleProperties } from '../style/resolve-dispatch.js';
import type { PathStyle, ResolvedPathStyle } from '../style/types.js';
import type { StyleResolutionContext } from '../types.js';
import { isTransparent } from '../util/is-transparent.js';
import { wireCommonEvents } from '../util/wire-common-events.js';

export interface PathProps extends CRCEventHandlers, CRCEventFocusOptions, CRCEventParticipationOptions, CRCPhysics2DPropExtension {}

export function renderPath(
  props: PathProps,
  style: Readonly<ResolvedPathStyle>,
  ctx: RenderingContext2D,
  paintBounds = getLayoutBox(),
) {
  const {
    d: input,
    fill,
    stroke,
    strokeWidth,
    opacity,
    cursor,
    lineInteractionWidth = strokeWidth ?? 0,
  } = style;

  const d = resolvePath(input);

  if (opacity !== undefined) {
    ctx.globalAlpha = ctx.globalAlpha * opacity;
  }

  if (fill && !isTransparent(fill)) {
    ctx.fillStyle = resolveTexturePaint(fill, ctx, paintBounds);
    ctx.fill(d);
  }

  if (stroke && strokeWidth && strokeWidth > 0) {
    ctx.strokeStyle = resolveTexturePaint(stroke, ctx, paintBounds);
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
