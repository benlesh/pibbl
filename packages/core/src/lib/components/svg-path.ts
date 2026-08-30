import { defineComp } from '../define-comp.js';
import type { CRCEventHandlers } from '../events/types.js';
import { crcSvgPath } from '../hooks/crc-svg-path.js';
import { RenderingContext2D } from '../types.js';
import { stripLayoutParticipation } from '../style/resolve-built-in.js';
import { registerOpaqueStyleProperties } from '../style/resolve-dispatch.js';
import type { ResolvedSvgPathStyle, SvgPathStyle } from '../style/types.js';
import { Path } from './path.js';

export interface SvgPathProps extends CRCEventHandlers {}

function SvgPath(
  props: SvgPathProps,
  style: Readonly<ResolvedSvgPathStyle>,
  ctx: RenderingContext2D,
) {
  const { d, ...pathStyle } = style;
  const svgPath = crcSvgPath(d);
  return Path(
    props,
    {
      ...pathStyle,
      d: svgPath,
    },
    ctx,
  );
}

/**
 * Creates a renderable SvgPath component element.
 */
export const svgPath = defineComp<
  SvgPathProps,
  SvgPathStyle,
  SvgPathStyle,
  ResolvedSvgPathStyle
>(SvgPath, {
  resolveStyle: style =>
    stripLayoutParticipation(style) as ResolvedSvgPathStyle,
});
registerOpaqueStyleProperties(SvgPath, ['d', 'fill', 'stroke', 'cursor']);
