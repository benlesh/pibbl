import type { SvgPathProps } from './svg-path.js';
import { drawSimpleStretchedTexture, resolveTexturePaint } from '../textures/texture-protocol.js';
import { getLayoutBox } from '../layout/context.js';
import { resolvePath } from '../geometry/resolve-path.js';
import { definePrimitive } from '../define-primitive.js';
import type {
  PibblEventFocusOptions,
  PibblEventHandlers,
  PibblEventParticipationOptions,
} from '../events/types.js';
import { RenderingContext2D } from '../types.js';
import type { PibblPhysics2DPropExtension } from '../types.js';
import { stripLayoutParticipation } from '../style/resolve-built-in.js';
import { registerOpaqueStyleProperties } from '../style/resolve-dispatch.js';
import type { PathStyle, ResolvedPathStyle } from '../style/types.js';
import type { StyleResolutionContext } from '../types.js';
import { isTransparent } from '../util/is-transparent.js';
import { wireCommonEvents } from '../util/wire-common-events.js';

/**
 * Authored inputs for Path, including the declared data and presentation options.
 *
 * @see {@link PibblEventHandlers}
 * @see {@link PibblEventParticipationOptions}
 * @see {@link PibblPhysics2DPropExtension}
 * @see {@link Path}
 * @see {@link SvgPathProps}
 */
export interface PathProps extends PibblEventHandlers, PibblEventFocusOptions, PibblEventParticipationOptions, PibblPhysics2DPropExtension {}

export function renderPath(
  props: PathProps,
  style: Readonly<ResolvedPathStyle>,
  ctx: RenderingContext2D,
  paintBounds = getLayoutBox(),
  directTextureFill = false,
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
    if (!directTextureFill || (stroke && strokeWidth && strokeWidth > 0) ||
      !drawSimpleStretchedTexture(fill, ctx, paintBounds)) {
      ctx.fillStyle = resolveTexturePaint(fill, ctx, paintBounds);
      ctx.fill(d);
    }
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
 *
 * @param props - Authored component inputs, supplied through JSX or createElement. See the linked
 * props and style types.
 * @throws When called directly; Pibbl mounts this component through JSX or createElement.
 *
 * @see {@link PathProps}
 * @see {@link PathStyle}
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
