import { definePrimitive } from '../define-primitive.js';
import { createSvgPath } from '../geometry/svg-path.js';
import { RenderingContext2D } from '../types.js';
import type { CRCPhysics2DPropExtension } from '../types.js';
import { stripLayoutParticipation } from '../style/resolve-built-in.js';
import { registerOpaqueStyleProperties } from '../style/resolve-dispatch.js';
import type { ResolvedSvgPathStyle, SvgPathStyle } from '../style/types.js';
import { renderPath } from './path.js';
import type { PathProps } from './path.js';

export interface SvgPathProps extends PathProps, CRCPhysics2DPropExtension {}

function renderSvgPath(
  props: SvgPathProps,
  style: Readonly<ResolvedSvgPathStyle>,
  ctx: RenderingContext2D,
) {
  const { d, ...pathStyle } = style;
  const svgPath = createSvgPath({ d });
  return renderPath(
    props,
    {
      ...pathStyle,
      d: svgPath,
    },
    ctx,
  );
}

/**
 * Describes an SVG-data path primitive for JSX or createElement authoring.
 */
export const SvgPath = definePrimitive<
  SvgPathProps,
  SvgPathStyle,
  SvgPathStyle,
  ResolvedSvgPathStyle
>(renderSvgPath, {
  resolveStyle: style =>
    stripLayoutParticipation(style) as ResolvedSvgPathStyle,
});
registerOpaqueStyleProperties(SvgPath, ['d', 'fill', 'stroke', 'cursor']);
